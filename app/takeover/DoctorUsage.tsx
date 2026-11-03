'use client';

import { useMemo } from 'react';
import { TAKEOVER_ROWS } from '@/data/takeoverHistory';
import { FJU_DOCTOR_USES, FJU_DOCTOR_AS_OF, FJU_DOCTOR_DEPT, FJU_DOCTOR_NOTE } from '@/data/takeoverDoctors';

const fmtK = (n: number) => n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(Math.round(n));
const monthLabel = (ym: string) => `${Number(ym.slice(5))}月`;
const TIP = 'Arista 塗佈器';

const MONTHS = [...new Set(FJU_DOCTOR_USES.map(u => u.date.slice(0, 7)))].sort();
const LAST3 = MONTHS.slice(-3), PREV3 = MONTHS.slice(-6, -3);

// 各產品平均每單位加權業績（輔大發票資料）→ 估算醫師貢獻
const UNIT_W: Record<string, number> = (() => {
  const s: Record<string, [number, number]> = {};
  for (const r of TAKEOVER_ROWS) if (r.hosp === '輔大醫院') {
    const e = (s[r.product] ??= [0, 0]); e[0] += r.weighted; e[1] += r.qty;
  }
  return Object.fromEntries(Object.entries(s).map(([k, [w, q]]) => [k, w / q]));
})();

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** 輔大 各醫師使用狀況（依使用日） */
export default function DoctorUsage() {
  const doctors = useMemo(() => {
    const map: Record<string, {
      name: string; byProduct: Record<string, number>; byMonth: Record<string, number>;
      units: number; w: number; last3: number; prev3: number; first: string; last: string;
    }> = {};
    for (const u of FJU_DOCTOR_USES) {
      const d = (map[u.doctor] ??= { name: u.doctor, byProduct: {}, byMonth: {}, units: 0, w: 0, last3: 0, prev3: 0, first: u.date, last: u.date });
      d.byProduct[u.product] = (d.byProduct[u.product] ?? 0) + u.qty;
      d.w += (UNIT_W[u.product] ?? 0) * u.qty;
      if (u.date < d.first) d.first = u.date;
      if (u.date > d.last) d.last = u.date;
      if (u.product === TIP) continue;   // 塗佈器跟著 Arista 走，不算「用量」
      const m = u.date.slice(0, 7);
      d.units += u.qty;
      d.byMonth[m] = (d.byMonth[m] ?? 0) + u.qty;
      if (LAST3.includes(m)) d.last3 += u.qty;
      if (PREV3.includes(m)) d.prev3 += u.qty;
    }
    return Object.values(map).sort((a, b) => b.w - a.w);
  }, []);

  const totalW = doctors.reduce((s, d) => s + d.w, 0);
  const maxCell = Math.max(1, ...doctors.flatMap(d => Object.values(d.byMonth)));

  const status = (d: typeof doctors[number]) => {
    const idle = daysBetween(d.last, FJU_DOCTOR_AS_OF);
    if (daysBetween(d.first, FJU_DOCTOR_AS_OF) <= 120 && d.prev3 === 0) return { label: '新用戶', cls: 'bg-blue-100 text-blue-700' };
    if (idle > 60) return { label: `${idle} 天沒用`, cls: 'bg-red-100 text-red-700' };
    if (d.last3 > d.prev3) return { label: '成長', cls: 'bg-emerald-100 text-emerald-700' };
    if (d.last3 < d.prev3) return { label: '下滑', cls: 'bg-amber-100 text-amber-700' };
    return { label: '持平', cls: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-800">輔大醫院 · 醫師使用狀況</h2>
        <span className="text-xs text-gray-500">
          依「使用日」（非發票日）· {monthLabel(MONTHS[0])}–{FJU_DOCTOR_AS_OF.slice(5).replace('-', '/')} · 估算業績＝用量 × 輔大平均單位加權
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-4">用量不含塗佈器 · 趨勢＝近 3 月（{LAST3.map(monthLabel).join('、')}）vs 前 3 月（{PREV3.map(monthLabel).join('、')}）</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100">
              <th className="text-left font-normal py-2">醫師</th>
              <th className="text-left font-normal py-2">使用產品</th>
              <th className="text-right font-normal py-2">估算業績</th>
              <th className="text-right font-normal py-2">佔比</th>
              <th className="text-right font-normal py-2">近3 / 前3</th>
              <th className="text-right font-normal py-2">最近使用</th>
              <th className="text-right font-normal py-2">狀態</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map(d => {
              const st = status(d);
              return (
                <tr key={d.name} className="border-b border-gray-50 align-top">
                  <td className="py-2.5 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{d.name}</span>
                    <span className="ml-1.5 text-xs text-gray-500">{FJU_DOCTOR_DEPT[d.name] ?? ''}</span>
                    {FJU_DOCTOR_NOTE[d.name] && <div className="text-xs text-gray-500 mt-0.5">{FJU_DOCTOR_NOTE[d.name]}</div>}
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(d.byProduct).sort((a, b) => b[1] - a[1]).map(([p, q]) => (
                        <span key={p} className={`text-xs px-1.5 py-0.5 rounded ${p === TIP ? 'bg-gray-50 text-gray-500' : 'bg-slate-100 text-gray-800'}`}>{p} ×{q}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-900">{fmtK(d.w)}</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-600">{Math.round(d.w / totalW * 100)}%</td>
                  <td className="py-2.5 text-right tabular-nums">
                    <span className="text-gray-900">{d.last3}</span><span className="text-gray-500"> / {d.prev3}</span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-600 whitespace-nowrap">{d.last.slice(5).replace('-', '/')}</td>
                  <td className="py-2.5 text-right"><span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-2">每月用量（支／片，不含塗佈器）</h3>
      <div className="overflow-x-auto">
        <table className="text-sm border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left font-normal pr-3 sticky left-0 bg-white">醫師</th>
              {MONTHS.map(m => <th key={m} className="font-normal w-11 text-center">{monthLabel(m)}</th>)}
              <th className="font-normal w-12 text-right pl-2">合計</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map(d => (
              <tr key={d.name}>
                <td className="pr-3 py-0.5 text-gray-800 whitespace-nowrap sticky left-0 bg-white">{d.name}</td>
                {MONTHS.map(m => {
                  const q = d.byMonth[m] ?? 0;
                  const t = q / maxCell;
                  return (
                    <td key={m} title={`${d.name} · ${monthLabel(m)}：${q}`} className="h-8 text-center tabular-nums rounded"
                      style={{ background: q ? `rgba(101,163,13,${0.12 + t * 0.73})` : '#f8fafc', color: t > 0.5 ? '#fff' : '#111827' }}>
                      {q || ''}
                    </td>
                  );
                })}
                <td className="text-right pl-2 tabular-nums font-semibold text-gray-900">{d.units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
