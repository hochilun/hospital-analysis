// 銷售報表資料：來源 Mars銷售報表_202501-202604.xlsx
// 工作表2 = 2025全年，工作表1 = 2026/01-04

export type SalesEntry = { qty: number; rev: number };
export type HospitalSales = Record<string, SalesEntry>;

export type MonthlyRow = { month: string; [key: string]: number | string };

export type YearSalesData = {
  label: string;
  HOSPITAL_TOTALS: Record<string, SalesEntry>;
  HOSPITAL_PRODUCT_SALES: Record<string, HospitalSales>;
  PRODUCT_TOTALS: Record<string, SalesEntry>;
  MONTHLY_REV: { month: string; rev: number }[];
  MONTHLY_BY_HOSPITAL: MonthlyRow[];
  MONTHLY_BY_CATEGORY: MonthlyRow[];
};

const APIS_IDS = ['seed_愛沛斯_sling', 'seed_愛沛斯_mini', 'seed_愛沛斯_toms', 'seed_愛沛斯_pelvi'];

// 各醫院有銷售紀錄的產品 ID
export const HOSPITAL_PRODUCT_IDS: Record<string, string[]> = {
  tucheng: ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', ...APIS_IDS, 'seed_ventralight'],
  tzuchi:  ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_3DMAX', 'seed_3DMAX_light', 'seed_塞納斯', ...APIS_IDS],
  sph:     ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', ...APIS_IDS, 'seed_ventralight'],
  grace:   ['seed_止血顆粒', 'seed_賀邁補', 'seed_塞納斯', 'seed_ventralight'],
  eck:     ['seed_宮安康', 'seed_止血顆粒', 'seed_速巴定', 'seed_3DMAX', 'seed_3DMAX_light', ...APIS_IDS, 'seed_ventralight', 'seed_ventrio_st'],
  tmuh:    ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_3DMAX', 'seed_3DMAX_light', ...APIS_IDS],
  clinic:  ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_塞納斯', ...APIS_IDS],
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
  '台北慈濟': { qty:  60, rev:   65714 },  // 賀邁補 15×15，2/6/9/11月
  '長庚土城': { qty:  20, rev:   67379 },  // 速巴定+賀邁補 10×15
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
    MONTHLY_REV: [
      { month: '1月',  rev: 231_068 },   // +948 土城
      { month: '2月',  rev: 302_772 },   // +21905 慈濟, +948 土城
      { month: '3月',  rev: 350_421 },   // +1895 土城
      { month: '4月',  rev: 368_849 },   // +2843 土城
      { month: '5月',  rev: 807_292 },
      { month: '6月',  rev: 819_724 },   // +21905 慈濟
      { month: '7月',  rev: 1_078_998 }, // +948 土城
      { month: '8月',  rev: 1_431_593 }, // +24487 土城
      { month: '9月',  rev: 726_866 },   // +10952 慈濟, +17655 土城
      { month: '10月', rev: 1_054_780 }, // +5885 土城
      { month: '11月', rev: 835_696 },   // +10952 慈濟, +5885 土城
      { month: '12月', rev: 663_141 },   // +5885 土城
    ],
    MONTHLY_BY_HOSPITAL: [
      { month: '1月',  中心診所: 0,       台北醫學: 43_238,  宏恩醫療: 0,       恩主公: 83_733,  沙爾德聖: 103_149, 台北慈濟: 0,      長庚土城: 948 },
      { month: '2月',  中心診所: 0,       台北醫學: 50_190,  宏恩醫療: 0,       恩主公: 78_324,  沙爾德聖: 151_405, 台北慈濟: 21_905, 長庚土城: 948 },
      { month: '3月',  中心診所: 2_286,   台北醫學: 0,       宏恩醫療: 0,       恩主公: 96_648,  沙爾德聖: 249_592, 台北慈濟: 0,      長庚土城: 1_895 },
      { month: '4月',  中心診所: 1_143,   台北醫學: 108_571, 宏恩醫療: 0,       恩主公: 74_406,  沙爾德聖: 181_886, 台北慈濟: 0,      長庚土城: 2_843 },
      { month: '5月',  中心診所: 1_143,   台北醫學: 90_762,  宏恩醫療: 469_143, 恩主公: 11_619,  沙爾德聖: 234_626, 台北慈濟: 0,      長庚土城: 0 },
      { month: '6月',  中心診所: 31_638,  台北醫學: 42_571,  宏恩醫療: 450_286, 恩主公: 68_343,  沙爾德聖: 204_981, 台北慈濟: 21_905, 長庚土城: 0 },
      { month: '7月',  中心診所: 112_648, 台北醫學: 120_596, 宏恩醫療: 424_952, 恩主公: 134_495, 沙爾德聖: 285_359, 台北慈濟: 0,      長庚土城: 948 },
      { month: '8月',  中心診所: 223_010, 台北醫學: 97_453,  宏恩醫療: 568_571, 恩主公: 92_629,  沙爾德聖: 425_443, 台北慈濟: 0,      長庚土城: 24_487 },
      { month: '9月',  中心診所: 61_943,  台北醫學: 165_190, 宏恩醫療: 218_095, 恩主公: 68_190,  沙爾德聖: 184_840, 台北慈濟: 10_952, 長庚土城: 17_655 },
      { month: '10月', 中心診所: 149_810, 台北醫學: 127_714, 宏恩醫療: 350_476, 恩主公: 92_914,  沙爾德聖: 327_981, 台北慈濟: 0,      長庚土城: 5_885 },
      { month: '11月', 中心診所: 40_571,  台北醫學: 85_714,  宏恩醫療: 263_762, 恩主公: 110_000, 沙爾德聖: 318_811, 台北慈濟: 10_952, 長庚土城: 5_885 },
      { month: '12月', 中心診所: 41_733,  台北醫學: 124_000, 宏恩醫療: 40_190,  恩主公: 189_410, 沙爾德聖: 261_923, 台北慈濟: 0,      長庚土城: 5_885 },
    ],
    MONTHLY_BY_CATEGORY: [
      { month: '1月',  Hemostasis: 55_162,  'Adhesion Prevention': 163_810, Hernia: 12_097, 'Urinary Incontinence': 0 },
      { month: '2月',  Hemostasis: 58_229,  'Adhesion Prevention': 215_810, Hernia: 28_734, 'Urinary Incontinence': 0 },
      { month: '3月',  Hemostasis: 50_171,  'Adhesion Prevention': 266_476, Hernia: 12_821, 'Urinary Incontinence': 20_952 },
      { month: '4月',  Hemostasis: 60_571,  'Adhesion Prevention': 281_905, Hernia: 16_919, 'Urinary Incontinence': 9_453 },
      { month: '5月',  Hemostasis: 490_838, 'Adhesion Prevention': 265_905, Hernia: 50_550, 'Urinary Incontinence': 0 },
      { month: '6月',  Hemostasis: 490_914, 'Adhesion Prevention': 236_952, Hernia: 70_905, 'Urinary Incontinence': 20_952 },
      { month: '7月',  Hemostasis: 547_771, 'Adhesion Prevention': 406_286, Hernia: 46_917, 'Urinary Incontinence': 78_025 },
      { month: '8月',  Hemostasis: 788_743, 'Adhesion Prevention': 520_190, Hernia: 53_016, 'Urinary Incontinence': 69_644 },
      { month: '9月',  Hemostasis: 292_943, 'Adhesion Prevention': 295_429, Hernia: 88_018, 'Urinary Incontinence': 50_476 },
      { month: '10月', Hemostasis: 493_676, 'Adhesion Prevention': 392_381, Hernia: 45_485, 'Urinary Incontinence': 123_238 },
      { month: '11月', Hemostasis: 267_171, 'Adhesion Prevention': 384_571, Hernia: 60_715, 'Urinary Incontinence': 123_238 },
      { month: '12月', Hemostasis: 168_705, 'Adhesion Prevention': 393_714, Hernia: 75_484, 'Urinary Incontinence': 25_238 },
    ],
  },
  '2026': {
    label: '2026 1-4月',
    HOSPITAL_TOTALS: HOSPITAL_TOTALS_2026,
    HOSPITAL_PRODUCT_SALES: HOSPITAL_PRODUCT_SALES_2026,
    PRODUCT_TOTALS: PRODUCT_TOTALS_2026,
    MONTHLY_REV: [
      { month: '1月', rev: 561_067 },
      { month: '2月', rev: 312_628 },
      { month: '3月', rev: 491_659 },
      { month: '4月', rev: 515_167 },
      { month: '5月', rev: 504_452 },
      { month: '6月', rev: 475_349 },  // 6/1–6/30（台北慈濟改列共跑，見 SHARED_PERFORMANCE）
      { month: '7月', rev: 770_650 },  // 7/1–7/31 整月（含共跑認領由前端動態加上）
      { month: '8月', rev: 830_662 },  // 8/1–8/31 整月（含共跑認領由前端動態加上）
    ],
    MONTHLY_BY_HOSPITAL: [
      { month: '1月', 中心診所: 28_190,  台北醫學: 48_952,   宏恩醫療: 0,       恩主公: 134_571, 沙爾德聖: 349_352 },
      { month: '2月', 中心診所: 12_381,  台北醫學: 29_048,   宏恩醫療: 90_266,  恩主公: 51_429,  沙爾德聖: 129_505 },
      { month: '3月', 中心診所: 67_638,  台北醫學: 31_333,   宏恩醫療: 12_190,  恩主公: 58_057,  沙爾德聖: 322_440 },
      { month: '4月', 中心診所: 40_571,  台北醫學: 112_000,  宏恩醫療: 45_667,  恩主公: 34_857,  沙爾德聖: 282_071 },
      { month: '5月', 中心診所: 18_095,  台北醫學: 160_571,  宏恩醫療: 0,       恩主公: 33_962,  沙爾德聖: 291_824 },
      { month: '6月', 中心診所: 27_048,   台北醫學: 60_000,   宏恩醫療: 10_240,  恩主公: 105_486, 沙爾德聖: 272_575 },
      { month: '7月', 中心診所: 63_048,   台北醫學: 193_288,  宏恩醫療: 73_143,  恩主公: 93_158,  沙爾德聖: 348_014 },
      { month: '8月', 中心診所: 61_924,   台北醫學: 181_143,  宏恩醫療: 14_476,  恩主公: 169_686, 沙爾德聖: 403_434 },
    ],
    MONTHLY_BY_CATEGORY: [
      { month: '1月', Hemostasis: 42_990,  'Adhesion Prevention': 455_810, Hernia: 41_314,  'Urinary Incontinence': 20_952 },
      { month: '2月', Hemostasis: 41_905,  'Adhesion Prevention': 209_143, Hernia: 61_580,  'Urinary Incontinence': 0 },
      { month: '3月', Hemostasis: 48_438,  'Adhesion Prevention': 337_524, Hernia: 27_411,  'Urinary Incontinence': 78_286 },
      { month: '4月', Hemostasis: 45_667,  'Adhesion Prevention': 326_286, Hernia: 85_881,  'Urinary Incontinence': 57_333 },
      { month: '5月', Hemostasis: 8_914,   'Adhesion Prevention': 332_571, Hernia: 76_109,  'Urinary Incontinence': 86_858 },
      { month: '6月', Hemostasis: 28_019,  'Adhesion Prevention': 358_286, Hernia: 89_044,  'Urinary Incontinence': 0 },
      { month: '7月', Hemostasis: 116_571, 'Adhesion Prevention': 446_095, Hernia: 143_243, 'Urinary Incontinence': 64_741 },
      { month: '8月', Hemostasis: 151_771, 'Adhesion Prevention': 480_953, Hernia: 156_033, 'Urinary Incontinence': 41_905 },
    ],
  },
};

// 向下相容（原有 import 不變）
export const HOSPITAL_TOTALS = HOSPITAL_TOTALS_2025;
export const HOSPITAL_PRODUCT_SALES = HOSPITAL_PRODUCT_SALES_2025;
export const PRODUCT_TOTALS = PRODUCT_TOTALS_2025;
