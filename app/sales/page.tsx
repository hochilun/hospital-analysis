'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { SALES_BY_YEAR } from '@/data/salesHistory';

type View = 'hospital' | 'product';

const CAT_COLORS: Record<string, string> = {
  'Hemostasis':           '#3b82f6',
  'Adhesion Prevention':  '#10b981',
  'Hernia':               '#f59e0b',
  'Urinary Incontinence': '#8b5cf6',
};
const CAT_ZH: Record<string, string> = {
  'Hemostasis':           '止血',
  'Adhesion Prevention':  '防沾黏',
  'Hernia':               '疝氣',
  'Urinary Incontinence': '泌尿',
};
const HOSP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

function prodToCat(name: string): string {
  if (name.startsWith('宮安康') || name.startsWith('塞納斯')) return 'Adhesion Prevention';
  if (name.startsWith('止血')) return 'Hemostasis';
  if (name.startsWith('賀邁補') || name.startsWith('速巴定') ||
      name.includes('3DMAX') || name.toLowerCase().includes('ventralight')) return 'Hernia';
  if (name.startsWith('愛沛斯')) return 'Urinary Incontinence';
  return 'Hemostasis';
}

function fmtRev(n: number) {
  if (n >= 1_000_000) return `NT$${(n / 1_000_000).toFixed(2)}M`;
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
  const [year, setYear] = useState<'2025' | '2026'>('2025');
  const [view, setView] = useState<View>('hospital');
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);

  const { HOSPITAL_TOTALS, HOSPITAL_PRODUCT_SALES, PRODUCT_TOTALS, label } = SALES_BY_YEAR[year];

  const { totalRev, totalQty, catPieData, catTotal, hospPieData, barData,
          hospitalsSorted, productsSorted, maxHospitalRev, maxProductRev } = useMemo(() => {
    const totalRev = Object.values(HOSPITAL_TOTALS).reduce((s, v) => s + v.rev, 0);
    const totalQty = Object.values(HOSPITAL_TOTALS).reduce((s, v) => s + v.qty, 0);

    const catRevMap: Record<string, number> = {};
    for (const [name, { rev }] of Object.entries(PRODUCT_TOTALS)) {
      const cat = prodToCat(name);
      catRevMap[cat] = (catRevMap[cat] ?? 0) + rev;
    }
    const catTotal = Object.values(catRevMap).reduce((s, v) => s + v, 0);
    const catPieData = Object.entries(catRevMap).sort((a, b) => b[1] - a[1])
      .map(([cat, value]) => ({ cat, name: CAT_ZH[cat] ?? cat, value }));

    const hospPieData = Object.entries(HOSPITAL_TOTALS).sort((a, b) => b[1].rev - a[1].rev)
      .map(([name, { rev }]) => ({ name, value: rev }));

    const barData = Object.entries(HOSPITAL_PRODUCT_SALES).map(([hospital, products]) => {
      const row: Record<string, string | number> = { hospital };
      for (const cat of Object.keys(CAT_COLORS)) row[cat] = 0;
      for (const [prod, { rev }] of Object.entries(products)) {
        const cat = prodToCat(prod);
        row[cat] = (row[cat] as number) + rev;
      }
      return row;
    });

    const hospitalsSorted = Object.entries(HOSPITAL_TOTALS).sort((a, b) => b[1].rev - a[1].rev);
    const productsSorted  = Object.entries(PRODUCT_TOTALS).sort((a, b) => b[1].rev - a[1].rev);

    return {
      totalRev, totalQty, catPieData, catTotal, hospPieData, barData,
      hospitalsSorted, productsSorted,
      maxHospitalRev: hospitalsSorted[0]?.[1].rev ?? 1,
      maxProductRev:  productsSorted[0]?.[1].rev ?? 1,
    };
  }, [year, HOSPITAL_TOTALS, HOSPITAL_PRODUCT_SALES, PRODUCT_TOTALS]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">歷史業績</h1>
              <p className="text-xs text-gray-400">不含長庚土城、台北慈濟</p>
            </div>
          </div>
          {/* 年份 filter */}
          <div className="flex gap-2">
            {(['2025', '2026'] as const).map(y => (
              <button key={y} onClick={() => { setYear(y); setSelectedHospital(null); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  year === y ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-400'
                }`}>
                {SALES_BY_YEAR[y].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* 總覽卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">總業績</p>
            <p className="text-2xl font-bold text-blue-600">{fmtRev(totalRev)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">總數量</p>
            <p className="text-2xl font-bold text-gray-800">{totalQty.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">涵蓋醫院</p>
            <p className="text-2xl font-bold text-gray-800">{Object.keys(HOSPITAL_TOTALS).length}</p>
          </div>
        </div>

        {/* 兩個圓餅圖 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">醫院業績佔比</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={hospPieData} cx="50%" cy="45%" outerRadius={75} dataKey="value" nameKey="name">
                  {hospPieData.map((_, i) => <Cell key={i} fill={HOSP_COLORS[i % HOSP_COLORS.length]} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const { name, value } = payload[0];
                  const v = Number(value ?? 0);
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm">
                      <p className="font-semibold text-gray-800">{name}</p>
                      <p className="text-gray-600">{fmtRev(v)} · {((v / totalRev) * 100).toFixed(1)}%</p>
                    </div>
                  );
                }} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">產品分類佔比</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catPieData} cx="50%" cy="45%" outerRadius={75} dataKey="value" nameKey="name">
                  {catPieData.map((entry) => <Cell key={entry.cat} fill={CAT_COLORS[entry.cat]} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const { name, value } = payload[0];
                  const v = Number(value ?? 0);
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm">
                      <p className="font-semibold text-gray-800">{name}</p>
                      <p className="text-gray-600">{fmtRev(v)} · {((v / catTotal) * 100).toFixed(1)}%</p>
                    </div>
                  );
                }} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 堆疊長條圖 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">各醫院業績結構（依分類）</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="hospital" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : `${Math.round(v/1000)}K`}
                tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={({ active, payload, label: lbl }) => {
                if (!active || !payload?.length) return null;
                const items = [...payload].reverse().filter(p => Number(p.value ?? 0) > 0);
                const total = items.reduce((s, p) => s + Number(p.value ?? 0), 0);
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm min-w-[180px]">
                    <p className="font-semibold text-gray-800 mb-2">{lbl}</p>
                    {items.map((p, i) => (
                      <div key={`${p.dataKey}-${i}`} className="flex items-center justify-between gap-4 mb-1">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.fill }} />
                          {CAT_ZH[p.dataKey as string] ?? p.dataKey}
                        </span>
                        <span className="font-medium text-gray-800">{fmtRev(Number(p.value ?? 0))}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between font-semibold text-gray-800">
                      <span>合計</span><span>{fmtRev(total)}</span>
                    </div>
                  </div>
                );
              }} />
              {Object.entries(CAT_COLORS).map(([cat, color]) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-4 mt-2 justify-center">
            {Object.entries(CAT_ZH).map(([cat, lbl]) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-3 h-3 rounded inline-block" style={{ background: CAT_COLORS[cat] }} />
                {lbl}
              </div>
            ))}
          </div>
        </div>

        {/* 切換 tab */}
        <div className="flex gap-2">
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
                            <td className="py-2 text-right text-gray-400">{((rev / total) * 100).toFixed(1)}%</td>
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
