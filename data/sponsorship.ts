// 學術贊助單價（每單位 NT$）
// 來源：products-db 各 variant 的 hospitalInfo.academicSponsorship，2026-08 校對。
// 產品名稱對應 myPerformance 使用的短名；未列出者一律無贊助（0）。

const ALL = '*';

// 產品短名 → { 醫院: 單價 }；'*' 代表所有醫院共用
const RATES: Record<string, Record<string, number>> = {
  '宮安康':        { [ALL]: 5500 },
  '宮安康 10ML':   { [ALL]: 5500 },
  '塞納斯':        { [ALL]: 5500 },
  'IS-M1':         { [ALL]: 6000 },
  'P-STOP-8':      { [ALL]: 12000 },
  '3DMAX LIGHT':   { [ALL]: 2000 },
  '3DMax':         { [ALL]: 2000 },
  '凡萃拉':        { [ALL]: 2000 },   // Ventralight ST
  '止血顆粒 1g':   { [ALL]: 2500 },
  '止血顆粒 5g':   { [ALL]: 7500 },
  // 止血顆粒 3g：沙爾德聖（聖保祿）與長庚土城為 4,500 的例外院價
  '止血顆粒 3g':   { [ALL]: 5000, '沙爾德聖': 4500, '長庚土城': 4500 },
  // 塗佈器兩種規格同價，僅在有計價的醫院適用
  '止血塗佈器':      { '恩主公': 1500, '宏恩醫療': 1500, '中心診所': 1500, '台北醫學': 1500 },
  '止血塗佈器 38cm': { '恩主公': 1500, '宏恩醫療': 1500, '中心診所': 1500, '台北醫學': 1500 },
  '止血塗佈器 14cm': { '恩主公': 1500, '宏恩醫療': 1500, '中心診所': 1500 },
};

// 無贊助：賀邁補、速巴定、IS-1、IS-6、IS-HELICO、IS-TOMS、凡提拉斯特、凡萃歐絲提

/** 單一產品在某醫院的學術贊助單價；無贊助回傳 0 */
export function sponsorRate(product: string, hospital: string): number {
  const r = RATES[product];
  if (!r) return 0;
  return r[hospital] ?? r[ALL] ?? 0;
}

/** 數量換算學術贊助金額 */
export function sponsorAmount(product: string, hospital: string, qty: number): number {
  return sponsorRate(product, hospital) * qty;
}
