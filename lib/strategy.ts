// 經營策略：Mars 自己設定「想投入多少心力」，跟描述現況用量的等級（S/A/B/C）分開。
// Elon 排下週計畫與客戶頁「本週優先」都以這個為主要依據（等級已不採用，2026-10-26 Mars：分級失真）。
export type StrategyKey = 'focus' | 'maintain' | 'normal' | 'paused';

export const STRATEGIES: { key: StrategyKey; emoji: string; label: string; desc: string; weight: number; cls: string }[] = [
  { key: 'focus',    emoji: '🔥', label: '重點衝刺', desc: '每週必排，以他為中心決定去哪院', weight: 3,   cls: 'bg-orange-100 text-orange-700' },
  { key: 'maintain', emoji: '🛡', label: '維持',     desc: '照頻率排，順路就去',             weight: 2,   cls: 'bg-sky-100 text-sky-700' },
  { key: 'normal',   emoji: '🌱', label: '一般觀察', desc: '只在順路時補進去',               weight: 1.2, cls: 'bg-emerald-50 text-emerald-700' },
  { key: 'paused',   emoji: '⏸', label: '停損',     desc: '不主動排，除非有待辦',           weight: 0,   cls: 'bg-gray-100 text-gray-500' },
];

export const strategyOf = (k?: string) => STRATEGIES.find(s => s.key === k);
/** 未設定時的權重（介於維持與一般之間偏低） */
export const strategyWeight = (k?: string) => strategyOf(k)?.weight ?? 1;

// 待辦類型：帶 sample、約 PM 同訪等需要準備，預設一週後才排拜訪
export type TodoKind = 'sample' | 'pm' | 'material' | 'other';
export const TODO_KINDS: { key: TodoKind; label: string; prepDays: number }[] = [
  { key: 'sample',   label: '帶 sample',   prepDays: 7 },
  { key: 'pm',       label: '約 PM 同訪',  prepDays: 7 },
  { key: 'material', label: '帶資料／文獻', prepDays: 7 },
  { key: 'other',    label: '其他',        prepDays: 0 },
];
