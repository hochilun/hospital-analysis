'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  HOSPITAL_TOTALS, HOSPITAL_PRODUCT_SALES,
  PRODUCT_TOTALS, HOSPITAL_ID_MAP,
} from '@/data/salesHistory';
import { HOSPITALS } from '@/data/hospitals';

type View = 'hospital' | 'product';

const PERIOD = '2025/01 – 2026/04';
const TOTAL_REV = Object.values(HOSPITAL_TOTALS).reduce((s, v) => s + v.rev, 0);
const TOTAL_QTY = Object.values(HOSPITAL_TOTALS).reduce((s, v) => s + v.qty, 0);

function fmtRev(n: number) {
  if (n >= 1_000_000) return `NT$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `NT$${Math.round(n / 1000)}K`;
  return `NT$${n.toLocaleString()}`;
}

function BarRow({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-sm text-gray-700 truncate">{label}</div>
      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
        <div className="h-full bg-blue-500 rounded transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-24 shrink-0 text-right text-sm font-medium text-gray-800">{fmtRev(value)}</div>
      {sub && <div className="w-16 shrink-0 text-right text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function SalesPage() {
  const [view, setView] = useState<View>('hospital');
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);

  const hospitalsSorted = Object.entries(HOSPITAL_TOTALS).sort((a, b) => b[1].rev - a[1].rev);
  const productsSorted  = Object.entries(PRODUCT_TOTALS).sort((a, b) => b[1].rev - a[1].rev);
  const maxHospitalRev  = hospitalsSorted[0]?.[1].rev ?? 1;
  const maxProductRev   = productsSorted[0]?.[1].rev ?? 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">歷史業績</h1>
              <p className="text-xs text-gray-400">{PERIOD}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* 總覽卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">總業績</p>
            <p className="text-2xl font-bold text-blue-600">{fmtRev(TOTAL_REV)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">總數量</p>
            <p className="text-2xl font-bold text-gray-800">{TOTAL_QTY.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">涵蓋醫院</p>
            <p className="text-2xl font-bold text-gray-800">{Object.keys(HOSPITAL_TOTALS).length}</p>
          </div>
        </div>

        {/* 切換 tab */}
        <div className="flex gap-2 mb-4">
          {(['hospital', 'product'] as View[]).map(v => (
            <button key={v} onClick={() => { setView(v); setSelectedHospital(null); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === v ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              {v === 'hospital' ? '依醫院' : '依產品'}
            </button>
          ))}
        </div>

        {view === 'hospital' && (
          <div className="space-y-4">
            {/* 醫院長條圖 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">各醫院業績</h2>
              <div className="space-y-3">
                {hospitalsSorted.map(([name, { qty, rev }]) => (
                  <button key={name} className="w-full text-left hover:opacity-80"
                    onClick={() => setSelectedHospital(selectedHospital === name ? null : name)}>
                    <BarRow label={name} value={rev} max={maxHospitalRev} sub={`${qty} 支`} />
                  </button>
                ))}
              </div>
            </div>

            {/* 醫院明細 */}
            {selectedHospital && HOSPITAL_PRODUCT_SALES[selectedHospital] && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">
                  {selectedHospital} — 產品明細
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="text-left py-2">產品</th>
                      <th className="text-right py-2">數量</th>
                      <th className="text-right py-2">業績</th>
                      <th className="text-right py-2">佔比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(HOSPITAL_PRODUCT_SALES[selectedHospital])
                      .sort((a, b) => b[1].rev - a[1].rev)
                      .map(([prod, { qty, rev }]) => {
                        const total = HOSPITAL_TOTALS[selectedHospital]?.rev ?? 1;
                        return (
                          <tr key={prod} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 font-medium text-gray-700">{prod}</td>
                            <td className="py-2 text-right text-gray-500">{qty}</td>
                            <td className="py-2 text-right text-gray-800">{fmtRev(rev)}</td>
                            <td className="py-2 text-right text-gray-400">
                              {((rev / total) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'product' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">各產品業績</h2>
              <div className="space-y-3">
                {productsSorted.map(([name, { qty, rev }]) => (
                  <BarRow key={name} label={name} value={rev} max={maxProductRev} sub={`${qty} 支`} />
                ))}
              </div>
            </div>

            {/* 產品 × 醫院分佈 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">各產品 × 醫院分佈</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left py-2 pr-4">產品</th>
                      {Object.keys(HOSPITAL_TOTALS).map(h => (
                        <th key={h} className="text-right py-2 px-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productsSorted.map(([prod]) => (
                      <tr key={prod} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-700">{prod}</td>
                        {Object.keys(HOSPITAL_TOTALS).map(h => {
                          const entry = HOSPITAL_PRODUCT_SALES[h]?.[prod];
                          return (
                            <td key={h} className="py-2 px-2 text-right text-gray-600">
                              {entry ? fmtRev(entry.rev) : <span className="text-gray-200">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
