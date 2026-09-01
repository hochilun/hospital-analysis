'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import type { Doctor } from '@/types';
import type { DocPerf } from '@/lib/doctorPerf';
import { DEPT_LABEL } from '@/data/hospitals';

// 單一色相 sequential ramp（磁量用），來自驗證過的藍色階
const SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95'];
// 四象限配色。象限本來就由中位線的「位置」決定，顏色只是把位置再講一次（冗餘編碼），
// 所以散布圖用到 4 個分類不會讓資訊只靠顏色傳達。
// 三個實色經 validate_palette 全數通過（最差 protan ΔE 9.2 / 一般視覺 25.6）；
// 開發池刻意留低彩度灰 —— 它是「背景群」，讓另外三群跳出來（emphasis 模式）。
const QUAD = {
  明星:   { dot: '#047857', tile: 'text-emerald-800 bg-emerald-50 border-emerald-200', desc: '拜訪多、業績高' },
  金雞母: { dot: '#1d4ed8', tile: 'text-blue-800 bg-blue-50 border-blue-200',        desc: '拜訪少、業績高' },
  待檢討: { dot: '#c2410c', tile: 'text-orange-800 bg-orange-50 border-orange-200',  desc: '拜訪多、業績低' },
  開發池: { dot: '#9ca3af', tile: 'text-gray-600 bg-gray-50 border-gray-200',        desc: '拜訪少、業績低' },
} as const;
type Quad = keyof typeof QUAD;
const QUAD_ORDER: Quad[] = ['明星', '金雞母', '待檢討', '開發池'];
const INK = '#374151';
const MUTED = '#9ca3af';
const GRID = '#eef0f2';

const money = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(Math.round(n));

type Row = {
  id: string; name: string; dept: string; hosp: string;
  visits: number; rev: number; kinds: number; flagged: boolean;
  x?: number;   // 繪圖用的抖動後座標；判讀一律用 visits
};

