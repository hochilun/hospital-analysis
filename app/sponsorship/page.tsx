'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { DEPT_LABEL, HOSP_COLOR } from '@/data/myPerformance';
import { SPONSOR_PRODUCTS, sponsorRate } from '@/data/sponsorship';
import { forceSync } from '@/lib/supabase';
import {
  computeMonth, sponsorMonths, monthLabel, loadSponsorState, saveSponsorState, itemKey,
  type SponsorState, type DoctorRow, type HospBlock, type ManualItem,
} from '@/lib/sponsorshipCore';

const fmtMoney = (n: number) => '$' + n.toLocaleString('zh-TW');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shortDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : s;

const DEPTS = ['GYN', 'GU', 'GS', 'ENT', 'TS', 'BS'];
const HOSP_CHOICES = ['沙爾德聖', '台北醫學', '恩主公', '台北慈濟', '長庚土城', '宏恩醫療', '中心診所', '輔大醫院', '西園醫院', '林口長庚'];

export default function SponsorshipPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SponsorState | null>(null);
  const [tick, setTick] = useState(0);
  const months = useMemo(() => sponsorMonths(), []);
  const [month, setMonth] = useState<string>('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [noteEditing, setNoteEditing] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ hosp: '沙爾德聖', dept: 'GYN', name: '', product: '宮安康', qty: '1', unit: '', note: '' });

  // 雲端為準：業績頁補登醫師／認領後，這頁一打開就是最新
  useEffect(() => {
    setMounted(true);
    Promise.all([forceSync('perf-doctors'), forceSync('perf-claims'), forceSync('sponsorship-state')])
      .finally(() => { setState(loadSponsorState()); setLoading(false); });
  }, []);

  // 預設停在「最早一個還沒處理完的月份」
  const results = useMemo(() => {
    if (!state) return {};
    return Object.fromEntries(months.map(m => [m, computeMonth(m, state)]));
  }, [state, months, tick]);

  useEffect(() => {
    if (!state || month) return;
    const open = months.find(m => {
      const r = results[m];
      return r && !r.settled && (r.pendingTotal > 0 || r.unassignedTotal > 0);
    });
    setMonth(open ?? months[months.length - 1]);
  }, [state, months, results, month]);

  const update = useCallback((fn: (s: SponsorState) => SponsorState) => {
    setState(prev => {
      if (!prev) return prev;
      const next = fn(structuredClone(prev));
      saveSponsorState(next);
      return next;
    });
  }, []);

  const res = month ? results[month] : undefined;
  const readOnly = !!res?.settled;

  const toggleDone = (r: DoctorRow) => update(s => {
    if (s.done[r.key]) delete s.done[r.key];
    else s.done[r.key] = { at: today(), amount: r.amount };
    return s;
  });
  const reconfirm = (r: DoctorRow) => update(s => { s.done[r.key] = { at: today(), amount: r.amount }; return s; });
  const toggleExclude = (r: DoctorRow) => update(s => {
    if (s.excluded[r.key] !== undefined) { delete s.excluded[r.key]; return s; }
    const why = window.prompt(`${r.name}：不請的原因（可留白）`, '');
    if (why === null) return s;
    s.excluded[r.key] = why.trim() || '不請';
    delete s.done[r.key];
    return s;
  });
  const saveNote = (key: string) => update(s => {
    if (noteDraft.trim()) s.notes[key] = noteDraft.trim(); else delete s.notes[key];
    return s;
  });
  const editRate = (r: DoctorRow, product: string, cur: number) => {
    const v = window.prompt(`${r.name} · ${product} 的單價（留白＝恢復預設 ${sponsorRate(product, r.hosp, r.name).toLocaleString()}）`, String(cur));
    if (v === null) return;
    const k = itemKey(month, r.hosp, r.name, product);
    update(s => {
      const n = Number(v.replace(/[,\s]/g, ''));
      if (!v.trim() || Number.isNaN(n)) delete s.rateOverride[k]; else s.rateOverride[k] = n;
      return s;
    });
  };
  const removeManual = (m: ManualItem) => {
    if (!window.confirm(`刪除加列：${m.name} ${m.product}×${m.qty}？`)) return;
    update(s => { s.manual = s.manual.filter(x => x.id !== m.id); return s; });
  };
  const addManual = () => {
    const qty = Number(form.qty), unit = Number(form.unit.replace(/[,\s]/g, ''));
    if (!form.name.trim() || !form.product.trim() || !qty || Number.isNaN(unit)) return;
    update(s => {
      s.manual.push({
        id: Math.random().toString(36).slice(2, 10), month, hosp: form.hosp.trim(), dept: form.dept,
        name: form.name.trim(), product: form.product.trim(), qty, unit, note: form.note.trim() || undefined,
      });
      return s;
    });
    setForm(f => ({ ...f, name: '', qty: '1', note: '' }));
    setAdding(false);
  };
  // 選產品／醫院時自動帶入預設單價
  useEffect(() => {
    setForm(f => ({ ...f, unit: String(sponsorRate(f.product, f.hosp, f.name.trim()) || f.unit) }));
  }, [form.product, form.hosp]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">學術贊助</h1>
            <p className="text-sm text-gray-500 mt-0.5">依使用月整理 · 醫師與數量取自業績頁登記，自動連動</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-600 hover:text-blue-600">主頁</Link>
            <Link href="/customers" className="text-sm text-gray-600 hover:text-blue-600">客戶</Link>
            <Link href="/performance" className="text-sm text-gray-600 hover:text-blue-600">個人業績</Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* 月份 */}
        <div className="flex flex-wrap gap-2">
          {months.map(m => {
            const r = results[m];
            const clear = r && (r.settled || (r.pendingTotal === 0 && r.unassignedTotal === 0 && r.rowCount > 0));
            const warn = r && !r.settled && r.unassignedTotal > 0;
            const active = m === month;
            return (
              <button key={m} onClick={() => setMonth(m)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  active ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                {monthLabel(m)}
                {clear && <span className={`ml-1.5 ${active ? 'text-emerald-300' : 'text-emerald-600'}`}>✓</span>}
                {!clear && r && r.rowCount - r.doneCount > 0 && (
                  <span className={`ml-1.5 text-xs ${active ? 'text-gray-300' : 'text-gray-400'}`}>{r.rowCount - r.doneCount}</span>
                )}
                {warn && <span className="ml-1 text-amber-500">⚠</span>}
              </button>
            );
          })}
        </div>

        {loading || !res ? (
          <p className="text-sm text-gray-400">載入中…</p>
        ) : (
          <>
            {res.settled && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                ✓ {monthLabel(month)}已結清（{res.settled}）。以下為系統試算，實際請領金額以當時送件為準。
              </div>
            )}

            {/* 摘要 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={`${monthLabel(month)}應付`} value={res.total} sub={`${res.rowCount} 位醫師`} />
              <Stat label="已處理" value={res.doneTotal} sub={`${res.doneCount} 位`} tone="green" />
              <Stat label="待處理" value={res.pendingTotal} sub={`${res.rowCount - res.doneCount} 位`} tone={res.pendingTotal ? 'blue' : undefined} />
              <Stat label="⚠ 未登記醫師" value={res.unassignedTotal} sub={res.unassignedTotal ? '到業績頁補登' : '全部已登記'} tone={res.unassignedTotal ? 'amber' : undefined} />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} className="w-4 h-4 accent-gray-900" />
                只看待處理
              </label>
              {res.excludedTotal > 0 && <span className="text-xs text-gray-400">不請 {fmtMoney(res.excludedTotal)}（不計入應付）</span>}
            </div>

            {res.blocks.map(b => (
              <HospSection key={b.hosp} b={b} month={month} readOnly={readOnly} pendingOnly={pendingOnly}
                noteEditing={noteEditing} noteDraft={noteDraft}
                onToggle={toggleDone} onReconfirm={reconfirm} onExclude={toggleExclude}
                onNoteEdit={(r) => { setNoteEditing(r.key); setNoteDraft(r.note ?? ''); }}
                onNoteDraft={setNoteDraft}
                onNoteSave={(key) => { saveNote(key); setNoteEditing(null); }}
                onNoteCancel={() => setNoteEditing(null)}
                onRate={editRate} onRemoveManual={removeManual} />
            ))}

            {/* 手動加列 */}
            {!readOnly && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-5">
                {!adding ? (
                  <button onClick={() => setAdding(true)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    ＋ 加列（系統沒有的醫院、補請、開單醫師加給…）
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-800">加列到 {monthLabel(month)}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <Field label="醫院">
                        <input list="hosp-choices" value={form.hosp} onChange={e => setForm({ ...form, hosp: e.target.value })} className={inputCls} />
                        <datalist id="hosp-choices">{HOSP_CHOICES.map(h => <option key={h} value={h} />)}</datalist>
                      </Field>
                      <Field label="科別">
                        <select value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} className={inputCls}>
                          {DEPTS.map(d => <option key={d} value={d}>{DEPT_LABEL[d] ?? d}</option>)}
                        </select>
                      </Field>
                      <Field label="醫師">
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="姓名" />
                      </Field>
                      <Field label="產品／項目">
                        <input list="prod-choices" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} className={inputCls} />
                        <datalist id="prod-choices">{SPONSOR_PRODUCTS.map(p => <option key={p} value={p} />)}</datalist>
                      </Field>
                      <Field label="數量">
                        <input type="number" min={1} value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="單價">
                        <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="備註" wide>
                        <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className={inputCls} placeholder="例：五月使用補請、不計入業績" />
                      </Field>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addManual} className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium">加入</button>
                      <button onClick={() => setAdding(false)} className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600">取消</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300';

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'col-span-2' : ''}`}>
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: 'green' | 'blue' | 'amber' }) {
  const color = tone === 'green' ? 'text-emerald-600' : tone === 'blue' ? 'text-blue-600' : tone === 'amber' ? 'text-amber-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-black mt-1 tabular-nums ${color}`}>{fmtMoney(value)}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

type SectionProps = {
  b: HospBlock; month: string; readOnly: boolean; pendingOnly: boolean;
  noteEditing: string | null; noteDraft: string;
  onToggle: (r: DoctorRow) => void; onReconfirm: (r: DoctorRow) => void; onExclude: (r: DoctorRow) => void;
  onNoteEdit: (r: DoctorRow) => void; onNoteDraft: (v: string) => void; onNoteSave: (key: string) => void; onNoteCancel: () => void;
  onRate: (r: DoctorRow, product: string, cur: number) => void; onRemoveManual: (m: ManualItem) => void;
};

function HospSection({ b, month, readOnly, pendingOnly, noteEditing, noteDraft, onToggle, onReconfirm, onExclude, onNoteEdit, onNoteDraft, onNoteSave, onNoteCancel, onRate, onRemoveManual }: SectionProps) {
  const rows = pendingOnly ? b.rows.filter(r => !r.done && !r.excluded || r.changed) : b.rows;
  if (pendingOnly && !rows.length && !b.unassigned.length && b.available) return null;
  const allDone = b.rows.length > 0 && b.rows.every(r => r.done || r.excluded) && !b.unassigned.length;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: HOSP_COLOR[b.hosp] ?? '#94a3b8' }} />
          <span className="font-semibold text-gray-900">{b.hosp}</span>
          {b.delayed && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">依 {monthLabel(b.invoiceMonth)}發票</span>
          )}
          {allDone && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ 全部處理</span>}
        </div>
        <div className="text-right">
          <span className="font-bold text-gray-900 tabular-nums">{fmtMoney(b.total)}</span>
          {b.doneTotal > 0 && b.doneTotal < b.total && (
            <span className="ml-2 text-xs text-gray-400">已處理 {fmtMoney(b.doneTotal)}</span>
          )}
        </div>
      </div>

      {!b.available ? (
        <p className="px-5 py-4 text-sm text-gray-400">
          等待 {monthLabel(b.invoiceMonth)}發票 —— {monthLabel(month)}的實際使用量要等 {monthLabel(b.invoiceMonth)}初開票後才會出現。
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(r => {
            const excluded = r.excluded !== undefined;
            return (
              <div key={r.key} className={`px-5 py-3 flex items-start gap-3 ${excluded ? 'opacity-50' : ''} ${r.changed ? 'bg-amber-50' : ''}`}>
                <input type="checkbox" checked={!!r.done} disabled={readOnly || excluded}
                  onChange={() => onToggle(r)}
                  className="mt-1 w-5 h-5 accent-emerald-600 cursor-pointer disabled:cursor-default shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-gray-900 ${excluded ? 'line-through' : ''}`}>{r.name}</span>
                    <span className="text-xs text-gray-400">{DEPT_LABEL[r.dept] ?? r.dept}</span>
                    {excluded && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">不請 · {r.excluded}</span>}
                    {r.done && !readOnly && <span className="text-[11px] text-emerald-600">✓ {shortDate(r.done.at)} 處理</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
                    {r.items.map((it, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <span>{it.product}×{it.qty}</span>
                        <button disabled={readOnly || !!it.manual} onClick={() => onRate(r, it.product, it.unit)}
                          className={`text-xs tabular-nums ${it.overridden ? 'text-violet-600 font-semibold' : 'text-gray-400'} ${readOnly || it.manual ? '' : 'hover:text-blue-600 hover:underline'}`}
                          title={it.manual ? '加列項目' : '點一下改單價'}>
                          @{it.unit.toLocaleString()}
                        </button>
                        {it.manual && <span className="text-[10px] px-1 rounded bg-violet-50 text-violet-600">加列</span>}
                        {it.note && <span className="text-[11px] text-amber-700 bg-amber-50 rounded px-1">📝 {it.note}</span>}
                        {it.manual && !readOnly && (
                          <button onClick={() => onRemoveManual(it.manual!)} className="text-xs text-gray-300 hover:text-red-500">×</button>
                        )}
                      </span>
                    ))}
                  </div>
                  {r.changed && r.done && (
                    <div className="mt-1.5 text-xs text-amber-700 flex items-center gap-2">
                      ⚠ 勾選時 {fmtMoney(r.done.amount)}，現在 {fmtMoney(r.amount)}（登記有變動）
                      <button onClick={() => onReconfirm(r)} className="underline hover:text-amber-900">以新金額確認</button>
                    </div>
                  )}
                  {noteEditing === r.key ? (
                    <div className="mt-2 flex gap-2">
                      <input autoFocus value={noteDraft} onChange={e => onNoteDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') onNoteSave(r.key); if (e.key === 'Escape') onNoteCancel(); }}
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1 text-sm text-gray-900" placeholder="備註" />
                      <button onClick={() => onNoteSave(r.key)} className="text-xs px-3 rounded-lg bg-gray-900 text-white">存</button>
                    </div>
                  ) : r.note ? (
                    <p className="mt-1 text-xs text-gray-500">💬 {r.note}</p>
                  ) : null}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold tabular-nums ${excluded ? 'text-gray-400' : 'text-gray-900'}`}>{fmtMoney(r.amount)}</p>
                  {!readOnly && (
                    <div className="mt-1 flex gap-2 justify-end text-[11px] text-gray-400">
                      <button onClick={() => onNoteEdit(r)} className="hover:text-blue-600">備註</button>
                      <button onClick={() => onExclude(r)} className="hover:text-red-500">{excluded ? '恢復' : '不請'}</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {b.unassigned.length > 0 && (
            <div className="px-5 py-3 bg-amber-50/60 flex items-center justify-between text-sm">
              <span className="text-amber-800">
                ⚠ 未登記醫師：{b.unassigned.map(u => `${u.product}×${u.qty}`).join('、')}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-amber-700 tabular-nums">({fmtMoney(b.unassignedTotal)})</span>
                <Link href="/performance" className="text-xs text-blue-600 hover:underline whitespace-nowrap">去補登 →</Link>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
