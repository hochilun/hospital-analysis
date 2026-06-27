'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  MY_PERFORMANCE, CAT_ZH, CAT_COLOR, HOSP_COLOR, DEPT_LABEL,
  type DoctorEntry, type HospProdEntry, type MonthPerf,
} from '@/data/myPerformance';
import { SALES_BY_YEAR } from '@/data/salesHistory';

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${Math.round(n / 1_000)}K`
  : String(n);

const fmtMoney = (n: number) => '$' + n.toLocaleString('zh-TW');

const CAT_ORDER = ['Adhesion Prevention', 'Urinary Incontinence', 'Hernia', 'Hemostasis'];
const sortByCategory = (prods: HospProdEntry[]) =>
  [...prods].sort((a, b) => {
    const diff = CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category);
    return diff !== 0 ? diff : b.rev - a.rev;
  });

const lsKey = (month: string, hosp: string, prod: string) =>
  `perf-doctors-${month}-${hosp}-${prod}`;

const loadDoctors = (month: string, hosp: string, prod: string): DoctorEntry[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(lsKey(month, hosp, prod)) ?? '[]'); }
  catch { return []; }
};

const saveDoctors = (month: string, hosp: string, prod: string, data: DoctorEntry[]) => {
  localStorage.setItem(lsKey(month, hosp, prod), JSON.stringify(data));
};

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}：{fmtMoney(p.value)}</p>
      ))}
    </div>
  );
};

const TrendTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const p26 = payload.find((p: any) => p.dataKey === '2026');
  const p25 = payload.find((p: any) => p.dataKey === '2025');
  const yoy = payload[0]?.payload?.yoy;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {p26 && <p style={{ color: '#3b82f6' }}>2026：{fmtMoney(p26.value)}</p>}
      {p25 && <p className="text-gray-400">2025：{fmtMoney(p25.value)}</p>}
      {yoy !== null && yoy !== undefined && (
        <p className={`font-bold mt-1 ${yoy >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          同期 {yoy >= 0 ? '▲' : '▼'}{Math.abs(yoy)}%
        </p>
      )}
    </div>
  );
};

const DEPT_COLOR_MAP: Record<string, string> = {
  GYN: 'bg-pink-100 text-pink-700',
  GU:  'bg-blue-100 text-blue-700',
  GS:  'bg-green-100 text-green-700',
  ENT: 'bg-orange-100 text-orange-700',
  TS:  'bg-purple-100 text-purple-700',
  BS:  'bg-rose-100 text-rose-700',
};

const ALL = '__all__';

// 將單月 myPerformance（應收）轉換為加權業績
function toWeighted(m: MonthPerf) {
  const overallRatio = m.revenue > 0 ? m.weighted / m.revenue : 1;

  // byHospital：優先用 salesHistory 精確加權值
  const hospRow = SALES_BY_YEAR['2026'].MONTHLY_BY_HOSPITAL.find(r => r.month === m.label);
  const byHospital: Record<string, number> = {};
  if (hospRow) {
    for (const [k, v] of Object.entries(hospRow)) {
      if (k !== 'month' && typeof v === 'number' && v > 0) byHospital[k] = v;
    }
  } else {
    for (const [h, v] of Object.entries(m.byHospital)) {
      byHospital[h] = Math.round(v * overallRatio);
    }
  }

  // byCategory：優先用 salesHistory 精確加權值
  const catRow = SALES_BY_YEAR['2026'].MONTHLY_BY_CATEGORY.find(r => r.month === m.label);
  const byCategory: Record<string, number> = {};
  if (catRow) {
    for (const cat of ['Hemostasis', 'Adhesion Prevention', 'Hernia', 'Urinary Incontinence']) {
      const v = catRow[cat] as number | undefined;
      if (v && v > 0) byCategory[cat] = v;
    }
  } else {
    for (const [c, v] of Object.entries(m.byCategory)) {
      byCategory[c] = Math.round(v * overallRatio);
    }
  }

  // hospitalProducts：依各醫院實際加權比例換算
  const hospitalProducts: Record<string, HospProdEntry[]> = {};
  for (const [h, prods] of Object.entries(m.hospitalProducts)) {
    const hRev = m.byHospital[h] ?? 0;
    const hW   = byHospital[h]  ?? 0;
    const hRatio = hRev > 0 ? hW / hRev : overallRatio;
    hospitalProducts[h] = prods.map(p => ({ ...p, rev: Math.round(p.rev * hRatio) }));
  }

  // byProduct：用整體比例換算
  const byProduct = m.byProduct.map(p => ({ ...p, rev: Math.round(p.rev * overallRatio) }));

  return { revenue: m.weighted, weighted: m.weighted, byHospital, byCategory, byProduct, hospitalProducts };
}

