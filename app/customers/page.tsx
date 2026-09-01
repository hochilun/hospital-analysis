'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Doctor, DoctorGrade, VisitRecord, ClinicSlot } from '@/types';
import { visitStatus, freqLabel, VISIT_FREQ_OPTIONS } from '@/lib/visitFrequency';
import { getDoctors, deleteDoctor, getHospitalStrategies, saveHospitalStrategy, getProducts, getVisits, getHospitalsData, saveDoctor } from '@/lib/storage';
import { DEPT_LABEL } from '@/data/hospitals';
import { MY_PERFORMANCE, CAT_COLOR } from '@/data/myPerformance';
import { loadClaims, loadDoctors, effectiveMonth } from '@/lib/perfCore';
import { buildDoctorPerf, linkDoctors, type DocPerf } from '@/lib/doctorPerf';
import CustomerInsights from '@/components/CustomerInsights';
import { HOSPITALS } from '@/data/hospitals';

// ── 常數 ─────────────────────────────────────────────────

const GRADE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  S: { bg: 'bg-amber-100', text: 'text-amber-800', label: '最忠實' },
  A: { bg: 'bg-green-100', text: 'text-green-700', label: '穩定' },
  B: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: '分用' },
  C: { bg: 'bg-gray-100',  text: 'text-gray-500',  label: '待開發' },
  D: { bg: 'bg-red-50',    text: 'text-red-400',   label: '暫不觸碰' },
  X: { bg: 'bg-violet-100', text: 'text-violet-700', label: '護理師' },
  Y: { bg: 'bg-slate-100',  text: 'text-slate-500',  label: '行政/秘書' },
};

const HOSP_BORDER: Record<string, string> = {
  tmuh:    'border-l-4 border-blue-400',
  eck:     'border-l-4 border-green-400',
  sph:     'border-l-4 border-purple-400',
  clinic:  'border-l-4 border-orange-400',
  grace:   'border-l-4 border-pink-400',
  tzuchi:  'border-l-4 border-teal-400',
  tucheng: 'border-l-4 border-yellow-400',
};
const HOSP_BADGE: Record<string, string> = {
  tmuh:    'bg-blue-100 text-blue-700 font-semibold',
  eck:     'bg-green-100 text-green-700 font-semibold',
  sph:     'bg-purple-100 text-purple-700 font-semibold',
  clinic:  'bg-orange-100 text-orange-700 font-semibold',
  grace:   'bg-pink-100 text-pink-700 font-semibold',
  tzuchi:  'bg-teal-100 text-teal-700 font-semibold',
  tucheng: 'bg-yellow-100 text-yellow-700 font-semibold',
};

const HOSP_CARD_BG: Record<string, string> = {
  tmuh:    'bg-blue-50',
  eck:     'bg-green-50',
  sph:     'bg-purple-50',
  clinic:  'bg-orange-50',
  grace:   'bg-pink-50',
  tzuchi:  'bg-teal-50',
  tucheng: 'bg-yellow-50',
};

// ── 工具函式 ──────────────────────────────────────────────

function monthlyTotal(monthlyData?: Record<string, number>): number {
  if (!monthlyData) return 0;
  return Object.values(monthlyData).reduce((s, v) => s + v, 0);
}

// ── 示範資料 seed ─────────────────────────────────────────


// ── 子元件 ────────────────────────────────────────────────

function StrategyField({ hospitalId, initial }: { hospitalId: string; initial: string }) {
  const [val, setVal] = useState(initial);
  return (
    <textarea value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => saveHospitalStrategy(hospitalId, val.trim())}
      placeholder="輸入目前對此醫院的主要策略..."
      rows={2}
      className="w-full text-sm text-gray-700 placeholder-gray-300 border border-dashed border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-400 bg-white" />
  );
}

// ── 主元件 ────────────────────────────────────────────────

