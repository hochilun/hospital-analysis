'use client';

// 各產品群表現 —— 產品群 × 醫院的疊加檢視。
//
// 顏色規則（dataviz）：
// - 主軸＝產品群時，堆疊段落＝醫院，用 HOSP_COLOR，**固定照 HOSP_ORDER 排**。
//   HOSP_ORDER 的相鄰配對已通過檢核（worst CVD ΔE 8.4／一般視覺 16.1）；七個類別色
//   不可能通過「任意配對」檢核，所以順序不能動，且每段都配文字標籤（段內或下方 caption），
//   顏色只是輔助、識別靠文字。
// - 主軸＝醫院時，段落＝四個品類，用 CAT_COLOR（已通過全配對檢核）。
// - 段與段之間留 2px 底色縫，兩端 4px 圓角。
// - 有 3:1 對比未達標的色（emerald/amber），依規則必須提供文字標籤與表格檢視，兩者都有。

import { useMemo, useState } from 'react';
import {
  CAT_ZH, CAT_COLOR, CAT_DISPLAY_ORDER, HOSP_COLOR, HOSP_ORDER,
  type HospProdEntry,
} from '@/data/myPerformance';

type EffMonth = {
  byHospital: Record<string, number>;
  hospitalProducts: Record<string, HospProdEntry[]>;
};

type Seg = { key: string; label: string; color: string; rev: number };
type ProdRow = { name: string; qty: number; rev: number; segs: Seg[] };
type Row = { key: string; label: string; color: string; total: number; segs: Seg[]; products: ProdRow[] };

const money = (n: number) => Math.round(n).toLocaleString('zh-TW');
const SURFACE = '#ffffff';

// 段內直接標名字的門檻。門檻要看「佔整個容器的寬度」而不是「佔該列的比例」——
// 短的那幾列整條就只有容器的兩成寬，用列內比例判斷會把字塞進 40px 的格子裡切掉。
// 容器約 1030px：醫院名 4 個中文字 ≈ 50px，再加金額 ≈ 100px。
const LABEL_PCT = 5.5;    // 佔容器寬度 %，只標名字
const AMOUNT_PCT = 10.5;  // 佔容器寬度 %，名字＋金額

