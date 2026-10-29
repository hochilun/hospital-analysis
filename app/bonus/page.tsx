'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MY_PERFORMANCE } from '@/data/myPerformance';
import { SALES_BY_YEAR } from '@/data/salesHistory';
import { TAKEOVER_ROWS } from '@/data/takeoverHistory';
import { monthWorkdays, elapsedWorkdays, isFixedMonthly } from '@/data/workdays';
import { effectiveMonth, loadClaims, type ClaimsMap } from '@/lib/perfCore';
import { forceSync } from '@/lib/supabase';
import { BONUS_TIERS, QUARTERS, calcBonus, nextTier, quarterOf } from '@/lib/bonus';

const YEAR = '2026';
const fmtMoney = (n: number) => '$' + Math.round(n).toLocaleString('zh-TW');
const fmtWan = (n: number) => `${(n / 10_000).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬`;
const pctLabel = (r: number) => `${(r * 100).toLocaleString('zh-TW', { maximumFractionDigits: 1 })}%`;
const monthNum = (mk: string) => Number(mk.slice(5, 7));
const shortDate = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

// 輔大・西園 11 月起由 Mars 接手：還沒有實際業績的月份，用前任最近三個完整月（6–8 月）的平均月加權業績頂著
const TAKEOVER_START = '2026-11';
const TAKEOVER_BASE_MONTHS = ['2026-06', '2026-07', '2026-08'];
const TAKEOVER_MONTHLY: Record<string, number> = (() => {
  const sum: Record<string, number> = {};
  for (const r of TAKEOVER_ROWS) {
    if (TAKEOVER_BASE_MONTHS.includes(r.month)) sum[r.hosp] = (sum[r.hosp] ?? 0) + r.weighted;
  }
  return Object.fromEntries(Object.entries(sum).map(([h, v]) => [h, v / TAKEOVER_BASE_MONTHS.length]));
})();

type MonthActual = { weighted: number; byHospital: Record<string, number> };

/** 某月實際加權業績（有效業績）：5 月起用業績頁同一套計算，1–4 月用 salesHistory（只有獨跑） */
function monthActual(mk: string, claims: ClaimsMap): MonthActual | null {
  const m = MY_PERFORMANCE.find(x => x.month === mk);
  if (m) {
    const e = effectiveMonth(m, claims);
    return { weighted: e.weighted, byHospital: e.byHospital };
  }
  if (!mk.startsWith(YEAR)) return null;
  const label = `${monthNum(mk)}月`;
  const y = SALES_BY_YEAR[YEAR];
  const rev = y.MONTHLY_REV.find(r => r.month === label);
  if (!rev) return null;
  const row = y.MONTHLY_BY_HOSPITAL.find(r => r.month === label) ?? {};
  const byHospital: Record<string, number> = {};
  for (const [k, v] of Object.entries(row)) if (k !== 'month' && typeof v === 'number') byHospital[k] = v;
  return { weighted: rev.rev, byHospital };
}