export default function CustomersPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [strategies, setStrategies] = useState<Record<string, string>>({});
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);
  const [priceMap, setPriceMap] = useState<Record<string, { base: number; byHosp: Record<string, number> }>>({});
  const [lastVisitMap, setLastVisitMap] = useState<Record<string, VisitRecord>>({});
  const [clinicMap, setClinicMap] = useState<Record<string, string>>({});  // doctorName -> 門診摘要
  // 業績報表（perf-doctors）算出的真實業績，以醫師 id 對應；unlinkedPerf = 業績報表有但這裡找不到的姓名
  const [allVisits, setAllVisits] = useState<VisitRecord[]>([]);
  const [mounted, setMounted] = useState(false);
  // 分析期間：預設近三個月（業績資料涵蓋到哪就從哪往回抓）
  const ALL_PERF_MONTHS = MY_PERFORMANCE.map(m => m.month);
  const [selMonths, setSelMonths] = useState<string[]>(ALL_PERF_MONTHS.slice(-3));
  const [tab, setTab] = useState<'dashboard' | 'list'>('list');

  // 篩選狀態
  const [filterGrades, setFilterGrades] = useState<Set<DoctorGrade>>(new Set());
  const [filterHospitals, setFilterHospitals] = useState<Set<string>>(new Set());
  const [filterDepts, setFilterDepts] = useState<Set<string>>(new Set());
  const [filterProducts, setFilterProducts] = useState<Set<string>>(new Set());
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'hospital' | 'revenue' | 'real' | 'visit_desc' | 'visit_asc'>('hospital');
  const [perDay, setPerDay] = useState(6);  // 每天可拜訪客戶數（產能規劃用，存 localStorage）

  useEffect(() => {
    const pd = localStorage.getItem('visit-capacity-per-day');
    if (pd) setPerDay(Number(pd) || 6);
    setDoctors(getDoctors());
    setStrategies(getHospitalStrategies());
    const prods = getProducts();
    setAllProducts(prods.map(p => ({ id: p.id, name: p.name })));
    const pm: Record<string, { base: number; byHosp: Record<string, number> }> = {};
    for (const p of prods) {
      const v = p.variants[0];
      if (v) pm[p.id] = { base: v.hospitalPrice ?? 0, byHosp: v.hospitalPrices ?? {} };
    }
    setPriceMap(pm);
    // 建立每位醫師的最近拜訪 map
    const visits = getVisits().sort((a, b) => b.date.localeCompare(a.date));
    const map: Record<string, VisitRecord> = {};
    for (const v of visits) {
      if (!map[v.doctorId]) map[v.doctorId] = v;
    }
    setLastVisitMap(map);
    setAllVisits(visits);
    // 建立門診摘要 map (醫師姓名 -> 摘要文字)
    const DAY = ['日','一','二','三','四','五','六'];
    const hospData = getHospitalsData();
    const cm: Record<string, string[]> = {};
    for (const h of hospData) {
      for (const slot of h.clinics) {
        if (!cm[slot.doctor]) cm[slot.doctor] = [];
        cm[slot.doctor].push(`${DAY[slot.dayOfWeek]}${slot.session}`);
      }
    }
    setClinicMap(Object.fromEntries(Object.entries(cm).map(([name, slots]) => [name, slots.join(' ')])));
    setMounted(true);
  }, []);

  // ── 期間相關的計算：期間一改就重算，清單與儀表板吃同一份 ──────────────
  const periodMonths = useMemo(
    () => MY_PERFORMANCE.filter(m => selMonths.includes(m.month)),
    [selMonths],
  );

  // 期間拜訪次數：與業績同一段時間，兩軸才是同期的投入與產出
  const visitCountById = useMemo(() => {
    const set = new Set(selMonths);
    const vc: Record<string, number> = {};
    for (const v of allVisits) {
      if (!set.has(v.date.slice(0, 7))) continue;
      vc[v.doctorId] = (vc[v.doctorId] ?? 0) + 1;
    }
    return vc;
  }, [allVisits, selMonths]);

  // 醫師歸屬涵蓋率：期間內有多少業績已經指到具體醫師身上。
  // 沒填的部分不會出現在圖表上，涵蓋率低時圖會嚴重失真，所以一定要顯示出來。
  const coverage = useMemo(() => {
    if (!mounted || !periodMonths.length) return null;
    const claims = loadClaims();
    let scope = 0, attributed = 0;
    const gaps: Record<string, number> = {};
    for (const m of periodMonths) {
      const e = effectiveMonth(m, claims);
      for (const [h, prods] of Object.entries(e.hospitalProducts)) {
        for (const prod of prods) {
          scope += prod.rev;
          const q = loadDoctors(m.month, h, prod.name).reduce((t, d) => t + d.qty, 0);
          const attr = prod.qty > 0 ? Math.round(prod.rev * Math.min(q, prod.qty) / prod.qty) : 0;
          attributed += attr;
          const gap = prod.rev - attr;
          if (gap > 0) gaps[`${m.label} ${h}`] = (gaps[`${m.label} ${h}`] ?? 0) + gap;
        }
      }
    }
    return {
      pct: scope > 0 ? Math.round((attributed / scope) * 100) : 100,
      missing: scope - attributed,
      topGaps: Object.entries(gaps).sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }, [mounted, periodMonths]);

  // 接上業績報表：用姓名把 perf-doctors 的真實業績掛到客戶身上
  const { perfById, unlinkedPerf } = useMemo(() => {
    if (!mounted || !periodMonths.length) return { perfById: {} as Record<string, DocPerf>, unlinkedPerf: [] as string[] };
    const perf = buildDoctorPerf(periodMonths, loadClaims());
    const { byName, unmatched } = linkDoctors(perf, doctors);
    const byId: Record<string, DocPerf> = {};
    for (const p of perf) {
      const doc = byName[p.name];
      if (!doc) continue;
      // 同一位醫師可能在多個科別各有一筆（例：跨科使用），合併成一筆
      const cur = byId[doc.id];
      byId[doc.id] = cur
        ? { ...cur, qty: cur.qty + p.qty, rev: cur.rev + p.rev, sponsor: cur.sponsor + p.sponsor,
            activeMonths: Math.max(cur.activeMonths, p.activeMonths),
            monthly: cur.monthly.map((m, i) => ({ ...m, rev: m.rev + (p.monthly[i]?.rev ?? 0) })),
            merged: [...cur.merged, ...p.merged].sort((a, b) => b.rev - a.rev) }
        : p;
    }
    return { perfById: byId, unlinkedPerf: unmatched };
  }, [mounted, periodMonths, doctors]);

  const reload = () => setDoctors(getDoctors());

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」？`)) return;
    deleteDoctor(id);
    reload();
  };

  // 中文科別名稱反查代碼（應對舊資料存中文的情況）
  const DEPT_CODE: Record<string, string> = Object.fromEntries(
    Object.entries(DEPT_LABEL).map(([code, label]) => [label, code])
  );
  const normDept = (dept: string) => DEPT_CODE[dept] ?? dept;

  // 所有科別（統一轉為代碼，避免 GYN / 婦產科 重複）
  const allDepts = [...new Set(doctors.map(d => normDept(d.department)).filter(Boolean))];

  // 所有 tags
  const allTags = [...new Set(doctors.flatMap(d => d.tags ?? []))].sort();

  // 醫院排序優先順序
  const HOSP_ORDER = HOSPITALS.reduce<Record<string, number>>((acc, h, i) => { acc[h.id] = i; return acc; }, {});

  const monthlyAvg = (data?: Record<string, number>) => {
    if (!data) return 0;
    const vals = Object.values(data).filter(v => v > 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  const calcMonthlyRev = (doc: Doctor) =>
    doc.productTargets.reduce((s, t) => {
      const avg = monthlyAvg(t.monthlyData);
      if (!avg) return s;
      const pm = priceMap[t.productId];
      if (!pm) return s;
      const hospIds = doc.hospitalIds ?? (doc.hospitalId ? [doc.hospitalId] : []);
      const price = hospIds.map(h => pm.byHosp[h]).find(Boolean) ?? pm.base;
      return s + Math.round(avg * price);
    }, 0);

  // 篩選邏輯
  const filtered = doctors.filter(d => {
    if (filterGrades.size > 0 && !filterGrades.has(d.grade)) return false;
    if (filterHospitals.size > 0) {
      const ids = d.hospitalIds ?? (d.hospitalId ? [d.hospitalId] : []);
      if (!ids.some(hid => filterHospitals.has(hid))) return false;
    }
    if (filterDepts.size > 0 && !filterDepts.has(normDept(d.department))) return false;
    if (filterProducts.size > 0 && !d.productTargets.some(t => filterProducts.has(t.productId))) return false;
    if (filterTags.size > 0 && !([...(d.tags ?? [])].some(tag => filterTags.has(tag)))) return false;
    if (search.trim() && !d.name.includes(search) && !d.hospitalName.includes(search) && !d.department.includes(search)) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'real') {
      return (perfById[b.id]?.rev ?? 0) - (perfById[a.id]?.rev ?? 0);
    }
    if (sortBy === 'revenue') {
      return calcMonthlyRev(b) - calcMonthlyRev(a);
    }
    if (sortBy === 'visit_desc' || sortBy === 'visit_asc') {
      const aDate = lastVisitMap[a.id]?.date ?? '';
      const bDate = lastVisitMap[b.id]?.date ?? '';
      if (!aDate && !bDate) return 0;
      if (!aDate) return sortBy === 'visit_asc' ? -1 : 1;
      if (!bDate) return sortBy === 'visit_asc' ? 1 : -1;
      return sortBy === 'visit_desc' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
    }
    const aId = (a.hospitalIds?.[0] ?? a.hospitalId) || '';
    const bId = (b.hospitalIds?.[0] ?? b.hospitalId) || '';
    return (HOSP_ORDER[aId] ?? 999) - (HOSP_ORDER[bId] ?? 999);
  });

  function toggleSet<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    return next;
  }

  const [showStrategies, setShowStrategies] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">客戶資料庫</h1>
            <span className="text-sm text-gray-400">{doctors.length} 位</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/customers/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              ＋ 新增客戶
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* ── 儀表板 / 清單 切換 ── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {([['dashboard', '儀表板'], ['list', '清單']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 拜訪頻率規劃儀表板（產能評估）── */}
        {tab === 'list' && (() => {
          const FREQS: { days: number; label: string; color: string }[] = [
            { days: 7,  label: '每週',   color: 'text-red-600' },
            { days: 14, label: '每兩週', color: 'text-orange-600' },
            { days: 30, label: '每月',   color: 'text-blue-600' },
            { days: 90, label: '每季',   color: 'text-violet-600' },
          ];
          const countBy = (d: number) => doctors.filter(x => (x.visitFrequencyDays ?? 0) === d).length;
          const unset = doctors.filter(x => !(x.visitFrequencyDays ?? 0)).length;
          const weeklyLoad = FREQS.reduce((s, f) => s + countBy(f.days) * (7 / f.days), 0);
          const capacity = Math.max(perDay, 0) * 5;
          const util = capacity > 0 ? Math.round((weeklyLoad / capacity) * 100) : 0;
          const over = weeklyLoad > capacity;
          const barColor = over ? 'bg-red-500' : util >= 80 ? 'bg-yellow-400' : 'bg-emerald-500';
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">拜訪頻率規劃</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  每天可拜訪
                  <input type="number" min={1} value={perDay}
                    onChange={e => { const n = Number(e.target.value) || 0; setPerDay(n); localStorage.setItem('visit-capacity-per-day', String(n)); }}
                    className="w-14 border border-gray-300 rounded-md px-2 py-1 text-center text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  位 → 每週量能 <span className="font-bold text-gray-700">{capacity}</span> 位
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3 mb-4">
                {FREQS.map(f => {
                  const n = countBy(f.days);
                  const load = n * (7 / f.days);
                  return (
                    <div key={f.days} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 text-center">
                      <div className="text-xs text-gray-400">{f.label}</div>
                      <div className={`text-2xl font-black ${f.color}`}>{n}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">≈ {load.toFixed(1)} 次/週</div>
                    </div>
                  );
                })}
                <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 text-center">
                  <div className="text-xs text-gray-400">未設定</div>
                  <div className="text-2xl font-black text-gray-300">{unset}</div>
                  <div className="text-[11px] text-gray-300 mt-0.5">未納入規劃</div>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-gray-500">每週所需拜訪量</span>
                  <span className="text-sm">
                    <span className={`font-black ${over ? 'text-red-600' : 'text-gray-800'}`}>{weeklyLoad.toFixed(1)}</span>
                    <span className="text-gray-400"> / {capacity} 位　({util}%)</span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(util, 100)}%` }} />
                </div>
                <p className={`text-xs mt-1.5 font-medium ${over ? 'text-red-600' : util >= 80 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                  {over
                    ? `⚠️ 已超過量能 ${(weeklyLoad - capacity).toFixed(1)} 位／週，建議降低部分客戶頻率或減少客戶數`
                    : util >= 80
                      ? `接近滿載，量能還剩 ${(capacity - weeklyLoad).toFixed(1)} 位／週`
                      : `✓ 規劃合理，量能還有 ${(capacity - weeklyLoad).toFixed(1)} 位／週`}
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── 需跟進客戶（超過拜訪頻率目標）── */}
        {tab === 'list' && (() => {
          const today = new Date();
          const list = doctors
            .map(d => ({ d, st: visitStatus(d.visitFrequencyDays, lastVisitMap[d.id]?.date, today) }))
            .filter(x => x.st.state === 'overdue' || x.st.state === 'never')
            .sort((a, b) => {
              if (a.st.state !== b.st.state) return a.st.state === 'overdue' ? -1 : 1;
              return b.st.overdueBy - a.st.overdueBy;
            });
          if (list.length === 0) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                ⚠️ 需跟進客戶
                <span className="text-xs font-normal text-amber-600">{list.length} 位已超過拜訪頻率目標</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {list.map(({ d, st }) => (
                  <Link key={d.id} href={`/customers/${d.id}`}
                    className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 hover:border-amber-400 transition-colors">
                    <span className="text-sm font-medium text-gray-800">{d.name}</span>
                    {d.department && <span className="text-[10px] text-gray-500 bg-gray-100 px-1 rounded">{DEPT_LABEL[d.department] ?? d.department}</span>}
                    <span className="text-xs font-semibold text-red-500">
                      {st.state === 'never' ? '從未拜訪' : `逾期 ${st.overdueBy} 天`}
                    </span>
                    <span className="text-[10px] text-gray-400">目標{freqLabel(st.freqDays)}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── 業績報表對不上客戶資料庫的醫師（多半是打錯字，會漏算業績）── */}
        {unlinkedPerf.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
              ⚠️ 業績報表有 {unlinkedPerf.length} 位醫師對不到客戶資料庫
              <span className="text-xs font-normal text-red-500">他們的業績不會顯示在下面的卡片上</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {unlinkedPerf.map(n => (
                <span key={n} className="text-xs bg-white border border-red-200 rounded-lg px-2 py-1 text-red-700">{n}</span>
              ))}
            </div>
            <p className="text-[11px] text-red-500 mt-2">
              通常是業績頁輸入醫師時選錯字。到 <Link href="/performance" className="underline">業績報表</Link> 把名字改成與這裡一致即可。
            </p>
          </div>
        )}

        {/* ── 醫院策略 (可折疊) ── */}
        {tab === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button onClick={() => setShowStrategies(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            醫院策略
            <span className="text-gray-400 text-xs">{showStrategies ? '▲ 收起' : '▼ 展開'}</span>
          </button>
          {showStrategies && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {HOSPITALS.map(hospital => (
                <div key={hospital.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{hospital.name}</span>
                    <Link href={`/customers/new?hospitalId=${hospital.id}`}
                      className="text-xs text-blue-600 hover:underline">＋ 新增醫師</Link>
                  </div>
                  <StrategyField hospitalId={hospital.id} initial={strategies[hospital.id] ?? ''} />
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* ── 篩選器（兩個分頁共用，圖表與清單吃同一組條件）── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {/* 期間：業績與拜訪次數都吃這段，清單頁的月均業績也一樣 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 w-8 shrink-0">期間</span>
            {([[1, '近1月'], [3, '近3月'], [ALL_PERF_MONTHS.length, '全部']] as const).map(([n, label]) => {
              const target = ALL_PERF_MONTHS.slice(-n);
              const on = selMonths.length === target.length && target.every(m => selMonths.includes(m));
              return (
                <button key={label} onClick={() => setSelMonths(target)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    on ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {label}
                </button>
              );
            })}
            <span className="text-gray-200">|</span>
            {MY_PERFORMANCE.map(m => (
              <button key={m.month}
                onClick={() => setSelMonths(prev =>
                  prev.includes(m.month)
                    ? (prev.length > 1 ? prev.filter(x => x !== m.month) : prev)   // 至少留一個月
                    : [...prev, m.month].sort())}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selMonths.includes(m.month) ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-400'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* 等級 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 w-8 shrink-0">等級</span>
            <button onClick={() => setFilterGrades(new Set())}
              className={`px-3 py-1 rounded-full text-xs font-medium ${filterGrades.size === 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              全選
            </button>
            {(['S','A','B','C','D','X','Y'] as DoctorGrade[]).map(g => {
              const s = GRADE_STYLE[g];
              return (
                <button key={g} onClick={() => setFilterGrades(prev => toggleSet(prev, g))}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                    filterGrades.has(g) ? `${s.bg} ${s.text} border-transparent` : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
                  }`}>
                  {g}
                </button>
              );
            })}
          </div>

          {/* 醫院 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 w-8 shrink-0">醫院</span>
            <button onClick={() => setFilterHospitals(new Set())}
              className={`px-3 py-1 rounded-full text-xs font-medium ${filterHospitals.size === 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              全選
            </button>
            {HOSPITALS.map(h => (
              <button key={h.id} onClick={() => setFilterHospitals(prev => toggleSet(prev, h.id))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterHospitals.has(h.id) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {h.shortName}
              </button>
            ))}
          </div>

          {/* 科別 */}
          {allDepts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 w-8 shrink-0">科別</span>
              <button onClick={() => setFilterDepts(new Set())}
                className={`px-3 py-1 rounded-full text-xs font-medium ${filterDepts.size === 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                全選
              </button>
              {allDepts.map(d => (
                <button key={d} onClick={() => setFilterDepts(prev => toggleSet(prev, d))}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterDepts.has(d) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {DEPT_LABEL[d] ?? d}
                </button>
              ))}
            </div>
          )}

          {/* 產品 */}
          {allProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 w-8 shrink-0">產品</span>
              <button onClick={() => setFilterProducts(new Set())}
                className={`px-3 py-1 rounded-full text-xs font-medium ${filterProducts.size === 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                全選
              </button>
              {allProducts.map(p => (
                <button key={p.id} onClick={() => setFilterProducts(prev => toggleSet(prev, p.id))}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterProducts.has(p.id) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* 標籤 */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 w-8 shrink-0">#</span>
              <button onClick={() => setFilterTags(new Set())}
                className={`px-3 py-1 rounded-full text-xs font-medium ${filterTags.size === 0 ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                全選
              </button>
              {allTags.map(tag => (
                <button key={tag} onClick={() => setFilterTags(prev => toggleSet(prev, tag))}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    filterTags.has(tag) ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                  }`}>
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* 排序 + 搜尋 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">排序</span>
            <button onClick={() => setSortBy('hospital')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === 'hospital' ? 'bg-gray-900 text-white border-transparent' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              醫院
            </button>
            <button onClick={() => setSortBy('real')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === 'real' ? 'bg-emerald-600 text-white border-transparent' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-400'}`}>
              實際業績 ↓
            </button>
            <button onClick={() => setSortBy('revenue')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === 'revenue' ? 'bg-blue-600 text-white border-transparent' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400'}`}>
              估算月業績 ↓
            </button>
            <button
              onClick={() => setSortBy(prev => prev === 'visit_desc' ? 'visit_asc' : 'visit_desc')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                sortBy === 'visit_desc' || sortBy === 'visit_asc'
                  ? 'bg-green-600 text-white border-transparent'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-green-400'
              }`}>
              拜訪日期 {sortBy === 'visit_desc' ? '↓' : sortBy === 'visit_asc' ? '↑' : '↕'}
            </button>
          </div>
          <input type="text" placeholder="搜尋姓名、醫院、科別..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
        </div>

        {tab === 'dashboard' && (
          <CustomerInsights
            doctors={filtered}
            perfById={perfById}
            visitCountById={visitCountById}
            coverage={coverage}
            periodLabel={periodMonths.length === 1
              ? (periodMonths[0]?.label ?? '')
              : `${periodMonths[0]?.label ?? ''}–${periodMonths[periodMonths.length - 1]?.label ?? ''}`}
          />
        )}

        {/* ── 醫師清單（永遠平鋪）── */}
        {tab === 'list' && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-10">找不到符合的醫師</p>
          ) : (
            filtered.map(doc => <DoctorCard key={doc.id} doc={doc} lastVisit={lastVisitMap[doc.id]} clinicSummary={clinicMap[doc.name]} priceMap={priceMap} perf={perfById[doc.id]} periodMonths={periodMonths.length} onDelete={handleDelete} onChanged={reload} />)
          )}
        </div>
        )}
      </div>
    </div>
  );
}

// ── DoctorCard ────────────────────────────────────────────

function DoctorCard({ doc, lastVisit, clinicSummary, priceMap, perf, periodMonths, onDelete, onChanged }: {
  doc: Doctor; lastVisit?: VisitRecord; clinicSummary?: string;
  perf?: DocPerf; periodMonths: number;
  priceMap: Record<string, { base: number; byHosp: Record<string, number> }>;
  onDelete: (id: string, name: string) => void;
  onChanged: () => void;
}) {
  const g = doc.grade ? GRADE_STYLE[doc.grade] : null;
  const allHospIds = doc.hospitalIds ?? (doc.hospitalId ? [doc.hospitalId] : []);
  const borderClass = HOSP_BORDER[allHospIds[0] ?? ''] ?? 'border-l-4 border-gray-200';
  const cardBg = HOSP_CARD_BG[allHospIds[0] ?? ''] ?? 'bg-white';
  const total = doc.productTargets.reduce((s, t) => s + monthlyTotal(t.monthlyData), 0);
  const targetTotal = doc.productTargets.reduce((s, t) => s + t.targetQty, 0);
  const rate = targetTotal > 0 ? Math.round((total / Math.max(targetTotal * 4, 1)) * 100) : null;

  // 月業績估算：月均用量 × 單價
  const avgQty = (data?: Record<string, number>) => {
    if (!data) return 0;
    const vals = Object.values(data).filter(v => v > 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const monthlyRev = doc.productTargets.reduce((s, t) => {
    const avg = avgQty(t.monthlyData);
    if (!avg) return s;
    const pm = priceMap[t.productId];
    if (!pm) return s;
    const price = allHospIds.map(h => pm.byHosp[h]).find(Boolean) ?? pm.base;
    return s + Math.round(avg * price);
  }, 0);

  // 計算距上次拜訪天數（用本地時間比較，避免 UTC 時區偏移）
  const daysSince = (() => {
    if (!lastVisit) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const visitDay = new Date(lastVisit.date + 'T00:00:00');
    return Math.floor((today.getTime() - visitDay.getTime()) / 86400000);
  })();
  const staleness = daysSince === null ? 'none' : daysSince > 30 ? 'red' : daysSince > 14 ? 'yellow' : 'green';
  const fStatus = visitStatus(doc.visitFrequencyDays, lastVisit?.date);
  const realMonthly = perf ? Math.round(perf.rev / Math.max(periodMonths, 1)) : 0;

  return (
    <div className={`${cardBg} rounded-lg border border-gray-100 pl-0 overflow-hidden flex ${borderClass}`}>
      <Link href={`/customers/${doc.id}`} className="flex-1 min-w-0 px-4 py-3">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{doc.name}</span>
          {doc.title && <span className="text-xs text-gray-400">{doc.title}</span>}
          {doc.department && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{DEPT_LABEL[doc.department] ?? doc.department}</span>}
          {g && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${g.bg} ${g.text}`}>{doc.grade}</span>
          )}
          {allHospIds.map(hid => {
            const hosp = HOSPITALS.find(h => h.id === hid);
            return (
              <span key={hid} className={`text-xs px-1.5 py-0.5 rounded ${HOSP_BADGE[hid] ?? 'bg-gray-50 text-gray-500'}`}>
                {hosp?.shortName ?? hid}
              </span>
            );
          })}
          {fStatus.state === 'overdue' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">🔴 逾期 {fStatus.overdueBy} 天</span>
          )}
          {fStatus.state === 'never' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">🔴 從未拜訪</span>
          )}
          {fStatus.state === 'soon' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">🟡 快到期</span>
          )}
        </div>
        {/* 真實產品組成：寬度＝金額佔比，一眼看主力產品是哪支 */}
        {perf && perf.merged.length > 0 && (
          <div className="mt-1.5">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
              {perf.merged.map(m => (
                <div key={m.name} style={{ width: `${(m.rev / perf.rev) * 100}%`, background: CAT_COLOR[m.cat] ?? '#cbd5e1' }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
              {perf.merged.slice(0, 3).map(m => (
                <span key={m.name} className="text-[10px] text-gray-500">
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                    style={{ background: CAT_COLOR[m.cat] ?? '#cbd5e1' }} />
                  {m.name} <span className="text-gray-400">{m.qty}件</span>
                </span>
              ))}
              {perf.merged.length > 3 && <span className="text-[10px] text-gray-300">+{perf.merged.length - 3}</span>}
            </div>
          </div>
        )}
        {doc.productTargets.length > 0 && (
          <div className="flex gap-2 mt-1 flex-wrap">
            {doc.productTargets.map(t => {
              const tot = monthlyTotal(t.monthlyData);
              return tot > 0 ? (
                <span key={t.productId} className="text-xs text-gray-500">
                  {t.productName} <span className="font-medium text-gray-700">{tot}</span>{t.unit}
                </span>
              ) : null;
            })}
          </div>
        )}
        {/* 門診時段摘要 */}
        {(clinicSummary || (doc.extraClinicSlots ?? []).length > 0) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {clinicSummary && clinicSummary.split(' ').map((s, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{s}</span>
            ))}
            {(doc.extraClinicSlots ?? []).map((s, i) => (
              <span key={`ex-${i}`} className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded">
                {s.location} {['日','一','二','三','四','五','六'][s.dayOfWeek]}{s.session}
              </span>
            ))}
          </div>
        )}
        {/* 標籤 */}
        {(doc.tags ?? []).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {(doc.tags ?? []).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 font-semibold rounded-full">#{tag}</span>
            ))}
          </div>
        )}
        {/* 上次拜訪 */}
        <div className="mt-1.5 flex items-start gap-1.5">
          {lastVisit ? (
            <>
              <span className={`text-xs shrink-0 font-medium ${
                staleness === 'red' ? 'text-red-400' : staleness === 'yellow' ? 'text-yellow-500' : 'text-green-600'
              }`}>
                {lastVisit.date}
                {daysSince === 0 ? '（今天）' : daysSince === 1 ? '（昨天）' : `（${daysSince}天前）`}
              </span>
              <span className="text-xs text-gray-400 truncate">{lastVisit.content}</span>
            </>
          ) : (
            <span className="text-xs text-gray-300">尚未拜訪</span>
          )}
        </div>
      </Link>
      <div className="flex items-center gap-3 px-4 shrink-0">
        <div className="text-center">
          <select
            value={doc.visitFrequencyDays ?? 0}
            onChange={e => { saveDoctor({ ...doc, visitFrequencyDays: Number(e.target.value) }); onChanged(); }}
            className={`text-xs border rounded-md px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 ${
              (doc.visitFrequencyDays ?? 0) > 0 ? 'border-gray-300 text-gray-700' : 'border-gray-200 text-gray-400'
            }`}
          >
            {VISIT_FREQ_OPTIONS.map(o => <option key={o.days} value={o.days}>{o.label}</option>)}
          </select>
          <div className="text-[10px] text-gray-400 mt-0.5">拜訪頻率</div>
        </div>
        {perf ? (
          // 業績報表歸屬到這位醫師的真實金額（加權），與 /performance 同一套算法
          <div className="text-center">
            <div className="text-sm font-bold text-emerald-600">
              {realMonthly >= 10000 ? `${Math.round(realMonthly / 1000)}K` : realMonthly.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">月均業績</div>
            <div className="text-[10px] text-gray-400">活躍 {perf.activeMonths}/{periodMonths} 月</div>
          </div>
        ) : monthlyRev > 0 ? (
          <div className="text-center">
            <div className="text-sm font-bold text-blue-400">
              {monthlyRev >= 10000 ? `${Math.round(monthlyRev / 1000)}K` : monthlyRev.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400">月業績<span className="text-gray-300">（估算）</span></div>
          </div>
        ) : null}
        {rate !== null && rate > 0 && (
          <div className="text-center">
            <div className={`text-sm font-bold ${rate >= 100 ? 'text-green-600' : rate >= 60 ? 'text-blue-600' : 'text-orange-500'}`}>
              {rate}%
            </div>
            <div className="text-xs text-gray-400">達成</div>
          </div>
        )}
        <button onClick={() => onDelete(doc.id, doc.name)} className="text-xs text-red-300 hover:text-red-500">刪除</button>
      </div>
    </div>
  );
}