export default function ProductGroupPanel({
  effByLabel, periods, partialNote,
}: {
  effByLabel: Record<string, EffMonth>;
  periods: { labels: string[]; curM: string; curQ: string[] };
  partialNote?: string;
}) {
  const [scope, setScope] = useState<'month' | 'quarter' | 'ytd'>('ytd');
  const [axis, setAxis] = useState<'cat' | 'hosp'>('cat');
  const [view, setView] = useState<'bar' | 'table'>('bar');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; row: string; seg: Seg; pct: number } | null>(null);

  const labels = scope === 'month' ? [periods.curM] : scope === 'quarter' ? periods.curQ : periods.labels;
  const scopeName = scope === 'month' ? `本月 ${periods.curM}` : scope === 'quarter' ? `本季（${periods.curQ.join('＋')}）` : '年度累計';

  // cube[品類][醫院][產品] = { qty, rev }
  const cube = useMemo(() => {
    const m: Record<string, Record<string, Record<string, { qty: number; rev: number }>>> = {};
    for (const l of labels) {
      const e = effByLabel[l];
      if (!e) continue;
      for (const [h, prods] of Object.entries(e.hospitalProducts)) {
        for (const p of prods) {
          if (p.rev <= 0) continue;
          const byHosp = (m[p.category] ??= {});
          const byProd = (byHosp[h] ??= {});
          const cell = (byProd[p.name] ??= { qty: 0, rev: 0 });
          cell.qty += p.qty;
          cell.rev += p.rev;
        }
      }
    }
    return m;
  }, [labels, effByLabel]);

  const cats = CAT_DISPLAY_ORDER.filter(c => cube[c]);
  const hosps = HOSP_ORDER.filter(h => cats.some(c => cube[c]?.[h]));
  const grand = cats.reduce((s, c) => s + Object.values(cube[c] ?? {})
    .reduce((t, ps) => t + Object.values(ps).reduce((u, v) => u + v.rev, 0), 0), 0);

  const cellRev = (c: string, h: string) =>
    Object.values(cube[c]?.[h] ?? {}).reduce((s, v) => s + v.rev, 0);

  const rows: Row[] = useMemo(() => {
    if (axis === 'cat') {
      return cats.map(c => {
        // 段落固定照 HOSP_ORDER —— 相鄰配對才是通過檢核的那組
        const segs: Seg[] = hosps
          .map(h => ({ key: h, label: h, color: HOSP_COLOR[h] ?? '#94a3b8', rev: cellRev(c, h) }))
          .filter(s => s.rev > 0);
        const prodMap: Record<string, ProdRow> = {};
        for (const h of hosps) {
          for (const [name, v] of Object.entries(cube[c]?.[h] ?? {})) {
            const r = (prodMap[name] ??= { name, qty: 0, rev: 0, segs: [] });
            r.qty += v.qty;
            r.rev += v.rev;
            r.segs.push({ key: h, label: h, color: HOSP_COLOR[h] ?? '#94a3b8', rev: v.rev });
          }
        }
        return {
          key: c, label: CAT_ZH[c] ?? c, color: CAT_COLOR[c] ?? '#94a3b8',
          total: segs.reduce((s, x) => s + x.rev, 0), segs,
          products: Object.values(prodMap).sort((a, b) => b.rev - a.rev),
        };
      }).sort((a, b) => b.total - a.total);
    }
    return hosps.map(h => {
      const segs: Seg[] = cats
        .map(c => ({ key: c, label: CAT_ZH[c] ?? c, color: CAT_COLOR[c] ?? '#94a3b8', rev: cellRev(c, h) }))
        .filter(s => s.rev > 0);
      const products: ProdRow[] = [];
      for (const c of cats) {
        for (const [name, v] of Object.entries(cube[c]?.[h] ?? {})) {
          products.push({
            name, qty: v.qty, rev: v.rev,
            segs: [{ key: c, label: CAT_ZH[c] ?? c, color: CAT_COLOR[c] ?? '#94a3b8', rev: v.rev }],
          });
        }
      }
      return {
        key: h, label: h, color: HOSP_COLOR[h] ?? '#94a3b8',
        total: segs.reduce((s, x) => s + x.rev, 0), segs,
        products: products.sort((a, b) => b.rev - a.rev),
      };
    }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
    // cube 決定 cats/hosps，不另列依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cube, axis]);

  const maxTotal = Math.max(...rows.map(r => r.total), 1);
  const legend: Seg[] = axis === 'cat'
    ? hosps.map(h => ({ key: h, label: h, color: HOSP_COLOR[h] ?? '#94a3b8', rev: 0 }))
    : cats.map(c => ({ key: c, label: CAT_ZH[c] ?? c, color: CAT_COLOR[c] ?? '#94a3b8', rev: 0 }));

  const pill = (on: boolean) =>
    `px-3 py-1 rounded-full text-xs font-medium transition-colors ${
      on ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 relative"
      onMouseLeave={() => setHover(null)}>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h2 className="text-base font-semibold text-gray-800">各產品群表現</h2>
        <span className="text-xs text-gray-400">{scopeName}・加權業績；點一列看群內產品</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setView('bar')} className={pill(view === 'bar')}>長條</button>
          <button onClick={() => setView('table')} className={pill(view === 'table')}>表格</button>
        </div>
      </div>
      {scope === 'month' && partialNote && (
        <p className="text-xs text-amber-600 mb-2">※ {periods.curM}僅計至 {partialNote}，與整月相比會偏低</p>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-3 mb-1">
        <span className="text-xs text-gray-400 font-medium">期間：</span>
        <button onClick={() => setScope('month')} className={pill(scope === 'month')}>本月 {periods.curM}</button>
        <button onClick={() => setScope('quarter')} className={pill(scope === 'quarter')}>本季</button>
        <button onClick={() => setScope('ytd')} className={pill(scope === 'ytd')}>年度累計</button>
        <span className="text-gray-200 select-none mx-1">｜</span>
        <span className="text-xs text-gray-400 font-medium">主軸：</span>
        <button onClick={() => { setAxis('cat'); setOpenRow(null); }} className={pill(axis === 'cat')}>產品群</button>
        <button onClick={() => { setAxis('hosp'); setOpenRow(null); }} className={pill(axis === 'hosp')}>醫院</button>
      </div>

      {/* 圖例：段落顏色的對照，識別另有段內／下方文字標籤 */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 mb-4 text-xs text-gray-500">
        {legend.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">此期間沒有資料</p>
      ) : view === 'table' ? (
        <MatrixTable cats={cats} hosps={hosps} cellRev={cellRev} grand={grand} />
      ) : (
        <div className="space-y-3.5">
          {rows.map(r => {
            const open = openRow === r.key;
            const share = grand > 0 ? (r.total / grand) * 100 : 0;
            return (
              <div key={r.key}>
                <button onClick={() => setOpenRow(open ? null : r.key)}
                  className="w-full text-left group">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                    <span className="text-sm font-semibold text-gray-800">{r.label}</span>
                    <span className="text-xs text-gray-300 group-hover:text-gray-500">{open ? '▾' : '▸'}</span>
                    <span className="ml-auto text-sm font-bold text-gray-900 tabular-nums">{money(r.total)}</span>
                    <span className="text-xs text-gray-400 tabular-nums w-10 text-right">{share.toFixed(0)}%</span>
                  </div>
                  <StackBar segs={r.segs} total={r.total} widthPct={(r.total / maxTotal) * 100} labels
                    onHover={(seg, pct, e) => setHover({
                      x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, row: r.label, seg, pct,
                    })}
                    onLeave={() => setHover(null)} />
                  {/* 段落文字對照：識別不靠顏色，順序與長條由左至右一致 */}
                  <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                    {r.segs.map((s, i) => (
                      <span key={s.key}>
                        {i > 0 && <span className="text-gray-200"> · </span>}
                        <span className="text-gray-500">{s.label}</span>{' '}
                        <span className="tabular-nums">{money(s.rev)}</span>
                      </span>
                    ))}
                  </p>
                </button>

                {open && (
                  <div className="mt-2 ml-4 border-l-2 border-gray-100 pl-4 space-y-1.5">
                    {r.products.map(p => {
                      const pShare = r.total > 0 ? (p.rev / r.total) * 100 : 0;
                      return (
                        <div key={p.name} className="flex items-center gap-3 text-xs">
                          <span className="text-gray-600 w-28 shrink-0 truncate" title={p.name}>{p.name}</span>
                          <span className="text-gray-400 tabular-nums w-12 text-right">{p.qty} 件</span>
                          <div className="flex-1 min-w-[60px]">
                            <StackBar segs={p.segs} total={p.rev} widthPct={pShare} height={10} />
                          </div>
                          <span className="font-semibold text-gray-700 tabular-nums w-20 text-right">{money(p.rev)}</span>
                          <span className="text-gray-400 tabular-nums w-10 text-right">{pShare.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-baseline gap-2 pt-3 border-t border-gray-100">
            <span className="text-sm font-semibold text-gray-600">合計</span>
            <span className="ml-auto text-sm font-bold text-gray-900 tabular-nums">{money(grand)}</span>
            <span className="text-xs text-gray-400 w-10 text-right">100%</span>
          </div>
        </div>
      )}

      {hover && <HoverTip hover={hover} />}
    </div>
  );
}

// 堆疊長條：段與段之間 2px 底色縫、兩端 4px 圓角、夠寬的段落直接標名字
function StackBar({ segs, total, widthPct, height = 22, labels = false, onHover, onLeave }: {
  segs: Seg[]; total: number; widthPct: number; height?: number; labels?: boolean;
  onHover?: (seg: Seg, pct: number, e: React.MouseEvent) => void;
  onLeave?: () => void;
}) {
  return (
    <div className="w-full">
      <div className="flex" style={{ width: `${Math.max(widthPct, 0.6)}%`, height, gap: 2, background: SURFACE }}>
        {segs.map((s, i) => {
          const pct = total > 0 ? (s.rev / total) * 100 : 0;
          const ofContainer = (pct * widthPct) / 100;   // 這一段佔整個容器寬度的 %
          const first = i === 0, last = i === segs.length - 1;
          return (
            <div key={s.key}
              onMouseMove={e => onHover?.(s, pct, e)}
              onMouseLeave={onLeave}
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: `${pct}%`, background: s.color,
                borderTopLeftRadius: first ? 4 : 0, borderBottomLeftRadius: first ? 4 : 0,
                borderTopRightRadius: last ? 4 : 0, borderBottomRightRadius: last ? 4 : 0,
              }}>
              {labels && ofContainer >= LABEL_PCT && (
                <span className="text-[10px] font-medium text-white whitespace-nowrap px-1 leading-none">
                  {s.label}{ofContainer >= AMOUNT_PCT && ` ${money(s.rev)}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HoverTip({ hover }: { hover: { row: string; seg: Seg; pct: number } }) {
  return (
    <div className="pointer-events-none fixed left-1/2 bottom-6 -translate-x-1/2 z-30 bg-gray-900/95 text-white rounded-xl shadow-lg px-4 py-2 text-xs">
      <span className="text-gray-300">{hover.row}</span>
      <span className="mx-2 inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-sm inline-block" style={{ background: hover.seg.color }} />
        {hover.seg.label}
      </span>
      <span className="font-bold tabular-nums">{money(hover.seg.rev)}</span>
      <span className="text-gray-400 ml-1.5 tabular-nums">{hover.pct.toFixed(0)}%</span>
    </div>
  );
}

// 表格檢視：品類 × 醫院矩陣（對比未達 3:1 的色必須要有的文字備援）
function MatrixTable({ cats, hosps, cellRev, grand }: {
  cats: readonly string[]; hosps: readonly string[];
  cellRev: (c: string, h: string) => number; grand: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100">
            <th className="text-left font-medium py-2 pr-3">產品群</th>
            {hosps.map(h => (
              <th key={h} className="text-right font-medium py-2 px-2 whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: HOSP_COLOR[h] }} />{h}
                </span>
              </th>
            ))}
            <th className="text-right font-medium py-2 pl-3">合計</th>
          </tr>
        </thead>
        <tbody>
          {cats.map(c => {
            const total = hosps.reduce((s, h) => s + cellRev(c, h), 0);
            return (
              <tr key={c} className="border-b border-gray-50">
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: CAT_COLOR[c] }} />
                    <span className="font-medium text-gray-700">{CAT_ZH[c] ?? c}</span>
                  </span>
                </td>
                {hosps.map(h => {
                  const v = cellRev(c, h);
                  return (
                    <td key={h} className={`py-2 px-2 text-right ${v > 0 ? 'text-gray-800' : 'text-gray-200'}`}>
                      {v > 0 ? money(v) : '—'}
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right font-semibold text-gray-900">{money(total)}</td>
              </tr>
            );
          })}
          <tr className="bg-gray-50/80 font-bold">
            <td className="py-2 pr-3 text-gray-700">合計</td>
            {hosps.map(h => (
              <td key={h} className="py-2 px-2 text-right text-gray-800">
                {money(cats.reduce((s, c) => s + cellRev(c, h), 0))}
              </td>
            ))}
            <td className="py-2 pl-3 text-right text-gray-900">{money(grand)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