export default function BonusPage() {
  const [mounted, setMounted] = useState(false);
  const [claims, setClaims] = useState<ClaimsMap>({});
  const [withTakeover, setWithTakeover] = useState(true);

  // 共跑認領以雲端為準，業績頁剛改過也能馬上反映
  useEffect(() => {
    setMounted(true);
    setClaims(loadClaims());
    forceSync('perf-claims').finally(() => setClaims(loadClaims()));
  }, []);

  const latest = MY_PERFORMANCE[MY_PERFORMANCE.length - 1];
  const curQ = quarterOf(latest.month);

  const quarters = useMemo(() => QUARTERS.map(({ q, months }) => {
    const keys = months.map(m => `${YEAR}-${m}`);
    const actuals = keys.map(k => monthActual(k, claims));
    const actual = actuals.reduce((s, a) => s + (a?.weighted ?? 0), 0);
    const hasData = actuals.some(Boolean);

    // 本季還沒跑完 → 預估。依「季內已過工作天」把目前步調推到整季。
    // 北醫這類月初一次開帳的醫院不能跟著天數放大：每月就是一筆，沒開到的月份用最近一個月的數字頂著。
    let forecast: null | {
      value: number; elapsed: number; total: number; paced: number; fixed: number; takeover: number;
    } = null;
    if (q === curQ) {
      const total = keys.reduce((s, k) => s + monthWorkdays(k), 0);
      const elapsed = keys.reduce((s, k) => {
        if (k < latest.month) return s + monthWorkdays(k);
        if (k === latest.month) return s + (latest.asOf ? elapsedWorkdays(k, latest.asOf) : monthWorkdays(k));
        return s;
      }, 0);
      const quarterDone = elapsed >= total;
      if (!quarterDone && elapsed > 0) {
        let paceBase = 0;
        const fixedHosps = new Set<string>();
        actuals.forEach(a => {
          if (!a) return;
          for (const [h, v] of Object.entries(a.byHospital)) {
            if (isFixedMonthly(h)) fixedHosps.add(h);
            else paceBase += v;
          }
        });
        const paced = paceBase * (total / elapsed);

        // 固定開帳醫院：逐月取實際值，沒有就用最近一次的月數字
        let fixed = 0;
        for (const h of fixedHosps) {
          let last = 0;
          for (const mk of MY_PERFORMANCE.map(x => x.month)) {
            const v = monthActual(mk, claims)?.byHospital[h] ?? 0;
            if (v > 0) last = v;
          }
          keys.forEach((k, i) => {
            const v = actuals[i]?.byHospital[h] ?? 0;
            fixed += v > 0 ? v : last;
          });
        }

        // 接手醫院：只補「還沒有資料」且在接手月以後的月份；有資料之後就由步調推估自然涵蓋
        let takeover = 0;
        if (withTakeover) {
          keys.forEach((k, i) => {
            if (k >= TAKEOVER_START && !actuals[i]) {
              takeover += Object.values(TAKEOVER_MONTHLY).reduce((s, v) => s + v, 0);
            }
          });
        }
        forecast = { value: paced + fixed + takeover, elapsed, total, paced, fixed, takeover };
      }
    }

    const basis = forecast ? forecast.value : actual;
    return {
      q, keys, actuals, actual, hasData, forecast,
      bonusActual: calcBonus(actual).total,
      bonus: calcBonus(basis),
      basis,
    };
  }), [claims, curQ, latest, withTakeover]);

  if (!mounted) return null;

  const cur = quarters.find(x => x.q === curQ)!;
  const curBasis = cur.basis;
  const tier = nextTier(curBasis);
  const yearBonus = quarters.reduce((s, x) => s + (x.hasData ? x.bonus.total : 0), 0);
  const maxBar = Math.max(6_500_000, curBasis * 1.1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">業務獎金</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              季獎金累進計算 · 加權業績（共跑只算本人／認領） · 資料更新至 {latest.asOf ? shortDate(latest.asOf) : `${monthNum(latest.month)}月底`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-600 hover:text-blue-600">主頁</Link>
            <Link href="/performance" className="text-sm text-gray-600 hover:text-blue-600">個人業績</Link>
            <Link href="/sponsorship" className="text-sm text-gray-600 hover:text-blue-600">學術贊助</Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* 本季 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-gray-500">Q{curQ} 本季（{monthNum(cur.keys[0])}–{monthNum(cur.keys[2])} 月）{cur.forecast ? '預估獎金' : '獎金'}</div>
              <div className="text-4xl font-bold text-gray-900 mt-1">{fmtMoney(cur.bonus.total)}</div>
              {cur.forecast && (
                <div className="text-sm text-gray-500 mt-1">
                  若停在目前累積：{fmtMoney(cur.bonusActual)}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <span className="text-gray-500">目前累積</span>
              <span className="text-right font-semibold text-gray-900">{fmtMoney(cur.actual)}</span>
              {cur.forecast && <>
                <span className="text-gray-500">預估整季</span>
                <span className="text-right font-semibold text-blue-700">{fmtMoney(cur.forecast.value)}</span>
                <span className="text-gray-500">季內工作天</span>
                <span className="text-right text-gray-700">已過 {cur.forecast.elapsed}／{cur.forecast.total} 天</span>
              </>}
            </div>
          </div>

          {/* 級距進度 */}
          <div>
            <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-gray-400" style={{ width: `${(cur.actual / maxBar) * 100}%` }} />
              {cur.forecast && (
                <div className="absolute inset-y-0 bg-blue-300"
                  style={{ left: `${(cur.actual / maxBar) * 100}%`, width: `${(Math.max(0, cur.forecast.value - cur.actual) / maxBar) * 100}%` }} />
              )}
              {BONUS_TIERS.slice(1).map(t => (
                <div key={t.from} className="absolute inset-y-0 w-px bg-gray-700" style={{ left: `${(t.from / maxBar) * 100}%` }} />
              ))}
            </div>
            <div className="relative h-5 mt-1 text-[11px] text-gray-500">
              {BONUS_TIERS.slice(1).map(t => (
                <span key={t.from} className="absolute -translate-x-1/2" style={{ left: `${(t.from / maxBar) * 100}%` }}>
                  {fmtWan(t.from)}・{pctLabel(t.rate)}
                </span>
              ))}
            </div>
            <div className="flex gap-4 text-xs text-gray-500 mt-1">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gray-400" />目前累積</span>
              {cur.forecast && <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-300" />預估到季末</span>}
            </div>
            <p className="text-sm text-gray-700 mt-3">
              {cur.forecast ? '預估' : ''}落在 <b>{pctLabel(tier.current.rate)}</b> 級距
              {tier.next && tier.gap !== null && <>，再 <b>{fmtWan(tier.gap)}</b> 就進 {pctLabel(tier.next.rate)} 級距</>}
            </p>
          </div>

          {/* 級距拆解 */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="text-left font-medium py-2">級距</th>
                <th className="text-right font-medium py-2">比率</th>
                <th className="text-right font-medium py-2">落在這段的業績</th>
                <th className="text-right font-medium py-2">獎金</th>
              </tr>
            </thead>
            <tbody>
              {cur.bonus.parts.map(p => (
                <tr key={p.from} className={`border-b border-gray-50 ${p.amount > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                  <td className="py-2">{fmtWan(p.from)} – {p.to ? fmtWan(p.to) : '以上'}</td>
                  <td className="text-right py-2">{pctLabel(p.rate)}</td>
                  <td className="text-right py-2">{fmtMoney(p.amount)}</td>
                  <td className="text-right py-2 font-medium">{fmtMoney(p.bonus)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-semibold" colSpan={3}>合計</td>
                <td className="text-right py-2 font-bold">{fmtMoney(cur.bonus.total)}</td>
              </tr>
            </tbody>
          </table>

          {/* 預估怎麼來的 */}
          {cur.forecast && (
            <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900 space-y-1.5">
              <div className="font-semibold">預估怎麼算</div>
              <div>・一般醫院：季內累積 ÷ 已過 {cur.forecast.elapsed} 工作天 × 整季 {cur.forecast.total} 天 ＝ {fmtMoney(cur.forecast.paced)}</div>
              {cur.forecast.fixed > 0 && (
                <div>・台北醫學（月初一次開帳，不按天數放大）：每月一筆，還沒開的月份用最近一個月頂著 ＝ {fmtMoney(cur.forecast.fixed)}</div>
              )}
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input type="checkbox" className="mt-1" checked={withTakeover} onChange={e => setWithTakeover(e.target.checked)} />
                <span>
                  加上輔大・西園（11 月起接手，還沒有實際業績的月份用前任 6–8 月平均：
                  {Object.entries(TAKEOVER_MONTHLY).map(([h, v]) => `${h} ${fmtWan(v)}／月`).join('、')}）
                  {withTakeover && cur.forecast.takeover > 0 && <> ＝ {fmtMoney(cur.forecast.takeover)}</>}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* 各季 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold text-gray-900">{YEAR} 各季</h2>
            <div className="text-sm text-gray-500">全年季獎金合計 <b className="text-gray-900 text-base">{fmtMoney(yearBonus)}</b></div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="text-left font-medium py-2">季</th>
                <th className="text-right font-medium py-2">各月加權業績</th>
                <th className="text-right font-medium py-2">季業績</th>
                <th className="text-right font-medium py-2">級距</th>
                <th className="text-right font-medium py-2">獎金</th>
              </tr>
            </thead>
            <tbody>
              {quarters.map(x => (
                <tr key={x.q} className={`border-b border-gray-50 ${x.hasData ? '' : 'text-gray-300'}`}>
                  <td className="py-2.5">
                    Q{x.q}
                    {x.forecast && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">預估</span>}
                  </td>
                  <td className="text-right py-2.5 text-gray-500 text-xs">
                    {x.keys.map((k, i) => `${monthNum(k)}月 ${x.actuals[i] ? fmtWan(x.actuals[i]!.weighted) : '—'}`).join('　')}
                  </td>
                  <td className="text-right py-2.5">
                    {x.hasData ? fmtMoney(x.basis) : '—'}
                    {x.forecast && <div className="text-[11px] text-gray-400">目前 {fmtMoney(x.actual)}</div>}
                  </td>
                  <td className="text-right py-2.5">{x.hasData ? pctLabel(nextTier(x.basis).current.rate) : '—'}</td>
                  <td className="text-right py-2.5 font-semibold">{x.hasData ? fmtMoney(x.bonus.total) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-3">
            1–4 月只有獨跑醫院的資料；5 月起含共跑醫院本人／認領部分。年度獎金（0.5%）規則未確認，未計入。
          </p>
        </div>
      </div>
    </div>
  );
}
