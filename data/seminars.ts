// Seminar / 晨會 / 產品介紹 活動紀錄
// 種子資料來源：Farm Land Bio Google Calendar（Mars 2026-05 上工後），由 Claude 辨識匯入。

export type Seminar = {
  id: string;
  date: string;          // YYYY-MM-DD
  hospitalId: string;    // tmuh/eck/sph/clinic/grace/tzuchi/tucheng
  department: string;    // GYN/GU/GS/ENT/TS/BS
  products: string[];    // 例：['Arista','SorbaFix']
  topic: string;         // 主題（可空）
  note?: string;
  source?: 'calendar' | 'manual';
};

// 活動用醫院短名（與 CRM hospital id 對應）
export const SEMINAR_HOSP: Record<string, string> = {
  tmuh: '北醫附醫', eck: '恩主公', sph: '聖保祿',
  clinic: '中心綜合', grace: '宏恩', tzuchi: '台北慈濟', tucheng: '土城長庚',
};
export const SEMINAR_HOSP_ORDER = ['tmuh', 'eck', 'sph', 'clinic', 'grace', 'tzuchi', 'tucheng'];

const s = (id: string, date: string, hospitalId: string, department: string, products: string[], topic: string): Seminar =>
  ({ id, date, hospitalId, department, products, topic, source: 'calendar' });

export const SEED_SEMINARS: Seminar[] = [
  // 恩主公
  s('sem_20260514_eck_GYN', '2026-05-14', 'eck', 'GYN', [], '科會・產品介紹'),
  s('sem_20260526_eck_ENT', '2026-05-26', 'eck', 'ENT', ['Arista'], ''),
  s('sem_20260603_eck_GS',  '2026-06-03', 'eck', 'GS', [], 'Ventral Hernia'),
  s('sem_20260630_eck_ENT', '2026-06-30', 'eck', 'ENT', ['PureRegen'], ''),
  s('sem_20260716_eck_GU',  '2026-07-16', 'eck', 'GU', [], 'Hernia'),
  // 土城長庚
  s('sem_20260609_tucheng_GS',  '2026-06-09', 'tucheng', 'GS', ['SorbaFix'], 'Ventral Hernia'),
  s('sem_20260625_tucheng_GU',  '2026-06-25', 'tucheng', 'GU', ['SorbaFix', 'Arista'], ''),
  s('sem_20260626_tucheng_ENT', '2026-06-26', 'tucheng', 'ENT', ['Arista'], ''),
  s('sem_20260707_tucheng_GS',  '2026-07-07', 'tucheng', 'GS', ['Arista'], ''),
  // 北醫
  s('sem_20260617_tmuh_GU',  '2026-06-17', 'tmuh', 'GU', ['3DMax', 'SorbaFix'], 'Hernia'),
  s('sem_20260701_tmuh_GU',  '2026-07-01', 'tmuh', 'GU', [], '晨會'),
  s('sem_20260714_tmuh_GYN', '2026-07-14', 'tmuh', 'GYN', [], '生殖醫學科'),
  // 台北慈濟
  s('sem_20260605_tzuchi_GU', '2026-06-05', 'tzuchi', 'GU', [], 'Hernia mesh'),
  s('sem_20260713_tzuchi_GS', '2026-07-13', 'tzuchi', 'GS', ['Arista'], ''),
  // 聖保祿
  s('sem_20260528_sph_ENT', '2026-05-28', 'sph', 'ENT', ['Arista'], ''),
  s('sem_20260706_sph_GS',  '2026-07-06', 'sph', 'GS', ['Arista'], ''),
];
