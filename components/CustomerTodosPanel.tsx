'use client';

// 客戶待辦（秘書）：把散在各位醫師頁面的待辦集中釘在一起，拜訪完隨手記、做完勾掉。
// 資料仍存在 Doctor.todos（Elon 也讀寫同一份），這裡只是彙整＋快速新增。
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Doctor, TodoItem } from '@/types';
import { getDoctors, saveDoctor } from '@/lib/storage';
import { HOSPITALS } from '@/data/hospitals';

const HOSP_SHORT = Object.fromEntries(HOSPITALS.map(h => [h.id, h.shortName]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayIso = () => localIso(new Date());
const daysFromToday = (iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(todayIso() + 'T00:00:00').getTime()) / 86_400_000);

function dueLabel(due?: string): { text: string; cls: string } | null {
  if (!due) return null;
  const n = daysFromToday(due);
  if (n < 0)  return { text: `逾期 ${-n} 天`, cls: 'bg-red-100 text-red-700' };
  if (n === 0) return { text: '今天到期', cls: 'bg-red-100 text-red-700' };
  if (n <= 3) return { text: `${n} 天後到期`, cls: 'bg-orange-100 text-orange-700' };
  return { text: `${due.slice(5).replace('-', '/')} 到期`, cls: 'bg-gray-100 text-gray-600' };
}

// 依類型分色，一眼看出是哪種事（kind 有設就用 kind，否則看標題關鍵字）
type CatKey = 'spons' | 'trial' | 'admin' | 'doc' | 'social' | 'promo' | 'misc';
const CATS: { key: CatKey; label: string; re: RegExp; cls: string }[] = [
  { key: 'spons',  label: '學贊／用量', re: /學贊|用量/,                         cls: 'bg-emerald-100 text-emerald-800' },
  { key: 'trial',  label: '試用',       re: /試用|sample/i,                      cls: 'bg-pink-100 text-pink-800' },
  { key: 'admin',  label: '開檔／申報', re: /開檔|申報|健保|院內碼|核准|護理長/, cls: 'bg-blue-100 text-blue-800' },
  { key: 'doc',    label: '資料',       re: /資料|比較表|價格|報價|文獻|DM|整理|核對/, cls: 'bg-violet-100 text-violet-800' },
  { key: 'social', label: '約訪／交際', re: /吃飯|聚餐|晚餐|午餐|接送|科會|約/,  cls: 'bg-amber-100 text-amber-800' },
  { key: 'promo',  label: '產品推廣',   re: /介紹|說服|衛教|文章|提/,             cls: 'bg-teal-100 text-teal-800' },
  { key: 'misc',   label: '其他',       re: /$^/,                                cls: 'bg-gray-100 text-gray-600' },
];
const KIND_CAT: Record<string, CatKey> = { sample: 'trial', material: 'doc', pm: 'social' };
const catOf = (t: TodoItem): CatKey =>
  (t.kind && KIND_CAT[t.kind]) || CATS.find(c => c.re.test(t.title))?.key || 'misc';

// 依期限分段：先處理紅的，再看這週，沒排期限的放最後並標出放多久
type GroupKey = 'overdue' | 'week' | 'later' | 'none';
const GROUPS: { key: GroupKey; title: string; hint: string; bar: string }[] = [
  { key: 'overdue', title: '🔴 逾期／今天',  hint: '先處理',                 bar: 'border-red-400' },
  { key: 'week',    title: '🟠 7 天內',      hint: '這週要排進行程',         bar: 'border-orange-400' },
  { key: 'later',   title: '🔵 之後',        hint: '已排期限',               bar: 'border-sky-300' },
  { key: 'none',    title: '⚪ 未排期限',    hint: '放最久的在前；按「＋期限」排進去', bar: 'border-gray-200' },
];
const groupOf = (due?: string): GroupKey => {
  if (!due) return 'none';
  const n = daysFromToday(due);
  return n <= 0 ? 'overdue' : n <= 7 ? 'week' : 'later';
};
const STALE_DAYS = 30;
const NONE_SHOW_N = 6;

type Row = { t: TodoItem; d: Doctor; hosp: string; cat: CatKey; group: GroupKey };

export default function CustomerTodosPanel({ onChanged, className = '' }: { onChanged?: () => void; className?: string }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [who, setWho] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [cat, setCat] = useState<CatKey | 'all'>('all');
  const [dating, setDating] = useState<string | null>(null);   // 正在補期限的待辦 id

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
    .map(t => ({
      t, d, hosp: HOSP_SHORT[(d.hospitalIds?.[0] ?? d.hospitalId) || ''] ?? d.hospitalName,
      cat: catOf(t), group: groupOf(t.due),
    })))
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

  const setDueOf = (r: Row, v: string) => {
    setDating(null);
    if (!v) return;
    persist({ ...r.d, todos: (r.d.todos ?? []).map(t => t.id === r.t.id ? { ...t, due: v } : t) });
  };

  const shown = cat === 'all' ? rows : rows.filter(r => r.cat === cat);
  const catCount = (k: CatKey) => rows.filter(r => r.cat === k).length;

  const renderRow = (r: Row) => {
    const dl = dueLabel(r.t.due);
    const c = CATS.find(x => x.key === r.cat)!;
    const age = -daysFromToday(localIso(new Date(r.t.createdAt)));   // createdAt 是 UTC，換回本地日期
    return (
      <li key={r.t.id} className="flex items-start gap-2.5 py-2">
        <input type="checkbox" onChange={() => done(r)} title="完成" className="mt-1 w-4 h-4 accent-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 line-clamp-2" title={r.t.title}>{r.t.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px]">
            <Link href={`/customers/${r.d.id}`} className="font-semibold text-blue-700 hover:underline">{r.d.name}</Link>
            <span className="text-gray-400">{r.hosp}</span>
            <span className={`px-1.5 rounded ${c.cls}`}>{c.label}</span>
            {r.t.product && <span className="px-1.5 rounded bg-blue-50 text-blue-700">{r.t.product}</span>}
            {r.t.nextAction && <span className="text-gray-500 truncate">→ {r.t.nextAction}</span>}
            {!r.t.due && (age >= STALE_DAYS
              ? <span className="text-orange-600">放了 {age} 天</span>
              : <span className="text-gray-300">{age <= 0 ? '今天記的' : `${age} 天前記的`}</span>)}
          </div>
        </div>
        <div className="shrink-0 pt-0.5">
          {dl ? (
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${dl.cls}`}>{dl.text}</span>
          ) : dating === r.t.id ? (
            <input type="date" autoFocus onChange={e => setDueOf(r, e.target.value)} onBlur={() => setDating(null)}
              className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] text-gray-600" />
          ) : (
            <button onClick={() => setDating(r.t.id)} className="text-[11px] text-gray-400 border border-dashed border-gray-300 rounded px-1.5 hover:text-gray-700 hover:border-gray-500">＋期限</button>
          )}
        </div>
      </li>
    );
  };

  const overdue = rows.filter(r => r.group === 'overdue').length;
  const week = rows.filter(r => r.group === 'week').length;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          📌 客戶待辦 <span className="text-gray-500 font-normal">{rows.length} 件</span>
          {overdue > 0 && <span className="ml-2 text-xs font-semibold text-red-600">{overdue} 件到期</span>}
          {week > 0 && <span className="ml-2 text-xs font-semibold text-orange-600">{week} 件本週</span>}
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
        <>
          {/* 類型篩選 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button onClick={() => setCat('all')}
              className={`text-xs px-2 py-0.5 rounded-full border ${cat === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              全部 {rows.length}
            </button>
            {CATS.filter(c => catCount(c.key) > 0).map(c => (
              <button key={c.key} onClick={() => setCat(cat === c.key ? 'all' : c.key)}
                className={`text-xs px-2 py-0.5 rounded-full ${cat === c.key ? 'ring-2 ring-gray-700 ' : ''}${c.cls}`}>
                {c.label} {catCount(c.key)}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {GROUPS.map(g => {
              const list = shown.filter(r => r.group === g.key);
              if (list.length === 0) return null;
              const cut = g.key === 'none' && !showAll ? list.slice(0, NONE_SHOW_N) : list;
              return (
                <section key={g.key} className={`border-l-4 pl-3 ${g.bar}`}>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-xs font-semibold text-gray-700">{g.title}</h3>
                    <span className="text-xs font-bold text-gray-700">{list.length}</span>
                    <span className="text-[11px] text-gray-400">{g.hint}</span>
                  </div>
                  <ul className="divide-y divide-gray-100">{cut.map(renderRow)}</ul>
                  {g.key === 'none' && list.length > NONE_SHOW_N && (
                    <button onClick={() => setShowAll(v => !v)} className="mt-1 text-xs text-blue-600 hover:underline">
                      {showAll ? '收起' : `顯示全部 ${list.length} 件`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
