// 工作天曆 —— 用來把「月中的業績」換算成「預估整月」。
//
// 預估整月 = 本月已發生業績 ÷ 已過工作天 × 該月總工作天
// 工作天 = 週一到週五，扣掉下面這張國定假日表。
//
// ⚠️ 這張表是手動維護的，錯了預估就會偏。畫面上會一起顯示「已過 X／全月 Y 工作天」，
//    看到天數跟實際請假日曆對不上，直接改這裡就好，其他程式不用動。

export const HOLIDAYS: readonly string[] = [
  // 2026（只列會落在平日、實際放假的日子；週末本來就不算工作天，不必列）
  '2026-01-01',  // 元旦（四）
  '2026-02-16',  // 除夕（一）
  '2026-02-17',  // 春節初一（二）
  '2026-02-18',  // 春節初二（三）
  '2026-02-19',  // 春節初三（四）
  '2026-02-20',  // 春節彈性放假（五）
  '2026-02-27',  // 和平紀念日補假（五，2/28 為週六）
  '2026-04-03',  // 兒童節補假（五，4/4 為週六）
  '2026-04-06',  // 清明節補假（一，4/5 為週日）
  '2026-05-01',  // 勞動節（五）
  '2026-06-19',  // 端午節（五）
  '2026-09-25',  // 中秋節（五）
  '2026-09-28',  // 教師節（一）
  '2026-10-09',  // 國慶日補假（五，10/10 為週六）
  '2026-10-26',  // 台灣光復節補假（一，10/25 為週日）
  '2026-12-25',  // 行憲紀念日（五）
];

const HOLIDAY_SET = new Set(HOLIDAYS);

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** 該日是否為工作天（平日且非國定假日）。以本地時間判斷，避免 UTC 位移跨日 */
export function isWorkday(y: number, m: number, d: number): boolean {
  const day = new Date(y, m - 1, d).getDay();
  if (day === 0 || day === 6) return false;
  return !HOLIDAY_SET.has(key(y, m, d));
}

/** 該月總工作天數。monthKey 形如 '2026-09' */
export function monthWorkdays(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) if (isWorkday(y, m, d)) n++;
  return n;
}

/** 該月到 asOf（含當天）為止已經過的工作天數。asOf 形如 '2026-09-17' */
export function elapsedWorkdays(monthKey: string, asOf: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  const [ay, am, ad] = asOf.split('-').map(Number);
  if (ay !== y || am !== m) return 0;
  let n = 0;
  for (let d = 1; d <= ad; d++) if (isWorkday(y, m, d)) n++;
  return n;
}

export type MonthPace = {
  monthKey: string;
  asOf: string;
  elapsed: number;   // 已過工作天
  total: number;     // 全月工作天
  factor: number;    // 換算倍數 = total / elapsed
};

/**
 * 計算某月的進度。整月已經跑完（或沒有 asOf）就回 null —— 那種月份不需要預估。
 */
export function monthPace(monthKey: string, asOf?: string): MonthPace | null {
  if (!asOf) return null;
  const total = monthWorkdays(monthKey);
  const elapsed = elapsedWorkdays(monthKey, asOf);
  if (elapsed <= 0 || elapsed >= total) return null;
  return { monthKey, asOf, elapsed, total, factor: total / elapsed };
}

/**
 * 「月初一次開帳」的醫院 —— 每月只開一次發票，把上個月整月的用量一次結清，
 * 開完當月就不會再動。所以這些醫院**當月數字已經是定案值，不能跟著工作天放大**。
 * 佐證（台北醫學逐月唯一一筆發票日）：5/11、6/4、7/6、8/7、9/7。
 */
export const FIXED_MONTHLY_HOSPITALS: readonly string[] = ['台北醫學'];

export const isFixedMonthly = (hosp: string) => FIXED_MONTHLY_HOSPITALS.includes(hosp);