function aggregatePerf(months: MonthPerf[]) {
  const byHospital: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byProductMap: Record<string, HospProdEntry> = {};
  const hospProdMap: Record<string, Record<string, HospProdEntry>> = {};
  let total = 0;

  for (const m of months) {
    const w = toWeighted(m);
    total += w.revenue;
    for (const [h, v] of Object.entries(w.byHospital)) {
      byHospital[h] = (byHospital[h] ?? 0) + v;
    }
    for (const [c, v] of Object.entries(w.byCategory)) {
      byCategory[c] = (byCategory[c] ?? 0) + v;
    }
    for (const p of w.byProduct) {
      if (byProductMap[p.name]) {
        byProductMap[p.name] = { ...byProductMap[p.name], qty: byProductMap[p.name].qty + p.qty, rev: byProductMap[p.name].rev + p.rev };
      } else {
        byProductMap[p.name] = { ...p };
      }
    }
    for (const [h, prods] of Object.entries(w.hospitalProducts)) {
      if (!hospProdMap[h]) hospProdMap[h] = {};
      for (const p of prods) {
        if (hospProdMap[h][p.name]) {
          hospProdMap[h][p.name] = { ...hospProdMap[h][p.name], qty: hospProdMap[h][p.name].qty + p.qty, rev: hospProdMap[h][p.name].rev + p.rev };
        } else {
          hospProdMap[h][p.name] = { ...p };
        }
      }
    }
  }

  return {
    revenue: total, weighted: total, byHospital, byCategory,
    byProduct: Object.values(byProductMap).sort((a, b) => b.rev - a.rev),
    hospitalProducts: Object.fromEntries(
      Object.entries(hospProdMap).map(([h, mp]) => [h, Object.values(mp).sort((a, b) => b.rev - a.rev)])
    ),
  };
}

