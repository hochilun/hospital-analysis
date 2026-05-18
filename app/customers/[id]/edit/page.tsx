'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Doctor, DoctorGrade, Product, ProductTarget, ProductCategory, ExtraClinicSlot } from '@/types';
import { getDoctors, saveDoctor, getProducts } from '@/lib/storage';
import { HOSPITALS, DEPT_LABEL } from '@/data/hospitals';

const DEPT_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(DEPT_LABEL).map(([code, label]) => [label, code])
);
const normDept = (dept: string) => DEPT_CODE[dept] ?? dept;

const GRADES: { value: DoctorGrade; label: string; color: string }[] = [
  { value: 'S', label: 'S', color: 'bg-amber-500 text-white' },
  { value: 'A', label: 'A', color: 'bg-green-500 text-white' },
  { value: 'B', label: 'B', color: 'bg-blue-500 text-white' },
  { value: 'C', label: 'C', color: 'bg-gray-400 text-white' },
  { value: 'D', label: 'D', color: 'bg-red-400 text-white' },
  { value: 'X', label: 'X', color: 'bg-violet-500 text-white' },
  { value: 'Y', label: 'Y', color: 'bg-slate-400 text-white' },
];

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', grade: '' as DoctorGrade, department: '', title: '', phone: '',
    habits: '', visitHabit: '', attitude: '', visitPlan: '', monthlyInvestment: '',
  });
  const [hospitalIds, setHospitalIds] = useState<string[]>([]);
  const [targets, setTargets] = useState<ProductTarget[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [extraClinicSlots, setExtraClinicSlots] = useState<ExtraClinicSlot[]>([]);
  const [loaded, setLoaded] = useState(false);

  const toggleHospital = (hid: string) =>
    setHospitalIds(prev => prev.includes(hid) ? prev.filter(x => x !== hid) : [...prev, hid]);

  useEffect(() => {
    setProducts(getProducts());
    const doc = getDoctors().find(d => d.id === id);
    if (!doc) { router.push('/customers'); return; }
    setHospitalIds(doc.hospitalIds ?? (doc.hospitalId ? [doc.hospitalId] : []));
    setForm({
      name: doc.name,
      grade: doc.grade ?? '',
      department: normDept(doc.department),
      title: doc.title,
      phone: doc.phone,
      habits: doc.habits,
      visitHabit: doc.visitHabit ?? '',
      attitude: doc.attitude,
      visitPlan: doc.visitPlan,
      monthlyInvestment: doc.monthlyInvestment ? String(doc.monthlyInvestment) : '',
    });
    setTargets(doc.productTargets.map(t => ({ ...t, monthlyData: t.monthlyData ?? {} })));
    setExtraClinicSlots(doc.extraClinicSlots ?? []);
    setLoaded(true);
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const addTarget = () => setTargets(t => [...t, { productId: '', productName: '', targetQty: 0, currentQty: 0, unit: '個', monthlyData: {} }]);
  const selectProduct = (i: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    setTargets(t => t.map((x, j) => j === i ? {
      ...x,
      productId: prod.id,
      productName: prod.name,
      category: (prod.category ?? '') as ProductCategory,
      unit: prod.variants[0]?.unit ?? '個',
    } : x));
  };

  // 取某產品在此客戶醫院的單價（採購價）
  const getUnitPrice = (productId: string): number => {
    const prod = products.find(p => p.id === productId);
    if (!prod || !prod.variants.length) return 0;
    const v = prod.variants[0];
    for (const hid of hospitalIds) {
      if (v.hospitalPrices?.[hid]) return v.hospitalPrices[hid];
    }
    return v.hospitalPrice ?? 0;
  };
  const updateTarget = (i: number, k: keyof ProductTarget, v: string | number) =>
    setTargets(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const removeTarget = (i: number) => setTargets(t => t.filter((_, j) => j !== i));

  const handleSave = () => {
    if (!form.name.trim()) { alert('請輸入醫師姓名'); return; }
    const primaryId = hospitalIds[0] ?? '';
    const hospital = HOSPITALS.find(h => h.id === primaryId);
    const doc: Doctor = {
      id,
      name: form.name.trim(),
      grade: form.grade,
      hospitalId: primaryId,
      hospitalName: hospital?.name ?? '',
      hospitalIds,
      department: normDept(form.department),
      title: form.title,
      phone: form.phone,
      habits: form.habits,
      visitHabit: form.visitHabit,
      attitude: form.attitude,
      visitPlan: form.visitPlan,
      productTargets: targets,
      monthlyInvestment: parseFloat(form.monthlyInvestment) || 0,
      extraClinicSlots,
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
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-2">醫院（可複選）</label>
              <div className="flex flex-wrap gap-2">
                {HOSPITALS.map(h => (
                  <button key={h.id} type="button" onClick={() => toggleHospital(h.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      hospitalIds.includes(h.id)
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}>
                    {h.shortName}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">科別</label>
              <select className="input-field mt-1" value={form.department} onChange={e => set('department', e.target.value)}>
                <option value="">請選擇...</option>
                {Object.entries(DEPT_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">職稱</label>
              <input className="input-field mt-1" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">電話</label>
              <input className="input-field mt-1" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-2">客戶等級</label>
              <div className="flex gap-2">
                {GRADES.map(g => (
                  <button key={g.value} type="button"
                    onClick={() => set('grade', form.grade === g.value ? '' : g.value)}
                    className={`w-10 h-10 rounded-lg text-sm font-bold border-2 transition-all ${
                      form.grade === g.value ? `${g.color} border-transparent` : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
                    }`}>
                    {g.label}
                  </button>
                ))}
                <span className="text-xs text-gray-400 self-center ml-1">
                  {form.grade === 'S' ? '最忠實 — 用量幾乎全給我們' :
                   form.grade === 'A' ? '穩定 — 每月固定用量' :
                   form.grade === 'B' ? '分用 — 跟其他廠商共享' :
                   form.grade === 'C' ? '待開發 — 還需要花時間' :
                   form.grade === 'D' ? '暫不觸碰' :
                   form.grade === 'X' ? '護理師' :
                   form.grade === 'Y' ? '行政人員／秘書' : '未設定'}
                </span>
              </div>
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
              <textarea className="input-field mt-1 h-20" value={form.visitHabit} onChange={e => set('visitHabit', e.target.value)} />
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
            <div className="space-y-4">
              {targets.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div>
                    <label className="text-xs text-gray-500">產品</label>
                    <select className="input-field mt-1" value={t.productId}
                      onChange={e => selectProduct(i, e.target.value)}>
                      <option value="">請選擇產品...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      {t.productId && !products.find(p => p.id === t.productId) && (
                        <option value={t.productId}>{t.productName}</option>
                      )}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-gray-500">目標月用量</label>
                    <input className="input-field mt-1" type="number" placeholder="0"
                      value={t.targetQty || ''}
                      onChange={e => updateTarget(i, 'targetQty', parseFloat(e.target.value) || 0)} />
                  </div>
                  <button onClick={() => removeTarget(i)} className="text-red-300 hover:text-red-500 pb-2 text-sm">✕</button>
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
          width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb;
          border-radius: 0.5rem; font-size: 0.875rem; color: #111827;
          background: white; outline: none; display: block;
        }
        .input-field:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
        textarea.input-field { resize: vertical; }
      `}</style>
    </div>
  );
}
