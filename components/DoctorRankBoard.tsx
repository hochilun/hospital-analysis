'use client';

// 醫師（客戶）業績排行 —— 取代原本的卡片牆。
//
// 為什麼換：卡片牆用「面積」編碼業績，面積是最難比較的視覺通道，加上卡內色帶、
// 頂端色條、四種字級分層，資訊多但讀不出順序。改成一行一位的排行榜：
// 長度編碼金額（最好比較的通道），名次與金額直接寫出來，顏色只標主力品類。
//
// 產品篩選：選一支產品後，排行改成「這支產品的醫師貢獻排名」，金額與件數都只算該產品。

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CAT_ZH, CAT_COLOR, DEPT_LABEL } from '@/data/myPerformance';
import { type DocPerf } from '@/lib/doctorPerf';

const money = (n: number) => '$' + Math.round(n).toLocaleString('zh-TW');
const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(Math.round(n));

const DEPT_COLOR_MAP: Record<string, string> = {
  GYN: 'bg-pink-100 text-pink-700',
  GU:  'bg-blue-100 text-blue-700',
  GS:  'bg-green-100 text-green-700',
  ENT: 'bg-orange-100 text-orange-700',
  TS:  'bg-purple-100 text-purple-700',
  BS:  'bg-rose-100 text-rose-700',
};

type Row = {
  key: string;
  doc: DocPerf;
  rev: number;        // 篩選中＝該產品貢獻；未篩選＝總業績
  qty: number;
  cat: string;        // 主力品類（未篩選）或該產品品類
  hosps: string[];
  topName: string;    // 主力產品名（未篩選時顯示）
  topPct: number;
};

