'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product } from '@/types';
import { getProducts, saveProduct } from '@/lib/storage';
import { HOSPITALS } from '@/data/hospitals';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', modelNumber: '', hospitalId: '',
    hospitalPrice: '', patientPrice: '', unit: '個', notes: '',
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const p = getProducts().find(x => x.id === id);
    if (!p) { router.push('/products'); return; }
    setForm({
      name: p.name,
      modelNumber: p.modelNumber,
      hospitalId: p.hospitalId,
      hospitalPrice: p.hospitalPrice ? String(p.hospitalPrice) : '',
      patientPrice: p.patientPrice ? String(p.patientPrice) : '',
      unit: p.unit,
      notes: p.notes,
    });
    setLoaded(true);
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) { alert('請輸入產品名稱'); return; }
    const hospital = HOSPITALS.find(h => h.id === form.hospitalId);
    const p: Product = {
      id,
      name: form.name.trim(),
      modelNumber: form.modelNumber.trim(),
      hospitalId: form.hospitalId,
      hospitalName: hospital?.name ?? '',
      hospitalPrice: parseFloat(form.hospitalPrice) || 0,
      patientPrice: parseFloat(form.patientPrice) || 0,
      unit: form.unit,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    saveProduct(p);
    router.push('/products');
  };

  const hospitalPrice = parseFloat(form.hospitalPrice) || 0;
  const patientPrice = parseFloat(form.patientPrice) || 0;
  const markup = hospitalPrice > 0 ? Math.round(((patientPrice - hospitalPrice) / hospitalPrice) * 100) : null;

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/products" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">編輯產品</h1>
          </div>
          <button onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">儲存</button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500">產品名稱 *</label>
            <input className="input mt-1" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">型號</label>
            <input className="input mt-1" value={form.modelNumber} onChange={e => set('modelNumber', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">所屬醫院</label>
            <select className="input mt-1" value={form.hospitalId} onChange={e => set('hospitalId', e.target.value)}>
              <option value="">請選擇（可留空）</option>
              {HOSPITALS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">醫院售價（NT$）</label>
              <input className="input mt-1" type="number" value={form.hospitalPrice}
                onChange={e => set('hospitalPrice', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">病人售價（NT$）</label>
              <input className="input mt-1" type="number" value={form.patientPrice}
                onChange={e => set('patientPrice', e.target.value)} />
            </div>
          </div>
          {markup !== null && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              醫院加成率：<span className={`font-bold ${markup >= 0 ? 'text-green-600' : 'text-red-500'}`}>+{markup}%</span>
              <span className="text-gray-400 text-xs ml-2">（差價 NT${(patientPrice - hospitalPrice).toLocaleString()}）</span>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500">單位</label>
            <input className="input mt-1 w-24" value={form.unit} onChange={e => set('unit', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">備注</label>
            <textarea className="input mt-1 h-20 resize-none" value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          outline: none;
          display: block;
        }
        .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      `}</style>
    </div>
  );
}
