'use client';

// 客戶待辦（秘書）：把散在各位醫師頁面的待辦集中釘在一起，拜訪完隨手記、做完勾掉。
// 資料仍存在 Doctor.todos（Elon 也讀寫同一份），這裡只是彙整＋快速新增。
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Doctor, TodoItem } from '@/types';
import { getDoctors, saveDoctor } from '@/lib/storage';
import { HOSPITALS } from '@/data/hospitals';
import { TODO_KINDS } from '@/lib/strategy';

const SHOW_N = 8;
const HOSP_SHORT = Object.fromEntries(HOSPITALS.map(h => [h.id, h.shortName]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysFromToday = (iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(todayIso() + 'T00:00:00').getTime()) / 86_400_000);

function dueLabel(due?: string): { text: string; cls: string } | null {
  if (!due) return null;
  const n = daysFromToday(due);
  if (n < 0)  return { text: `逾期 ${-n} 天`, cls: 'bg-red-100 text-red-700' };
  if (n === 0) return { text: '今天到期', cls: 'bg-red-100 text-red-700' };
  if (n <= 3) return { text: `${n} 天後到期`, cls: 'bg-orange-100 text-orange-700' };
  return { text: `${due.slice(5).replace('-', '/')} 到期`, cls: 'bg-gray-100 text-gray-600' };
}

type Row = { t: TodoItem; d: Doctor; hosp: string };

export default function CustomerTodosPanel({ onChanged, className = '' }: { onChanged?: () => void; className?: string }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [who, setWho] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const load = () => setDoctors(getDoctors());
    load();
    window.addEventListener('doctors-updated', load);
    return () => window.removeEventListener('doctors-updated', load);
  }, []);

  // 輸入框顯示「姓名・醫院」，同名醫師才分得出來
  const options = useMemo(() => doctors.map(d => ({
    d, label: `${d.name}・${HOSP_SHORT[(d.hospitalIds?.[0] ?? d.hospitalId) || ''] ?? d.hospitalName}`,
  })), [doctors]);

  const rows = useMemo<Row[]>(() => doctors.flatMap(d => (d.todos ?? [])
    .filter(t => !t.done)
    .map(t => ({ t, d, hosp: HOSP_SHORT[(d.hospitalIds?.[0] ?? d.hospitalId) || ''] ?? d.hospitalName })))
    // 有期限的照期限排（逾期最前），沒期限的照建立時間（放最久的先）
    .sort((a, b) => {
      if (a.t.due && b.t.due) return a.t.due.localeCompare(b.t.due);
      if (a.t.due) return -1;
      if (b.t.due) return 1;
      return a.t.createdAt.localeCompare(b.t.createdAt);
    }), [doctors]);

  const persist = (d: Doctor) => {
    saveDoctor(d);
    setDoctors(getDoctors());
    onChanged?.();
  };

  const add = () => {
    const hit = options.find(o => o.label === who.trim()) ?? options.find(o => o.d.name === who.trim());
    if (!hit) { alert('請從清單選擇客戶'); return; }
    if (!title.trim()) { alert('請填寫要做的事'); return; }
    const item: TodoItem = {
      id: uid(), title: title.trim(), currentStatus: '', nextAction: '', kind: 'other',
      due: due || undefined, source: 'web', createdAt: new Date().toISOString(),
    };
    persist({ ...hit.d, todos: [...(hit.d.todos ?? []), item] });
    setTitle(''); setDue('');
  };

  const done = (r: Row) => persist({
    ...r.d, todos: (r.d.todos ?? []).map(t => t.id === r.t.id ? { ...t, done: true, doneAt: todayIso() } : t),
  });

  const list = showAll ? rows : rows.slice(0, SHOW_N);
  const overdue = rows.filter(r => r.t.due && daysFromToday(r.t.due) <= 0).length;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          📌 客戶待辦 <span className="text-gray-500 font-normal">{rows.length} 件</span>
          {overdue > 0 && <span className="ml-2 text-xs font-semibold text-red-600">{overdue} 件到期</span>}
        </h2>
        <span className="text-[11px] text-gray-400">勾選＝完成；完成紀錄留在客戶頁</span>
      </div>

      {/* 快速新增：選客戶 → 寫要做的事 → （選填）期限 */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input list="todo-doctor-options" value={who} onChange={e => setWho(e.target.value)} placeholder="客戶"
          className="w-40 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
        <datalist id="todo-doctor-options">
          {options.map(o => <option key={o.d.id} value={o.label} />)}
        </datalist>
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(); }}
          placeholder="要做的事，例：做 3D 網膜與健保網膜比較表"
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
        <input type="date" value={due} onChange={e => setDue(e.target.value)} title="期限（選填）"
          className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:border-amber-400" />
        <button onClick={add} className="px-4 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600">＋ 加入</button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">沒有待辦，拜訪完有要跟進的事就記在這裡</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map(r => {
            const dl = dueLabel(r.t.due);
            const kind = r.t.kind && r.t.kind !== 'other' ? TODO_KINDS.find(k => k.key === r.t.kind)?.label : null;
            const age = -daysFromToday(r.t.createdAt.slice(0, 10));
            return (
              <li key={r.t.id} className="flex items-start gap-2.5 py-2">
                <input type="checkbox" onChange={() => done(r)} title="完成" className="mt-1 w-4 h-4 accent-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{r.t.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px]">
                    <Link href={`/customers/${r.d.id}`} className="font-semibold text-blue-700 hover:underline">{r.d.name}</Link>
                    <span className="text-gray-400">{r.hosp}</span>
                    {dl && <span className={`px-1.5 rounded ${dl.cls}`}>{dl.text}</span>}
                    {kind && <span className="px-1.5 rounded bg-amber-100 text-amber-800">{kind}</span>}
                    {r.t.product && <span className="px-1.5 rounded bg-blue-50 text-blue-700">{r.t.product}</span>}
                    {r.t.nextAction && <span className="text-gray-500 truncate">→ {r.t.nextAction}</span>}
                    <span className="text-gray-300">{age <= 0 ? '今天記的' : `${age} 天前記的`}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > SHOW_N && (
        <button onClick={() => setShowAll(v => !v)} className="mt-2 text-xs text-blue-600 hover:underline">
          {showAll ? '收起' : `顯示全部 ${rows.length} 件`}
        </button>
      )}
    </div>
  );
}
