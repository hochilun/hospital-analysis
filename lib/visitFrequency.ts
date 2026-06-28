// 拜訪頻率設定 + 逾期判斷（依最近一次拜訪日 vs 目標頻率）

export const VISIT_FREQ_OPTIONS: { days: number; label: string }[] = [
  { days: 0,  label: '不設定' },
  { days: 7,  label: '每週' },
  { days: 14, label: '每兩週' },
  { days: 30, label: '每月' },
  { days: 90, label: '每季' },
];

export const freqLabel = (days?: number): string => {
  if (!days || days <= 0) return '不設定';
  return VISIT_FREQ_OPTIONS.find(o => o.days === days)?.label ?? `每 ${days} 天`;
};

export type VisitState = 'none' | 'never' | 'ok' | 'soon' | 'overdue';

export type VisitStatus = {
  state: VisitState;
  daysSince: number | null;  // 距上次拜訪天數（never/none 為 null）
  overdueBy: number;         // 逾期天數（超過目標頻率的部分）
  freqDays: number;
};

/** 依目標頻率與最近拜訪日，判斷拜訪狀態 */
export function visitStatus(
  freqDays: number | undefined,
  lastDate: string | undefined,
  now: Date = new Date(),
): VisitStatus {
  const fd = freqDays ?? 0;
  if (fd <= 0) return { state: 'none', daysSince: null, overdueBy: 0, freqDays: 0 };
  if (!lastDate) return { state: 'never', daysSince: null, overdueBy: 0, freqDays: fd };
  const last = new Date(lastDate + 'T00:00:00');
  const daysSince = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
  if (daysSince > fd) return { state: 'overdue', daysSince, overdueBy: daysSince - fd, freqDays: fd };
  if (daysSince >= fd * 0.8) return { state: 'soon', daysSince, overdueBy: 0, freqDays: fd };
  return { state: 'ok', daysSince, overdueBy: 0, freqDays: fd };
}