export default function PerformancePage() {
  const data = MY_PERFORMANCE;
  const latest = data[data.length - 1];
  const ytd = useMemo(() => aggregatePerf(data), []);
  const totalRevenue = useMemo(() => data.reduce((s, m) => s + m.revenue, 0), []);

  const ytdLabel = data.length === 1
    ? data[0].label
    : `${data[0].label}–${data[data.length - 1].label}`;

  const [selectedHosp, setSelectedHosp] = useState<string>(ALL);
  const [selectedProd, setSelectedProd] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);
  const [addingTo, setAddingTo] = useState<{ prod: string } | null>(null);
  const [form, setForm] = useState<{ dept: string; name: string; qty: number | string }>({ dept: 'GYN', name: '', qty: 1 });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  // 月份篩選資料：null = 整年度累積，否則顯示單月（全部轉為加權業績）
  const monthData = useMemo(() => {
    if (!selectedMonth) return ytd;
    const m = data.find(d => d.label === selectedMonth);
    if (!m) return ytd;
    return toWeighted(m);
  }, [selectedMonth, ytd, data]);

  const periodLabel = selectedMonth ?? ytdLabel;
  const activeMonthKey = selectedMonth
    ? (data.find(d => d.label === selectedMonth)?.month ?? latest.month)
    : latest.month;

  // 月份趨勢：salesHistory 2026 vs 2025 同期
  const trendData = useMemo(() => {
    const rev2026 = SALES_BY_YEAR['2026'].MONTHLY_REV;
    const rev2025 = SALES_BY_YEAR['2025'].MONTHLY_REV;
    return rev2026.map(r => {
      const v25 = rev2025.find(x => x.month === r.month)?.rev ?? 0;
      const yoy = v25 > 0 ? Math.round(((r.rev - v25) / v25) * 100) : null;
      return { label: r.month, '2026': r.rev, '2025': v25, yoy };
    });
  }, []);

  // 年度累積醫院排名（salesHistory 全 6 個月加總）
  const ytdHospData = useMemo(() => {
    const rows = SALES_BY_YEAR['2026'].MONTHLY_BY_HOSPITAL;
    const map: Record<string, number> = {};
    const names = ['沙爾德聖', '恩主公', '台北醫學', '宏恩醫療', '中心診所', '台北慈濟', '長庚土城'];
    for (const row of rows) {
      for (const h of names) {
        if (row[h]) map[h] = (map[h] ?? 0) + (row[h] as number);
      }
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, rev]) => ({ name, 年度累積: rev }));
  }, []);

  // 最新月份醫院排名（加權業績）
  const latestHospData = useMemo(() => {
    const w = toWeighted(latest);
    return Object.entries(w.byHospital)
      .sort((a, b) => b[1] - a[1])
      .map(([name, rev]) => ({ name, [latest.label]: rev }));
  }, [latest]);

  const hospList = Object.keys(monthData.byHospital);
  const isAll = selectedHosp === ALL;

  const hospProds: HospProdEntry[] = isAll
    ? sortByCategory(monthData.byProduct)
    : sortByCategory(monthData.hospitalProducts[selectedHosp] ?? []);
  const hospTotal = isAll ? monthData.revenue : (monthData.byHospital[selectedHosp] ?? 0);

  const catAgg: Record<string, number> = {};
  if (isAll) {
    Object.entries(monthData.byCategory).forEach(([cat, rev]) => { catAgg[cat] = rev; });
  } else {
    hospProds.forEach(p => { catAgg[p.category] = (catAgg[p.category] ?? 0) + p.rev; });
  }
  const catPieData = Object.entries(catAgg)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, value]) => ({ name: CAT_ZH[cat] ?? cat, cat, value }));

  // 整年度時跨月合計；單月時只讀該月
  const months4Doctors = selectedMonth ? [activeMonthKey] : data.map(m => m.month);

  // 讀取單一醫院＋產品的醫師資料（可跨月合計）
  const loadDoctorsForPeriod = (hosp: string, prod: string): DoctorEntry[] => {
    const map: Record<string, DoctorEntry> = {};
    for (const mk of months4Doctors) {
      for (const d of loadDoctors(mk, hosp, prod)) {
        const key = `${d.dept}|${d.name}`;
        if (map[key]) { map[key] = { ...map[key], qty: map[key].qty + d.qty }; }
        else           { map[key] = { ...d }; }
      }
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  };

  const rankingDoctors: (DoctorEntry & { hosps?: string[] })[] = (() => {
    if (!selectedProd) return [];
    const targetHosps = isAll ? hospList : [selectedHosp];
    const map: Record<string, DoctorEntry & { hosps: string[] }> = {};
    for (const hosp of targetHosps) {
      for (const mk of months4Doctors) {
        loadDoctors(mk, hosp, selectedProd).forEach(d => {
          const key = `${d.dept}|${d.name}`;
          if (!map[key]) map[key] = { ...d, qty: 0, hosps: [] };
          map[key].qty += d.qty;
          if (!map[key].hosps.includes(hosp)) map[key].hosps.push(hosp);
        });
      }
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  })();

  const handleAdd = (prod: string) => {
    const qty = Number(form.qty);
    if (!form.name.trim() || qty < 1) return;
    const existing = loadDoctors(activeMonthKey, selectedHosp, prod);
    if (editingIdx !== null) {
      existing[editingIdx] = { dept: form.dept, name: form.name.trim(), qty };
    } else {
      existing.push({ dept: form.dept, name: form.name.trim(), qty });
    }
    saveDoctors(activeMonthKey, selectedHosp, prod, existing);
    setAddingTo(null);
    setEditingIdx(null);
    setForm({ dept: 'GYN', name: '', qty: 1 });
    refresh();
  };

  const handleDelete = (prod: string, idx: number) => {
    const existing = loadDoctors(activeMonthKey, selectedHosp, prod);
    existing.splice(idx, 1);
    saveDoctors(activeMonthKey, selectedHosp, prod, existing);
    refresh();
  };

  const openEdit = (prod: string, idx: number, entry: DoctorEntry) => {
    setAddingTo({ prod });
    setEditingIdx(idx);
    setForm({ dept: entry.dept, name: entry.name, qty: entry.qty });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">個人業績</h1>
            <p className="text-sm text-gray-500">
              何季倫 · 2026 年
              {(() => {
                const a = [...data].reverse().find((m) => m.asOf);
                if (!a?.asOf) return null;
                const [, mm, dd] = a.asOf.split('-');
                return (
                  <span className="ml-2 text-gray-400">
                    · 資料更新至 {Number(mm)}/{Number(dd)}
                  </span>
                );
              })()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-600 hover:text-blue-600">主頁</Link>
            <Link href="/customers" className="text-sm text-gray-600 hover:text-blue-600">客戶</Link>
            <Link href="/products" className="text-sm text-gray-600 hover:text-blue-600">產品</Link>
            <Link href="/sales" className="text-sm text-gray-600 hover:text-blue-600">公司業績</Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* KPI */}
        <div className="grid grid-cols-2 gap-4">
          <KpiCard label="累積應收金額" value={fmtMoney(totalRevenue)} sub={ytdLabel} color="blue" />
          <KpiCard
            label="累積加權業績"
            value={fmtMoney(ytd.weighted)}
            sub={`加權率 ${Math.round((ytd.weighted / totalRevenue) * 100)}%`}
            color="green"
          />
        </div>

        {/* 月份趨勢折線圖 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-base font-semibold text-gray-800">月份業績趨勢（加權業績）</h2>
            <span className="text-xs text-gray-400">— 2026 實線　- - 2025 同期</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<TrendTip />} />
              <Legend
                formatter={(v) => v === '2026' ? '2026 加權業績' : '2025 同期'}
                wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 8 }}
              />
              <Line type="monotone" dataKey="2026" stroke="#3b82f6" strokeWidth={2.5}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="2025" stroke="#d1d5db" strokeWidth={1.5}
                strokeDasharray="5 3" dot={{ r: 3, fill: '#d1d5db', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 醫院業績排名：年度累積 + 最新月份 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">醫院業績排名・年度累積</h2>
            <ResponsiveContainer width="100%" height={ytdHospData.length * 50}>
              <BarChart layout="vertical" data={ytdHospData} barSize={16}
                margin={{ left: 8, right: 72, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tickFormatter={fmt}
                  tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={72}
                  tick={{ fontSize: 13, fill: '#374151', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="年度累積" radius={[0, 4, 4, 0]}>
                  {ytdHospData.map((entry, i) => (
                    <Cell key={i} fill={HOSP_COLOR[entry.name] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">醫院業績排名・{latest.label}</h2>
            <ResponsiveContainer width="100%" height={latestHospData.length * 50}>
              <BarChart layout="vertical" data={latestHospData} barSize={16}
                margin={{ left: 8, right: 72, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tickFormatter={fmt}
                  tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={72}
                  tick={{ fontSize: 13, fill: '#374151', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey={latest.label} radius={[0, 4, 4, 0]}>
                  {latestHospData.map((entry, i) => (
                    <Cell key={i} fill={HOSP_COLOR[entry.name] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 醫院選擇器（月份篩選） */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400 font-medium">月份篩選：</span>
            {[null, ...data.map(d => d.label)].map(mo => (
              <button key={mo ?? 'all'}
                onClick={() => { setSelectedMonth(mo); setAddingTo(null); setSelectedProd(null); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedMonth === mo
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {mo === null ? '整年度' : mo}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
            選擇醫院查看詳情（{selectedMonth ? selectedMonth : `${ytdLabel} 累積`}）
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => { setSelectedHosp(ALL); setAddingTo(null); setSelectedProd(null); }}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 text-sm font-medium transition-all ${
                isAll ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span>全部</span>
              <span className={`text-xs ${isAll ? 'text-blue-500' : 'text-gray-400'}`}>
                {fmtMoney(monthData.revenue)} · 100%
              </span>
            </button>
            {hospList.map(hosp => {
              const rev = monthData.byHospital[hosp];
              const pct = Math.round((rev / monthData.revenue) * 100);
              const isActive = hosp === selectedHosp;
              return (
                <button key={hosp}
                  onClick={() => { setSelectedHosp(hosp); setAddingTo(null); setSelectedProd(null); }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 text-sm font-medium transition-all ${
                    isActive ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: HOSP_COLOR[hosp] ?? '#94a3b8' }} />
                  <span>{hosp}</span>
                  <span className={`text-xs ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                    {fmtMoney(rev)} · {pct}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 品類圓餅 + 產品明細 */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="text-base font-semibold text-gray-800">{isAll ? '全部醫院' : selectedHosp}</h2>
              <span className="text-xs text-gray-400">{periodLabel}</span>
            </div>
            <p className="text-2xl font-black text-gray-900 mb-4">{fmtMoney(hospTotal)}</p>
            <div className="flex justify-center">
              <PieChart width={220} height={180}>
                <Pie data={catPieData} cx="50%" cy="50%"
                  innerRadius={48} outerRadius={76} paddingAngle={3} dataKey="value">
                  {catPieData.map(e => (
                    <Cell key={e.cat} fill={CAT_COLOR[e.cat] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtMoney(Number(v))} />
              </PieChart>
            </div>
            <div className="space-y-1.5 mt-2">
              {catPieData.map(({ name, cat, value }) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: CAT_COLOR[cat] }} />
                    <span className="text-gray-600">{name}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold text-gray-900">{fmtMoney(value)}</span>
                    <span className="text-gray-400 text-xs w-8 text-right">
                      {Math.round((value / hospTotal) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-3 bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">產品 &amp; 使用醫師</h2>
              {selectedProd && <span className="text-xs text-gray-400">點擊產品查看醫師排行</span>}
            </div>

            {hospProds.map(prod => {
              const doctors = isAll ? [] : loadDoctorsForPeriod(selectedHosp, prod.name);
              const isAddingThis = addingTo?.prod === prod.name;
              const usedQty = doctors.reduce((s, d) => s + d.qty, 0);
              const isSelected = selectedProd === prod.name;

              return (
                <div key={prod.name}
                  className={`border rounded-xl p-4 space-y-3 cursor-pointer transition-all ${
                    isSelected ? 'border-blue-300 bg-blue-50/40' : 'border-gray-100 hover:border-gray-200'
                  }`}
                  onClick={() => setSelectedProd(isSelected ? null : prod.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: CAT_COLOR[prod.category] + '20', color: CAT_COLOR[prod.category] }}>
                        {CAT_ZH[prod.category] ?? prod.category}
                      </span>
                      <span className="font-bold text-gray-900">{prod.name}</span>
                      <span className="text-gray-400 text-sm">{prod.qty} 件</span>
                    </div>
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                      <span className="font-bold text-gray-900">{fmtMoney(prod.rev)}</span>
                      {!isAll && (
                        <button
                          onClick={() => {
                            if (isAddingThis) { setAddingTo(null); setEditingIdx(null); }
                            else { setAddingTo({ prod: prod.name }); setEditingIdx(null); setForm({ dept: 'GYN', name: '', qty: prod.qty - usedQty > 0 ? prod.qty - usedQty : 1 }); }
                          }}
                          className="text-xs px-3 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium"
                        >
                          {isAddingThis ? '取消' : '+ 新增醫師'}
                        </button>
                      )}
                    </div>
                  </div>

                  {!isAll && doctors.length > 0 && (
                    <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                      {doctors.map((d, i) => (
                        <div key={i} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${DEPT_COLOR_MAP[d.dept] ?? 'bg-gray-100 text-gray-600'}`}>
                          <span className="font-semibold">{DEPT_LABEL[d.dept] ?? d.dept}</span>
                          <span>·</span>
                          <span>{d.name}</span>
                          <span className="opacity-60">×{d.qty}</span>
                          <button onClick={() => openEdit(prod.name, i, d)} className="ml-1 opacity-50 hover:opacity-100">✎</button>
                          <button onClick={() => handleDelete(prod.name, i)} className="opacity-40 hover:opacity-100">×</button>
                        </div>
                      ))}
                      {usedQty < prod.qty && (
                        <span className="text-xs text-amber-500 self-center">未分配 {prod.qty - usedQty} 件</span>
                      )}
                    </div>
                  )}

                  {isAddingThis && (
                    <div className="flex items-end gap-3 pt-1 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-600 font-medium">科別</label>
                        <select value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}
                          style={{ color: '#111827' }}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                          {Object.entries(DEPT_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs text-gray-600 font-medium">醫師姓名</label>
                        <input type="text" placeholder="例：王醫師" value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (e.currentTarget.closest('.flex')?.parentElement?.querySelector('input[type="number"]') as HTMLElement)?.focus();
                            }
                          }}
                          style={{ color: '#111827' }}
                          className="text-sm placeholder:text-gray-400 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div className="flex flex-col gap-1 w-20">
                        <label className="text-xs text-gray-600 font-medium">數量</label>
                        <input type="number" min={1} max={prod.qty} value={form.qty}
                          onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAdd(prod.name)}
                          style={{ color: '#111827' }}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <button onClick={() => handleAdd(prod.name)}
                        className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
                        {editingIdx !== null ? '更新' : '確認'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 醫師用量排行 */}
        {selectedProd && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-800">醫師用量排行</h2>
                <p className="text-sm text-gray-400 mt-0.5">{isAll ? '全部醫院' : selectedHosp} · {selectedProd}</p>
              </div>
              <button onClick={() => setSelectedProd(null)}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded">
                收起
              </button>
            </div>
            {rankingDoctors.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">尚未輸入使用醫師資料</p>
            ) : (
              <div className="space-y-2">
                {rankingDoctors.map((d, i) => {
                  const maxQty = rankingDoctors[0].qty;
                  const pct = Math.round((d.qty / maxQty) * 100);
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <span className={`text-sm font-bold w-5 text-right ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                        {i + 1}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium min-w-[52px] text-center ${DEPT_COLOR_MAP[d.dept] ?? 'bg-gray-100 text-gray-600'}`}>
                        {DEPT_LABEL[d.dept] ?? d.dept}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 w-24">{d.name}</span>
                      {(d as any).hosps && (
                        <span className="text-xs text-gray-400">{(d as any).hosps.join('、')}</span>
                      )}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: CAT_COLOR[hospProds.find(p => p.name === selectedProd)?.category ?? ''] ?? '#3b82f6' }} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-12 text-right">{d.qty} 件</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: 'blue' | 'green';
}) {
  const t = color === 'blue' ? 'text-blue-600' : 'text-emerald-600';
  return (
    <div className="rounded-2xl border border-gray-100 p-5 bg-white">
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-black ${t}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
