'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

import { Product } from '@/types';
import { getProducts, deleteProduct } from '@/lib/storage';
import { HOSPITALS } from '@/data/hospitals';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filterHospital, setFilterHospital] = useState('');

  useEffect(() => { setProducts(getProducts()); }, []);

  const filtered = filterHospital
    ? products.filter(p => p.hospitalId === filterHospital)
    : products;

  // 依醫院分組
  const grouped = filtered.reduce((acc, p) => {
    const key = p.hospitalName || '未分類';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, Product[]>);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」？`)) return;
    deleteProduct(id);
    setProducts(getProducts());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">產品資料庫</h1>
          </div>
          <Link href="/products/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            ＋ 新增產品
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* 醫院篩選 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFilterHospital('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!filterHospital ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            全部
          </button>
          {HOSPITALS.map(h => (
            <button key={h.id} onClick={() => setFilterHospital(h.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterHospital === h.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {h.shortName}
            </button>
          ))}
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">💊</p>
            <p className="text-base font-medium">還沒有產品資料</p>
            <p className="text-sm mt-1">點右上角「新增產品」開始建立</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([hospitalName, prods]) => (
              <div key={hospitalName}>
                <h2 className="text-sm font-semibold text-gray-500 mb-2">{hospitalName}</h2>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                        <th className="text-left py-2.5 px-4">產品名稱</th>
                        <th className="text-left py-2.5 px-4">型號</th>
                        <th className="text-right py-2.5 px-4">醫院售價</th>
                        <th className="text-right py-2.5 px-4">病人售價</th>
                        <th className="text-right py-2.5 px-4">加成率</th>
                        <th className="py-2.5 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {prods.map(p => {
                        const markup = p.hospitalPrice > 0
                          ? Math.round(((p.patientPrice - p.hospitalPrice) / p.hospitalPrice) * 100)
                          : null;
                        return (
                          <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-800">{p.name}</td>
                            <td className="py-3 px-4 text-gray-500">{p.modelNumber || '—'}</td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {p.hospitalPrice ? `NT$${p.hospitalPrice.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {p.patientPrice ? `NT$${p.patientPrice.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {markup !== null && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${markup >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  +{markup}%
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <Link href={`/products/${p.id}/edit`}
                                  className="text-xs text-blue-500 hover:text-blue-700">編輯</Link>
                                <button onClick={() => handleDelete(p.id, p.name)}
                                  className="text-xs text-gray-300 hover:text-red-400">刪除</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
