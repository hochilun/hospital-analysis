'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Doctor, DoctorGrade, ProductCategory, VisitRecord, ClinicSlot } from '@/types';
import { getDoctors, deleteDoctor, getHospitalStrategies, saveHospitalStrategy, saveDoctors, getProducts, getVisits, getHospitalsData } from '@/lib/storage';
import { DEPT_LABEL } from '@/data/hospitals';
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

const CAT_ZH: Record<string, string> = {
  'Hemostasis':           '止血',
  'Adhesion Prevention':  '防沾黏',
  'Hernia':               '疝氣',
  'Urinary Incontinence': '泌尿',
};
const CAT_COLOR: Record<string, string> = {
  'Hemostasis':           'bg-blue-600',
  'Adhesion Prevention':  'bg-emerald-500',
  'Hernia':               'bg-amber-500',
  'Urinary Incontinence': 'bg-purple-500',
};
const CATEGORIES: ProductCategory[] = ['Hemostasis', 'Adhesion Prevention', 'Hernia', 'Urinary Incontinence'];

// ── 工具函式 ──────────────────────────────────────────────

function monthlyTotal(monthlyData?: Record<string, number>): number {
  if (!monthlyData) return 0;
  return Object.values(monthlyData).reduce((s, v) => s + v, 0);
}

function doctorCatTotal(doc: Doctor, cat: ProductCategory | 'all'): number {
  return doc.productTargets.reduce((s, t) => {
    if (cat !== 'all' && t.category !== cat) return s;
    return s + monthlyTotal(t.monthlyData);
  }, 0);
}

function prodToCat(name: string): ProductCategory {
  if (name.startsWith('宮安康') || name.startsWith('塞納斯')) return 'Adhesion Prevention';
  if (name.startsWith('止血')) return 'Hemostasis';
  if (name.startsWith('賀邁補') || name.startsWith('速巴定') || name.includes('3DMAX') || name.toLowerCase().includes('ventralight')) return 'Hernia';
  if (name.startsWith('愛沛斯')) return 'Urinary Incontinence';
  return 'Hemostasis';
}

// ── 示範資料 seed ─────────────────────────────────────────

const GRADES_DIST: DoctorGrade[] = ['S', 'S', 'A', 'A', 'A', 'B', 'B', 'C', 'C', 'D'];

function seedMockData(doctors: Doctor[]): Doctor[] {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04'];
  return doctors.map((doc, di) => {
    const grade = doc.grade || GRADES_DIST[di % GRADES_DIST.length];
    const multiplier = grade === 'S' ? 0.95 : grade === 'A' ? 0.75 : grade === 'B' ? 0.45 : 0.1;
    const targets = doc.productTargets.map(t => {
      const base = Math.max(t.targetQty || 3, 1);
      const monthlyData: Record<string, number> = {};
      months.forEach(m => {
        const jitter = 0.8 + Math.random() * 0.4;
        monthlyData[m] = Math.max(1, Math.round(base * multiplier * jitter));
      });
      return { ...t, monthlyData, category: t.category || prodToCat(t.productName) };
    });
    return { ...doc, grade, productTargets: targets };
  });
}

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

