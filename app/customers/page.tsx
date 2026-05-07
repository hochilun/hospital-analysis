'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Doctor, ProductTarget } from '@/types';
import { getDoctors, deleteDoctor } from '@/lib/storage';

function achievement(targets: ProductTarget[]) {
  if (!targets.length) return null;
  const total = targets.reduce((s, t) => s + t.targetQty, 0);
  const actual = targets.reduce((s, t) => s + t.actualQty, 0);
  if (total === 0) return null;
  return Math.round((actual / total) * 100);
}

export default function CustomersPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => { setDoctors(getDoctors()); }, []);

  const filtered = doctors.filter(d =>
    d.name.includes(search) || d.hospitalName.includes(search) || d.department.includes(search)
  );

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」？`)) return;
    deleteDoctor(id);
    setDoctors(getDoctors());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">客戶資料庫</h1>
          </div>
          <Link href="/customers/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            ＋ 新增客戶
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <input
          type="text"
          placeholder="搜尋醫師姓名、醫院、科別..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm mb-6 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-base font-medium">還沒有客戶資料</p>
            <p className="text-sm mt-1">點右上角「新增客戶」開始建立</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(doc => {
              const rate = achievement(doc.productTargets);
              return (
                <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <Link href={`/customers/${doc.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{doc.name}</span>
                      {doc.title && <span className="text-xs text-gray-400">{doc.title}</span>}
                    </div>
                    <div className="text-sm text-gray-500">{doc.hospitalName} · {doc.department}</div>
                    {doc.phone && <div className="text-xs text-gray-400 mt-0.5">{doc.phone}</div>}
                  </Link>

                  <div className="flex items-center gap-4 shrink-0">
                    {rate !== null && (
                      <div className="text-center">
                        <div className={`text-lg font-bold ${rate >= 100 ? 'text-green-600' : rate >= 60 ? 'text-blue-600' : 'text-orange-500'}`}>
                          {rate}%
                        </div>
                        <div className="text-xs text-gray-400">目標達成</div>
                      </div>
                    )}
                    {doc.monthlyInvestment > 0 && (
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-700">
                          ${doc.monthlyInvestment.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">月投資</div>
                      </div>
                    )}
                    <Link href={`/customers/${doc.id}`}
                      className="text-sm text-blue-600 hover:underline">詳情</Link>
                    <button onClick={() => handleDelete(doc.id, doc.name)}
                      className="text-sm text-red-400 hover:text-red-600">刪除</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
