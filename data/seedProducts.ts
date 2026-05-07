// 從銷售報表與院內報價表整合的產品資料
import { Product, ProductVariant, ProductCategory, HospitalVariantInfo } from '@/types';

function uid(seed: string) {
  return 'seed_' + seed.replace(/\s+/g, '_').slice(0, 20);
}

function v(
  modelNumber: string,
  description: string,
  hospitalPrice: number,
  options: {
    selfPayCode?: string;
    nhiCode?: string;
    patientPrice?: number;
    unit?: string;
    hospitalPrices?: Record<string, number>;
    hospitalInfo?: Record<string, HospitalVariantInfo>;
  } = {}
): ProductVariant {
  return {
    id: uid(modelNumber),
    modelNumber,
    description,
    selfPayCode: options.selfPayCode,
    nhiCode: options.nhiCode,
    hospitalPrice,
    patientPrice: options.patientPrice ?? 0,
    unit: options.unit ?? '支',
    hospitalPrices: options.hospitalPrices ?? {},
    hospitalInfo: options.hospitalInfo ?? {},
  };
}

export const SEED_PRODUCTS: Product[] = [
  // ── ADHESION PREVENTION ──────────────────────────────
  {
    id: 'seed_宮安康',
    name: '宮安康 MateRegen Gel',
    category: 'Adhesion Prevention' as ProductCategory,
    hospitalId: '', hospitalName: '',
    notes: '宮腔用可吸收防沾黏凝膠，婦產科主力產品',
    variants: [
      v('MateRegen Gel 5ml', '5ml版（主要規格）', 11047, {
        selfPayCode: 'FSZ001142001',
        patientPrice: 17000,
        hospitalPrices: { tucheng:10476, tzuchi:12381, sph:10476, eck:11619, tmuh:11429 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-076206',  patientPrice:16800, purchasePrice:10999 },
          sph:     { hospitalCode:'84-286-076206',  patientPrice:16800, purchasePrice:10999 },
          tzuchi:  { hospitalCode:'6ZWDD01057',     patientPrice:17000, purchasePrice:13000 },
        },
      }),
      v('MateRegen Gel 3ml', '3ml版', 11047, {
        selfPayCode: 'FSZ001142001',
        patientPrice: 12000,
      }),
      v('MateRegen Gel 10ml', '10ml版', 21429, {
        selfPayCode: 'FSZ001142001',
        patientPrice: 32000,
        hospitalPrices: { tzuchi:21429 },
        hospitalInfo: {
          tzuchi: { hospitalCode:'6ZWDD01086', patientPrice:32000, purchasePrice:22500 },
        },
      }),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_塞納斯',
    name: '塞納斯 PureRegen Gel Sinus',
    category: 'Adhesion Prevention' as ProductCategory,
    hospitalId: '', hospitalName: '',
    notes: '鼻腔阻隔物交聯透明質酸凝膠，耳鼻喉科',
    variants: [
      v('PureRegen Gel Sinus', '鼻腔阻隔物（滅菌）', 12288, {
        patientPrice: 17000,
        hospitalPrices: { tzuchi: 11429 },
        hospitalInfo: {
          tzuchi: { hospitalCode:'6ZWDD01080', patientPrice:17000, purchasePrice:12000 },
        },
      }),
    ],
    createdAt: new Date().toISOString(),
  },

  // ── HEMOSTASIS ───────────────────────────────────────
  {
    id: 'seed_止血顆粒',
    name: '巴德亞瑞絲達 可吸收止血顆粒',
    category: 'Hemostasis' as ProductCategory,
    hospitalId: '', hospitalName: '',
    notes: '多科別適用，另有配套塗佈器',
    variants: [
      v('SM0005-USA', '1公克', 7175, {
        selfPayCode: 'TTZ030696001',
        patientPrice: 10500,
        hospitalPrices: { tucheng:6933, tzuchi:8095, sph:6933, eck:7429, tmuh:7000 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-SM0005', patientPrice:10400,  purchasePrice:7280 },
          sph:     { hospitalCode:'84-286-SM0005', patientPrice:10400,  purchasePrice:7280 },
          tzuchi:  { hospitalCode:'6ZWDD01028',    patientPrice:10500,  purchasePrice:8500 },
          eck:     { hospitalCode:'97U1153',        patientPrice:10500,  purchasePrice:7800 },
        },
      }),
      v('SM0002-USA', '3公克', 12499, {
        selfPayCode: 'TTZ030696002',
        patientPrice: 21000,
        hospitalPrices: { tucheng:12171, tzuchi:14000, eck:15238, grace:15381, tmuh:14762 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-SM0002', patientPrice:21000, purchasePrice:14200 },
          sph:     { hospitalCode:'84-286-SM0002', patientPrice:21000, purchasePrice:14200 },
          tzuchi:  { hospitalCode:'6ZWDD01047',    patientPrice:21000, purchasePrice:14700 },
          eck:     { hospitalCode:'97U1150',        patientPrice:21000, purchasePrice:16000 },
        },
      }),
      v('SM0007-USA', '5公克', 24595, {
        selfPayCode: 'TTZ030696003',
        patientPrice: 35000,
        hospitalPrices: { tucheng:22381, tzuchi:23333, grace:25714, tmuh:23429, clinic:23333 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-SM0007', patientPrice:33750, purchasePrice:23500 },
          sph:     { hospitalCode:'84-286-SM0007', patientPrice:33750, purchasePrice:23500 },
          tzuchi:  { hospitalCode:'6ZWDD01048',    patientPrice:35000, purchasePrice:24500 },
        },
      }),
      v('TTZ030696004', '14cm 塗佈器 ×2', 1857, {
        selfPayCode: 'TTZ030696004',
        patientPrice: 3000,
        hospitalInfo: {
          eck: { hospitalCode:'97U1151', patientPrice:3000, purchasePrice:1950 },
        },
      }),
      v('AM0005', '38cm 加長型塗佈器', 2033, {
        selfPayCode: 'TTZ030696005',
        patientPrice: 3000,
        hospitalPrices: { grace:2286, eck:1486, tmuh:1524, clinic:1448 },
        hospitalInfo: {
          eck: { hospitalCode:'97U1152', patientPrice:3000, purchasePrice:1950 },
        },
      }),
    ],
    createdAt: new Date().toISOString(),
  },

  // ── HERNIA ───────────────────────────────────────────
  {
    id: 'seed_速巴定',
    name: '巴德速巴定 可吸收固定系統',
    category: 'Hernia' as ProductCategory,
    hospitalId: '', hospitalName: '',
    notes: '疝氣修補固定，一般外科',
    variants: [
      v('0113115', '15釘', 6296, {
        nhiCode: 'FSPF122345BA',
        patientPrice: 11034,
        hospitalPrices: { tucheng:5885, tzuchi:6805, eck:6490 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-301-113082', patientPrice:11034, purchasePrice:7724 },
          sph:     { hospitalCode:'84-301-113082', patientPrice:11034, purchasePrice:7724 },
          eck:     { hospitalCode:'9710320',        patientPrice:11034, purchasePrice:8500 },
        },
        unit: '組',
      }),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_賀邁補',
    name: '豪爾亞賀邁補 Hermesh 8 修補網片',
    category: 'Hernia' as ProductCategory,
    hospitalId: '', hospitalName: '',
    notes: '疝氣修補，一般外科',
    variants: [
      v('Hermesh 8 6×11', '6×11 cm', 512, {
        nhiCode: 'FSP6180611QH',
        patientPrice: 791,
        hospitalPrices: { grace:512 },
        unit: '片',
      }),
      v('Hermesh 8 10×15', '10×15 cm', 990, {
        nhiCode: 'FSP6180815QH',
        patientPrice: 1459,
        hospitalPrices: { tucheng:948, sph:948, grace:1043, clinic:1143 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-H81015', patientPrice:1459, purchasePrice:1079 },
          sph:     { hospitalCode:'84-286-H81015', patientPrice:1459, purchasePrice:1079 },
        },
        unit: '片',
      }),
      v('Hermesh 8 15×15', '15×15 cm', 1103, {
        nhiCode: 'FSP6181515QH',
        patientPrice: 1603,
        hospitalPrices: { tucheng:1069, tzuchi:1114, sph:1059, tmuh:1143 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-H81515', patientPrice:1603, purchasePrice:1122 },
          sph:     { hospitalCode:'84-286-H81515', patientPrice:1603, purchasePrice:1122 },
          tzuchi:  { hospitalCode:'6FSP610048',    patientPrice:1603, purchasePrice:1170 },
          eck:     { patientPrice:1603, purchasePrice:1202 },
        },
        unit: '片',
      }),
      v('Hertra Kit #30', 'Hertra Kit #30', 2533, {
        nhiCode: 'FSP62H6T23QH',
        patientPrice: 3800,
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-6T25H3', patientPrice:3800, purchasePrice:2660 },
          sph:     { hospitalCode:'84-286-6T25H3', patientPrice:3800, purchasePrice:2660 },
        },
        unit: '組',
      }),
      v('Hertra Kit #31', 'Hertra Kit #31', 2533, {
        nhiCode: 'FSP62H6T23QH',
        patientPrice: 3800,
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-6T27H3', patientPrice:3800, purchasePrice:2660 },
          sph:     { hospitalCode:'84-286-6T27H3', patientPrice:3800, purchasePrice:2660 },
        },
        unit: '組',
      }),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_3DMAX',
    name: '巴德 3DMAX LIGHT 立體修補網',
    category: 'Hernia' as ProductCategory,
    hospitalId: '', hospitalName: '',
    notes: '腹腔鏡疝氣修補，一般外科',
    variants: [
      v('0115310', '3D MAX 中/左', 6952, {
        selfPayCode: 'FSZ009255001', patientPrice: 10000,
        hospitalPrices: { eck:6952 },
        hospitalInfo: { eck:{ hospitalCode:'9200058', patientPrice:10000, purchasePrice:7300 } },
        unit: '片',
      }),
      v('0115320', '3D MAX 中/右', 6952, {
        selfPayCode: 'FSZ009255001', patientPrice: 10000,
        hospitalPrices: { eck:6952 },
        hospitalInfo: { eck:{ hospitalCode:'9200059', patientPrice:10000, purchasePrice:7300 } },
        unit: '片',
      }),
      v('0115311', '3D MAX 大/左', 6953, {
        selfPayCode: 'FSZ009255001', patientPrice: 10000,
        hospitalPrices: { eck:6952 },
        hospitalInfo: { eck:{ hospitalCode:'9200060', patientPrice:10000, purchasePrice:7300 } },
        unit: '片',
      }),
      v('0115321', '3D MAX 大/右', 6953, {
        selfPayCode: 'FSZ009255001', patientPrice: 10000,
        hospitalPrices: { eck:6952 },
        hospitalInfo: { eck:{ hospitalCode:'9200061', patientPrice:10000, purchasePrice:7300 } },
        unit: '片',
      }),
      v('0117311', '3DMAX LIGHT 大/左',   6190, { selfPayCode:'FSZ009255001', patientPrice:10000, unit:'片' }),
      v('0117312', '3DMAX LIGHT 特大/左', 6168, { selfPayCode:'FSZ009255001', patientPrice:10000, unit:'片' }),
      v('0117321', '3DMAX LIGHT 大/右',   6189, { selfPayCode:'FSZ009255001', patientPrice:10000, unit:'片' }),
      v('0117322', '3DMAX LIGHT 特大/右', 6168, { selfPayCode:'FSZ009255001', patientPrice:10000, unit:'片' }),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_ventralight',
    name: '巴德 Ventralight ST Mesh 凡萃拉絲提鋼片',
    category: 'Hernia' as ProductCategory,
    hospitalId: '', hospitalName: '',
    notes: '腹腔鏡疝氣修補，114/6/1 起轉健保',
    variants: [
      v('5954680', '6"×8" (15.2×20.3cm)', 12857, {
        nhiCode: 'FSP6454680BA',
        patientPrice: 27098,
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-954680', patientPrice:27098, purchasePrice:13500 },
          sph:     { hospitalCode:'84-286-954680', patientPrice:27098, purchasePrice:13500 },
        },
        unit: '片',
      }),
    ],
    createdAt: new Date().toISOString(),
  },

  // ── URINARY INCONTINENCE ─────────────────────────────
  {
    id: 'seed_愛沛斯',
    name: '愛沛斯 懸吊/骨盆底系統',
    category: 'Urinary Incontinence' as ProductCategory,
    hospitalId: '', hospitalName: '',
    notes: '婦產科/泌尿外科，尿失禁與骨盆底重建',
    variants: [
      v('IS-M1', '迷你懸吊手術系統', 21861, {
        selfPayCode: 'FSZ031551001', patientPrice: 35000,
        hospitalPrices: { tucheng:20952, tzuchi:22667, tmuh:25238 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-301-ISM100', patientPrice:35000, purchasePrice:22000 },
          sph:     { hospitalCode:'84-301-ISM100', patientPrice:35000, purchasePrice:22000 },
          eck:     { hospitalCode:'97U0627',        patientPrice:35000, purchasePrice:25000 },
          tzuchi:  { hospitalCode:'6ZFSP71031',     patientPrice:35000, purchasePrice:23800 },
          tmuh:    { hospitalCode:'2172054151',      patientPrice:35000, purchasePrice:26500 },
        },
        unit: '組',
      }),
      v('IS-TOMS-1', 'Toms 懸吊系統（健保）', 66667, {
        nhiCode: 'FSP72STMS142', patientPrice: 100000,
        hospitalPrices: { tucheng:66667, tzuchi:73333 },
        hospitalInfo: {
          tucheng: { purchasePrice:70000 },
          sph:     { purchasePrice:70000 },
          eck:     { hospitalCode:'97U0628',    patientPrice:100000, purchasePrice:75000 },
          tzuchi:  { hospitalCode:'6ZFSP72002', patientPrice:100000, purchasePrice:77000 },
        },
        unit: '組',
      }),
      v('IS-1', '懸吊帶系統（健保）', 8988, {
        nhiCode: 'FSP71ST10042', patientPrice: 13482,
        hospitalPrices: { tucheng:8988, tzuchi:10015, tmuh:9453 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-301-IS1000', patientPrice:13482, purchasePrice:9437 },
          sph:     { hospitalCode:'84-301-IS1000', patientPrice:13482, purchasePrice:9437 },
          eck:     { hospitalCode:'97Y6002',        patientPrice:13482, purchasePrice:9926 },
          tzuchi:  { hospitalCode:'6ZFSP71037',     patientPrice:13482, purchasePrice:10516 },
          tmuh:    { hospitalCode:'2372054012',      patientPrice:13482, purchasePrice:9926 },
        },
        unit: '組',
      }),
      v('IS-6', '懸吊帶系統 IS-6（健保）', 8988, {
        nhiCode: 'FSP71ST10042', patientPrice: 13482,
        hospitalPrices: { tucheng:8988, tzuchi:10015, tmuh:9453 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-301-IS6000', patientPrice:13482, purchasePrice:9437 },
          sph:     { hospitalCode:'84-301-IS6000', patientPrice:13482, purchasePrice:9437 },
          tzuchi:  { hospitalCode:'6ZFSP71036',    patientPrice:13482, purchasePrice:10516 },
          tmuh:    { hospitalCode:'2372054012',     patientPrice:13482, purchasePrice:9926 },
        },
        unit: '組',
      }),
      v('IS-HELICO-01', '懸吊帶系統 HELICO（健保）', 8988, {
        nhiCode: 'FSP71ST10042', patientPrice: 13482,
        hospitalPrices: { tucheng:8988, tzuchi:10015, tmuh:9453 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-301-ISHE01', patientPrice:13482, purchasePrice:9437 },
          sph:     { hospitalCode:'84-301-ISHE01', patientPrice:13482, purchasePrice:9437 },
          eck:     { hospitalCode:'97Y6002',        patientPrice:13482, purchasePrice:9926 },
          tzuchi:  { hospitalCode:'6ZFSP71038',     patientPrice:13482, purchasePrice:10516 },
          tmuh:    { hospitalCode:'2372054012',      patientPrice:13482, purchasePrice:9926 },
        },
        unit: '組',
      }),
      v('P-STOP-8', '骨盆底修護網片 40×185+65×180', 36381, {
        patientPrice: 58725,
        hospitalPrices: { tucheng:36381, tzuchi:41524, tmuh:37143 },
        hospitalInfo: {
          tucheng: { hospitalCode:'84-286-PSTOP8', patientPrice:55000, purchasePrice:38200 },
          sph:     { hospitalCode:'84-286-PSTOP8', patientPrice:55000, purchasePrice:38200 },
          tzuchi:  { hospitalCode:'6ZFSP71035',    patientPrice:58725, purchasePrice:43600 },
          tmuh:    { hospitalCode:'2372054161',     patientPrice:55000, purchasePrice:39000 },
        },
        unit: '片',
      }),
    ],
    createdAt: new Date().toISOString(),
  },
];
