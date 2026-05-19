'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Product, ProductCategory } from '@/types';
import { getProducts, deleteProduct, saveProduct } from '@/lib/storage';
import { HOSPITALS } from '@/data/hospitals';
import { SEED_PRODUCTS } from '@/data/seedProducts';
import { HOSPITAL_PRODUCT_IDS } from '@/data/salesHistory';
import { pullFromCloud } from '@/lib/supabase';

const CATEGORIES: { key: ProductCategory; label: string; color: string }[] = [
  { key: 'Hemostasis',           label: 'Hemostasis',           color: 'bg-red-100 text-red-800 border-red-200' },
  { key: 'Adhesion Prevention',  label: 'Adhesion Prevention',  color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { key: 'Hernia',               label: 'Hernia',               color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'Urinary Incontinence', label: 'Urinary Incontinence', color: 'bg-green-100 text-green-800 border-green-200' },
  { key: '',                     label: '未分類',                color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filterHospital, setFilterHospital] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => { setProducts(getProducts()); }, []);

  const toggle = (cat: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const selectedHospital = HOSPITALS.find(h => h.id === filterHospital);

  const filtered = filterHospital
    ? products.filter(p => {
        const salesIds = HOSPITAL_PRODUCT_IDS[filterHospital] ?? [];
        return salesIds.includes(p.id) || p.hospitalId === filterHospital;
      })
    : products;

  // 依分類分組
  const grouped: Record<string, Product[]> = {};
  CATEGORIES.forEach(c => { grouped[c.key] = []; });
  filtered.forEach(p => {
    const cat = p.category ?? '';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」及所有型號？`)) return;
    deleteProduct(id);
    setProducts(getProducts());
  };

  const handleCloudSync = async () => {
    localStorage.removeItem('products-db');
    await pullFromCloud();
    setProducts(getProducts());
  };

  const handleImport = () => {
    const existing = getProducts().map(p => p.id);
    let count = 0;
    SEED_PRODUCTS.forEach(p => {
      if (!existing.includes(p.id)) { saveProduct(p); count++; }
      else { saveProduct({ ...getProducts().find(x => x.id === p.id)!, ...p }); }
    });
    setProducts(getProducts());
    alert('產品已更新完成');
  };

  const hasAny = filtered.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">產品資料庫</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCloudSync}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
              從雲端同步
            </button>
            <button onClick={handleImport}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
              匯入報表產品
            </button>
            <Link href="/products/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              ＋ 新增產品
            </Link>
          </div>
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

        {!hasAny ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">💊</p>
            <p className="text-base font-medium">還沒有產品資料</p>
            <p className="text-sm mt-1">點右上角「匯入報表產品」或「新增產品」</p>
          </div>
        ) : (
          <div className="space-y-3">
            {CATEGORIES.map(({ key, label, color }) => {
              const prods = grouped[key] ?? [];
              if (prods.length === 0) return null;
              const isCollapsed = collapsed.has(key);
              return (
                <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* 分類標題 */}
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${color}`}>
                        {label}
                      </span>
                      <span className="text-sm text-gray-400">{prods.length} 個產品</span>
                    </div>
                    <span className={`text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>▲</span>
                  </button>

                  {/* 產品列表 */}
                  {!isCollapsed && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {prods.map(p => (
                        <div key={p.id}>
                          {/* 產品標題 */}
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50">
                            <div>
                              <span className="font-semibold text-gray-800">{p.name}</span>
                              {p.nameEn && <div className="text-xs text-gray-400 mt-0.5">{p.nameEn}</div>}
                              {p.licenseNumber && <div className="text-xs text-gray-400 mt-0.5">{p.licenseNumber}</div>}
                            </div>
                            <div className="flex gap-3">
                              <Link href={`/products/${p.id}/edit`}
                                className="text-xs text-blue-500 hover:text-blue-700">編輯</Link>
                              <button onClick={() => handleDelete(p.id, p.name)}
                                className="text-xs text-gray-300 hover:text-red-400">刪除</button>
                            </div>
                          </div>
                          {/* 型號表 */}
                          {p.variants?.length > 0 && (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-gray-400 border-b border-gray-50">
                                  <th className="text-left py-2 px-4">型號</th>
                                  <th className="text-left py-2 px-4">描述</th>
                                  {filterHospital && <th className="text-left py-2 px-3">院內碼</th>}
                                  <th className="text-left py-2 px-3">自費碼/健保碼</th>
                                  <th className="text-right py-2 px-4">
                                    {filterHospital ? `採購價（未稅）` : '參考採購價'}
                                  </th>
                                  <th className="text-right py-2 px-4">末端售價</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.variants.map(v => {
                                  const info = filterHospital ? v.hospitalInfo?.[filterHospital] : undefined;
                                  const displayPrice = filterHospital && v.hospitalPrices?.[filterHospital]
                                    ? v.hospitalPrices[filterHospital]
                                    : v.hospitalPrice;
                                  const patientPriceDisplay = info?.patientPrice ?? v.patientPrice;
                                  const code = v.selfPayCode || v.nhiCode;
                                  const codeType = v.nhiCode ? '健' : v.selfPayCode ? '自' : '';
                                  return (
                                    <tr key={v.id} className="border-b border-gray-50 last:border-0">
                                      <td className="py-2.5 px-4 font-medium text-gray-700">{v.modelNumber}</td>
                                      <td className="py-2.5 px-4 text-gray-500">{v.description || '—'}</td>
                                      {filterHospital && (
                                        <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">
                                          {info?.hospitalCode ?? '—'}
                                        </td>
                                      )}
                                      <td className="py-2.5 px-3 text-xs">
                                        {code ? (
                                          <span className="flex items-center gap-1">
                                            <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${codeType === '健' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                              {codeType}
                                            </span>
                                            <span className="text-gray-500 font-mono">{code}</span>
                                          </span>
                                        ) : '—'}
                                      </td>
                                      <td className="py-2.5 px-4 text-right">
                                        {displayPrice ? (
                                          <span className={filterHospital && v.hospitalPrices?.[filterHospital] ? 'text-blue-700 font-medium' : 'text-gray-700'}>
                                            NT${displayPrice.toLocaleString()}
                                          </span>
                                        ) : '—'}
                                      </td>
                                      <td className="py-2.5 px-4 text-right text-gray-700">
                                        {patientPriceDisplay ? `NT$${patientPriceDisplay.toLocaleString()}` : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
