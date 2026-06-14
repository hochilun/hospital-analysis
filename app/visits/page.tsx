'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getDoctors, getVisits, getProducts } from '@/lib/storage';
import { Doctor, VisitRecord, Product } from '@/types';
import { DEPT_LABEL } from '@/data/hospitals';
import { pullFromCloud } from '@/lib/supabase';

// ── 業績門檻 → 拜訪週期（天）─────────────────────────────
const TIERS = [
  { minAmt: 50000, days: 14, label: '高貢獻', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { minAmt: 10000, days: 30, label: '中貢獻', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { minAmt: 0,     days: 60, label: '低貢獻', color: 'text-gray-500 bg-gray-50 border-gray-200' },
];

function getTier(avgMonthly: number) {
  return TIERS.find(t => avgMonthly >= t.minAmt) ?? TIERS[TIERS.length - 1];
}

// ── 計算近3個月月份字串 ───────────────────────────────────
function recentMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth() + 1;
  for (let i = 0; i < 3; i++) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m--; if (m === 0) { m = 12; y--; }
  }
  return months;
}

// ── 建立 productId → hospitalId → 平均採購價 ──────────────
function buildPriceMap(products: Product[]): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (const prod of products) {
    const pid = prod.id;
    if (!pid) continue;
    const hospTotals: Record<string, number[]> = {};
    for (const v of prod.variants ?? []) {
      for (const [hid, hinfo] of Object.entries(v.hospitalInfo ?? {})) {
        const pp = (hinfo as any).purchasePrice;
        if (pp) {
          hospTotals[hid] = [...(hospTotals[hid] ?? []), pp];
        }
      }
    }
    map[pid] = Object.fromEntries(
      Object.entries(hospTotals).map(([hid, vals]) => [hid, vals.reduce((a, b) => a + b, 0) / vals.length])
    );
  }
  return map;
}

type DoctorStatus = {
  doctor: Doctor;
  lastVisit: string | null;
  daysAgo: number;
  avgMonthly: number;
  tier: typeof TIERS[number];
  status: 'overdue' | 'warning' | 'ok';
  overdueDays: number;
};

const HOSP_BADGE: Record<string, string> = {
  tmuh:    'bg-blue-100 text-blue-700',
  eck:     'bg-green-100 text-green-700',
  sph:     'bg-purple-100 text-purple-700',
  clinic:  'bg-orange-100 text-orange-700',
  grace:   'bg-pink-100 text-pink-700',
  tzuchi:  'bg-teal-100 text-teal-700',
  tucheng: 'bg-yellow-100 text-yellow-700',
};

