import { notFound } from 'next/navigation';
import { HOSPITALS } from '@/data/hospitals';
import { SEED_PRODUCTS } from '@/data/seedProducts';
import { HOSPITAL_PRODUCT_IDS } from '@/data/salesHistory';
import { Product, ProductCategory } from '@/types';

const CATEGORIES: { key: ProductCategory | ''; labelZh: string; color: string }[] = [
  { key: 'Adhesion Prevention',  labelZh: '防沾黏產品',      color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { key: 'Hemostasis',           labelZh: '止血產品',         color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'Hernia',               labelZh: '疝氣修補',         color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'Urinary Incontinence', labelZh: '尿失禁 / 骨盆底', color: 'bg-green-50 border-green-200 text-green-700' },
  { key: '',                     labelZh: '其他',             color: 'bg-gray-50 border-gray-200 text-gray-600' },
];

export async function generateStaticParams() {
  return HOSPITALS.map(h => ({ id: h.id }));
}

export default async function HospitalClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const hospital = HOSPITALS.find(h => h.id === id);
  if (!hospital) notFound();

  const productIds = HOSPITAL_PRODUCT_IDS[id] ?? [];

  // Only include products in the hospital's list, and only variants with hospital-specific data
  const products = SEED_PRODUCTS
    .filter(p => productIds.includes(p.id))
    .map(p => ({
      ...p,
      variants: p.variants.filter(v => v.hospitalInfo?.[id] !== undefined),
    }))
    .filter(p => p.variants.length > 0);

  // Group by category
  const grouped: Record<string, Product[]> = {};
  CATEGORIES.forEach(c => { grouped[c.key] = []; });
  products.forEach(p => {
    const cat = p.category ?? '';
    grouped[cat] = [...(grouped[cat] ?? []), p as Product];
  });

  const hasProducts = products.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">在院產品資訊</p>
          <h1 className="text-2xl font-bold text-gray-900">{hospital.name}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {!hasProducts ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-base">尚無此醫院的產品資料</p>
          </div>
        ) : (
          <div className="space-y-10">
            {CATEGORIES.map(({ key, labelZh, color }) => {
              const prods = grouped[key];
              if (!prods?.length) return null;

              return (
                <section key={key}>
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${color}`}>
                      {labelZh}
                    </span>
                    <div className="flex-1 border-t border-gray-100" />
                  </div>

                  <div className="space-y-4">
                    {prods.map(product => (
                      <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {/* Product header */}
                        <div className="px-5 py-4">
                          <h3 className="font-semibold text-gray-900">{product.name}</h3>
                          {product.notes && (
                            <p className="text-sm text-gray-500 mt-1">{product.notes}</p>
                          )}
                        </div>

                        {/* Variants table */}
                        <div className="border-t border-gray-100 overflow-x-auto">
                          <table className="w-full text-sm min-w-[560px]">
                            <thead>
                              <tr className="bg-gray-50 text-xs text-gray-400">
                                <th className="text-left py-2.5 px-5 font-medium">型號</th>
                                <th className="text-left py-2.5 px-4 font-medium">規格</th>
                                <th className="text-left py-2.5 px-4 font-medium">院內碼</th>
                                <th className="text-left py-2.5 px-4 font-medium">費用代碼</th>
                                <th className="text-right py-2.5 px-5 font-medium">病人售價</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {product.variants.map(v => {
                                const info = v.hospitalInfo![id];
                                const patientPrice = info.patientPrice ?? v.patientPrice;
                                const code = v.nhiCode || v.selfPayCode;
                                const isNhi = !!v.nhiCode;

                                return (
                                  <tr key={v.id}>
                                    <td className="py-3 px-5 font-medium text-gray-800 whitespace-nowrap">
                                      {v.modelNumber}
                                    </td>
                                    <td className="py-3 px-4 text-gray-500">
                                      {v.description || '—'}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs text-gray-500 whitespace-nowrap">
                                      {info.hospitalCode || '—'}
                                    </td>
                                    <td className="py-3 px-4 text-xs">
                                      {code ? (
                                        <span className="flex items-center gap-1.5">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isNhi ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {isNhi ? '健' : '自'}
                                          </span>
                                          <span className="font-mono text-gray-500">{code}</span>
                                        </span>
                                      ) : '—'}
                                    </td>
                                    <td className="py-3 px-5 text-right font-semibold text-gray-900 whitespace-nowrap">
                                      {patientPrice ? `NT$${patientPrice.toLocaleString()}` : '—'}
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
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-6 pb-12 pt-4 text-center">
        <p className="text-xs text-gray-300">
          本頁資料僅供院內參考，實際售價以醫院公告為準
        </p>
      </div>
    </div>
  );
}
