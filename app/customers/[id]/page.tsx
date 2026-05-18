'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Doctor, VisitRecord, ExtraClinicSlot, ClinicSlot, TodoItem } from '@/types';
import { getDoctors, saveDoctor, getVisits, saveVisit, deleteVisit, getHospitalsData, getProducts } from '@/lib/storage';
import { HOSPITALS } from '@/data/hospitals';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

const GRADE_STYLE: Record<string, string> = {
  S: 'bg-amber-100 text-amber-800',
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-gray-100 text-gray-600',
  D: 'bg-red-50 text-red-500',
  X: 'bg-violet-100 text-violet-700',
  Y: 'bg-slate-100 text-slate-500',
};

function monthlyAvg(monthlyData?: Record<string, number>): number {
  if (!monthlyData) return 0;
  const vals = Object.values(monthlyData).filter(v => v > 0);
  if (vals.length === 0) return 0;
  return parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
}

// 產生 2026-01 ~ 今月的月份清單
function getMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  let y = 2026, m = 1;
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}

const MONTHS = getMonths();

function MonthlyUsagePanel({ target, onChange }: {
  target: { productName: string; targetQty: number; unit: string; monthlyData?: Record<string, number> };
  onChange: (monthlyData: Record<string, number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const data = target.monthlyData ?? {};
  const avg = monthlyAvg(data);
  const rate = target.targetQty > 0 ? Math.round((avg / target.targetQty) * 100) : 0;

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      {/* 產品名稱 + 展開按鈕 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">{target.productName}</span>
        <button onClick={() => setOpen(v => !v)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            open ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
          }`}>
          {open ? '▲ 收起' : '▼ 輸入月用量'}
        </button>
      </div>

      {/* 進度條 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${rate >= 100 ? 'bg-green-500' : rate >= 60 ? 'bg-blue-500' : 'bg-orange-400'}`}
            style={{ width: `${Math.min(rate, 100)}%` }} />
        </div>
        <span className="text-xs text-gray-500 shrink-0">月均 {avg} / 目標 {target.targetQty} {target.unit}</span>
      </div>

      {/* 月份輸入 */}
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map(month => (
              <div key={month}>
                <label className="text-[10px] text-gray-400 block mb-0.5">{month}</label>
                <input type="number" placeholder="0"
                  value={data[month] || ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    const next = { ...data };
                    if (val === 0) delete next[month]; else next[month] = val;
                    onChange(next);
                  }}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitDraft, setVisitDraft] = useState({ date: new Date().toISOString().slice(0, 10), companions: '', content: '', nextAction: '' });
  const [hospitalClinicSlots, setHospitalClinicSlots] = useState<(ClinicSlot & { hospitalName: string })[]>([]);
  const [showClinicForm, setShowClinicForm] = useState(false);
  const [clinicDraft, setClinicDraft] = useState<ExtraClinicSlot>({ location: '', dayOfWeek: 1, session: '早' });
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [todoDraft, setTodoDraft] = useState({ title: '', currentStatus: '', nextAction: '' });
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ date: '', companions: '', content: '', nextAction: '' });
  const [priceMap, setPriceMap] = useState<Record<string, { base: number; byHosp: Record<string, number> }>>({});

  useEffect(() => {
    const doc = getDoctors().find(d => d.id === id);
    if (!doc) { router.push('/customers'); return; }
    const fullDoc = { ...doc, productTargets: doc.productTargets.map(t => ({ ...t, monthlyData: t.monthlyData ?? {} })), extraClinicSlots: doc.extraClinicSlots ?? [] };
    setDoctor(fullDoc);
    setVisits(getVisits().filter(v => v.doctorId === id).sort((a, b) => b.date.localeCompare(a.date)));
    // 從已抓的門診表比對醫師姓名
    // 建立產品單價 map
    const prods = getProducts();
    const pm: Record<string, { base: number; byHosp: Record<string, number> }> = {};
    for (const p of prods) {
      const v = p.variants[0];
      if (v) pm[p.id] = { base: v.hospitalPrice ?? 0, byHosp: v.hospitalPrices ?? {} };
    }
    setPriceMap(pm);

    const hospData = getHospitalsData();
    const matched: (ClinicSlot & { hospitalName: string })[] = [];
    for (const h of hospData) {
      for (const slot of h.clinics) {
        if (slot.doctor === doc.name) {
          matched.push({ ...slot, hospitalName: h.shortName });
        }
      }
    }
    matched.sort((a, b) => a.dayOfWeek - b.dayOfWeek || ['早','午','晚'].indexOf(a.session) - ['早','午','晚'].indexOf(b.session));
    setHospitalClinicSlots(matched);
  }, [id]);

  const updateMonthlyData = (i: number, monthlyData: Record<string, number>) => {
    if (!doctor) return;
    const targets = doctor.productTargets.map((t, j) => j === i ? { ...t, monthlyData } : t);
    const updated = { ...doctor, productTargets: targets };
    setDoctor(updated);
    saveDoctor(updated);
  };

  const addVisit = () => {
    if (!visitDraft.content.trim()) { alert('請填寫拜訪內容'); return; }
    const v: VisitRecord = { id: uid(), doctorId: id, ...visitDraft };
    saveVisit(v);
    setVisits(prev => [v, ...prev]);
    setVisitDraft({ date: new Date().toISOString().slice(0, 10), companions: '', content: '', nextAction: '' });
    setShowVisitForm(false);
  };

  const addClinicSlot = () => {
    if (!doctor || !clinicDraft.location.trim()) { alert('請填寫診所名稱'); return; }
    const updated = { ...doctor, extraClinicSlots: [...(doctor.extraClinicSlots ?? []), clinicDraft] };
    setDoctor(updated);
    saveDoctor(updated);
    setClinicDraft({ location: '', dayOfWeek: 1, session: '早' });
    setShowClinicForm(false);
  };

  const removeClinicSlot = (i: number) => {
    if (!doctor) return;
    const slots = (doctor.extraClinicSlots ?? []).filter((_, j) => j !== i);
    const updated = { ...doctor, extraClinicSlots: slots };
    setDoctor(updated);
    saveDoctor(updated);
  };

  const addTodo = () => {
    if (!doctor || !todoDraft.title.trim()) { alert('請填寫待辦事項'); return; }
    const item: TodoItem = { id: uid(), ...todoDraft, createdAt: new Date().toISOString() };
    const updated = { ...doctor, todos: [...(doctor.todos ?? []), item] };
    setDoctor(updated);
    saveDoctor(updated);
    setTodoDraft({ title: '', currentStatus: '', nextAction: '' });
    setShowTodoForm(false);
  };

  const updateTodo = (id: string, field: keyof TodoItem, value: string) => {
    if (!doctor) return;
    const todos = (doctor.todos ?? []).map(t => t.id === id ? { ...t, [field]: value } : t);
    const updated = { ...doctor, todos };
    setDoctor(updated);
    saveDoctor(updated);
  };

  const removeTodo = (id: string) => {
    if (!doctor) return;
    const updated = { ...doctor, todos: (doctor.todos ?? []).filter(t => t.id !== id) };
    setDoctor(updated);
    saveDoctor(updated);
  };

  const startEditVisit = (v: VisitRecord) => {
    setEditingVisitId(v.id);
    setEditDraft({ date: v.date, companions: v.companions, content: v.content, nextAction: v.nextAction });
  };

  const saveEditVisit = () => {
    if (!editingVisitId || !editDraft.content.trim()) { alert('請填寫拜訪內容'); return; }
    const original = visits.find(v => v.id === editingVisitId);
    if (!original) return;
    const updated = { ...original, ...editDraft };
    saveVisit(updated);
    setVisits(prev => prev.map(v => v.id === editingVisitId ? updated : v));
    setEditingVisitId(null);
  };

  const removeVisit = (vid: string) => {
    if (!confirm('刪除這筆拜訪紀錄？')) return;
    deleteVisit(vid);
    setVisits(prev => prev.filter(v => v.id !== vid));
  };

  if (!doctor) return null;

  const avgTotal = doctor.productTargets.reduce((s, t) => s + monthlyAvg(t.monthlyData), 0);
  const targetTotal = doctor.productTargets.reduce((s, t) => s + t.targetQty, 0);
  const rate = targetTotal > 0 ? Math.round((avgTotal / targetTotal) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/customers" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">{doctor.name}</h1>
            {doctor.title && <span className="text-sm text-gray-400">{doctor.title}</span>}
            {doctor.grade && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_STYLE[doctor.grade] ?? ''}`}>
                {doctor.grade}
              </span>
            )}
          </div>
          <Link href={`/customers/${id}/edit`} className="text-sm text-blue-600 hover:underline">編輯</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* 基本資料 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div><span className="text-gray-400">醫院</span><span className="ml-2 text-gray-800">
              {(doctor.hospitalIds ?? [doctor.hospitalId]).filter(Boolean)
                .map(hid => HOSPITALS.find(h => h.id === hid)?.name ?? hid).join('、') || '—'}
            </span></div>
            <div><span className="text-gray-400">科別</span><span className="ml-2 text-gray-800">{doctor.department || '—'}</span></div>
            <div><span className="text-gray-400">電話</span><span className="ml-2 text-gray-800">{doctor.phone || '—'}</span></div>
            <div><span className="text-gray-400">月投資</span><span className="ml-2 text-gray-800">{doctor.monthlyInvestment ? `NT$${doctor.monthlyInvestment.toLocaleString()}` : '—'}</span></div>
          </div>
          {doctor.habits && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">手術習慣 / 偏好</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{doctor.habits}</p></div>}
          {doctor.visitHabit && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">拜訪習慣模式</p><p className="text-sm text-blue-700 whitespace-pre-wrap font-medium">{doctor.visitHabit}</p></div>}
          {doctor.attitude && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">對產品的態度</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{doctor.attitude}</p></div>}
          {doctor.visitPlan && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">拜訪目標 / 策略</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{doctor.visitPlan}</p></div>}
        </div>

        {/* 門診時段 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">門診時段</h2>
            <button onClick={() => setShowClinicForm(v => !v)} className="text-xs text-blue-600 hover:underline">
              {showClinicForm ? '取消' : '＋ 新增院外門診'}
            </button>
          </div>

          {/* 新增院外門診表單 */}
          {showClinicForm && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">診所名稱</label>
                <input value={clinicDraft.location} onChange={e => setClinicDraft(d => ({ ...d, location: e.target.value }))}
                  placeholder="例：津久診所"
                  className="px-2.5 py-1.5 border border-gray-200 rounded text-sm w-36 bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">星期</label>
                <select value={clinicDraft.dayOfWeek} onChange={e => setClinicDraft(d => ({ ...d, dayOfWeek: Number(e.target.value) }))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm bg-white focus:outline-none">
                  {['日','一','二','三','四','五','六'].map((d, i) => <option key={i} value={i}>週{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">時段</label>
                <select value={clinicDraft.session} onChange={e => setClinicDraft(d => ({ ...d, session: e.target.value as '早'|'午'|'晚' }))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm bg-white focus:outline-none">
                  {['早','午','晚'].map(s => <option key={s} value={s}>{s}診</option>)}
                </select>
              </div>
              <button onClick={addClinicSlot} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">新增</button>
            </div>
          )}

          {/* 醫院門診（從門診表自動比對） */}
          {hospitalClinicSlots.length === 0 && (doctor.extraClinicSlots ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">尚無門診資料，請先更新醫院門診表或手動新增</p>
          ) : (
            <div className="space-y-2">
              {hospitalClinicSlots.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">從門診表自動比對</p>
                  <div className="flex flex-wrap gap-1.5">
                    {hospitalClinicSlots.map((slot, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                        {slot.hospitalName} 週{['日','一','二','三','四','五','六'][slot.dayOfWeek]}{slot.session}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(doctor.extraClinicSlots ?? []).length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5 mt-3">院外 / 手動新增</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(doctor.extraClinicSlots ?? []).map((slot, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-violet-50 text-violet-700 rounded-full flex items-center gap-1">
                        {slot.location} 週{['日','一','二','三','四','五','六'][slot.dayOfWeek]}{slot.session}
                        <button onClick={() => removeClinicSlot(i)} className="text-violet-300 hover:text-red-400 ml-0.5">✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 產品目標 & 月用量 */}
        {doctor.productTargets.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">產品目標達成</h2>
              <div className="flex items-center gap-4">
                {(() => {
                  const hospIds = doctor.hospitalIds ?? (doctor.hospitalId ? [doctor.hospitalId] : []);
                  const totalRev = doctor.productTargets.reduce((s, t) => {
                    const vals = Object.values(t.monthlyData ?? {}).filter(v => v > 0);
                    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                    if (!avg) return s;
                    const pm = priceMap[t.productId];
                    if (!pm) return s;
                    const price = hospIds.map(h => pm.byHosp[h]).find(Boolean) ?? pm.base;
                    return s + Math.round(avg * price);
                  }, 0);
                  return totalRev > 0 ? (
                    <div className="text-right">
                      <span className="text-xs text-gray-400">月均業績</span>
                      <div className="text-base font-bold text-blue-600">
                        NT${totalRev.toLocaleString()}
                      </div>
                    </div>
                  ) : null;
                })()}
                {rate !== null && (
                  <span className={`text-lg font-bold ${rate >= 100 ? 'text-green-600' : rate >= 60 ? 'text-blue-600' : 'text-orange-500'}`}>
                    {rate}%
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {doctor.productTargets.map((t, i) => (
                <MonthlyUsagePanel key={t.productId || i} target={t}
                  onChange={data => updateMonthlyData(i, data)} />
              ))}
            </div>
          </div>
        )}

        {/* 待辦事項 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">待辦事項（{(doctor.todos ?? []).length}）</h2>
            <button onClick={() => setShowTodoForm(v => !v)} className="text-xs text-blue-600 hover:underline">
              {showTodoForm ? '取消' : '＋ 新增'}
            </button>
          </div>

          {showTodoForm && (
            <div className="mb-4 p-4 bg-amber-50 rounded-lg space-y-3">
              <div>
                <label className="text-xs text-gray-500">待辦事項</label>
                <input value={todoDraft.title} onChange={e => setTodoDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="例：提送試用申請、跟進審核進度..."
                  className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Current Status（目前狀態）</label>
                <textarea value={todoDraft.currentStatus} onChange={e => setTodoDraft(d => ({ ...d, currentStatus: e.target.value }))}
                  placeholder="目前進行到哪了..." rows={2}
                  className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Next Action（下一步）</label>
                <textarea value={todoDraft.nextAction} onChange={e => setTodoDraft(d => ({ ...d, nextAction: e.target.value }))}
                  placeholder="接下來要做什麼..." rows={2}
                  className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none resize-none" />
              </div>
              <button onClick={addTodo} className="w-full py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600">新增</button>
            </div>
          )}

          {(doctor.todos ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">尚無待辦事項</p>
          ) : (
            <div className="space-y-3">
              {(doctor.todos ?? []).map(t => (
                <div key={t.id} className="border border-amber-100 rounded-lg p-3 bg-amber-50/50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <input value={t.title}
                      onChange={e => updateTodo(t.id, 'title', e.target.value)}
                      className="flex-1 text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-amber-400 pb-0.5" />
                    <button onClick={() => removeTodo(t.id)} className="text-xs text-gray-300 hover:text-red-400 shrink-0">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Current Status</p>
                      <textarea value={t.currentStatus}
                        onChange={e => updateTodo(t.id, 'currentStatus', e.target.value)}
                        rows={2} placeholder="目前狀態..."
                        className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Next Action</p>
                      <textarea value={t.nextAction}
                        onChange={e => updateTodo(t.id, 'nextAction', e.target.value)}
                        rows={2} placeholder="下一步行動..."
                        className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-amber-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 拜訪紀錄 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">拜訪紀錄（{visits.length}）</h2>
            <button onClick={() => setShowVisitForm(v => !v)} className="text-xs text-blue-600 hover:underline">
              {showVisitForm ? '取消' : '＋ 新增拜訪'}
            </button>
          </div>

          {showVisitForm && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">日期</label>
                  <input type="date" value={visitDraft.date} onChange={e => setVisitDraft(d => ({ ...d, date: e.target.value }))}
                    className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">同行人員</label>
                  <input value={visitDraft.companions} onChange={e => setVisitDraft(d => ({ ...d, companions: e.target.value }))}
                    placeholder="如：主管、同事姓名"
                    className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">拜訪內容</label>
                <textarea value={visitDraft.content} onChange={e => setVisitDraft(d => ({ ...d, content: e.target.value }))}
                  placeholder="今天談了什麼..." rows={3}
                  className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500">下一步行動</label>
                <input value={visitDraft.nextAction} onChange={e => setVisitDraft(d => ({ ...d, nextAction: e.target.value }))}
                  placeholder="下次要做什麼..."
                  className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
              </div>
              <button onClick={addVisit} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">儲存</button>
            </div>
          )}

          {visits.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">還沒有拜訪紀錄</p>
          ) : (
            <div className="space-y-3">
              {visits.map(v => {
                const isEditing = editingVisitId === v.id;
                return (
                  <div key={v.id} className={`border rounded-lg p-3 ${isEditing ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}>
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500">日期</label>
                            <input type="date" value={editDraft.date} onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))}
                              className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">同行人員</label>
                            <input value={editDraft.companions} onChange={e => setEditDraft(d => ({ ...d, companions: e.target.value }))}
                              placeholder="如：主管、同事姓名"
                              className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">拜訪內容</label>
                          <textarea value={editDraft.content} onChange={e => setEditDraft(d => ({ ...d, content: e.target.value }))}
                            rows={3} className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none resize-none" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">下一步行動</label>
                          <input value={editDraft.nextAction} onChange={e => setEditDraft(d => ({ ...d, nextAction: e.target.value }))}
                            placeholder="下次要做什麼..."
                            className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEditVisit} className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">儲存</button>
                          <button onClick={() => setEditingVisitId(null)} className="px-4 py-1.5 border border-gray-200 text-sm rounded-lg text-gray-500 hover:border-gray-400">取消</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">{v.date}</span>
                            {v.companions && (
                              <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                同行：{v.companions}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => startEditVisit(v)} className="text-xs text-gray-400 hover:text-blue-500">編輯</button>
                            <button onClick={() => removeVisit(v.id)} className="text-xs text-gray-300 hover:text-red-400">✕</button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{v.content}</p>
                        {v.nextAction && <p className="text-xs text-blue-600 mt-1.5">→ {v.nextAction}</p>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
