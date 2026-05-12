// 銷售報表資料：2025/01 - 2026/04
// 來源：Mars銷售報表_202501-202604.xlsx

export type SalesEntry = { qty: number; rev: number };
export type HospitalSales = Record<string, SalesEntry>;

// 各醫院有銷售紀錄的產品 ID（依銷售報表完整對應）
export const HOSPITAL_PRODUCT_IDS: Record<string, string[]> = {
  tucheng: ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_愛沛斯', 'seed_ventralight'],
  tzuchi:  ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_3DMAX', 'seed_塞納斯', 'seed_愛沛斯'],
  sph:     ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_愛沛斯', 'seed_ventralight'],
  grace:   ['seed_止血顆粒', 'seed_賀邁補', 'seed_塞納斯', 'seed_ventralight'],
  eck:     ['seed_宮安康', 'seed_止血顆粒', 'seed_速巴定', 'seed_3DMAX', 'seed_愛沛斯'],
  tmuh:    ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_速巴定', 'seed_3DMAX', 'seed_愛沛斯'],
  clinic:  ['seed_宮安康', 'seed_止血顆粒', 'seed_賀邁補', 'seed_塞納斯', 'seed_愛沛斯'],
};

// 醫院 ID 對應
export const HOSPITAL_ID_MAP: Record<string, string> = {
  '台北慈濟': 'tzuchi',
  '長庚土城': 'tucheng',
  '台北醫學': 'tmuh',
  '中心診所': 'clinic',
  '宏恩醫療': 'grace',
  '沙爾德聖': 'sph',
  '恩主公':   'eck',
};

// 各醫院總業績（長庚土城/台北慈濟有跨科別業績非 Mars 負責，暫時排除）
export const HOSPITAL_TOTALS: Record<string, SalesEntry> = {
  '沙爾德聖': { qty: 468,  rev: 4013364  },
  '宏恩醫療': { qty: 254,  rev: 2933599  },
  '恩主公':   { qty: 147,  rev: 1379625  },
  '台北醫學': { qty: 148,  rev: 1277335  },
  '中心診所': { qty: 93,   rev: 814705   },
};

// 各醫院 × 各產品明細（長庚土城/台北慈濟暫時排除）
export const HOSPITAL_PRODUCT_SALES: Record<string, HospitalSales> = {
  '沙爾德聖': {
    '宮安康':     { qty: 325,  rev: 3404762  },
    '賀邁補 10×15':{ qty: 104, rev: 98552    },
    '止血顆粒 1g':{ qty: 14,   rev: 97067    },
    '賀邁補 15×15':{ qty: 11,  rev: 11650    },
  },
  '宏恩醫療': {
    '止血顆粒 5g':{ qty: 95,   rev: 2442857  },
    '止血塗佈器': { qty: 94,   rev: 214857   },
    '賀邁補 6×11':{ qty: 40,   rev: 20480    },
    '止血顆粒 3g':{ qty: 2,    rev: 30762    },
    '賀邁補 10×15':{ qty: 5,   rev: 5214     },
  },
  '恩主公': {
    '宮安康':     { qty: 67,   rev: 778476   },
    '速巴定 15釘':{ qty: 27,   rev: 175238   },
    '止血顆粒 3g':{ qty: 12,   rev: 182857   },
    '止血顆粒 1g':{ qty: 7,    rev: 52000    },
    '止血塗佈器': { qty: 18,   rev: 26743    },
  },
  '台北醫學': {
    '宮安康':     { qty: 45,   rev: 514286   },
    '賀邁補 15×15':{ qty: 29,  rev: 33143    },
    '止血顆粒 3g':{ qty: 14,   rev: 206667   },
    '止血顆粒 1g':{ qty: 5,    rev: 35000    },
    '止血顆粒 5g':{ qty: 1,    rev: 23429    },
    '止血塗佈器': { qty: 2,    rev: 3048     },
  },
  '中心診所': {
    '止血顆粒 5g':{ qty: 22,   rev: 513333   },
    '賀邁補 10×15':{ qty: 30,  rev: 34286    },
    '止血塗佈器': { qty: 22,   rev: 31848    },
  },
};

// 各產品總業績（已扣除長庚土城/台北慈濟）
export const PRODUCT_TOTALS: Record<string, SalesEntry> = {
  '宮安康':       { qty: 437,  rev: 4697524  },
  '止血顆粒 3g':  { qty: 28,   rev: 420285   },
  '止血顆粒 5g':  { qty: 118,  rev: 2979619  },
  '止血顆粒 1g':  { qty: 26,   rev: 184066   },
  '止血塗佈器':   { qty: 136,  rev: 276495   },
  '愛沛斯 IS-M1': { qty: 50,   rev: 1093048  },
  '愛沛斯 P-STOP':{ qty: 27,   rev: 987333   },
  '愛沛斯 HELICO':{ qty: 13,   rev: 117305   },
  '愛沛斯 IS-6':  { qty: 4,    rev: 38937    },
  '塞納斯':       { qty: 37,   rev: 454667   },
  '速巴定 15釘':  { qty: 27,   rev: 175239   },
  '賀邁補 10×15': { qty: 139,  rev: 138052   },
  '賀邁補 15×15': { qty: 40,   rev: 44792    },
  '賀邁補 6×11':  { qty: 40,   rev: 20480    },
};
