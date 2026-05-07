'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Doctor, ProductTarget } from '@/types';
import { getDoctors, saveDoctor } from '@/lib/storage';
import { HOSPITALS } from '@/data/hospitals';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', hospitalId: '', department: '', title: '', phone: '',
    habits: '', visitHabit: '', attitude: '', visitPlan: '', monthlyInvestment: '',
  });
  const [targets, setTargets] = useState<ProductTarget[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const doc = getDoctors().find(d => d.id === id);
    if (!doc) { router.push('/customers'); return; }
    setForm({
      name: doc.name,
      hospitalId: doc.hospitalId,
      department: doc.department,
      title: doc.title,
      phone: doc.phone,
      habits: doc.habits,
      visitHabit: doc.visitHabit ?? '',
      attitude: doc.attitude,
      visitPlan: doc.visitPlan,
      monthlyInvestment: doc.monthlyInvestment ? String(doc.monthlyInvestment) : '',
    });
    setTargets(doc.productTargets);
    setLoaded(true);
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const addTarget = () => setTargets(t => [...t, { productId: uid(), productName: '', targetQty: 0, actualQty: 0, unit: '個' }]);
  const updateTarget = (i: number, k: keyof ProductTarget, v: string | number) =>
    setTargets(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const removeTarget = (i: number) => setTargets(t => t.filter((_, j) => j !== i));

  const handleSave = () => {
    if (!form.name.trim()) { alert('請輸入醫師姓名'); return; }
    const hospital = HOSPITALS.find(h => h.id === form.hospitalId);
    const doc: Doctor = {
      id,
      name: form.name.trim(),
      hospitalId: form.hospitalId,
      hospitalName: hospital?.name ?? form.hospitalId,
      department: form.department,
      title: form.title,
      phone: form.phone,
      habits: form.habits,
      visitHabit: form.visitHabit,
      attitude: form.attitude,
      visitPlan: form.visitPlan,
      productTargets: targets,
      monthlyInvestment: parseFloat(form.monthlyInvestment) || 0,
      createdAt: new Date().toISOString(),
    };
    saveDoctor(doc);
    router.push(`/customers/${id}`);
  };

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/customers/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">編輯客戶</h1>
          </div>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            儲存
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* 基本資料 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">基本資料</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500">醫師姓名 *</label>
              <input className="input-field mt-1" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">醫院</label>
              <select className="input-field mt-1" value={form.hospitalId} onChange={e => set('hospitalId', e.target.value)}>
                <option value="">請選擇</option>
                {HOSPITALS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">科別</label>
              <input className="input-field mt-1" value={form.department} onChange={e => set('department', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">職稱</label>
              <input className="input-field mt-1" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">電話</label>
              <input className="input-field mt-1" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
        </section>

        {/* 客戶洞察 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">客戶洞察</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">手術習慣 / 個人偏好</label>
              <textarea className="input-field mt-1 h-20" value={form.habits} onChange={e => set('habits', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">拜訪習慣模式</label>
              <textarea className="input-field mt-1 h-20" placeholder="例：每週四早上門診前，可以買早餐過去給他..." value={form.visitHabit} onChange={e => set('visitHabit', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">對產品的態度</label>
              <textarea className="input-field mt-1 h-20" value={form.attitude} onChange={e => set('attitude', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">拜訪目標 / 策略</label>
              <textarea className="input-field mt-1 h-20" value={form.visitPlan} onChange={e => set('visitPlan', e.target.value)} />
            </div>
          </div>
        </section>

        {/* 產品目標 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">產品目標</h2>
            <button onClick={addTarget} className="text-xs text-blue-600 hover:underline">＋ 新增產品</button>
          </div>
          {targets.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">點「新增產品」設定目標用量</p>
          ) : (
            <div className="space-y-3">
              {targets.map((t, i) => (
                <div key={t.productId} className="grid grid-cols-4 gap-2 items-end">
                  <div className="col-span-1">
                    <label className="text-xs text-gray-500">產品名稱</label>
                    <input className="input-field mt-1" value={t.productName}
                      onChange={e => updateTarget(i, 'productName', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">目標月用量</label>
                    <input className="input-field mt-1" type="number" value={t.targetQty}
                      onChange={e => updateTarget(i, 'targetQty', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">實際用量</label>
                    <input className="input-field mt-1" type="number" value={t.actualQty}
                      onChange={e => updateTarget(i, 'actualQty', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">單位</label>
                      <input className="input-field mt-1" value={t.unit}
                        onChange={e => updateTarget(i, 'unit', e.target.value)} />
                    </div>
                    <button onClick={() => removeTarget(i)} className="text-red-400 hover:text-red-600 pb-2 text-sm">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 投資追蹤 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">投資追蹤</h2>
          <div>
            <label className="text-xs text-gray-500">每月平均投資（NT$）</label>
            <input className="input-field mt-1 w-48" type="number" value={form.monthlyInvestment}
              onChange={e => set('monthlyInvestment', e.target.value)} />
          </div>
        </section>
      </div>

      <style jsx>{`
        .input-field {
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
        .input-field:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
        textarea.input-field { resize: vertical; }
      `}</style>
    </div>
  );
}
