// 銷售報表資料：來源 Mars銷售報表_202501-202604.xlsx
// 工作表2 = 2025全年，工作表1 = 2026/01-04

export type SalesEntry = { qty: number; rev: number };
export type HospitalSales = Record<string, SalesEntry>;

export type YearSalesData = {
  label: string;
  HOSPITAL_TOTALS: Record<string, SalesEntry>;
  HOSPITAL_PRODUCT_SALES: Record<string, HospitalSales>;
  PRODUCT_TOTALS: Record<string, SalesEntry>;
};

// 各醫院有銷售紀錄的產品 ID
export const HOSPITAL_PRODUCT_IDS: Record<string, string[]> = {
  tucheng: ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_愛沛斯', 'seed_ventralight'],
  tzuchi:  ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_3DMAX', 'seed_塞納斯', 'seed_愛沛斯'],
  sph:     ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_愛沛斯', 'seed_ventralight'],
  grace:   ['seed_止血顆粒', 'seed_賀邁補', 'seed_塞納斯', 'seed_ventralight'],
  eck:     ['seed_宮安康', 'seed_止血顆粒', 'seed_速巴定', 'seed_3DMAX', 'seed_愛沛斯'],
  tmuh:    ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_3DMAX', 'seed_愛沛斯'],
  clinic:  ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_塞納斯', 'seed_愛沛斯'],
};

export const HOSPITAL_ID_MAP: Record<string, string> = {
  '台北慈濟': 'tzuchi', '長庚土城': 'tucheng', '台北醫學': 'tmuh',
  '中心診所': 'clinic', '宏恩醫療': 'grace', '沙爾德聖': 'sph', '恩主公': 'eck',
};

// ── 2025 全年 ─────────────────────────────────────────────────────────
const HOSPITAL_TOTALS_2025: Record<string, SalesEntry> = {
  '沙爾德聖': { qty: 354, rev: 2929995 },
  '宏恩醫療': { qty: 199, rev: 2785476 },
  '恩主公':   { qty: 109, rev: 1038139 },
  '台北醫學': { qty: 115, rev: 1056002 },
  '中心診所': { qty:  71, rev:  665924 },
};

const HOSPITAL_PRODUCT_SALES_2025: Record<string, HospitalSales> = {
  '沙爾德聖': {
    '宮安康':        { qty: 241, rev: 2524762 },
    '愛沛斯 P-STOP': { qty:   5, rev:  181905 },
    '賀邁補 10×15':  { qty:  85, rev:   80548 },
    '止血顆粒 1g':   { qty:  10, rev:   69333 },
    '愛沛斯 IS-M1':  { qty:   3, rev:   62857 },
    '賀邁補 15×15':  { qty:  10, rev:   10590 },
  },
  '宏恩醫療': {
    '止血顆粒 5g':   { qty:  93, rev: 2391429 },
    '止血塗佈器':    { qty:  91, rev:  208000 },
    '塞納斯':        { qty:  14, rev:  170667 },
    '止血顆粒 3g':   { qty:   1, rev:   15381 },
  },
  '恩主公': {
    '宮安康':        { qty:  52, rev:  604190 },
    '止血顆粒 3g':   { qty:  10, rev:  152381 },
    '速巴定 15釘':   { qty:  19, rev:  123429 },
    '愛沛斯 IS-M1':  { qty:   3, rev:   71429 },
    '止血顆粒 1g':   { qty:   7, rev:   52000 },
    '止血塗佈器':    { qty:  17, rev:   25257 },
    '愛沛斯 IS-6':   { qty:   1, rev:    9453 },
  },
  '台北醫學': {
    '宮安康':        { qty:  35, rev:  400000 },
    '止血顆粒 3g':   { qty:  14, rev:  206667 },
    '愛沛斯 IS-M1':  { qty:   7, rev:  176667 },
    '3DMAX':         { qty:  27, rev:  167143 },
    '止血顆粒 1g':   { qty:   5, rev:   35000 },
    '賀邁補 15×15':  { qty:  22, rev:   25143 },
    '止血顆粒 5g':   { qty:   1, rev:   23429 },
    '愛沛斯 IS-6':   { qty:   2, rev:   18907 },
    '止血塗佈器':    { qty:   2, rev:    3048 },
  },
  '中心診所': {
    '止血顆粒 5g':   { qty:  21, rev:  490000 },
    '塞納斯':        { qty:  10, rev:  123810 },
    '止血塗佈器':    { qty:  21, rev:   30400 },
    '賀邁補 10×15':  { qty:  19, rev:   21714 },
  },
};

