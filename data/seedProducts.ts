// 從銷售報表自動生成的產品資料
import { Product, ProductVariant } from '@/types';

function uid(seed: string) {
  return 'seed_' + seed.replace(/\s+/g, '_').slice(0, 20);
}

function v(modelNumber: string, description: string, hospitalPrice: number, unit = '支'): ProductVariant {
  return { id: uid(modelNumber), modelNumber, description, hospitalPrice, patientPrice: 0, unit };
}

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'seed_宮安康',
    name: '宮安康 MateRegen Gel',
    hospitalId: '',
    hospitalName: '',
    notes: '宮腔用可吸收防沾黏凝膠，婦產科主力產品',
    variants: [
      v('MateRegen Gel',      '一般版', 11047),
      v('MateRegen Gel 10ML', '10ML版', 21429),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_止血顆粒',
    name: '巴德亞瑞絲達 可吸收止血顆粒',
    hospitalId: '',
    hospitalName: '',
    notes: '多科別適用，另有配套塗佈器',
    variants: [
      v('SM0005-USA', '1公克', 7175),
      v('SM0002-USA', '3公克', 12499),
      v('SM0007-USA', '5公克', 24595),
      v('AM0005',     '加長型塗佈器 38CM', 2033, '支'),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_愛沛斯',
    name: '愛沛斯 懸吊/骨盆底系統',
    hospitalId: '',
    hospitalName: '',
    notes: '婦產科/泌尿外科，尿失禁與骨盆底重建',
    variants: [
      v('IS-M1',     '迷你懸吊手術系統', 21861, '組'),
      v('IS-6',      '懸吊帶系統', 9734, '組'),
      v('IS-HELICO-01', '懸吊帶系統 HELICO', 9023, '組'),
      v('P-STOP-8',  '骨盆底修護網片', 36568, '片'),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_塞納斯',
    name: '塞納斯 PureRegen Gel Sinus',
    hospitalId: '',
    hospitalName: '',
    notes: '鼻腔阻隔物交聯透明質酸凝膠，耳鼻喉科',
    variants: [
      v('PureRegen Gel Sinus', '鼻腔阻隔物（滅菌）', 12288),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_速巴定',
    name: '巴德速巴定 可吸收固定系統',
    hospitalId: '',
    hospitalName: '',
    notes: '疝氣修補固定，一般外科',
    variants: [
      v('0113115', '15釘', 6296, '組'),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_賀邁補',
    name: '豪爾亞賀邁補 Hermesh 8 修補網片',
    hospitalId: '',
    hospitalName: '',
    notes: '疝氣修補，一般外科',
    variants: [
      v('Hermesh 8 6×11',   '6×11 cm',  512, '片'),
      v('Hermesh 8 10×15',  '10×15 cm', 990, '片'),
      v('Hermesh 8 15×15',  '15×15 cm', 1103, '片'),
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_3DMAX',
    name: '巴德 3DMAX LIGHT 立體修補網',
    hospitalId: '',
    hospitalName: '',
    notes: '腹腔鏡疝氣修補，一般外科',
    variants: [
      v('0117311', '大/左',   6190, '片'),
      v('0117312', '特大/左', 6168, '片'),
      v('0117321', '大/右',   6189, '片'),
      v('0117322', '特大/右', 6168, '片'),
      v('0115310', '3D MAX 中/左', 6952, '片'),
      v('0115311', '3D MAX 大/左', 6953, '片'),
      v('0115320', '3D MAX 中/右', 6953, '片'),
      v('0115321', '3D MAX 大/右', 6953, '片'),
    ],
    createdAt: new Date().toISOString(),
  },
];
