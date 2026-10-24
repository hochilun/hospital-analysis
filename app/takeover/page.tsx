'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TAKEOVER_ROWS, TAKEOVER_AS_OF, TAKEOVER_PREV_REP, TAKEOVER_CATEGORY } from '@/data/takeoverHistory';
import { HOSP_COLOR, CAT_ZH } from '@/data/myPerformance';

const HOSPS = ['輔大醫院', '西園醫院'] as const;
type Sel = 'all' | typeof HOSPS[number];

const fmtMoney = (n: number) => '$' + Math.round(n).toLocaleString('zh-TW');
const fmtK = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(Math.round(n));
const monthLabel = (ym: string) => `${ym.slice(2, 4)}/${Number(ym.slice(5))}`;

const MONTHS = [...new Set(TAKEOVER_ROWS.map(r => r.month))].sort();
const LAST = MONTHS[MONTHS.length - 1];
const PARTIAL_LAST = !TAKEOVER_AS_OF.endsWith('-30') && !TAKEOVER_AS_OF.endsWith('-31');

// 交接重點（2026-10-24 分析）
const NOTES: Record<string, { tone: 'warn' | 'good'; text: string }[]> = {
  '西園醫院': [
    { tone: 'warn', text: '89% 業績來自 Arista 5g，幾乎每支配一個塗佈器 —— 少數醫師的大手術在用，單一產品風險高。' },
    { tone: 'warn', text: '5g 高峰在 25/10–26/1（月均 29 支），2026 年穩在 15–20 支；半年比較約少 30%，同月份（9 月）持平。' },
    { tone: 'warn', text: '每月集中開 2–4 次發票，單月數字受開票時點影響大，看季平均比較準。' },
    { tone: 'good', text: '其他產品幾乎空白：婦產 3 位醫師宮安康一年 4 支、耳鼻喉塞納斯 0、泌尿懸吊／疝氣極少 —— 都是開發機會。' },
    { tone: 'warn', text: '健康指標：5g 每月 ≥15 支正常，<10 支要立刻了解原因。' },
  ],
  '輔大醫院': [
    { tone: 'good', text: '品項分散（止血、耳鼻喉、疝氣、婦泌都有），不會因單一醫師整個垮掉。' },
    { tone: 'good', text: '成長中：近 3 月月均約 25 萬，是 25/9–26/2 的兩倍；8 月 33.7 萬創高。' },
    { tone: 'good', text: '主力 Arista 3g（約一半業績），7、8 月各 9–10 支創新高。' },
    { tone: 'good', text: '剛起步值得追：宮安康 9 月 4 支（婦產 11 位醫師）、IS-M1 8 月首單、Arista 5g 8–9 月開始用。' },
    { tone: 'good', text: '疝氣三品項（Ventralex／Ventralight／3DMAX）都有在用，可直接套台北慈濟的疝氣小卡。' },
  ],
};