const PRODUCT_TOTALS_2025: Record<string, SalesEntry> = {
  '宮安康':        { qty: 328, rev: 3528952 },
  '止血顆粒 5g':   { qty: 115, rev: 2904858 },
  '止血塗佈器':    { qty: 131, rev:  263657 },
  '止血顆粒 3g':   { qty:  25, rev:  374429 },
  '愛沛斯 P-STOP': { qty:   5, rev:  181905 },
  '愛沛斯 IS-M1':  { qty:  13, rev:  310953 },
  '3DMAX':         { qty:  27, rev:  167143 },
  '塞納斯':        { qty:  24, rev:  294477 },
  '速巴定 15釘':   { qty:  19, rev:  123429 },
  '止血顆粒 1g':   { qty:  22, rev:  156333 },
  '賀邁補 10×15':  { qty: 104, rev:  102262 },
  '賀邁補 15×15':  { qty:  32, rev:   35733 },
  '愛沛斯 IS-6':   { qty:   3, rev:   28360 },
};

// ── 2026 1-4月 ────────────────────────────────────────────────────────
const HOSPITAL_TOTALS_2026: Record<string, SalesEntry> = {
  '沙爾德聖': { qty: 114, rev: 1083369 },
  '恩主公':   { qty:  26, rev:  258057 },
  '台北醫學': { qty:  33, rev:  221333 },
  '宏恩醫療': { qty:  55, rev:  148123 },
  '中心診所': { qty:  22, rev:  148781 },
};

const HOSPITAL_PRODUCT_SALES_2026: Record<string, HospitalSales> = {
  '沙爾德聖': {
    '宮安康':        { qty:  84, rev:  880000 },
    '愛沛斯 IS-M1':  { qty:   4, rev:   83810 },
    '愛沛斯 P-STOP': { qty:   2, rev:   72762 },
    '止血顆粒 1g':   { qty:   4, rev:   27733 },
    '賀邁補 10×15':  { qty:  19, rev:   18005 },
    '賀邁補 15×15':  { qty:   1, rev:    1059 },
  },
  '恩主公': {
    '宮安康':        { qty:  15, rev:  174286 },
    '速巴定 15釘':   { qty:   8, rev:   51810 },
    '止血顆粒 3g':   { qty:   2, rev:   30476 },
    '止血塗佈器':    { qty:   1, rev:    1486 },
  },
  '台北醫學': {
    '宮安康':        { qty:  10, rev:  114286 },
    '3DMAX':         { qty:  16, rev:   99048 },
    '賀邁補 15×15':  { qty:   7, rev:    8000 },
  },
  '宏恩醫療': {
    '止血顆粒 5g':   { qty:   2, rev:   51429 },
    '塞納斯':        { qty:   4, rev:   48762 },
    '賀邁補 6×11':   { qty:  40, rev:   20480 },
    '止血顆粒 3g':   { qty:   1, rev:   15381 },
    '止血塗佈器':    { qty:   3, rev:    6857 },
    '賀邁補 10×15':  { qty:   5, rev:    5214 },
  },
  '中心診所': {
    '塞納斯':        { qty:   9, rev:  111429 },
    '止血顆粒 5g':   { qty:   1, rev:   23333 },
    '賀邁補 10×15':  { qty:  11, rev:   12571 },
    '止血塗佈器':    { qty:   1, rev:    1448 },
  },
};

const PRODUCT_TOTALS_2026: Record<string, SalesEntry> = {
  '宮安康':        { qty: 109, rev: 1168572 },
  '塞納斯':        { qty:  13, rev:  160191 },
  '愛沛斯 IS-M1':  { qty:   4, rev:   83810 },
  '愛沛斯 P-STOP': { qty:   2, rev:   72762 },
  '止血顆粒 5g':   { qty:   3, rev:   74762 },
  '3DMAX':         { qty:  16, rev:   99048 },
  '速巴定 15釘':   { qty:   8, rev:   51810 },
  '止血顆粒 3g':   { qty:   3, rev:   45857 },
  '賀邁補 6×11':   { qty:  40, rev:   20480 },
  '止血顆粒 1g':   { qty:   4, rev:   27733 },
  '賀邁補 10×15':  { qty:  35, rev:   35790 },
  '賀邁補 15×15':  { qty:   8, rev:    9059 },
  '止血塗佈器':    { qty:   5, rev:    9791 },
};

// ── 匯出：依年份索引 ──────────────────────────────────────────────────
export const SALES_BY_YEAR: Record<string, YearSalesData> = {
  '2025': {
    label: '2025 全年',
    HOSPITAL_TOTALS: HOSPITAL_TOTALS_2025,
    HOSPITAL_PRODUCT_SALES: HOSPITAL_PRODUCT_SALES_2025,
    PRODUCT_TOTALS: PRODUCT_TOTALS_2025,
  },
  '2026': {
    label: '2026 1-4月',
    HOSPITAL_TOTALS: HOSPITAL_TOTALS_2026,
    HOSPITAL_PRODUCT_SALES: HOSPITAL_PRODUCT_SALES_2026,
    PRODUCT_TOTALS: PRODUCT_TOTALS_2026,
  },
};

// 向下相容（原有 import 不變）
export const HOSPITAL_TOTALS = HOSPITAL_TOTALS_2025;
export const HOSPITAL_PRODUCT_SALES = HOSPITAL_PRODUCT_SALES_2025;
export const PRODUCT_TOTALS = PRODUCT_TOTALS_2025;
