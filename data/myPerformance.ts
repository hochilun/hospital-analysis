// 個人業績資料 — 何季倫（Mars）
// 來源：farmlands/sales/ 週報，每月月底更新

export type DoctorEntry = {
  dept: string;   // 科別代號: GYN / GU / GS / ENT / TS / BS
  name: string;   // 醫師姓名
  qty: number;    // 使用數量
};

export type HospProdEntry = {
  name: string;
  category: string;
  qty: number;
  rev: number;
};

export type MonthPerf = {
  month: string;          // e.g. '2026-05'
  label: string;          // e.g. '5月'
  asOf?: string;          // 資料更新至 e.g. '2026-06-25'（未填代表整月已結算）
  revenue: number;
  weighted: number;
  byHospital: Record<string, number>;
  byCategory: Record<string, number>;
  byProduct: HospProdEntry[];
  hospitalProducts: Record<string, HospProdEntry[]>;
};

export const DEPT_LABEL: Record<string, string> = {
  GYN: '婦產科', GU: '泌尿科', GS: '一般外科',
  ENT: '耳鼻喉', TS: '胸腔外科', BS: '乳房外科',
};

export const CAT_ZH: Record<string, string> = {
  'Adhesion Prevention':  '防沾黏',
  'Hernia':               '疝氣',
  'Urinary Incontinence': '泌尿',
  'Hemostasis':           '止血',
};

export const CAT_COLOR: Record<string, string> = {
  'Adhesion Prevention':  '#10b981',
  'Hernia':               '#f59e0b',
  'Urinary Incontinence': '#8b5cf6',
  'Hemostasis':           '#3b82f6',
};

export const HOSP_COLOR: Record<string, string> = {
  '沙爾德聖': '#3b82f6',
  '台北醫學':  '#10b981',
  '恩主公':    '#f59e0b',
  '中心診所':  '#8b5cf6',
  '台北慈濟':  '#ef4444',
  '長庚土城':  '#ec4899',
  '宏恩醫療':  '#06b6d4',
};

// ── 2026 年月份資料 ────────────────────────────────────────────────────

