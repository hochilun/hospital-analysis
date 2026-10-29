// 多田業務季獎金（2025 年初改的規則）
// 一季的加權業績分段累進計算（跟所得稅一樣，各段用各自的比率），每季從 0 重算、不跨季累積。
// 業績基準＝加權業績，共跑醫院只算本人／認領的部分（同業績頁的有效業績）。
// 年度獎金（聽說改成 0.5%）規則未確認，先不算。

export type BonusTier = { from: number; to: number | null; rate: number };

export const BONUS_TIERS: BonusTier[] = [
  { from: 0,         to: 2_500_000, rate: 0.035 },
  { from: 2_500_000, to: 3_500_000, rate: 0.05 },
  { from: 3_500_000, to: 5_500_000, rate: 0.06 },
  { from: 5_500_000, to: null,      rate: 0.07 },
];

export type TierPart = BonusTier & { amount: number; bonus: number };

/** 一季業績 → 各級距拆解與獎金總額 */
export function calcBonus(quarterWeighted: number): { total: number; parts: TierPart[] } {
  const parts = BONUS_TIERS.map(t => {
    const top = t.to ?? Infinity;
    const amount = Math.max(0, Math.min(quarterWeighted, top) - t.from);
    return { ...t, amount, bonus: amount * t.rate };
  });
  return { total: parts.reduce((s, p) => s + p.bonus, 0), parts };
}

/** 目前所在級距與離下一級還差多少（已在最高級就回 null） */
export function nextTier(quarterWeighted: number) {
  const idx = BONUS_TIERS.findIndex(t => t.to === null || quarterWeighted < t.to);
  const cur = BONUS_TIERS[idx];
  const next = BONUS_TIERS[idx + 1];
  return { current: cur, next: next ?? null, gap: next ? next.from - quarterWeighted : null };
}

export const QUARTERS = [
  { q: 1, months: ['01', '02', '03'] },
  { q: 2, months: ['04', '05', '06'] },
  { q: 3, months: ['07', '08', '09'] },
  { q: 4, months: ['10', '11', '12'] },
] as const;

export const quarterOf = (monthKey: string) => Math.ceil(Number(monthKey.slice(5, 7)) / 3);
