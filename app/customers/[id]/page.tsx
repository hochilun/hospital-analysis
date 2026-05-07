'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Doctor, VisitRecord } from '@/types';
import { getDoctors, saveDoctor, getVisits, saveVisit, deleteVisit } from '@/lib/storage';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitDraft, setVisitDraft] = useState({ date: new Date().toISOString().slice(0, 10), content: '', nextAction: '' });

  useEffect(() => {
    const doc = getDoctors().find(d => d.id === id);
    if (!doc) { router.push('/customers'); return; }
    setDoctor(doc);
    setVisits(getVisits().filter(v => v.doctorId === id).sort((a, b) => b.date.localeCompare(a.date)));
  }, [id]);

  const updateTarget = (i: number, field: 'actualQty', value: number) => {
    if (!doctor) return;
    const targets = doctor.productTargets.map((t, j) => j === i ? { ...t, [field]: value } : t);
    const updated = { ...doctor, productTargets: targets };
    setDoctor(updated);
    saveDoctor(updated);
  };

  const addVisit = () => {
    if (!visitDraft.content.trim()) { alert('請填寫拜訪內容'); return; }
    const v: VisitRecord = { id: uid(), doctorId: id, ...visitDraft };
    saveVisit(v);
    setVisits(prev => [v, ...prev]);
    setVisitDraft({ date: new Date().toISOString().slice(0, 10), content: '', nextAction: '' });
    setShowVisitForm(false);
  };

  const removeVisit = (vid: string) => {
    if (!confirm('刪除這筆拜訪紀錄？')) return;
    deleteVisit(vid);
    setVisits(prev => prev.filter(v => v.id !== vid));
  };

  if (!doctor) return null;

  const totalTarget = doctor.productTargets.reduce((s, t) => s + t.targetQty, 0);
  const totalActual = doctor.productTargets.reduce((s, t) => s + t.actualQty, 0);
  const rate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/customers" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">{doctor.name}</h1>
            {doctor.title && <span className="text-sm text-gray-400">{doctor.title}</span>}
          </div>
          <Link href={`/customers/${id}/edit`} className="text-sm text-blue-600 hover:underline">編輯</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* 基本資料 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div><span className="text-gray-400">醫院</span><span className="ml-2 text-gray-800">{doctor.hospitalName || '—'}</span></div>
            <div><span className="text-gray-400">科別</span><span className="ml-2 text-gray-800">{doctor.department || '—'}</span></div>
            <div><span className="text-gray-400">電話</span><span className="ml-2 text-gray-800">{doctor.phone || '—'}</span></div>
            <div><span className="text-gray-400">月投資</span><span className="ml-2 text-gray-800">{doctor.monthlyInvestment ? `NT$${doctor.monthlyInvestment.toLocaleString()}` : '—'}</span></div>
          </div>
          {doctor.habits && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">手術習慣 / 偏好</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{doctor.habits}</p></div>}
          {doctor.visitHabit && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">🗓 拜訪習慣模式</p><p className="text-sm text-blue-700 whitespace-pre-wrap font-medium">{doctor.visitHabit}</p></div>}
          {doctor.attitude && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">對產品的態度</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{doctor.attitude}</p></div>}
          {doctor.visitPlan && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">拜訪目標 / 策略</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{doctor.visitPlan}</p></div>}
        </div>

        {/* 產品目標達成 */}
        {doctor.productTargets.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">產品目標達成</h2>
              {rate !== null && (
                <span className={`text-lg font-bold ${rate >= 100 ? 'text-green-600' : rate >= 60 ? 'text-blue-600' : 'text-orange-500'}`}>
                  {rate}%
                </span>
              )}
            </div>
            <div className="space-y-3">
              {doctor.productTargets.map((t, i) => {
                const r = t.targetQty > 0 ? Math.round((t.actualQty / t.targetQty) * 100) : 0;
                return (
                  <div key={t.productId} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{t.productName}</span>
                        <span className="text-gray-500">{t.actualQty}/{t.targetQty} {t.unit}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${r >= 100 ? 'bg-green-500' : r >= 60 ? 'bg-blue-500' : 'bg-orange-400'}`}
                          style={{ width: `${Math.min(r, 100)}%` }} />
                      </div>
                    </div>
                    <div className="w-12 text-right">
                      <input type="number" value={t.actualQty} onChange={e => updateTarget(i, 'actualQty', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs text-right border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              <div>
                <label className="text-xs text-gray-500">日期</label>
                <input type="date" value={visitDraft.date} onChange={e => setVisitDraft(d => ({ ...d, date: e.target.value }))}
                  className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-full bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500">拜訪內容</label>
                <textarea value={visitDraft.content} onChange={e => setVisitDraft(d => ({ ...d, content: e.target.value }))}
                  placeholder="今天談了什麼..." rows={3}
                  className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm w-full bg-white focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500">下一步行動</label>
                <input value={visitDraft.nextAction} onChange={e => setVisitDraft(d => ({ ...d, nextAction: e.target.value }))}
                  placeholder="下次要做什麼..."
                  className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-full bg-white focus:outline-none" />
              </div>
              <button onClick={addVisit} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">儲存</button>
            </div>
          )}

          {visits.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">還沒有拜訪紀錄</p>
          ) : (
            <div className="space-y-3">
              {visits.map(v => (
                <div key={v.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">{v.date}</span>
                    <button onClick={() => removeVisit(v.id)} className="text-xs text-gray-300 hover:text-red-400">✕</button>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{v.content}</p>
                  {v.nextAction && <p className="text-xs text-blue-600 mt-1.5">→ {v.nextAction}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
