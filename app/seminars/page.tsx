'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { getSeminars, saveSeminars } from '@/lib/storage';
import { pullFromCloud } from '@/lib/supabase';
import { Seminar, SEMINAR_HOSP, SEMINAR_HOSP_ORDER } from '@/data/seminars';

const DEPT_LABEL: Record<string, string> = {
  GYN: '婦產科', GU: '泌尿外科', GS: '一般外科', ENT: '耳鼻喉科', TS: '胸腔外科', BS: '乳房外科',
};
const DEPT_COLOR: Record<string, string> = {
  GYN: 'bg-pink-100 text-pink-700', GU: 'bg-blue-100 text-blue-700', GS: 'bg-green-100 text-green-700',
  ENT: 'bg-orange-100 text-orange-700', TS: 'bg-purple-100 text-purple-700', BS: 'bg-rose-100 text-rose-700',
};
const HOSP_DOT: Record<string, string> = {
  tmuh: '#10b981', eck: '#f59e0b', sph: '#8b5cf6', clinic: '#6366f1', grace: '#06b6d4', tzuchi: '#ef4444', tucheng: '#ec4899',
};
const ALL = '__all__';
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
const monthOf = (date: string) => date.slice(0, 7);
const emptyForm = (): Omit<Seminar, 'id'> => ({ date: todayStr(), hospitalId: 'tmuh', department: 'GYN', products: [], topic: '', note: '', source: 'manual' });