export default function CustomerInsights({ doctors, perfById, visitCountById, periodLabel }: {
  doctors: Doctor[];
  perfById: Record<string, DocPerf>;
  visitCountById: Record<string, number>;
  periodLabel: string;
}) {
  const [tableView, setTableView] = useState(false);

  const rows: Row[] = useMemo(() => doctors.map(d => {
    const p = perfById[d.id];
    return {
      id: d.id, name: d.name,
      dept: DEPT_LABEL[d.department] ?? d.department,
      hosp: d.hospitalName || '—',
      visits: visitCountById[d.id] ?? 0,
      rev: p?.rev ?? 0,
      kinds: p?.merged.length ?? 0,
      flagged: false,
    };
  }), [doctors, perfById, visitCountById]);

  // 門檻：拜訪取全體中位數；業績取「有業績者」的中位數（用全體會是 0，切不開）
  const med = (a: number[]) => {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };
  const visitThreshold = med(rows.map(r => r.visits));
  const revThreshold = med(rows.filter(r => r.rev > 0).map(r => r.rev));

  // 拜訪次數是整數、無業績者業績同為 0，多人會疊在同一像素。
  // 用 id 雜湊產生「穩定」的水平微位移把點攤開（每次渲染結果一致）；
  // tooltip 與表格一律顯示原始整數，不影響判讀。
  const jitter = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.6;   // ±0.3 次
  };
  const quadrant = (r: { visits: number; rev: number }): Quad =>
    r.rev >= revThreshold ? (r.visits > visitThreshold ? '明星' : '金雞母')
                          : (r.visits > visitThreshold ? '待檢討' : '開發池');
  const scored = rows.map(r => ({
    ...r,
    quad: quadrant(r),
    flagged: r.visits > visitThreshold && r.rev < revThreshold,
    x: Math.max(0, r.visits + jitter(r.id)),
  }));
  const counts = scored.reduce<Record<string, number>>((acc, r) => {
    acc[r.quad] = (acc[r.quad] ?? 0) + 1; return acc;
  }, {});
  // 分界畫在整數中間，拜訪次數是整數、抖動僅 ±0.3，點永遠不會跨到錯的一側
  const xSplit = visitThreshold + 0.5;
  const maxX = Math.max(...scored.map(r => r.x), 1);
  const maxY = Math.max(...scored.map(r => r.rev), 1);

  // 只在極端值直接標名字：業績前 5、以及待檢討中拜訪最多的 5 位
  const labelIds = useMemo(() => {
    const byRev = [...scored].filter(r => r.rev > 0).sort((a, b) => b.rev - a.rev).slice(0, 5);
    const byVisit = [...scored].filter(r => r.flagged).sort((a, b) => b.visits - a.visits).slice(0, 3);
    return new Set([...byRev, ...byVisit].map(r => r.id));
  }, [scored]);
  // 待檢討多半擠在相近的拜訪次數上，標籤上下交錯才不會疊在一起
  const labelOffset = useMemo(() => {
    const m: Record<string, number> = {};
    [...labelIds].forEach((id, i) => { m[id] = i % 2 === 0 ? -12 : 22; });
    return m;
  }, [labelIds]);

  // ── 產品 × 醫師矩陣 ──────────────────────────────────────
  const matrix = useMemo(() => {
    const docs = doctors
      .map(d => ({ d, p: perfById[d.id] }))
      .filter((x): x is { d: Doctor; p: DocPerf } => !!x.p && x.p.rev > 0)
      .sort((a, b) => b.p.rev - a.p.rev);
    const prodTotal: Record<string, number> = {};
    for (const { p } of docs) for (const m of p.merged) prodTotal[m.name] = (prodTotal[m.name] ?? 0) + m.rev;
    const prods = Object.entries(prodTotal).sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const cell = (docId: string, prod: string) =>
      docs.find(x => x.d.id === docId)?.p.merged.find(m => m.name === prod)?.rev ?? 0;
    // 集中度：某產品最大單一醫師佔比
    const concentration: Record<string, { pct: number; who: string }> = {};
    for (const prod of prods) {
      let best = { pct: 0, who: '' };
      for (const { d } of docs) {
        const v = cell(d.id, prod);
        const pct = prodTotal[prod] > 0 ? (v / prodTotal[prod]) * 100 : 0;
        if (pct > best.pct) best = { pct, who: d.name };
      }
      concentration[prod] = best;
    }
    return { docs, prods, prodTotal, cell, concentration };
  }, [doctors, perfById]);

  const shade = (v: number, colTotalMax: number) => {
    if (v <= 0) return null;
    const t = colTotalMax > 0 ? v / colTotalMax : 0;
    return SEQ[Math.min(SEQ.length - 1, Math.max(0, Math.round(t * (SEQ.length - 1))))];
  };

  const Tip = ({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-gray-800">{r.name} <span className="font-normal text-gray-400">{r.dept}</span></p>
        <p className="text-gray-500">{r.hosp}</p>
        <p className="text-gray-700 mt-1">拜訪 <b>{r.visits}</b> 次 · 業績 <b>${r.rev.toLocaleString()}</b></p>
        <p className="text-gray-400">用 {r.kinds} 支產品 · <span style={{ color: QUAD[quadrant(r)].dot }} className="font-medium">{quadrant(r)}</span></p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── 四象限 ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-700">投入 vs 產出</h2>
          <span className="text-xs text-gray-400">{periodLabel} · {scored.length} 位</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          橫軸＝這段期間拜訪次數（投入），縱軸＝歸屬到該醫師的業績（產出，平方根刻度）。
          分界為中位數：拜訪 {visitThreshold} 次、業績 ${revThreshold.toLocaleString()}。圓圈大小＝使用的產品支數。
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {QUAD_ORDER.map(q => (
            <div key={q} className={`rounded-lg border px-3 py-2 ${QUAD[q].tile}`}>
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: QUAD[q].dot }} />{q}
              </div>
              <div className="text-xl font-bold">{counts[q] ?? 0}</div>
              <div className="text-[10px] opacity-70">{QUAD[q].desc}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs">
          {QUAD_ORDER.map(q => (
            <span key={q} className="flex items-center gap-1.5 text-gray-600">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: QUAD[q].dot }} />
              {q} <span className="text-gray-400">{counts[q] ?? 0}</span>
            </span>
          ))}
          <button onClick={() => setTableView(v => !v)}
            className="ml-auto text-xs text-gray-400 hover:text-gray-700 underline">
            {tableView ? '看圖表' : '看表格'}
          </button>
        </div>

        {tableView ? (
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-gray-500">
                  {['醫師', '科別', '醫院', '拜訪', '業績', '產品數', '象限'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...scored].sort((a, b) => b.rev - a.rev || b.visits - a.visits).map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5"><Link href={`/customers/${r.id}`} className="text-blue-600 hover:underline">{r.name}</Link></td>
                    <td className="px-3 py-1.5 text-gray-500">{r.dept}</td>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.hosp}</td>
                    <td className="px-3 py-1.5 tabular-nums text-right">{r.visits}</td>
                    <td className="px-3 py-1.5 tabular-nums text-right">{r.rev ? r.rev.toLocaleString() : '—'}</td>
                    <td className="px-3 py-1.5 tabular-nums text-right">{r.kinds || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5" style={{ color: QUAD[r.quad].dot }}>
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: QUAD[r.quad].dot }} />
                        {r.quad}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 30, right: 28, bottom: 32, left: 18 }}>
                <CartesianGrid stroke={GRID} />
                <XAxis type="number" dataKey="x" name="拜訪次數"
                  domain={[0, 'dataMax']} allowDecimals={false}
                  tick={{ fontSize: 11, fill: MUTED }} stroke={GRID}
                  tickFormatter={(v: number) => String(Math.round(v))}
                  label={{ value: '拜訪次數（投入）', position: 'insideBottom', offset: -18, fontSize: 11, fill: MUTED }} />
                <YAxis type="number" dataKey="rev" name="業績" scale="sqrt" domain={[0, 'dataMax']}
                  tick={{ fontSize: 11, fill: MUTED }} stroke={GRID} tickFormatter={(v: number) => money(v)}
                  width={52}
                  label={{ value: '業績（產出）', angle: -90, position: 'insideLeft', fontSize: 11, fill: MUTED }} />
                <ZAxis type="number" dataKey="kinds" range={[64, 420]} />
                {/* 象限底色：把位置這件事再講一次，顏色就不是唯一的識別管道 */}
                <ReferenceArea x1={0} x2={xSplit} y1={revThreshold} y2={maxY} fill={QUAD['金雞母'].dot} fillOpacity={0.05} />
                <ReferenceArea x1={xSplit} x2={maxX} y1={revThreshold} y2={maxY} fill={QUAD['明星'].dot} fillOpacity={0.05} />
                <ReferenceArea x1={0} x2={xSplit} y1={0} y2={revThreshold} fill={QUAD['開發池'].dot} fillOpacity={0.06} />
                <ReferenceArea x1={xSplit} x2={maxX} y1={0} y2={revThreshold} fill={QUAD['待檢討'].dot} fillOpacity={0.05} />
                <ReferenceLine x={xSplit} stroke="#d1d5db"
                  label={{ value: `中位 ${visitThreshold} 次`, position: 'top', fontSize: 10, fill: MUTED }} />
                <ReferenceLine y={revThreshold} stroke="#d1d5db"
                  label={{ value: `中位 ${money(revThreshold)}`, position: 'right', fontSize: 10, fill: MUTED }} />
                <Tooltip content={<Tip />} cursor={{ strokeDasharray: '0', stroke: '#e5e7eb' }} />
                <Scatter data={scored} fillOpacity={0.75}>
                  {scored.map(r => (
                    <Cell key={r.id} fill={QUAD[r.quad].dot} stroke="#fff" strokeWidth={2} />
                  ))}
                  {/* 只直接標極端值（業績前 5、待檢討中拜訪最多 5 位），其餘交給 tooltip */}
                  <LabelList dataKey="name" content={(props: unknown) => {
                    const { x, y, index } = props as { x?: number; y?: number; index?: number };
                    const r = typeof index === 'number' ? scored[index] : undefined;
                    if (!r || !labelIds.has(r.id) || x === undefined || y === undefined) return null;
                    return (
                      <text x={x} y={y + (labelOffset[r.id] ?? -10)} textAnchor="middle" fontSize={10}
                        fill={QUAD[r.quad].dot} fontWeight={600}>{r.name}</text>
                    );
                  }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 產品 × 醫師 熱力圖 ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-700">產品 × 醫師</h2>
          <span className="text-xs text-gray-400">{matrix.docs.length} 位有業績 · {matrix.prods.length} 支產品</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          顏色深淺＝該產品在這位醫師身上的金額（每支產品各自比較，深＝這支產品主要靠他）。
          空白＝沒用過，是交叉銷售的機會。
        </p>
        <div className="flex items-center gap-2 mb-3 text-[10px] text-gray-400">
          <span>少</span>
          {SEQ.filter((_, i) => i % 2 === 0).map(c => (
            <span key={c} className="inline-block w-6 h-3 rounded-sm" style={{ background: c }} />
          ))}
          <span>多</span>
        </div>

        {matrix.docs.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">目前篩選條件下沒有有業績的醫師</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left font-medium text-gray-500 px-2 whitespace-nowrap">醫師</th>
                  {matrix.prods.map(p => (
                    <th key={p} className="px-1 pb-1 font-medium text-gray-500 align-bottom h-[158px]">
                      <div className="whitespace-nowrap text-[10px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 150 }}>{p}</div>
                    </th>
                  ))}
                  <th className="px-2 font-medium text-gray-500 text-right whitespace-nowrap">合計</th>
                </tr>
              </thead>
              <tbody>
                {matrix.docs.map(({ d, p }) => (
                  <tr key={d.id}>
                    <th className="sticky left-0 bg-white text-left font-normal px-2 whitespace-nowrap">
                      <Link href={`/customers/${d.id}`} className="text-gray-700 hover:text-blue-600 hover:underline">{d.name}</Link>
                    </th>
                    {matrix.prods.map(prod => {
                      const v = matrix.cell(d.id, prod);
                      const bg = shade(v, matrix.prodTotal[prod]);
                      return (
                        <td key={prod} className="text-center tabular-nums rounded"
                          style={{ background: bg ?? '#fafafa', minWidth: 52, padding: '4px 6px',
                                   color: bg && v / matrix.prodTotal[prod] > 0.55 ? '#fff' : INK }}
                          title={`${d.name} · ${prod}：$${v.toLocaleString()}`}>
                          {v > 0 ? money(v) : <span className="text-gray-300">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-2 text-right tabular-nums font-semibold text-gray-800 whitespace-nowrap">{money(p.rev)}</td>
                  </tr>
                ))}
                <tr>
                  <th className="sticky left-0 bg-white text-left font-medium text-gray-500 px-2 pt-2 whitespace-nowrap">最集中</th>
                  {matrix.prods.map(prod => {
                    const c = matrix.concentration[prod];
                    const risky = c.pct >= 70;
                    return (
                      <td key={prod} className="text-center pt-2 align-top">
                        <div className={`text-[10px] tabular-nums font-semibold ${risky ? 'text-red-600' : 'text-gray-400'}`}>
                          {Math.round(c.pct)}%
                        </div>
                        <div className="text-[9px] text-gray-400 whitespace-nowrap">{c.who}</div>
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3">
          「最集中」＝這支產品最大單一醫師的佔比，<span className="text-red-600 font-medium">紅色代表 ≥70%</span>，
          等於這支產品押在一個人身上，他一走就掉一大塊。
        </p>
      </div>
    </div>
  );
}