export default function VisitsPage() {
  const [doctors, setDoctors]   = useState<Doctor[]>([]);
  const [visits, setVisits]     = useState<VisitRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterHosp, setFilterHosp] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'warning' | 'ok'>('all');

  useEffect(() => {
    const load = () => {
      setDoctors(getDoctors());
      setVisits(getVisits());
      setProducts(getProducts());
    };
    pullFromCloud().then(load);
    load();
  }, []);

  const months = useMemo(() => recentMonths(), []);
  const priceMap = useMemo(() => buildPriceMap(products), [products]);

  const statuses = useMemo<DoctorStatus[]>(() => {
    // 最後拜訪日
    const lastVisitMap: Record<string, string> = {};
    for (const v of visits) {
      const did = v.doctorId;
      if (did && v.date && (!lastVisitMap[did] || v.date > lastVisitMap[did])) {
        lastVisitMap[did] = v.date;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return doctors.map(doc => {
      const hid = doc.hospitalId ?? doc.hospitalIds?.[0] ?? '';

      // 月均採購業績
      let total = 0;
      for (const pt of doc.productTargets ?? []) {
        const avgPrice = priceMap[pt.productId]?.[hid] ?? 0;
        if (!avgPrice) continue;
        const qty = months.reduce((s, mo) => s + (pt.monthlyData?.[mo] ?? 0), 0);
        total += qty * avgPrice;
      }
      const avgMonthly = total / 3;

      const tier = getTier(avgMonthly);
      const lv = lastVisitMap[doc.id] ?? null;
      const daysAgo = lv
        ? Math.floor((today.getTime() - new Date(lv).getTime()) / 86400000)
        : 9999;

      const overdueDays = daysAgo - tier.days;
      let status: DoctorStatus['status'];
      if (daysAgo >= tier.days)           status = 'overdue';
      else if (daysAgo >= tier.days * 0.7) status = 'warning';
      else                                  status = 'ok';

      return { doctor: doc, lastVisit: lv, daysAgo, avgMonthly, tier, status, overdueDays };
    });
  }, [doctors, visits, priceMap, months]);

  // 醫院篩選選項
  const hospitals = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of statuses) {
      const hid = s.doctor.hospitalId ?? '';
      if (hid) map[hid] = s.doctor.hospitalName ?? hid;
    }
    return Object.entries(map);
  }, [statuses]);

  const filtered = useMemo(() => {
    return statuses
      .filter(s => {
        if (filterHosp && s.doctor.hospitalId !== filterHosp) return false;
        if (filterStatus !== 'all' && s.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        // 逾期在前 → 警示 → 正常；同狀態內逾期最久的在前
        const order = { overdue: 0, warning: 1, ok: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return b.daysAgo - a.daysAgo;
      });
  }, [statuses, filterHosp, filterStatus]);

  const counts = useMemo(() => ({
    overdue: statuses.filter(s => s.status === 'overdue').length,
    warning: statuses.filter(s => s.status === 'warning').length,
    ok:      statuses.filter(s => s.status === 'ok').length,
  }), [statuses]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">拜訪健康度</h1>
            <p className="text-sm text-gray-500">依業績權重追蹤拜訪週期</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/"          className="text-sm text-gray-500 hover:text-blue-600">首頁</Link>
            <Link href="/customers" className="text-sm text-gray-500 hover:text-blue-600">客戶</Link>
            <Link href="/products"  className="text-sm text-gray-500 hover:text-blue-600">產品</Link>
            <Link href="/sales"     className="text-sm text-gray-500 hover:text-blue-600">業績</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

        {/* ── 摘要卡片 ── */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setFilterStatus(filterStatus === 'overdue' ? 'all' : 'overdue')}
            className={`rounded-2xl p-4 border-2 text-left transition-all ${filterStatus === 'overdue' ? 'border-red-400 bg-red-50' : 'bg-white border-transparent shadow-sm hover:shadow'}`}
          >
            <div className="text-3xl font-bold text-red-500">{counts.overdue}</div>
            <div className="text-sm text-red-400 font-medium mt-0.5">逾期未拜訪</div>
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === 'warning' ? 'all' : 'warning')}
            className={`rounded-2xl p-4 border-2 text-left transition-all ${filterStatus === 'warning' ? 'border-amber-400 bg-amber-50' : 'bg-white border-transparent shadow-sm hover:shadow'}`}
          >
            <div className="text-3xl font-bold text-amber-500">{counts.warning}</div>
            <div className="text-sm text-amber-500 font-medium mt-0.5">即將到期</div>
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === 'ok' ? 'all' : 'ok')}
            className={`rounded-2xl p-4 border-2 text-left transition-all ${filterStatus === 'ok' ? 'border-emerald-400 bg-emerald-50' : 'bg-white border-transparent shadow-sm hover:shadow'}`}
          >
            <div className="text-3xl font-bold text-emerald-500">{counts.ok}</div>
            <div className="text-sm text-emerald-500 font-medium mt-0.5">正常</div>
          </button>
        </div>

        {/* ── 醫院篩選 ── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterHosp('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!filterHosp ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}
          >
            全部
          </button>
          {hospitals.map(([hid, name]) => (
            <button
              key={hid}
              onClick={() => setFilterHosp(filterHosp === hid ? '' : hid)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterHosp === hid ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* ── 醫師清單 ── */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">沒有符合條件的客戶</div>
          )}
          {filtered.map(({ doctor: d, lastVisit, daysAgo, avgMonthly, tier, status, overdueDays }) => {
            const hospId = d.hospitalId ?? '';
            const statusStyle =
              status === 'overdue' ? 'border-l-4 border-red-400 bg-white' :
              status === 'warning' ? 'border-l-4 border-amber-400 bg-white' :
                                     'border-l-4 border-emerald-300 bg-white';

            return (
              <Link
                key={d.id}
                href={`/hospital/${hospId}?doctor=${encodeURIComponent(d.name)}`}
                className={`block rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-all ${statusStyle}`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* 左：醫師資訊 */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* 狀態圓點 */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      status === 'overdue' ? 'bg-red-400' :
                      status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{d.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HOSP_BADGE[hospId] ?? 'bg-gray-100 text-gray-600'}`}>
                          {d.hospitalName}
                        </span>
                        {d.department && (
                          <span className="text-xs text-gray-400">{DEPT_LABEL[d.department] ?? d.department}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {lastVisit
                          ? `上次：${lastVisit}（${daysAgo === 9999 ? '從未' : `${daysAgo} 天前`}）`
                          : '尚未拜訪'}
                      </div>
                    </div>
                  </div>

                  {/* 右：業績 + 狀態標籤 */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* 月均業績 */}
                    <div className="text-right">
                      <div className="text-xs text-gray-400">月均採購</div>
                      <div className="text-sm font-semibold text-gray-700">
                        {avgMonthly > 0 ? `$${avgMonthly.toLocaleString('en', { maximumFractionDigits: 0 })}` : '—'}
                      </div>
                    </div>

                    {/* 貢獻等級 */}
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${tier.color}`}>
                      {tier.label}
                    </span>

                    {/* 狀態 */}
                    {status === 'overdue' && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-600 font-semibold whitespace-nowrap">
                        逾期 {overdueDays} 天
                      </span>
                    )}
                    {status === 'warning' && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 font-semibold whitespace-nowrap">
                        即將到期
                      </span>
                    )}
                    {status === 'ok' && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-600 font-semibold whitespace-nowrap">
                        正常
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── 週期說明 ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-xs text-gray-400 space-y-1">
          <div className="font-medium text-gray-500 mb-2">拜訪週期規則（近3個月平均月採購）</div>
          {TIERS.map(t => (
            <div key={t.days}>
              <span className={`inline-block px-2 py-0.5 rounded-full border mr-2 ${t.color}`}>{t.label}</span>
              {t.minAmt > 0 ? `≥ $${t.minAmt.toLocaleString()}` : '< $10,000'} → {t.days} 天內拜訪
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