export default function SeminarsPage() {
  const [mounted, setMounted] = useState(false);
  const [, force] = useState(0);
  const refresh = useCallback(() => force(n => n + 1), []);
  const [fMonth, setFMonth] = useState<string>(ALL);
  const [fHosp, setFHosp] = useState<string>(ALL);
  const [fDept, setFDept] = useState<string>(ALL);
  const [editing, setEditing] = useState<Seminar | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<Seminar, 'id'>>(emptyForm());
  const [prodText, setProdText] = useState('');

  useEffect(() => {
    setMounted(true);
    // 首次若本機無 seminars，用種子寫入並推雲端
    if (typeof window !== 'undefined' && localStorage.getItem('seminars') === null) {
      saveSeminars(getSeminars());
    }
    pullFromCloud().then(() => refresh());
  }, [refresh]);

  const all = mounted ? getSeminars() : [];
  const sorted = [...all].sort((a, b) => b.date.localeCompare(a.date));
  const today = todayStr();

  const months = useMemo(() => Array.from(new Set(all.map(s => monthOf(s.date)))).sort().reverse(), [all]);

  const filtered = sorted.filter(s =>
    (fMonth === ALL || monthOf(s.date) === fMonth) &&
    (fHosp === ALL || s.hospitalId === fHosp) &&
    (fDept === ALL || s.department === fDept));

  // 統計
  const thisMonth = monthOf(today);
  const thisMonthCount = all.filter(s => monthOf(s.date) === thisMonth).length;
  const byHosp = SEMINAR_HOSP_ORDER.map(id => ({ id, count: all.filter(s => s.hospitalId === id).length })).filter(h => h.count > 0);
  const maxHosp = Math.max(1, ...byHosp.map(h => h.count));
  const byProduct = (() => {
    const m: Record<string, number> = {};
    for (const s of all) for (const p of s.products) m[p] = (m[p] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  })();

  // Coverage：每院最近一場 + 各院各科最後日期
  const coverage = SEMINAR_HOSP_ORDER.map(id => {
    const list = all.filter(s => s.hospitalId === id);
    const last = list.length ? list.map(s => s.date).sort().reverse()[0] : null;
    const days = last ? daysBetween(last, today) : null;
    const depts = Array.from(new Set(list.map(s => s.department)));
    return { id, count: list.length, last, days, depts };
  }).sort((a, b) => (b.days ?? 99999) - (a.days ?? 99999));

  const openAdd = () => { setForm(emptyForm()); setProdText(''); setEditing(null); setAdding(true); };
  const openEdit = (s: Seminar) => { setForm({ ...s }); setProdText(s.products.join('、')); setEditing(s); setAdding(true); };
  const closeForm = () => { setAdding(false); setEditing(null); };
  const submit = () => {
    if (!form.date || !form.hospitalId) return;
    const products = prodText.split(/[、,，\s]+/).map(x => x.trim()).filter(Boolean);
    const list = getSeminars();
    if (editing) {
      const i = list.findIndex(x => x.id === editing.id);
      if (i >= 0) list[i] = { ...editing, ...form, products };
    } else {
      list.push({ ...form, products, id: `sem_m_${Date.now()}` });
    }
    saveSeminars(list);
    closeForm(); refresh();
  };
  const remove = (id: string) => {
    if (!confirm('刪除這場活動？')) return;
    saveSeminars(getSeminars().filter(x => x.id !== id));
    refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">活動紀錄</h1>
            <p className="text-sm text-gray-500">Seminar・晨會・產品介紹</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-600 hover:text-blue-600">主頁</Link>
            <Link href="/customers" className="text-sm text-gray-600 hover:text-blue-600">客戶</Link>
            <Link href="/performance" className="text-sm text-gray-600 hover:text-blue-600">我的</Link>
            <button onClick={openAdd} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ 新增活動</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* KPI + 依醫院/產品統計 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 mb-1">累積場次</p>
            <p className="text-3xl font-black text-gray-900">{mounted ? all.length : '—'}</p>
            <p className="text-xs text-gray-400 mt-1">本月 {thisMonthCount} 場</p>
          </div>
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 mb-2">依醫院</p>
            <div className="space-y-1.5">
              {byHosp.map(h => (
                <div key={h.id} className="flex items-center gap-2 text-sm">
                  <span className="w-16 shrink-0 text-gray-600">{SEMINAR_HOSP[h.id]}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(h.count / maxHosp) * 100}%`, background: HOSP_DOT[h.id] }} />
                  </div>
                  <span className="w-6 text-right font-bold text-gray-900">{h.count}</span>
                </div>
              ))}
            </div>
            {byProduct.length > 0 && (
              <p className="text-xs text-gray-400 mt-3">
                主推產品：{byProduct.map(([p, c]) => `${p}×${c}`).join('　')}
              </p>
            )}
          </div>
        </div>

        {/* Coverage 提醒 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-base font-semibold text-gray-800">醫院覆蓋提醒</h2>
            <span className="text-xs text-gray-400">越久沒辦的排越前面</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {coverage.map(c => {
              const overdue = c.days === null || c.days > 30;
              return (
                <div key={c.id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: HOSP_DOT[c.id] }} />
                  <span className="w-16 shrink-0 font-medium text-gray-700">{SEMINAR_HOSP[c.id]}</span>
                  <span className="text-gray-400 text-xs">
                    {c.depts.length ? c.depts.map(d => DEPT_LABEL[d] ?? d).join('/') : '—'}
                  </span>
                  <span className={`ml-auto text-xs font-medium ${overdue ? 'text-amber-600' : 'text-gray-500'}`}>
                    {c.last ? `最近 ${c.last.slice(5)}・${c.days} 天前` : '尚未辦過'}
                    {overdue && ' ⚠'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 篩選 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 w-10">月份</span>
            {[ALL, ...months].map(m => (
              <button key={m} onClick={() => setFMonth(m)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${fMonth === m ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
                {m === ALL ? '全部' : m.replace('2026-', '') + '月'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 w-10">醫院</span>
            <button onClick={() => setFHosp(ALL)} className={`px-3 py-1 rounded-full text-xs font-medium ${fHosp === ALL ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>全部</button>
            {SEMINAR_HOSP_ORDER.filter(id => all.some(s => s.hospitalId === id)).map(id => (
              <button key={id} onClick={() => setFHosp(id)} className={`px-3 py-1 rounded-full text-xs font-medium ${fHosp === id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>{SEMINAR_HOSP[id]}</button>
            ))}
          </div>
        </div>

        {/* 清單 */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {!mounted ? (
            <p className="text-sm text-gray-300 py-8 text-center">載入中…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">此篩選下沒有活動</p>
          ) : filtered.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 group">
              <span className="text-sm font-mono text-gray-500 w-20 shrink-0">{s.date.slice(5)}<span className="text-gray-300 text-xs">/{s.date.slice(2, 4)}</span></span>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: HOSP_DOT[s.hospitalId] }} />
              <span className="text-sm font-semibold text-gray-800 w-16 shrink-0">{SEMINAR_HOSP[s.hospitalId]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${DEPT_COLOR[s.department] ?? 'bg-gray-100 text-gray-600'}`}>{DEPT_LABEL[s.department] ?? s.department}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {s.products.map(p => (
                  <span key={p} className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{p}</span>
                ))}
                {s.topic && <span className="text-sm text-gray-500 truncate">{s.topic}</span>}
                {s.note && <span className="text-xs text-gray-400 truncate">· {s.note}</span>}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 shrink-0">
                <button onClick={() => openEdit(s)} className="text-xs text-gray-400 hover:text-blue-600">編輯</button>
                <button onClick={() => remove(s.id)} className="text-xs text-gray-400 hover:text-red-500">刪除</button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center">共 {filtered.length} 場{fMonth !== ALL || fHosp !== ALL ? `（全部 ${all.length}）` : ''}</p>
      </div>

      {/* 新增/編輯 彈窗 */}
      {adding && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={closeForm}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">{editing ? '編輯活動' : '新增活動'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">日期
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ color: '#111827' }} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">醫院
                <select value={form.hospitalId} onChange={e => setForm(f => ({ ...f, hospitalId: e.target.value }))}
                  style={{ color: '#111827' }} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {SEMINAR_HOSP_ORDER.map(id => <option key={id} value={id}>{SEMINAR_HOSP[id]}</option>)}
                </select>
              </label>
              <label className="text-sm">科別
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  style={{ color: '#111827' }} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {Object.entries(DEPT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="text-sm">產品（頓號分隔）
                <input type="text" value={prodText} onChange={e => setProdText(e.target.value)} placeholder="Arista、SorbaFix"
                  style={{ color: '#111827' }} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="text-sm block">主題
              <input type="text" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="例：Ventral Hernia / 晨會"
                style={{ color: '#111827' }} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="text-sm block">備註
              <input type="text" value={form.note ?? ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                style={{ color: '#111827' }} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
              <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">{editing ? '更新' : '新增'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