function LeaderBoard({ title, cat, doctors, color }: {
  title: string; cat: ProductCategory | 'all'; doctors: Doctor[]; color: string;
}) {
  const ranked = [...doctors]
    .map(d => ({ d, total: doctorCatTotal(d, cat) }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const max = ranked[0]?.total ?? 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-[180px]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h3 className="text-xs font-semibold text-gray-700">{title}</h3>
      </div>
      {ranked.length === 0 ? (
        <p className="text-xs text-gray-300 text-center py-3">無資料</p>
      ) : (
        <div className="space-y-2">
          {ranked.map(({ d, total }, i) => (
            <div key={d.id}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-gray-600 truncate max-w-[100px]">
                  <span className="text-gray-400 mr-1">#{i + 1}</span>{d.name}
                </span>
                <span className="font-medium text-gray-800 ml-1">{total}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${(total / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

  // 篩選狀態
  const [filterGrades, setFilterGrades] = useState<Set<DoctorGrade>>(new Set());
  const [filterHospitals, setFilterHospitals] = useState<Set<string>>(new Set());
  const [filterDepts, setFilterDepts] = useState<Set<string>>(new Set());
  const [filterProducts, setFilterProducts] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'hospital' | 'revenue'>('hospital');

  useEffect(() => {
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
  }, []);

  const reload = () => setDoctors(getDoctors());

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」？`)) return;
    deleteDoctor(id);
    reload();
  };

  const handleSeedMock = () => {
    if (!confirm('將為所有客戶產生 2026/01-04 的示範月用量（已有資料也會覆蓋）。確定？')) return;
    saveDoctors(seedMockData(doctors));
    reload();
  };

  // 所有科別
  const allDepts = [...new Set(doctors.map(d => d.department).filter(Boolean))];

  // 醫院排序優先順序
  const HOSP_ORDER = HOSPITALS.reduce<Record<string, number>>((acc, h, i) => { acc[h.id] = i; return acc; }, {});

  const calcMonthlyRev = (doc: Doctor) =>
    doc.productTargets.reduce((s, t) => {
      const qty = t.currentQty ?? 0;
      if (!qty) return s;
      const pm = priceMap[t.productId];
      if (!pm) return s;
      const hospIds = doc.hospitalIds ?? (doc.hospitalId ? [doc.hospitalId] : []);
      const price = hospIds.map(h => pm.byHosp[h]).find(Boolean) ?? pm.base;
      return s + Math.round(qty * price);
    }, 0);

  // 篩選邏輯
  const filtered = doctors.filter(d => {
    if (filterGrades.size > 0 && !filterGrades.has(d.grade)) return false;
    if (filterHospitals.size > 0) {
      const ids = d.hospitalIds ?? (d.hospitalId ? [d.hospitalId] : []);
      if (!ids.some(hid => filterHospitals.has(hid))) return false;
    }
    if (filterDepts.size > 0 && !filterDepts.has(d.department)) return false;
    if (filterProducts.size > 0 && !d.productTargets.some(t => filterProducts.has(t.productId))) return false;
    if (search.trim() && !d.name.includes(search) && !d.hospitalName.includes(search) && !d.department.includes(search)) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'revenue') {
      return calcMonthlyRev(b) - calcMonthlyRev(a);
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
            <button onClick={handleSeedMock}
              className="px-3 py-1.5 border border-gray-200 text-xs text-gray-500 rounded-lg hover:border-gray-400">
              產生示範資料
            </button>
            <Link href="/customers/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              ＋ 新增客戶
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* ── 排行榜 ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-3">業績貢獻排行榜</h2>
          <div className="grid grid-cols-5 gap-3">
            {CATEGORIES.map(cat => (
              <LeaderBoard key={cat} title={CAT_ZH[cat]} cat={cat} doctors={doctors}
                color={CAT_COLOR[cat]} />
            ))}
            <LeaderBoard title="總計" cat="all" doctors={doctors} color="bg-gray-600" />
          </div>
        </div>

        {/* ── 醫院策略 (可折疊) ── */}
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

        {/* ── 篩選器 ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
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

          {/* 排序 + 搜尋 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">排序</span>
            <button onClick={() => setSortBy('hospital')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === 'hospital' ? 'bg-gray-900 text-white border-transparent' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              醫院
            </button>
            <button onClick={() => setSortBy('revenue')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === 'revenue' ? 'bg-blue-600 text-white border-transparent' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400'}`}>
              月業績 ↓
            </button>
          </div>
          <input type="text" placeholder="搜尋姓名、醫院、科別..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
        </div>

        {/* ── 醫師清單（永遠平鋪）── */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-10">找不到符合的醫師</p>
          ) : (
            filtered.map(doc => <DoctorCard key={doc.id} doc={doc} lastVisit={lastVisitMap[doc.id]} clinicSummary={clinicMap[doc.name]} priceMap={priceMap} onDelete={handleDelete} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ── DoctorCard ────────────────────────────────────────────

function DoctorCard({ doc, lastVisit, clinicSummary, priceMap, onDelete }: {
  doc: Doctor; lastVisit?: VisitRecord; clinicSummary?: string;
  priceMap: Record<string, { base: number; byHosp: Record<string, number> }>;
  onDelete: (id: string, name: string) => void;
}) {
  const g = doc.grade ? GRADE_STYLE[doc.grade] : null;
  const allHospIds = doc.hospitalIds ?? (doc.hospitalId ? [doc.hospitalId] : []);
  const borderClass = HOSP_BORDER[allHospIds[0] ?? ''] ?? 'border-l-4 border-gray-200';
  const cardBg = HOSP_CARD_BG[allHospIds[0] ?? ''] ?? 'bg-white';
  const total = doc.productTargets.reduce((s, t) => s + monthlyTotal(t.monthlyData), 0);
  const targetTotal = doc.productTargets.reduce((s, t) => s + t.targetQty, 0);
  const rate = targetTotal > 0 ? Math.round((total / Math.max(targetTotal * 4, 1)) * 100) : null;

  // 月業績估算：currentQty × 單價
  const monthlyRev = doc.productTargets.reduce((s, t) => {
    const qty = t.currentQty ?? 0;
    if (!qty) return s;
    const pm = priceMap[t.productId];
    if (!pm) return s;
    const price = allHospIds.map(h => pm.byHosp[h]).find(Boolean) ?? pm.base;
    return s + Math.round(qty * price);
  }, 0);

  // 計算距上次拜訪天數（用本地時間比較，避免 UTC 時區偏移）
  const daysSince = (() => {
    if (!lastVisit) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const visitDay = new Date(lastVisit.date + 'T00:00:00');
    return Math.floor((today.getTime() - visitDay.getTime()) / 86400000);
  })();
  const staleness = daysSince === null ? 'none' : daysSince > 30 ? 'red' : daysSince > 14 ? 'yellow' : 'green';

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
        </div>
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
        {monthlyRev > 0 && (
          <div className="text-center">
            <div className="text-sm font-bold text-blue-600">
              {monthlyRev >= 10000 ? `${Math.round(monthlyRev / 1000)}K` : monthlyRev.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">月業績</div>
          </div>
        )}
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