export default function DoctorRankBoard({
  docs, periodMonths, periodLabel, scopeLabel, coverage, linkByName, unmatched,
}: {
  docs: DocPerf[];
  periodMonths: number;
  periodLabel: string;
  scopeLabel: string;
  coverage: number;
  linkByName: Record<string, { id: string }>;
  unmatched: string[];
}) {
  const [prod, setProd] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // 產品籌碼：期間內所有產品，依總業績由大到小
  const prodChips = useMemo(() => {
    const m: Record<string, { name: string; cat: string; rev: number }> = {};
    for (const d of docs) {
      for (const p of d.merged) {
        const e = (m[p.name] ??= { name: p.name, cat: p.cat, rev: 0 });
        e.rev += p.rev;
      }
    }
    return Object.values(m).sort((a, b) => b.rev - a.rev);
  }, [docs]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const d of docs) {
      const key = `${d.dept}|${d.name}`;
      if (prod) {
        const mg = d.merged.find(p => p.name === prod);
        if (!mg || mg.rev <= 0) continue;
        out.push({
          key, doc: d, rev: mg.rev, qty: mg.qty, cat: mg.cat,
          hosps: [...new Set(d.products.filter(p => p.name === prod).map(p => p.hosp))],
          topName: prod, topPct: 100,
        });
      } else {
        if (d.rev <= 0) continue;
        const top = d.merged[0];
        out.push({
          key, doc: d, rev: d.rev, qty: d.qty, cat: top?.cat ?? '',
          hosps: [...new Set(d.products.map(p => p.hosp))],
          topName: top?.name ?? '—',
          topPct: d.rev > 0 && top ? Math.round((top.rev / d.rev) * 100) : 0,
        });
      }
    }
    return out.sort((a, b) => b.rev - a.rev);
  }, [docs, prod]);

  const total = rows.reduce((s, r) => s + r.rev, 0) || 1;
  const max = rows[0]?.rev ?? 1;
  // 有出現的品類才進圖例
  const cats = [...new Set(rows.map(r => r.cat).filter(Boolean))];

  const pill = (on: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
      on ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-gray-800">客戶業績排行</h2>
        <span className="text-xs text-gray-400">
          {scopeLabel} · {periodLabel} · {prod ? `${prod} 的醫師貢獻` : '依歸屬業績'}
          {docs.length > 0 && (
            <span className={coverage < 95 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
              {' · '}醫師已登記 {coverage}% 業績{coverage < 95 && '（未登記者不列入，月均／活躍月數會偏低）'}
            </span>
          )}
        </span>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">尚未輸入使用醫師資料，可至上方各產品「+ 新增醫師」</p>
      ) : (
        <>
          {unmatched.length > 0 && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
              ⚠️ 這 {unmatched.length} 位在客戶資料庫查無此人，多半是選字錯誤：
              <span className="font-semibold"> {unmatched.join('、')}</span>
              <span className="text-red-400">　改成與 <Link href="/customers" className="underline">客戶資料庫</Link> 一致的寫法即可接起來。</span>
            </div>
          )}

          {/* 產品篩選 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-xs text-gray-400 font-medium mr-0.5">產品：</span>
            <button onClick={() => setProd(null)} className={pill(prod === null)}>全部</button>
            {prodChips.map(p => (
              <button key={p.name} onClick={() => { setProd(p.name); setOpen(null); }}
                className={`${pill(prod === p.name)} inline-flex items-center gap-1.5`}>
                <span className="w-2 h-2 rounded-sm"
                  style={{ background: prod === p.name ? 'rgba(255,255,255,.85)' : (CAT_COLOR[p.cat] ?? '#94a3b8') }} />
                {p.name}
              </button>
            ))}
          </div>

          {/* 圖例：長條顏色＝主力品類 */}
          {cats.length > 1 && (
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mb-3 text-[11px] text-gray-400">
              <span>長條顏色＝{prod ? '產品品類' : '主力產品品類'}：</span>
              {cats.map(c => (
                <span key={c} className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CAT_COLOR[c] ?? '#94a3b8' }} />
                  {CAT_ZH[c] ?? c}
                </span>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">這支產品在本期間沒有登記使用醫師</p>
          ) : (
            <div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 pb-1.5 border-b border-gray-100">
                <span className="w-6 text-right">#</span>
                <span className="w-16">科別</span>
                <span className="w-20">醫師</span>
                <span className="flex-1 min-w-[80px]" />
                <span className="w-36">{prod ? '該醫師總業績' : '主力產品'}</span>
                <span className="w-24">醫院</span>
                <span className="w-12 text-right">件數</span>
                <span className="w-24 text-right">業績</span>
                <span className="w-10 text-right">佔比</span>
                <span className="w-4" />
              </div>

              {rows.map((r, i) => {
                const on = open === r.key;
                const pct = (r.rev / total) * 100;
                return (
                  <div key={r.key} className="border-b border-gray-50 last:border-0">
                    <button onClick={() => setOpen(on ? null : r.key)}
                      className={`w-full flex items-center gap-3 py-2 text-left transition-colors ${on ? 'bg-gray-50' : 'hover:bg-gray-50/60'}`}>
                      <span className={`w-6 text-right text-sm font-bold tabular-nums ${
                        i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                        {i + 1}
                      </span>
                      <span className={`w-16 text-[11px] px-2 py-0.5 rounded-full font-medium text-center ${DEPT_COLOR_MAP[r.doc.dept] ?? 'bg-gray-100 text-gray-600'}`}>
                        {DEPT_LABEL[r.doc.dept] ?? r.doc.dept}
                      </span>
                      <span className="w-20 text-sm font-semibold text-gray-800 truncate">{r.doc.name}</span>

                      <span className="flex-1 min-w-[80px] h-2.5 bg-gray-100 rounded overflow-hidden">
                        <span className="block h-full rounded"
                          style={{ width: `${Math.max((r.rev / max) * 100, 1.5)}%`, background: CAT_COLOR[r.cat] ?? '#94a3b8' }} />
                      </span>
                      <span className="w-36 text-[11px] text-gray-500 truncate">
                        {/* 篩選中重複列產品名沒有資訊；改成「這支佔他總業績多少」 */}
                        {prod
                          ? `${money(r.doc.rev)}・佔 ${r.doc.rev > 0 ? Math.round((r.rev / r.doc.rev) * 100) : 0}%`
                          : `${r.topName} ${r.topPct}%`}
                      </span>
                      <span className="w-24 text-[11px] text-gray-400 truncate" title={r.hosps.join('、')}>
                        {r.hosps.join('、')}
                      </span>

                      <span className="w-12 text-right text-xs text-gray-400 tabular-nums">{r.qty} 件</span>
                      <span className="w-24 text-right text-sm font-bold text-gray-900 tabular-nums">{money(r.rev)}</span>
                      <span className="w-10 text-right text-xs text-gray-400 tabular-nums">{pct.toFixed(0)}%</span>
                      <span className="w-4 text-xs text-gray-300 text-center">{on ? '▾' : '▸'}</span>
                    </button>

                    {on && <DoctorDetail d={r.doc} periodMonths={periodMonths} link={linkByName[r.doc.name]} />}
                  </div>
                );
              })}

              <div className="flex items-center gap-3 pt-2.5 text-sm">
                <span className="w-6" />
                <span className="font-semibold text-gray-600">合計 {rows.length} 位</span>
                <span className="flex-1" />
                <span className="w-36" />
                <span className="w-24" />
                <span className="w-12" />
                <span className="w-24 text-right font-bold text-gray-900 tabular-nums">{money(total)}</span>
                <span className="w-10 text-right text-xs text-gray-400">100%</span>
                <span className="w-4" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DoctorDetail({ d, periodMonths, link }: {
  d: DocPerf; periodMonths: number; link?: { id: string };
}) {
  const sponPct = d.rev > 0 ? Math.round((d.sponsor / d.rev) * 100) : 0;
  return (
    <div className="mb-3 ml-9 mr-1 border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span className="text-sm font-bold text-gray-900 tabular-nums">{money(d.rev)}</span>
        <span className="text-xs text-gray-400">
          {d.qty} 件 · 月均 {money(Math.round(d.rev / periodMonths))} · 活躍 {d.activeMonths}/{periodMonths} 月
          {d.sponsor > 0 && ` · 學贊 ${money(d.sponsor)}（佔業績 ${sponPct}%）`}
        </span>
        {link ? (
          <Link href={`/customers/${link.id}`} className="ml-auto text-xs text-blue-600 hover:underline">客戶資料 →</Link>
        ) : (
          <span className="ml-auto text-xs text-red-500" title="姓名與客戶資料庫對不起來，可能是選字錯誤">⚠️ 客戶資料庫查無此人</span>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400 pb-1 border-b border-gray-100">
        <span>產品</span>
        <div className="flex gap-3 items-center">
          <span className="w-10 text-right">件數</span>
          <span className="w-20 text-right">業績</span>
          <span className="w-20 text-right">學術贊助</span>
        </div>
      </div>
      {d.products.map((p, idx) => (
        <div key={idx} className="flex items-center justify-between text-sm py-1">
          <span className="text-gray-600">
            {p.name}<span className="text-gray-400 text-xs ml-1">@{p.hosp}</span>
          </span>
          <div className="flex gap-3 items-center tabular-nums">
            <span className="text-gray-400 text-xs w-10 text-right">{p.qty} 件</span>
            <span className="font-semibold text-gray-800 w-20 text-right">{money(p.rev)}</span>
            <span className={`w-20 text-right text-xs ${p.sponsor > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
              {p.sponsor > 0 ? money(p.sponsor) : '無贊助'}
            </span>
          </div>
        </div>
      ))}

      {d.monthly.some(m => m.rev > 0) && (
        <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
          {d.monthly.map(m => (
            <div key={m.label} className="flex-1 text-center">
              <p className="text-[10px] text-gray-400">{m.label}</p>
              <p className={`text-xs font-semibold tabular-nums ${m.rev > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                {m.rev > 0 ? short(m.rev) : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
