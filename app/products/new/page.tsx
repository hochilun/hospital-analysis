'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product, ProductVariant } from '@/types';
import { saveProduct } from '@/lib/storage';
import { HOSPITALS } from '@/data/hospitals';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function emptyVariant(): ProductVariant {
  return { id: uid(), modelNumber: '', description: '', hospitalPrice: 0, patientPrice: 0, unit: '個' };
}

function VariantRow({ v, onChange, onRemove, showRemove }: {
  v: ProductVariant;
  onChange: (k: keyof ProductVariant, val: string | number) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const markup = v.hospitalPrice > 0
    ? Math.round(((v.patientPrice - v.hospitalPrice) / v.hospitalPrice) * 100) : null;
  return (
    <div className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">型號</label>
          <input className="input mt-1" placeholder="例：ECS-1G" value={v.modelNumber}
            onChange={e => onChange('modelNumber', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">描述</label>
          <input className="input mt-1" placeholder="例：1克裝" value={v.description}
            onChange={e => onChange('description', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">醫院售價（NT$）</label>
          <input className="input mt-1" type="number" placeholder="0" value={v.hospitalPrice || ''}
            onChange={e => onChange('hospitalPrice', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">病人售價（NT$）</label>
          <input className="input mt-1" type="number" placeholder="0" value={v.patientPrice || ''}
            onChange={e => onChange('patientPrice', parseFloat(e.target.value) || 0)} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-24">
          <label className="text-xs text-gray-500">單位</label>
          <input className="input mt-1" placeholder="個" value={v.unit}
            onChange={e => onChange('unit', e.target.value)} />
        </div>
        {markup !== null && (
          <div className="text-xs text-gray-600 mt-4">
            加成 <span className={`font-bold ${markup >= 0 ? 'text-green-600' : 'text-red-500'}`}>+{markup}%</span>
            <span className="text-gray-400 ml-1">（差 NT${(v.patientPrice - v.hospitalPrice).toLocaleString()}）</span>
          </div>
        )}
        {showRemove && (
          <button onClick={onRemove} className="mt-4 ml-auto text-xs text-red-400 hover:text-red-600">✕ 移除</button>
        )}
      </div>
    </div>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [notes, setNotes] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([emptyVariant()]);

  const updateVariant = (i: number, k: keyof ProductVariant, v: string | number) =>
    setVariants(prev => prev.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const addVariant = () => setVariants(prev => [...prev, emptyVariant()]);
  const removeVariant = (i: number) => setVariants(prev => prev.filter((_, j) => j !== i));

  const handleSave = () => {
    if (!name.trim()) { alert('請輸入產品名稱'); return; }
    if (variants.every(v => !v.modelNumber.trim())) { alert('請至少填寫一個型號'); return; }
    const hospital = HOSPITALS.find(h => h.id === hospitalId);
    const p: Product = {
      id: uid(),
      name: name.trim(),
      nameEn: nameEn.trim() || undefined,
      licenseNumber: licenseNumber.trim() || undefined,
      hospitalId,
      hospitalName: hospital?.name ?? '',
      variants: variants.filter(v => v.modelNumber.trim()),
      notes,
      createdAt: new Date().toISOString(),
    };
    saveProduct(p);
    router.push('/products');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/products" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">新增產品</h1>
          </div>
          <button onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">儲存</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        {/* 基本資料 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500">產品名稱（中文）*</label>
            <input className="input mt-1" placeholder="例：止血粉" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">英文品名</label>
            <input className="input mt-1" placeholder="e.g. Arista AH Absorbable Hemostatic Particles" value={nameEn} onChange={e => setNameEn(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">許可證字號</label>
            <input className="input mt-1" placeholder="衛部醫器輸字第 XXXXXX 號" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">所屬醫院</label>
            <select className="input mt-1" value={hospitalId} onChange={e => setHospitalId(e.target.value)}>
              <option value="">請選擇（可留空）</option>
              {HOSPITALS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">備注</label>
            <textarea className="input mt-1 h-16 resize-none" placeholder="產品說明..." value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* 型號列表 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">型號 / 規格</h2>
            <button onClick={addVariant} className="text-xs text-blue-600 hover:underline">＋ 新增型號</button>
          </div>
          <div className="space-y-3">
            {variants.map((v, i) => (
              <VariantRow key={v.id} v={v}
                onChange={(k, val) => updateVariant(i, k, val)}
                onRemove={() => removeVariant(i)}
                showRemove={variants.length > 1}
              />
            ))}
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
          color: #111827;
          background: white;
          outline: none;
          display: block;
        }
        .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      `}</style>
    </div>
  );
}