export const MY_PERFORMANCE: MonthPerf[] = [
  {
    month: '2026-05',
    label: '5月',
    revenue: 531_765,
    weighted: 504_452,
    byHospital: {
      '沙爾德聖': 306_415,
      '台北醫學':  168_600,
      '恩主公':     37_750,
      '中心診所':   19_000,
    },
    byCategory: {
      'Adhesion Prevention':  349_200,
      'Urinary Incontinence':  91_201,
      'Hernia':                81_614,
      'Hemostasis':             9_750,
    },
    byProduct: [
      { name: '宮安康',          category: 'Adhesion Prevention',  qty: 30, rev: 336_200 },
      { name: 'IS-M1',           category: 'Urinary Incontinence', qty:  2, rev:  53_000 },
      { name: '3DMAX LIGHT',     category: 'Hernia',               qty:  8, rev:  52_000 },
      { name: 'P-STOP-8',        category: 'Urinary Incontinence', qty:  1, rev:  38_201 },
      { name: '塞納斯',           category: 'Adhesion Prevention',  qty:  1, rev:  13_000 },
      { name: '賀邁補',           category: 'Hernia',               qty: 14, rev:  13_814 },
      { name: '速巴定',           category: 'Hernia',               qty:  1, rev:   8_500 },
      { name: '止血顆粒 1g',      category: 'Hemostasis',           qty:  1, rev:   7_800 },
      { name: '3DMax',            category: 'Hernia',               qty:  1, rev:   7_300 },
      { name: '止血塗佈器 38cm',  category: 'Hemostasis',           qty:  1, rev:   1_950 },
    ],
    hospitalProducts: {
      '沙爾德聖': [
        { name: '宮安康',  category: 'Adhesion Prevention',  qty: 24, rev: 264_000 },
        { name: 'P-STOP-8', category: 'Urinary Incontinence', qty:  1, rev:  38_201 },
        { name: '賀邁補',  category: 'Hernia',               qty:  4, rev:   4_214 },
      ],
      '台北醫學': [
        { name: '宮安康',      category: 'Adhesion Prevention',  qty:  5, rev:  60_000 },
        { name: '3DMAX LIGHT', category: 'Hernia',               qty:  8, rev:  52_000 },
        { name: 'IS-M1',       category: 'Urinary Incontinence', qty:  2, rev:  53_000 },
        { name: '賀邁補',      category: 'Hernia',               qty:  3, rev:   3_600 },
      ],
      '恩主公': [
        { name: '宮安康',          category: 'Adhesion Prevention', qty:  1, rev:  12_200 },
        { name: '速巴定',           category: 'Hernia',              qty:  1, rev:   8_500 },
        { name: '止血顆粒 1g',      category: 'Hemostasis',          qty:  1, rev:   7_800 },
        { name: '3DMax',            category: 'Hernia',              qty:  1, rev:   7_300 },
        { name: '止血塗佈器 38cm',  category: 'Hemostasis',          qty:  1, rev:   1_950 },
      ],
      '中心診所': [
        { name: '塞納斯', category: 'Adhesion Prevention', qty: 1, rev: 13_000 },
        { name: '賀邁補', category: 'Hernia',              qty: 7, rev:  6_000 },
      ],
    },
  },
  {
    month: '2026-06',
    label: '6月',
    asOf: '2026-06-25',
    revenue: 520_777,
    weighted: 485_284,
    byHospital: {
      '沙爾德聖': 287_179,
      '恩主公':   114_550,
      '台北醫學':  63_000,
      '中心診所':  27_200,
      '台北慈濟':  15_408,
      '宏恩醫療':  13_440,
    },
    byCategory: {
      'Adhesion Prevention': 376_200,
      'Hernia':              113_347,
      'Hemostasis':           31_230,
    },
    byProduct: [
      { name: '宮安康',           category: 'Adhesion Prevention', qty: 31, rev: 350_200 },
      { name: '3DMAX LIGHT',      category: 'Hernia',              qty:  7, rev:  45_476 },
      { name: '速巴定',            category: 'Hernia',              qty:  4, rev:  33_656 },
      { name: '塞納斯',            category: 'Adhesion Prevention', qty:  2, rev:  26_000 },
      { name: '賀邁補',            category: 'Hernia',              qty: 26, rev:  19_615 },
      { name: '止血顆粒 1g',       category: 'Hemostasis',          qty:  2, rev:  15_080 },
      { name: '3DMax',             category: 'Hernia',              qty:  2, rev:  14_600 },
      { name: '止血顆粒 3g',       category: 'Hemostasis',          qty:  1, rev:  14_200 },
      { name: '止血塗佈器 38cm',   category: 'Hemostasis',          qty:  1, rev:   1_950 },
    ],
    hospitalProducts: {
      '沙爾德聖': [
        { name: '宮安康',          category: 'Adhesion Prevention', qty: 23, rev: 253_000 },
        { name: '止血顆粒 3g',      category: 'Hemostasis',          qty:  1, rev:  14_200 },
        { name: '速巴定',           category: 'Hernia',              qty:  1, rev:   7_724 },
        { name: '止血顆粒 1g',      category: 'Hemostasis',          qty:  1, rev:   7_280 },
        { name: '賀邁補',          category: 'Hernia',              qty:  5, rev:   4_975 },
      ],
      '恩主公': [
        { name: '宮安康',          category: 'Adhesion Prevention', qty:  6, rev:  73_200 },
        { name: '速巴定',           category: 'Hernia',              qty:  2, rev:  17_000 },
        { name: '3DMax',            category: 'Hernia',              qty:  2, rev:  14_600 },
        { name: '止血顆粒 1g',      category: 'Hemostasis',          qty:  1, rev:   7_800 },
        { name: '止血塗佈器 38cm',  category: 'Hemostasis',          qty:  1, rev:   1_950 },
      ],
      '台北醫學': [
        { name: '3DMAX LIGHT', category: 'Hernia',              qty:  6, rev:  39_000 },
        { name: '宮安康',      category: 'Adhesion Prevention', qty:  2, rev:  24_000 },
      ],
      '中心診所': [
        { name: '塞納斯', category: 'Adhesion Prevention', qty: 2, rev: 26_000 },
        { name: '賀邁補', category: 'Hernia',              qty: 1, rev:  1_200 },
      ],
      '台北慈濟': [
        { name: '速巴定',       category: 'Hernia', qty: 1, rev:  8_932 },
        { name: '3DMAX LIGHT', category: 'Hernia', qty: 1, rev:  6_476 },
      ],
      '宏恩醫療': [
        { name: '賀邁補', category: 'Hernia', qty: 20, rev: 13_440 },
      ],
    },
  },
  // 後續月份在此追加 ↓
];
