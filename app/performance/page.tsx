'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, BarChart, Bar,
} from 'recharts';
import {
  MY_PERFORMANCE, CAT_ZH, CAT_COLOR, HOSP_COLOR, DEPT_LABEL,
  SHARED_HOSPITALS, SHARED_PERFORMANCE, SHARED_AUTO, isSettledMonth, HOSP_ORDER,
  type DoctorEntry, type HospProdEntry, type MonthPerf,
} from '@/data/myPerformance';
import { sponsorAmount } from '@/data/sponsorship';
import { SALES_BY_YEAR } from '@/data/salesHistory';
import { pushToCloud, pullFromCloud } from '@/lib/supabase';
import {
  loadAllDoctors, loadDoctors, saveDoctors, migrateOldDoctorKeys,
  loadClaims, getClaim, saveClaim, isShared,
  claimedSharedMonth, effectiveMonth, effectiveAggregate, toWeighted,
  type ClaimsMap, type SharedProdView,
} from '@/lib/perfCore';
import { buildDoctorPerf, loadDoctorsForPeriod, linkDoctors, type DocPerf } from '@/lib/doctorPerf';
import { getDoctors } from '@/lib/storage';

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


export default function PerformancePage() {
  const data = MY_PERFORMANCE;
  const latest = data[data.length - 1];

  const ytdLabel = data.length === 1
    ? data[0].label
    : `${data[0].label}–${data[data.length - 1].label}`;

  const [trendHosp, setTrendHosp] = useState<string>(ALL);   // 頂部趨勢圖的醫院切換
  const [drillHosp, setDrillHosp] = useState<string | null>(null);   // 各醫院表格點選展開的細部
  const [viewMode, setViewMode] = useState<'month' | 'hospital'>('month');
  const [selectedHosp, setSelectedHosp] = useState<string>(ALL);
  const [selectedProd, setSelectedProd] = useState<string | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);   // 空=整年度；可複選多月加總
  const [claimTick, forceUpdate] = useState(0);
  const [addingTo, setAddingTo] = useState<{ prod: string } | null>(null);
  const [form, setForm] = useState<{ dept: string; name: string; qty: number | string; note: string }>({ dept: 'GYN', name: '', qty: 1, note: '' });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);  // 避免 localStorage 造成 SSR/client hydration 不一致
  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  // 載入時：先從雲端補資料（本機空才補），再把舊版分散 key 遷移合併，最後重繪
  useEffect(() => {
    setMounted(true);
    pullFromCloud().then(() => {
      migrateOldDoctorKeys();
      refresh();
    });
  }, [refresh]);

  // 認領資料（掛載後才讀 localStorage，避免 hydration 不一致）；claimTick 變動時重算
  const claims = useMemo<ClaimsMap>(() => (mounted ? loadClaims() : {}), [mounted, claimTick]);
  const ytd = useMemo(() => effectiveAggregate(data, claims), [data, claims]);
  const totalRevenue = ytd.revenueApplied;   // 累積應收（獨跑全額 + 共跑認領）

  // 月份多選：空=整年度累積；1個月=單月；2個月以上=加總（唯讀，不能認領）
  const selMonthObjs = useMemo(() => data.filter(d => selectedMonths.includes(d.label)), [data, selectedMonths]);
  const singleMonth = selectedMonths.length === 1 ? selectedMonths[0] : null;   // 只有選剛好 1 個月才可認領/編輯

  const monthData = useMemo(() => {
    if (selMonthObjs.length === 0) return ytd;
    if (selMonthObjs.length === 1) return effectiveMonth(selMonthObjs[0], claims);
    return effectiveAggregate(selMonthObjs, claims);
  }, [selMonthObjs, ytd, claims]);

  const activeMonthKey = singleMonth
    ? (data.find(d => d.label === singleMonth)?.month ?? latest.month)
    : latest.month;
  // 共跑部分已由主管確認定案 → 認領框唯讀，數字一律以 SHARED_AUTO 為準
  const settledActive = isSettledMonth(activeMonthKey);

  // 季度快捷（只顯示有資料的季）
  const monthNum = (label: string) => parseInt(label, 10);
  const QUARTERS: number[][] = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];
  const QUARTER_NAME = ['第一季', '第二季', '第三季', '第四季'];
  const availQuarters = QUARTERS
    .map((q, i) => ({ i, months: data.filter(d => q.includes(monthNum(d.label))).map(d => d.label) }))
    .filter(q => q.months.length > 0);
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
  const activeQuarter = selectedMonths.length > 1 ? availQuarters.find(q => sameSet(q.months, selectedMonths)) : undefined;

  const periodLabel = selectedMonths.length === 0
    ? ytdLabel
    : selectedMonths.length === 1
      ? selectedMonths[0]
      : activeQuarter
        ? QUARTER_NAME[activeQuarter.i]
        : [...selectedMonths].sort((a, b) => monthNum(a) - monthNum(b)).join('＋');

  // 月份篩選列（依月份／依醫院共用）
  const clearDetail = () => { setAddingTo(null); setSelectedProd(null); };
  const toggleMonth = (label: string) => { clearDetail(); setSelectedMonths(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]); };
  const pillCls = (active: boolean) => `px-3 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`;
  const monthFilterBar = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 font-medium">月份篩選：</span>
      <button onClick={() => { clearDetail(); setSelectedMonths([]); }} className={pillCls(selectedMonths.length === 0)}>整年度</button>
      {availQuarters.map(q => (
        <button key={q.i} onClick={() => { clearDetail(); setSelectedMonths(q.months); }}
          className={pillCls(!!activeQuarter && activeQuarter.i === q.i)}>{QUARTER_NAME[q.i]}</button>
      ))}
      <span className="text-gray-200 select-none">｜</span>
      {data.map(d => d.label).map(mo => (
        <button key={mo} onClick={() => toggleMonth(mo)} className={pillCls(selectedMonths.includes(mo))}>{mo}</button>
      ))}
      {selectedMonths.length > 1 && <span className="text-xs text-amber-500 ml-1">多月加總・唯讀（認領請選單月）</span>}
    </div>
  );

  // 尚未結算完的月份（asOf 日期早於該月最後一天）→ YoY 是不完整月 vs 完整月，需標註
  const partialMonth = useMemo(() => {
    for (const m of [...data].reverse()) {
      if (!m.asOf) continue;
      const [y, mo, d] = m.asOf.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      if (d < lastDay) return { label: m.label, asOf: `${mo}/${d}` };
    }
    return null;
  }, [data]);

  // 月份趨勢：2026 有效業績（含共跑認領）vs 2025 同期。5–6月用有效業績，其餘用 salesHistory
  const trendData = useMemo(() => {
    const rev2026 = SALES_BY_YEAR['2026'].MONTHLY_REV;
    const rev2025 = SALES_BY_YEAR['2025'].MONTHLY_REV;
    const effByLabel: Record<string, number> = {};
    for (const m of data) effByLabel[m.label] = effectiveMonth(m, claims).weighted;
    return rev2026.map(r => {
      const v26 = effByLabel[r.month] ?? r.rev;
      const v25 = rev2025.find(x => x.month === r.month)?.rev ?? 0;
      const yoy = v25 > 0 ? Math.round(((v26 - v25) / v25) * 100) : null;
      return { label: r.month, '2026': v26, '2025': v25, yoy };
    });
  }, [data, claims]);

  // ── 期間彙總（本月／本季／年度）──────────────────────────────────────
  // 年度自五月到職起算。季別以月份歸屬（Q1 1-3、Q2 4-6、Q3 7-9、Q4 10-12），
  // 只計入實際有資料的月份，所以「上季」在五月到職的情況下只有 5、6 月。
  const effByLabel = useMemo(() => {
    const o: Record<string, ReturnType<typeof effectiveMonth>> = {};
    for (const m of data) o[m.label] = effectiveMonth(m, claims);
    return o;
  }, [data, claims]);

  const quarterOf = (label: string) => Math.floor((parseInt(label, 10) - 1) / 3) + 1;
  const sumOf = (labels: string[], hosp?: string) =>
    labels.reduce((s, l) => {
      const e = effByLabel[l];
      if (!e) return s;
      return s + (hosp ? (e.byHospital[hosp] ?? 0) : e.weighted);
    }, 0);

  const periods = useMemo(() => {
    const labels = data.map(m => m.label);
    const curM = labels[labels.length - 1];
    const prevM = labels[labels.length - 2];
    const cq = quarterOf(curM);
    const curQ = labels.filter(l => quarterOf(l) === cq);
    const prevQ = labels.filter(l => quarterOf(l) === cq - 1);
    return { labels, curM, prevM, cq, curQ, prevQ };
  }, [data]);

  const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

  // 各醫院：本月／上月、本季／上季
  const hospPeriodRows = useMemo(() => {
    const hs = HOSP_ORDER.filter(h => periods.labels.some(l => (effByLabel[l]?.byHospital[h] ?? 0) > 0));
    return hs.map(h => {
      const m = sumOf([periods.curM], h), mPrev = periods.prevM ? sumOf([periods.prevM], h) : 0;
      const q = sumOf(periods.curQ, h), qPrev = sumOf(periods.prevQ, h);
      return { hosp: h, m, mPrev, mPct: pct(m, mPrev), q, qPrev, qPct: pct(q, qPrev), ytd: sumOf(periods.labels, h) };
    }).sort((a, b) => b.m - a.m || b.q - a.q);
  }, [periods, effByLabel]);

  // 點選醫院後的細部：逐月業績、逐月品類、產品明細
  const drill = useMemo(() => {
    if (!drillHosp) return null;
    const monthly = periods.labels.map(l => ({
      label: l,
      業績: Math.round(effByLabel[l]?.byHospital[drillHosp] ?? 0),
    }));
    const cats = new Set<string>();
    const catMonthly = periods.labels.map(l => {
      const row: Record<string, number | string> = { label: l };
      for (const p of (effByLabel[l]?.hospitalProducts[drillHosp] ?? [])) {
        cats.add(p.category);
        row[p.category] = ((row[p.category] as number) ?? 0) + p.rev;
      }
      return row;
    });
    const prodMap: Record<string, { cat: string; byMonth: Record<string, number>; qty: number; total: number }> = {};
    for (const l of periods.labels) {
      for (const p of (effByLabel[l]?.hospitalProducts[drillHosp] ?? [])) {
        if (!prodMap[p.name]) prodMap[p.name] = { cat: p.category, byMonth: {}, qty: 0, total: 0 };
        prodMap[p.name].byMonth[l] = (prodMap[p.name].byMonth[l] ?? 0) + p.rev;
        prodMap[p.name].qty += p.qty;
        prodMap[p.name].total += p.rev;
      }
    }
    const products = Object.entries(prodMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
    return { monthly, catMonthly, cats: [...cats], products };
  }, [drillHosp, periods, effByLabel]);

  // 各醫院逐月（2026 有效業績 vs 2025 同期）——供頂部醫院切換與小倍數圖使用。
  // 有個人明細的月份用有效業績（含共跑認領）；其餘月份回退 salesHistory。
  const hospMonthly = useMemo(() => {
    const eff: Record<string, Record<string, number>> = {};
    for (const m of data) eff[m.label] = effectiveMonth(m, claims).byHospital;
    const h26 = SALES_BY_YEAR['2026'].MONTHLY_BY_HOSPITAL;
    const h25 = SALES_BY_YEAR['2025'].MONTHLY_BY_HOSPITAL;
    const out: Record<string, TrendRow[]> = {};
    for (const h of HOSP_ORDER) {
      out[h] = SALES_BY_YEAR['2026'].MONTHLY_REV.map(r => {
        const v26 = eff[r.month]
          ? Math.round(eff[r.month][h] ?? 0)
          : Number(h26.find(x => x.month === r.month)?.[h] ?? 0);
        const v25 = Number(h25.find(x => x.month === r.month)?.[h] ?? 0);
        return { label: r.month, '2026': v26, '2025': v25, yoy: v25 > 0 ? Math.round(((v26 - v25) / v25) * 100) : null };
      });
    }
    return out;
  }, [data, claims]);

  // 頂部趨勢圖顯示的序列：全部或單一醫院
  const activeTrend = trendHosp === ALL ? trendData : (hospMonthly[trendHosp] ?? []);
  const trendColor = trendHosp === ALL ? '#3b82f6' : (HOSP_COLOR[trendHosp] ?? '#3b82f6');

  // 年度累積醫院排名：未納入個人明細的月份用 salesHistory，5–6月用有效業績（含共跑認領）
  const ytdHospData = useMemo(() => {
    const map: Record<string, number> = {};
    const effLabels = new Set(data.map(m => m.label));
    for (const row of SALES_BY_YEAR['2026'].MONTHLY_BY_HOSPITAL) {
      if (effLabels.has(row.month as string)) continue;
      for (const [k, v] of Object.entries(row)) {
        if (k !== 'month' && typeof v === 'number' && v > 0) map[k] = (map[k] ?? 0) + v;
      }
    }
    for (const m of data) {
      for (const [h, v] of Object.entries(effectiveMonth(m, claims).byHospital)) {
        if (v > 0) map[h] = (map[h] ?? 0) + v;
      }
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, rev]) => ({ name, 年度累積: rev }));
  }, [data, claims]);

  // 最新月份醫院排名（有效業績，含共跑認領；未認領的共跑醫院不列入排名）
  const latestHospData = useMemo(() => {
    const e = effectiveMonth(latest, claims);
    return Object.entries(e.byHospital)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, rev]) => ({ name, [latest.label]: rev }));
  }, [latest, claims]);

  // 依醫院模式：選定醫院的每月有效業績走勢
  const hospTrend = useMemo(() => {
    return data.map(m => {
      const e = effectiveMonth(m, claims);
      const rev = selectedHosp === ALL ? e.weighted : (e.byHospital[selectedHosp] ?? 0);
      return { label: m.label, 業績: Math.round(rev) };
    });
  }, [data, selectedHosp, claims]);

  // 切換檢視模式：進「依醫院」時，詳情需要具體月份＋具體醫院，補上預設值
  const switchMode = (mode: 'month' | 'hospital') => {
    setViewMode(mode);
    setAddingTo(null);
    setSelectedProd(null);
    if (mode === 'hospital') {
      if (selectedMonths.length === 0) setSelectedMonths([latest.label]);
      if (selectedHosp === ALL && latestHospData[0]) setSelectedHosp(latestHospData[0].name);
    }
  };

  const hospList = Object.keys(monthData.byHospital);
  const isAll = selectedHosp === ALL;
  const isSharedHosp = !isAll && isShared(selectedHosp);

  // 共跑醫院：依整院金額排序（未認領的大產品也留在上方方便認領）；否則依認領/加權金額
  const rawHospProds: HospProdEntry[] = isAll
    ? monthData.byProduct
    : (monthData.hospitalProducts[selectedHosp] ?? []);
  const hospProds: HospProdEntry[] = isSharedHosp
    ? [...rawHospProds].sort((a, b) => {
        const diff = CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category);
        return diff !== 0 ? diff : ((b as SharedProdView).gross ?? b.rev) - ((a as SharedProdView).gross ?? a.rev);
      })
    : sortByCategory(rawHospProds);
  const hospTotal = isAll ? monthData.revenue : (monthData.byHospital[selectedHosp] ?? 0);
  // 共跑醫院拆解（加權）：本人業績(Mars檔) / 認領 / 整院認領池
  const sharedRows = isSharedHosp ? (hospProds as SharedProdView[]) : [];
  const autoTotal  = sharedRows.filter(p => p.auto).reduce((s, p) => s + p.rev, 0);
  const claimTotal = sharedRows.filter(p => !p.auto).reduce((s, p) => s + p.rev, 0);
  const poolGrossTotal = sharedRows.filter(p => !p.auto).reduce((s, p) => s + (p.gross ?? 0), 0);

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
  const months4Doctors = selectedMonths.length ? selMonthObjs.map(m => m.month) : data.map(m => m.month);

  // 讀取單一醫院＋產品的醫師資料（可跨月合計）；計算本體在 lib/doctorPerf
  const docsForPeriod = (hosp: string, prod: string): DoctorEntry[] => {
    if (!mounted) return [];  // 掛載前回傳空，與 SSR 一致避免 hydration mismatch
    return loadDoctorsForPeriod(months4Doctors, hosp, prod).sort((a, b) => b.qty - a.qty);
  };

  // ⚠ 必須放在 docsForPeriod 之後（先前放在前面會 TDZ crash）
  // 每個產品「登記醫師支數」是否超過可分配數量（共跑醫院＝認領支數，其餘＝發票件數）
  const overAllocated = (isAll ? [] : hospProds).map(prod => {
    const used = docsForPeriod(selectedHosp, prod.name).reduce((s, d) => s + d.qty, 0);
    return { name: prod.name, used, qty: prod.qty, pool: isSharedHosp && (prod as SharedProdView).auto === false };
  }).filter(o => o.used > o.qty);

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

  // 醫師業績排行榜：反推每位醫師的業績貢獻（產品業績 × 該醫師佔該產品數量比例）
  // 另計學術贊助、活躍月數、逐月走勢，供指標列使用。
  // 醫師業績歸屬：改由 lib/doctorPerf 計算，與客戶資料庫共用同一份邏輯
  const doctorLeaderboard: DocPerf[] = useMemo(() => {
    if (!mounted) return [];   // 掛載前回傳空，與 SSR 一致避免 hydration mismatch
    return buildDoctorPerf(
      selectedMonths.length ? selMonthObjs : data,
      claims,
      isAll ? hospList : [selectedHosp],
      monthData,
    );
    // hospList 由 monthData 推導，不另列依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, data, selMonthObjs, selectedMonths, claims, isAll, selectedHosp, monthData]);
  const docTotalRev = doctorLeaderboard.reduce((s, d) => s + d.rev, 0) || 1;

  // 對接客戶資料庫：用姓名把醫師接回 CRM，接不到的（多半打錯字）直接在畫面提示
  const docLink = useMemo(
    () => (mounted ? linkDoctors(doctorLeaderboard, getDoctors()) : { byName: {}, unmatched: [] }),
    [mounted, doctorLeaderboard],
  );

  // 卡片牆：面積正比於業績。以「列打包」取代嚴格 treemap——
  // 每列卡片寬度正比業績、列高正比該列平均業績，前面列少而大、後面列多而扁，
  // 這樣尾端醫師仍保有可讀的字級（嚴格 treemap 會壓成讀不到字的細條）。
  const doctorTiles = useMemo(() => {
    const list = doctorLeaderboard.filter(d => d.rev > 0);
    if (!list.length) return [];
    const rows: DocPerf[][] = [];
    let i = 0, n = 1;
    while (i < list.length) {
      rows.push(list.slice(i, i + n));
      i += n;
      n = Math.min(n + 1, 6);
    }
    const avgs = rows.map(r => r.reduce((s, d) => s + d.rev, 0) / r.length);
    const maxAvg = Math.max(...avgs, 1);
    return rows.map((r, ri) => ({
      docs: r,
      // 高度用平方根壓縮，避免第一列過高、尾列過扁
      height: Math.round(72 + 96 * Math.sqrt(avgs[ri] / maxAvg)),
    }));
  }, [doctorLeaderboard]);
  const periodMonths = (selectedMonths.length ? selMonthObjs : data).length || 1;
  // 醫師登記涵蓋率：已歸屬到醫師的業績 ÷ 期間該範圍總業績。
  // 未登記的月份會讓「活躍月數／月均」偏低，這裡明示以免誤讀。
  const docCoverage = (() => {
    const targetHosps = isAll ? hospList : [selectedHosp];
    const scope = targetHosps.reduce((s, h) =>
      s + (monthData.hospitalProducts[h] ?? []).reduce((t, p) => t + p.rev, 0), 0);
    return scope > 0 ? Math.round((docTotalRev / scope) * 100) : 100;
  })();

  // 醫師名冊：所有輸入過的醫師去重（{科別,姓名}），新增時自動比對，避免選字錯誤造成重複醫師
  const doctorRoster = useMemo(() => {
    if (!mounted) return [] as { dept: string; name: string; count: number }[];
    const map: Record<string, { dept: string; name: string; count: number }> = {};
    for (const arr of Object.values(loadAllDoctors())) {
      for (const d of arr) {
        const k = `${d.dept}|${d.name}`;
        if (!map[k]) map[k] = { dept: d.dept, name: d.name, count: 0 };
        map[k].count += d.qty;
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [mounted, claimTick]);

  // 認領：寫入某月某共跑醫院某產品「我的支數」
  const handleClaim = (hosp: string, prod: string, grossQty: number, val: string | number) => {
    const q = Math.max(0, Math.min(Math.floor(Number(val) || 0), grossQty));
    saveClaim(activeMonthKey, hosp, prod, q);
    refresh();
  };

  const handleAdd = (prod: string) => {
    const qty = Number(form.qty);
    if (!form.name.trim() || qty < 1) return;
    const existing = loadDoctors(activeMonthKey, selectedHosp, prod);
    if (editingIdx !== null) {
      existing[editingIdx] = { dept: form.dept, name: form.name.trim(), qty, ...(form.note.trim() ? { note: form.note.trim() } : {}) };
    } else {
      existing.push({ dept: form.dept, name: form.name.trim(), qty, ...(form.note.trim() ? { note: form.note.trim() } : {}) });
    }
    saveDoctors(activeMonthKey, selectedHosp, prod, existing);
    setAddingTo(null);
    setEditingIdx(null);
    setForm({ dept: 'GYN', name: '', qty: 1, note: '' });
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
    setForm({ dept: entry.dept, name: entry.name, qty: entry.qty, note: entry.note ?? '' });
  };

  // 醫院選擇 pills（依月份／依醫院兩種模式共用）
  const hospPills = (
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
  );

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

        {/* 本月／本季／年度 */}
        <div className="grid grid-cols-3 gap-4">
          <PeriodCard label={`本月・${periods.curM}`} value={sumOf([periods.curM])}
            cmpLabel={periods.prevM ? `上月 ${periods.prevM}` : undefined}
            cmpValue={periods.prevM ? sumOf([periods.prevM]) : undefined}
            note={partialMonth?.label === periods.curM ? `僅計至 ${partialMonth.asOf}` : undefined} />
          <PeriodCard label={`本季・第${['一','二','三','四'][periods.cq - 1]}季`} value={sumOf(periods.curQ)}
            cmpLabel={periods.prevQ.length ? `上季（${periods.prevQ.join('＋')}）` : undefined}
            cmpValue={periods.prevQ.length ? sumOf(periods.prevQ) : undefined}
            note={`本季含 ${periods.curQ.join('＋')}`} />
          <PeriodCard label="年度累計" value={sumOf(periods.labels)} accent
            note={`${ytdLabel}（五月到職起算）· 月均 ${fmtMoney(Math.round(sumOf(periods.labels) / periods.labels.length))}`} />
        </div>

        {/* 各醫院：本月／本季，各自對比上一期 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-base font-semibold text-gray-800">各醫院表現</h2>
            <span className="text-xs text-gray-400">本月比上月、本季比上季；點醫院看細部</span>
            {partialMonth?.label === periods.curM && (
              <span className="text-xs text-amber-600 ml-auto">※ {periods.curM}僅計至 {partialMonth.asOf}，與整月相比會偏低</span>
            )}
          </div>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left font-medium py-2 pr-3">醫院</th>
                <th className="text-right font-medium py-2 px-3">本月 {periods.curM}</th>
                <th className="text-right font-medium py-2 px-3 w-28">vs 上月</th>
                <th className="text-right font-medium py-2 px-3">本季</th>
                <th className="text-right font-medium py-2 px-3 w-28">vs 上季</th>
                <th className="text-right font-medium py-2 pl-3">年度累計</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {hospPeriodRows.map(r => {
                const on = drillHosp === r.hosp;
                return (
                  <tr key={r.hosp}
                    onClick={() => { const n = on ? null : r.hosp; setDrillHosp(n); setTrendHosp(n ?? ALL); }}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${on ? 'bg-gray-50' : 'hover:bg-gray-50/60'}`}>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: HOSP_COLOR[r.hosp] }} />
                        <span className="font-medium text-gray-800">{r.hosp}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{r.m.toLocaleString('zh-TW')}</td>
                    <td className="py-2.5 px-3 text-right"><DeltaBadge v={r.mPct} base={r.mPrev} /></td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{r.q.toLocaleString('zh-TW')}</td>
                    <td className="py-2.5 px-3 text-right"><DeltaBadge v={r.qPct} base={r.qPrev} /></td>
                    <td className="py-2.5 pl-3 text-right text-gray-500">{r.ytd.toLocaleString('zh-TW')}</td>
                    <td className="text-gray-300 text-xs text-center">{on ? '▾' : '▸'}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50/80 font-bold">
                <td className="py-2.5 pr-3 text-gray-700">合計</td>
                <td className="py-2.5 px-3 text-right text-gray-900">{sumOf([periods.curM]).toLocaleString('zh-TW')}</td>
                <td className="py-2.5 px-3 text-right"><DeltaBadge v={pct(sumOf([periods.curM]), periods.prevM ? sumOf([periods.prevM]) : 0)} /></td>
                <td className="py-2.5 px-3 text-right text-gray-900">{sumOf(periods.curQ).toLocaleString('zh-TW')}</td>
                <td className="py-2.5 px-3 text-right"><DeltaBadge v={pct(sumOf(periods.curQ), sumOf(periods.prevQ))} /></td>
                <td className="py-2.5 pl-3 text-right text-gray-700">{sumOf(periods.labels).toLocaleString('zh-TW')}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* 點選醫院後的細部 */}
        {drillHosp && drill && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-baseline gap-3 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: HOSP_COLOR[drillHosp] }} />
              <h2 className="text-base font-semibold text-gray-800">{drillHosp}</h2>
              <span className="text-xs text-gray-400">逐月業績與產品線變化</span>
              <button onClick={() => { setDrillHosp(null); setTrendHosp(ALL); }}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600">收起</button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-2">逐月業績（加權）</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={drill.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<TrendTip />} cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="業績" fill={HOSP_COLOR[drillHosp]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-2">產品線組成（加權）</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={drill.catMonthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<CatTip />} cursor={{ fill: '#f9fafb' }} />
                    <Legend formatter={(v) => CAT_ZH[v] ?? v} wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 6 }} />
                    {drill.cats.map((c, i) => (
                      <Bar key={c} dataKey={c} stackId="a" fill={CAT_COLOR[c] ?? '#94a3b8'}
                        isAnimationActive={false} stroke="#fff" strokeWidth={2}
                        radius={i === drill.cats.length - 1 ? [4, 4, 0, 0] : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 產品明細：逐月 */}
            <div className="mt-5 pt-4 border-t border-gray-100 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left font-medium py-2 pr-3">產品</th>
                    {periods.labels.map(l => <th key={l} className="text-right font-medium py-2 px-3">{l}</th>)}
                    <th className="text-right font-medium py-2 pl-3">合計</th>
                    <th className="text-right font-medium py-2 pl-3 w-14">件數</th>
                  </tr>
                </thead>
                <tbody>
                  {drill.products.map(p => (
                    <tr key={p.name} className="border-b border-gray-50">
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLOR[p.cat] ?? '#94a3b8' }} />
                          <span className="text-gray-700">{p.name}</span>
                        </span>
                      </td>
                      {periods.labels.map(l => (
                        <td key={l} className={`py-2 px-3 text-right ${p.byMonth[l] ? 'text-gray-700' : 'text-gray-300'}`}>
                          {p.byMonth[l] ? fmt(p.byMonth[l]) : '—'}
                        </td>
                      ))}
                      <td className="py-2 pl-3 text-right font-semibold text-gray-900">{p.total.toLocaleString('zh-TW')}</td>
                      <td className="py-2 pl-3 text-right text-gray-400 text-xs">{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 月份趨勢折線圖 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="text-base font-semibold text-gray-800">月份業績趨勢（加權業績）</h2>
            <span className="text-xs text-gray-400">— 2026 實線　- - 2025 同期</span>
          </div>

          {/* 醫院切換 */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <button onClick={() => setTrendHosp(ALL)} className={pillCls(trendHosp === ALL)}>全部</button>
            {HOSP_ORDER.filter(h => (hospMonthly[h] ?? []).some(r => r['2026'] > 0 || r['2025'] > 0)).map(h => {
              const on = trendHosp === h;
              return (
                <button key={h} onClick={() => setTrendHosp(h)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                    on ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
                  style={on ? { background: HOSP_COLOR[h] } : undefined}>
                  <span className="w-2 h-2 rounded-full"
                    style={{ background: on ? 'rgba(255,255,255,.85)' : HOSP_COLOR[h] }} />
                  {h}
                </button>
              );
            })}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={activeTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<TrendTip />} />
              <Legend
                formatter={(v) => v === '2026' ? `2026 ${trendHosp === ALL ? '加權業績' : trendHosp}` : '2025 同期'}
                wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 8 }}
              />
              <Line type="monotone" dataKey="2026" stroke={trendColor} strokeWidth={2.5} isAnimationActive={false}
                dot={{ r: 4, fill: trendColor, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="2025" stroke="#d1d5db" strokeWidth={1.5} isAnimationActive={false}
                strokeDasharray="5 3" dot={{ r: 3, fill: '#d1d5db', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>

          <MonthlyYoyTable rows={activeTrend} partialLabel={partialMonth?.label} partialAsOf={partialMonth?.asOf}
            barColor={trendColor} scopeLabel={trendHosp === ALL ? undefined : trendHosp} />
        </div>

        {/* 醫院業績排名：年度累積 + 最新月份（排行榜列，顯示確切金額與佔比）*/}
        <div className="grid grid-cols-2 gap-4">
          <HospRankBoard title="醫院業績排名・年度累積"
            rows={ytdHospData.map(d => ({ name: d.name, rev: d['年度累積'] as number }))} />
          <HospRankBoard title={`醫院業績排名・${latest.label}`}
            rows={latestHospData.map(d => ({ name: d.name, rev: d[latest.label] as number }))} />
        </div>

        {/* 檢視模式切換 + 篩選 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400 font-medium">檢視方式：</span>
            {([['month', '依月份'], ['hospital', '依醫院']] as const).map(([m, label]) => (
              <button key={m}
                onClick={() => switchMode(m)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  viewMode === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {viewMode === 'month' ? (
            <>
              {/* 依月份：先選月份（可複選/季）→ 再選醫院看詳情 */}
              <div className="mb-3">{monthFilterBar}</div>
              <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
                選擇醫院查看詳情（{periodLabel}{selectedMonths.length === 0 ? ' 累積' : ''}）
              </p>
              {hospPills}
            </>
          ) : (
            <>
              {/* 依醫院：先選醫院 → 看該院每月走勢 → 再選月份看詳情 */}
              <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
                選擇醫院查看每月走勢
              </p>
              {hospPills}

              <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-4">
                <h2 className="text-base font-semibold text-gray-800 mb-4">
                  {isAll ? '全部醫院' : selectedHosp} · 每月業績走勢（加權）
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={hospTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<ChartTip />} />
                    <Line type="monotone" dataKey="業績"
                      stroke={isAll ? '#3b82f6' : (HOSP_COLOR[selectedHosp] ?? '#3b82f6')} strokeWidth={2.5}
                      dot={{ r: 4, fill: isAll ? '#3b82f6' : (HOSP_COLOR[selectedHosp] ?? '#3b82f6'), strokeWidth: 0 }}
                      activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4">{monthFilterBar}</div>
            </>
          )}
        </div>

        {/* 品類圓餅 + 產品明細 */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="text-base font-semibold text-gray-800">{isAll ? '全部醫院' : selectedHosp}</h2>
              {isSharedHosp && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">共跑</span>
              )}
              <span className="text-xs text-gray-400">{periodLabel}</span>
            </div>
            <p className="text-2xl font-black text-gray-900 mb-1">{fmtMoney(hospTotal)}</p>
            {isSharedHosp && (
              <p className="text-xs text-gray-400 mb-4">
                本人業績 <span className="text-gray-600 font-medium">{fmtMoney(autoTotal)}</span>
                {settledActive ? (
                  <span className="ml-1 text-emerald-600 font-medium">· 主管已確認定案</span>
                ) : (
                  <>
                    {' ＋ 認領 '}<span className="text-emerald-600 font-medium">{fmtMoney(claimTotal)}</span>
                    <span className="text-gray-300"> · 整院可認領池 {fmtMoney(poolGrossTotal)}</span>
                  </>
                )}
              </p>
            )}
            {!isSharedHosp && <div className="mb-4" />}
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
            {/* 登記醫師支數 > 可分配數量 → 業績會被少認（共跑）或多分攤，先在最上面講 */}
            {overAllocated.length > 0 && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
                <p className="font-semibold mb-1">⚠️ 有 {overAllocated.length} 項的登記醫師支數超過可分配數量</p>
                {overAllocated.map(o => (
                  <p key={o.name}>
                    {o.name}：登記 {o.used} 支
                    {o.pool ? `，但只認領 ${o.qty} 支 —— 認領沒跟著改，業績會少認` : `，超過 ${o.qty} 件`}
                  </p>
                ))}
              </div>
            )}

            {hospProds.map(prod => {
              const doctors = isAll ? [] : docsForPeriod(selectedHosp, prod.name);
              const isAddingThis = addingTo?.prod === prod.name;
              const usedQty = doctors.reduce((s, d) => s + d.qty, 0);
              const isSelected = selectedProd === prod.name;
              // 姓名比對建議：名冊中含目前輸入字串、且不完全相同者（前 6 筆）
              const nq = form.name.trim();
              const nameSuggestions = (isAddingThis && nq)
                ? doctorRoster.filter(d => d.name.includes(nq) && d.name !== nq).slice(0, 6)
                : [];
              const sv = prod as SharedProdView;
              const isAutoRow = isSharedHosp && sv.auto === true;   // 本人業績（Mars 檔），全計
              const isPoolRow = isSharedHosp && sv.auto === false;  // 整院認領池，需認領

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
                      {isAutoRow && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">本人</span>
                      )}
                      <span className="text-gray-400 text-sm">
                        {isAutoRow ? `本人 ${prod.qty} 件` : isPoolRow ? `整院 ${sv.grossQty} 件` : `${prod.qty} 件`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                      <div className="text-right">
                        <span className="font-bold text-gray-900">{fmtMoney(prod.rev)}</span>
                        {isPoolRow && (
                          <span className="block text-[11px] text-gray-400">整院 {fmtMoney(sv.gross ?? 0)}</span>
                        )}
                      </div>
                      {isPoolRow && (
                        settledActive ? (
                          <span className="text-xs text-gray-400">主管已確認・不需認領</span>
                        ) : singleMonth ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">我的</span>
                            <input
                              type="number" min={0} max={(prod as SharedProdView).grossQty}
                              value={(prod as SharedProdView).mine || 0}
                              onChange={e => handleClaim(selectedHosp, prod.name, (prod as SharedProdView).grossQty, e.target.value)}
                              style={{ color: '#111827' }}
                              className={`w-16 text-sm text-center border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                                usedQty > prod.qty ? 'border-red-400 bg-red-50' : 'border-gray-300'
                              }`}
                            />
                            <span className="text-xs text-gray-400">支</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">我的 {(prod as SharedProdView).mine || 0} 支（選單月認領）</span>
                        )
                      )}
                      {!isAll && singleMonth && (
                        <button
                          onClick={() => {
                            if (isAddingThis) { setAddingTo(null); setEditingIdx(null); }
                            else { setAddingTo({ prod: prod.name }); setEditingIdx(null); setForm({ dept: 'GYN', name: '', qty: prod.qty - usedQty > 0 ? prod.qty - usedQty : 1, note: '' }); }
                          }}
                          className="text-xs px-3 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium whitespace-nowrap"
                        >
                          {isAddingThis ? '取消' : '+ 醫師'}
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
                          {d.note && (
                            <span className="ml-1 max-w-[13rem] truncate text-[11px] text-amber-700 bg-amber-100 rounded px-1.5 py-0.5"
                              title={d.note}>📝 {d.note}</span>
                          )}
                          {singleMonth && <button onClick={() => openEdit(prod.name, i, d)} className="ml-1 opacity-50 hover:opacity-100">✎</button>}
                          {singleMonth && <button onClick={() => handleDelete(prod.name, i)} className="opacity-40 hover:opacity-100">×</button>}
                        </div>
                      ))}
                      {usedQty < prod.qty && (
                        <span className="text-xs text-amber-500 self-center">未分配 {prod.qty - usedQty} 件</span>
                      )}
                      {usedQty > prod.qty && (
                        <span className="text-xs font-semibold text-red-600 self-center">
                          {isPoolRow
                            ? `⚠ 登記醫師 ${usedQty} 支，但只認領 ${prod.qty} 支 → 把「我的」改成 ${usedQty}`
                            : `⚠ 登記醫師 ${usedQty} 支，超過 ${prod.qty} 件`}
                        </span>
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
                      <div className="flex flex-col gap-1 flex-1 relative">
                        <label className="text-xs text-gray-600 font-medium">醫師姓名</label>
                        <input type="text" placeholder="打前幾個字，可從下方選既有醫師" value={form.name}
                          autoComplete="off"
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              // 有建議且尚未完全命中 → Enter 先帶入第一個建議
                              if (nameSuggestions.length > 0) {
                                const s = nameSuggestions[0];
                                setForm(f => ({ ...f, dept: s.dept, name: s.name }));
                                return;
                              }
                              (e.currentTarget.closest('.flex')?.parentElement?.querySelector('input[type="number"]') as HTMLElement)?.focus();
                            }
                          }}
                          style={{ color: '#111827' }}
                          className="text-sm placeholder:text-gray-400 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        {nameSuggestions.length > 0 && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                            <p className="px-3 py-1 text-[10px] text-gray-400 bg-gray-50 border-b border-gray-100">既有醫師（點選帶入，避免重複）</p>
                            {nameSuggestions.map(s => (
                              <button key={`${s.dept}|${s.name}`} type="button"
                                onClick={() => setForm(f => ({ ...f, dept: s.dept, name: s.name }))}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-blue-50 transition-colors">
                                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${DEPT_COLOR_MAP[s.dept] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {DEPT_LABEL[s.dept] ?? s.dept}
                                </span>
                                <span className="text-sm text-gray-800">{s.name}</span>
                                <span className="text-gray-300 text-xs ml-auto">{s.count} 件</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 w-20">
                        <label className="text-xs text-gray-600 font-medium">數量</label>
                        <input type="number" min={1} max={prod.qty} value={form.qty}
                          onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAdd(prod.name)}
                          style={{ color: '#111827' }}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div className="flex flex-col gap-1 w-56">
                        <label className="text-xs text-gray-600 font-medium">備註 <span className="text-gray-300 font-normal">選填</span></label>
                        <input type="text" placeholder="例：使用醫師待確認" value={form.note}
                          onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
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

        {/* 醫師業績排行榜 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">醫師使用分析</h2>
            <span className="text-xs text-gray-400">
              {isAll ? '全部醫院' : selectedHosp} · {periodLabel} · 依業績排行
              {mounted && doctorLeaderboard.length > 0 && (
                <span className={docCoverage < 95 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                  {' · '}醫師已登記 {docCoverage}% 業績{docCoverage < 95 && '（未登記者不列入，月均／活躍月數會偏低）'}
                </span>
              )}
            </span>
          </div>
          {!mounted ? (
            <p className="text-sm text-gray-300 py-6 text-center">載入中…</p>
          ) : doctorLeaderboard.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">尚未輸入使用醫師資料，可至上方各產品「+ 新增醫師」</p>
          ) : (
            <>
              {docLink.unmatched.length > 0 && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
                  ⚠️ 這 {docLink.unmatched.length} 位在客戶資料庫查無此人，多半是選字錯誤：
                  <span className="font-semibold"> {docLink.unmatched.join('、')}</span>
                  <span className="text-red-400">　改成與 <Link href="/customers" className="underline">客戶資料庫</Link> 一致的寫法即可接起來。</span>
                </div>
              )}
              {/* 卡片牆：面積正比業績；頂端色條＝主力產品品類，卡內色帶＝完整產品組成 */}
              <div className="space-y-2">
                {doctorTiles.map((row, ri) => (
                  <div key={ri} className="flex gap-2" style={{ height: row.height }}>
                    {row.docs.map((d, di) => {
                      const rank = doctorTiles.slice(0, ri).reduce((s2, r) => s2 + r.docs.length, 0) + di;
                      return (
                        <DoctorTile key={`${d.dept}|${d.name}`} d={d} rank={rank}
                          share={(d.rev / docTotalRev) * 100} height={row.height}
                          periodMonths={periodMonths}
                          active={expandedDoc === `${d.dept}|${d.name}`}
                          onClick={() => setExpandedDoc(expandedDoc === `${d.dept}|${d.name}` ? null : `${d.dept}|${d.name}`)} />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* 展開的醫師細部 */}
              {(() => {
                const d = doctorLeaderboard.find(x => `${x.dept}|${x.name}` === expandedDoc);
                if (!d) return null;
                const sponPct = d.rev > 0 ? Math.round((d.sponsor / d.rev) * 100) : 0;
                return (
                  <div className="mt-4 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLOR_MAP[d.dept] ?? 'bg-gray-100 text-gray-600'}`}>
                        {DEPT_LABEL[d.dept] ?? d.dept}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-800">{d.name}</h3>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtMoney(d.rev)}</span>
                      <span className="text-xs text-gray-400">{d.qty} 件 · 月均 {fmtMoney(Math.round(d.rev / periodMonths))} · 活躍 {d.activeMonths}/{periodMonths} 月
                        {d.sponsor > 0 && ` · 學贊 ${fmtMoney(d.sponsor)}（佔業績 ${sponPct}%）`}</span>
                      {docLink.byName[d.name] ? (
                        <Link href={`/customers/${docLink.byName[d.name].id}`}
                          className="ml-auto text-xs text-blue-600 hover:underline">客戶資料 →</Link>
                      ) : (
                        <span className="ml-auto text-xs text-red-500" title="姓名與客戶資料庫對不起來，可能是選字錯誤">⚠️ 客戶資料庫查無此人</span>
                      )}
                      <button onClick={() => setExpandedDoc(null)} className="ml-3 text-xs text-gray-400 hover:text-gray-600">收起</button>
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
                          {p.name}{isAll && <span className="text-gray-400 text-xs ml-1">@{p.hosp}</span>}
                        </span>
                        <div className="flex gap-3 items-center tabular-nums">
                          <span className="text-gray-400 text-xs w-10 text-right">{p.qty} 件</span>
                          <span className="font-semibold text-gray-800 w-20 text-right">{fmtMoney(p.rev)}</span>
                          <span className={`w-20 text-right text-xs ${p.sponsor > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                            {p.sponsor > 0 ? fmtMoney(p.sponsor) : '無贊助'}
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
                              {m.rev > 0 ? fmt(m.rev) : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
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

function HospRankBoard({ title, rows }: { title: string; rows: { name: string; rev: number }[] }) {
  const total = rows.reduce((s, r) => s + r.rev, 0) || 1;
  const max = rows[0]?.rev || 1;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">尚無資料</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r, i) => {
            const pct = Math.round((r.rev / total) * 100);
            const barPct = Math.max(2, Math.round((r.rev / max) * 100));
            const color = HOSP_COLOR[r.name] ?? '#94a3b8';
            return (
              <div key={r.name} className="flex items-center gap-2.5">
                <span className={`text-sm font-bold w-6 text-center shrink-0 ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </span>
                <span className="text-sm font-semibold text-gray-800 w-16 shrink-0 truncate" title={r.name}>{r.name}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden min-w-[24px]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
                </div>
                <span className="text-sm font-bold text-gray-900 w-[86px] text-right shrink-0 tabular-nums">{fmtMoney(r.rev)}</span>
                <span className="text-xs text-gray-400 w-8 text-right shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 逐月業績數字表（2026 vs 2025 同期 YoY）─────────────────────────────
type TrendRow = { label: string; '2026': number; '2025': number; yoy: number | null };

function MonthlyYoyTable({ rows, partialLabel, partialAsOf, barColor, scopeLabel }: {
  rows: TrendRow[]; partialLabel?: string; partialAsOf?: string; barColor?: string; scopeLabel?: string;
}) {
  if (!rows.length) return null;

  const max = Math.max(...rows.map(r => r['2026']), 1);   // 長條比例只看 2026 自身高低
  const sum26 = rows.reduce((s, r) => s + r['2026'], 0);
  const sum25 = rows.reduce((s, r) => s + r['2025'], 0);
  const sumYoy = sum25 > 0 ? Math.round(((sum26 - sum25) / sum25) * 100) : null;

  const diffCls = (d: number) => d > 0 ? 'text-emerald-600' : d < 0 ? 'text-rose-500' : 'text-gray-400';
  const signed = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toLocaleString('zh-TW');

  const YoyBadge = ({ v }: { v: number | null }) => {
    if (v === null) return <span className="text-gray-300">—</span>;
    const cls = v > 0
      ? 'bg-emerald-50 text-emerald-600'
      : v < 0 ? 'bg-rose-50 text-rose-500' : 'bg-gray-100 text-gray-400';
    return (
      <span className={`inline-block min-w-[58px] px-2 py-0.5 rounded-md text-xs font-bold ${cls}`}>
        {v > 0 ? '▲' : v < 0 ? '▼' : '－'} {Math.abs(v)}%
      </span>
    );
  };

  return (
    <div className="mt-5 pt-5 border-t border-gray-100">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">逐月數字・2026 vs 2025 同期{scopeLabel ? `（${scopeLabel}）` : ''}</h3>
        {partialLabel && (
          <span className="text-xs text-amber-600">
            ※ {partialLabel}僅計至 {partialAsOf}，與 2025 整月相比會偏低
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left font-medium py-2 pr-3 w-16">月份</th>
              <th className="text-right font-medium py-2 px-3">2026 加權業績</th>
              <th className="text-right font-medium py-2 px-3">2025 同期</th>
              <th className="text-right font-medium py-2 px-3">增減</th>
              <th className="text-right font-medium py-2 pl-3 w-24">YoY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const diff = r['2026'] - r['2025'];
              const isPartial = r.label === partialLabel;
              return (
                <tr key={r.label} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="py-2 pr-3 text-gray-700 font-medium whitespace-nowrap">
                    {r.label}
                    {isPartial && <span className="ml-1 text-[10px] text-amber-500 font-normal">※</span>}
                  </td>
                  <td className="py-2 px-3 text-right relative">
                    {/* 背景長條：一眼看出月份高低 */}
                    <span className="absolute inset-y-1 right-3 rounded"
                      style={{ width: `${(r['2026'] / max) * 100}%`, maxWidth: '100%',
                               background: (barColor ?? '#3b82f6') + '1f' }} />
                    <span className="relative font-semibold text-gray-900">
                      {r['2026'].toLocaleString('zh-TW')}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-400">
                    {r['2025'] > 0 ? r['2025'].toLocaleString('zh-TW') : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right font-medium ${diffCls(diff)}`}>
                    {r['2025'] > 0 ? signed(diff) : '—'}
                  </td>
                  <td className="py-2 pl-3 text-right"><YoyBadge v={r.yoy} /></td>
                </tr>
              );
            })}
            <tr className="bg-gray-50/80">
              <td className="py-2.5 pr-3 font-bold text-gray-700 whitespace-nowrap">
                累計 {rows[0].label}–{rows[rows.length - 1].label}
              </td>
              <td className="py-2.5 px-3 text-right font-black" style={{ color: barColor ?? '#2563eb' }}>{sum26.toLocaleString('zh-TW')}</td>
              <td className="py-2.5 px-3 text-right font-medium text-gray-500">{sum25.toLocaleString('zh-TW')}</td>
              <td className={`py-2.5 px-3 text-right font-bold ${diffCls(sum26 - sum25)}`}>{signed(sum26 - sum25)}</td>
              <td className="py-2.5 pl-3 text-right"><YoyBadge v={sumYoy} /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 期間 KPI 卡（本月／本季／年度），附與上一期的比較
function PeriodCard({ label, value, cmpLabel, cmpValue, note, accent }: {
  label: string; value: number; cmpLabel?: string; cmpValue?: number; note?: string; accent?: boolean;
}) {
  const d = cmpValue !== undefined && cmpValue > 0 ? Math.round(((value - cmpValue) / cmpValue) * 100) : null;
  const diff = cmpValue !== undefined ? value - cmpValue : 0;
  return (
    <div className="rounded-2xl border border-gray-100 p-5 bg-white">
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ? 'text-emerald-600' : 'text-gray-900'}`}>{fmtMoney(value)}</p>
      {d !== null ? (
        <p className="text-xs mt-1.5 flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded font-bold ${
            d > 0 ? 'bg-emerald-50 text-emerald-600' : d < 0 ? 'bg-rose-50 text-rose-500' : 'bg-gray-100 text-gray-400'}`}>
            {d > 0 ? '▲' : d < 0 ? '▼' : '－'} {Math.abs(d)}%
          </span>
          <span className="text-gray-400">
            {cmpLabel} {fmtMoney(cmpValue!)}（{diff >= 0 ? '+' : '−'}{fmtMoney(Math.abs(diff)).slice(1)}）
          </span>
        </p>
      ) : cmpLabel ? (
        <p className="text-xs text-gray-300 mt-1.5">無{cmpLabel}可比</p>
      ) : null}
      {note && <p className="text-[11px] text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

// 環比徽章（本月 vs 上月、本季 vs 上季）
function DeltaBadge({ v, base }: { v: number | null; base?: number }) {
  if (v === null) return <span className="text-gray-300 text-xs">新增</span>;
  const cls = v > 0 ? 'bg-emerald-50 text-emerald-600'
            : v < 0 ? 'bg-rose-50 text-rose-500' : 'bg-gray-100 text-gray-400';
  return (
    <span className="inline-flex flex-col items-end">
      <span className={`inline-block min-w-[56px] text-center px-2 py-0.5 rounded-md text-xs font-bold ${cls}`}>
        {v > 0 ? '▲' : v < 0 ? '▼' : '－'} {Math.abs(v)}%
      </span>
      {base !== undefined && base > 0 && (
        <span className="text-[10px] text-gray-300 mt-0.5">前期 {fmt(base)}</span>
      )}
    </span>
  );
}

// 堆疊品類圖的 tooltip
function CatTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.filter(p => p.value > 0).map(p => (
        <p key={p.name} className="flex items-center gap-2 text-gray-600">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {CAT_ZH[p.name] ?? p.name}
          <span className="ml-auto font-medium tabular-nums">{fmtMoney(p.value)}</span>
        </p>
      ))}
      <p className="mt-1 pt-1 border-t border-gray-100 flex gap-2 text-gray-700 font-semibold">
        合計<span className="ml-auto tabular-nums">{fmtMoney(total)}</span>
      </p>
    </div>
  );
}

// 醫師卡片牆的單張卡：寬度由 flex-grow 依業績分配，內容依卡片高度分層顯示
function DoctorTile({ d, rank, share, height, periodMonths, active, onClick }: {
  d: { name: string; dept: string; qty: number; rev: number; sponsor: number; activeMonths: number;
       monthly: { label: string; rev: number }[];
       merged: { name: string; cat: string; qty: number; rev: number }[] };
  rank: number; share: number; height: number; periodMonths: number; active: boolean; onClick: () => void;
}) {
  const top = d.merged[0];
  const topPct = d.rev > 0 && top ? Math.round((top.rev / d.rev) * 100) : 0;
  const accent = CAT_COLOR[top?.cat ?? ''] ?? '#94a3b8';
  const sponPct = d.rev > 0 ? Math.round((d.sponsor / d.rev) * 100) : 0;
  const big = height >= 160, mid = height >= 108;
  return (
    <button onClick={onClick}
      style={{ flexGrow: Math.max(d.rev, 1), flexBasis: 0, minWidth: 88 }}
      className={`relative overflow-hidden text-left rounded-xl border transition-all ${
        active ? 'border-gray-400 shadow-sm bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
      {/* 頂端色條＝主力產品品類 */}
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="h-full flex flex-col px-3 pt-3 pb-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {rank < 3 && <span className="text-xs shrink-0">{['🥇', '🥈', '🥉'][rank]}</span>}
          <span className={`font-bold text-gray-900 truncate ${big ? 'text-base' : 'text-sm'}`}>{d.name}</span>
          {mid && (
            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DEPT_COLOR_MAP[d.dept] ?? 'bg-gray-100 text-gray-600'}`}>
              {DEPT_LABEL[d.dept] ?? d.dept}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1.5 mt-0.5 min-w-0">
          <span className={`font-black text-gray-900 tabular-nums ${big ? 'text-xl' : mid ? 'text-base' : 'text-sm'}`}>
            {big ? fmtMoney(d.rev) : fmt(d.rev)}
          </span>
          <span className="text-[10px] text-gray-400 shrink-0">佔 {share < 1 ? '<1' : Math.round(share)}%</span>
        </div>

        {big && d.monthly.length > 1 && (() => {
          const peak = Math.max(...d.monthly.map(m => m.rev), 1);
          return (
            <div className="flex items-end gap-1.5 mt-3 mb-0.5" style={{ height: 34 }}>
              {d.monthly.map(m => (
                <div key={m.label} className="flex-1 flex flex-col justify-end items-center gap-0.5">
                  <span className="text-[9px] text-gray-400 tabular-nums">{m.rev > 0 ? fmt(m.rev) : ''}</span>
                  <div className="w-full rounded-sm" style={{ height: `${Math.max(2, (m.rev / peak) * 18)}px`, background: m.rev > 0 ? accent : '#e5e7eb', opacity: m.rev > 0 ? 0.5 : 1 }} />
                  <span className="text-[9px] text-gray-400">{m.label}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* 產品組成色帶：一眼看出這位醫師靠什麼撐起來 */}
        <div className="flex gap-[2px] h-2 mt-auto rounded-sm overflow-hidden">
          {d.merged.map(p => (
            <span key={p.name} title={`${p.name} ${fmtMoney(p.rev)}`}
              style={{ flexGrow: Math.max(p.rev, 1), flexBasis: 0, background: CAT_COLOR[p.cat] ?? '#cbd5e1' }} />
          ))}
        </div>

        {mid && top && (
          <p className="text-[10px] text-gray-500 truncate mt-1">
            <span className="font-semibold">{top.name}</span> {topPct}%
            {d.merged.length > 1 && <span className="text-gray-300"> ＋{d.merged.length - 1} 項</span>}
          </p>
        )}
        {big && (
          <p className="text-[10px] text-gray-400 truncate">
            月均 {fmt(Math.round(d.rev / periodMonths))} · 活躍 {d.activeMonths}/{periodMonths}
            {d.sponsor > 0 && <span className={sponPct >= 45 ? 'text-amber-600' : ''}> · 學贊 {fmt(d.sponsor)}（{sponPct}%）</span>}
          </p>
        )}
      </div>
    </button>
  );
}

// 醫師卡片上的單一指標格
function Metric({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'weak';
}) {
  const vc = tone === 'good' ? 'text-emerald-600'
           : tone === 'warn' ? 'text-amber-600'
           : tone === 'weak' ? 'text-gray-400'
           : 'text-gray-800';
  return (
    <div className="flex-1 px-3 py-1.5 min-w-0">
      <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
      <p className={`text-xs font-bold truncate tabular-nums ${vc}`} title={value}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 leading-tight">{sub}</p>}
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