export default function TakeoverPage() {
  const [sel, setSel] = useState<Sel>('all');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const rows = useMemo(() => sel === 'all' ? TAKEOVER_ROWS : TAKEOVER_ROWS.filter(r => r.hosp === sel), [sel]);

  // 每月加權（依醫院堆疊）
  const monthly = useMemo(() => MONTHS.map(m => {
    const o: Record<string, number | string> = { month: m, label: monthLabel(m) + (m === LAST && PARTIAL_LAST ? '*' : '') };
    for (const h of HOSPS) o[h] = rows.filter(r => r.month === m && r.hosp === h).reduce((s, r) => s + r.weighted, 0);
    o.total = HOSPS.reduce((s, h) => s + (o[h] as number), 0);
    return o;
  }), [rows]);

  const total = rows.reduce((s, r) => s + r.weighted, 0);
  const avg = total / MONTHS.length;
  const sumMonths = (ms: string[]) => monthly.filter(x => ms.includes(x.month as string)).reduce((s, x) => s + (x.total as number), 0);
  const last3 = MONTHS.slice(-3), prev3 = MONTHS.slice(-6, -3);
  const last3Avg = sumMonths(last3) / 3, prev3Avg = sumMonths(prev3) / 3;
  const delta = prev3Avg ? (last3Avg - prev3Avg) / prev3Avg : 0;

  // 產品排行
  const products = useMemo(() => {
    const map: Record<string, { name: string; qty: number; w: number; rev: number; byMonth: Record<string, number>; last3: number; prev3: number }> = {};
    for (const r of rows) {
      const p = (map[r.product] ??= { name: r.product, qty: 0, w: 0, rev: 0, byMonth: {}, last3: 0, prev3: 0 });
      p.qty += r.qty; p.w += r.weighted; p.rev += r.rev;
      p.byMonth[r.month] = (p.byMonth[r.month] ?? 0) + r.qty;
      if (last3.includes(r.month)) p.last3 += r.qty;
      if (prev3.includes(r.month)) p.prev3 += r.qty;
    }
    return Object.values(map).sort((a, b) => b.w - a.w);
  }, [rows]);
  const top = products[0];
  const maxW = top?.w ?? 1;
  const maxCell = Math.max(1, ...products.flatMap(p => Object.values(p.byMonth)));

  const singleColor = sel === 'all' ? null : HOSP_COLOR[sel];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">輔大・西園 交接參考</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              前任業務 {TAKEOVER_PREV_REP} · {monthLabel(MONTHS[0])}–{monthLabel(LAST)}（資料至 {TAKEOVER_AS_OF.slice(5).replace('-', '/')}）· 依發票月、加權業績
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-600 hover:text-blue-600">主頁</Link>
            <Link href="/customers" className="text-sm text-gray-600 hover:text-blue-600">客戶</Link>
            <Link href="/performance" className="text-sm text-gray-600 hover:text-blue-600">個人業績</Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* 篩選 */}
        <div className="flex gap-2">
          {(['all', ...HOSPS] as Sel[]).map(h => (
            <button key={h} onClick={() => setSel(h)}
              className={`px-4 py-2 rounded-full text-sm font-medium border flex items-center gap-2 ${
                sel === h ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              {h !== 'all' && <span className="w-2 h-2 rounded-full" style={{ background: HOSP_COLOR[h] }} />}
              {h === 'all' ? '兩院合計' : h}
            </button>
          ))}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label={`${MONTHS.length} 個月加權合計`} value={fmtMoney(total)} />
          <Tile label="月均" value={fmtMoney(avg)} />
          <Tile label="近 3 月月均" value={fmtMoney(last3Avg)}
            sub={<span className={delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}% vs 前 3 月{PARTIAL_LAST ? '（9 月未滿）' : ''}</span>} />
          <Tile label="主力產品" value={top?.name ?? '—'} sub={top ? `佔 ${Math.round(top.w / total * 100)}%` : ''} />
        </div>

        {/* 月趨勢 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">每月業績（加權）</h2>
            {PARTIAL_LAST && <span className="text-xs text-gray-400">* {monthLabel(LAST)} 資料只到 {Number(TAKEOVER_AS_OF.slice(8))} 日</span>}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<MonthTip />} />
              {sel === 'all' && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
              {HOSPS.filter(h => sel === 'all' || sel === h).map((h, i, arr) => (
                <Bar key={h} dataKey={h} stackId="a" fill={singleColor ?? HOSP_COLOR[h]} stroke="#fff" strokeWidth={2}
                  radius={i === arr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 產品排行 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">產品排行</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left font-normal py-2">產品</th>
                  <th className="text-left font-normal py-2 w-[34%]">加權業績</th>
                  <th className="text-right font-normal py-2">佔比</th>
                  <th className="text-right font-normal py-2">數量</th>
                  <th className="text-right font-normal py-2">月均用量</th>
                  <th className="text-right font-normal py-2">近 3 月 vs 前 3 月</th>
                  <th className="text-right font-normal py-2">平均單價</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.name} className="border-b border-gray-50">
                    <td className="py-2.5">
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{CAT_ZH[TAKEOVER_CATEGORY[p.name]] ?? ''}</span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 rounded-r" style={{ width: `${Math.max(2, p.w / maxW * 100)}%`, background: singleColor ?? '#64748b' }} />
                        <span className="text-xs text-gray-600 tabular-nums whitespace-nowrap">{fmtK(p.w)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{Math.round(p.w / total * 100)}%</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-900">{p.qty}</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{(p.qty / MONTHS.length).toFixed(1)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span className="text-gray-900">{p.last3}</span>
                      <span className="text-gray-400"> / {p.prev3}</span>
                      {p.last3 !== p.prev3 && (
                        <span className={`ml-1.5 text-xs ${p.last3 > p.prev3 ? 'text-emerald-600' : 'text-red-500'}`}>{p.last3 > p.prev3 ? '▲' : '▼'}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{p.qty ? fmtMoney(p.rev / p.qty) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 每月用量 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">每月用量（支／片）</h2>
            <span className="text-xs text-gray-400">顏色越深＝用量越多 · 空白＝無</span>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="text-left font-normal pr-3 sticky left-0 bg-white">產品</th>
                  {MONTHS.map(m => <th key={m} className="font-normal w-12 text-center">{monthLabel(m)}{m === LAST && PARTIAL_LAST ? '*' : ''}</th>)}
                  <th className="font-normal w-14 text-right pl-2">合計</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.name}>
                    <td className="pr-3 py-0.5 text-gray-800 whitespace-nowrap sticky left-0 bg-white">{p.name}</td>
                    {MONTHS.map(m => {
                      const q = p.byMonth[m] ?? 0;
                      const t = q / maxCell;
                      return (
                        <td key={m} title={`${p.name} · ${monthLabel(m)}：${q}`}
                          className="h-8 text-center tabular-nums rounded"
                          style={{ background: q ? `rgba(14,116,144,${0.1 + t * 0.75})` : '#f8fafc', color: t > 0.5 ? '#fff' : '#111827' }}>
                          {q || ''}
                        </td>
                      );
                    })}
                    <td className="text-right pl-2 tabular-nums font-semibold text-gray-900">{p.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 交接重點 */}
        <div className="grid md:grid-cols-2 gap-4">
          {HOSPS.filter(h => sel === 'all' || sel === h).map(h => (
            <div key={h} className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: HOSP_COLOR[h] }} />{h} · 交接重點
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {NOTES[h].map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0">{n.tone === 'warn' ? '⚠️' : '✅'}</span><span>{n.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-black text-gray-900 mt-1 tabular-nums truncate">{value}</p>
      {sub && <p className="text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function MonthTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-gray-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />{p.dataKey}：{fmtMoney(p.value)}
        </p>
      ))}
      {payload.length > 1 && <p className="font-semibold text-gray-900 mt-1">合計 {fmtMoney(total)}</p>}
    </div>
  );
}
