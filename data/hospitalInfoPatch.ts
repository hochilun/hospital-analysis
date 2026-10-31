// 各院產品資訊（院內碼／採購價／末端售價）的增量更新。
// products-db 以雲端為準，種子檔已跟雲端分岔，不能整包覆蓋；這裡只「補上／更新」指定醫院的欄位，
// 產品頁同步完雲端後自動套用，套過一次之後內容相同就不會再寫。
// 價格一律含稅（purchasePrice）；hospitalPrices 存未稅＝含稅 ÷ 1.05。
import { Product, HospitalVariantInfo } from '@/types';

type Patch = { hospitalCode?: string; purchasePrice: number; patientPrice?: number };

// 來源：farmlands/MARS醫材產品價-輔大西園部北格202610.xlsx（2026-10-31）
// 輔大 塞納斯 經沛宇供貨；輔大 Ventralight 8"×10" 表上為 NA 未列；西園 P-STOP-8、Hermesh 表上無院內碼
export const HOSPITAL_INFO_PATCH: Record<string, Record<string, Patch>> = {
  // 宮安康、塞納斯
  'MateRegen Gel 5ml': {
    fju: { hospitalCode: 'MFSZ00BR05', purchasePrice: 12900, patientPrice: 17000 },
    wgh: { hospitalCode: '52702',      purchasePrice: 12000, patientPrice: 17000 },
  },
  'PureRegen Gel Sinus': {
    fju: { hospitalCode: 'MWDZ030059', purchasePrice: 11400 },
    wgh: { hospitalCode: '52687',      purchasePrice: 12000, patientPrice: 17000 },
  },
  // Arista
  'SM0005-USA':   { fju: { hospitalCode: 'MTTZ03BAH1', purchasePrice: 7875 },  wgh: { hospitalCode: '53191', purchasePrice: 8000,  patientPrice: 10500 } },
  'SM0002-USA':   { fju: { hospitalCode: 'MTTZ03BAH3', purchasePrice: 15750 }, wgh: { hospitalCode: '53192', purchasePrice: 16000, patientPrice: 21000 } },
  'SM0007-USA':   { fju: { hospitalCode: 'MTTZ03BAH5', purchasePrice: 25700 }, wgh: { hospitalCode: '53193', purchasePrice: 26500, patientPrice: 35000 } },
  'TTZ030696004': { fju: { hospitalCode: 'MTTZ03BA14', purchasePrice: 2250 },  wgh: { hospitalCode: '53194', purchasePrice: 2300,  patientPrice: 2900 } },
  'AM0005':       { fju: { hospitalCode: 'MTTZ03AA38', purchasePrice: 2250 },  wgh: { hospitalCode: '53195', purchasePrice: 2300,  patientPrice: 2900 } },
  // 3DMAX Light
  '0117310': { fju: { hospitalCode: 'MFSZ02BL53', purchasePrice: 6800 } },
  '0117320': { fju: { hospitalCode: 'MFSZ02BR53', purchasePrice: 6800 } },
  '0117311': { fju: { hospitalCode: 'MFSZ02BL62', purchasePrice: 6800 } },
  '0117321': { fju: { hospitalCode: 'MFSZ02BR62', purchasePrice: 6800 } },
  '0117312': { fju: { hospitalCode: 'MFSZ02BL67', purchasePrice: 6800 } },
  '0117322': { fju: { hospitalCode: 'MFSZ02BR48', purchasePrice: 6800 } },
  // 3DMAX
  '0115310': { fju: { hospitalCode: 'MFSZ00B000', purchasePrice: 6500 } },
  '0115320': { fju: { hospitalCode: 'MFSZ00B003', purchasePrice: 6500 } },
  '0115311': { fju: { hospitalCode: 'MFSZ00B001', purchasePrice: 6500 } },
  '0115321': { fju: { hospitalCode: 'MFSZ00B004', purchasePrice: 6500 } },
  '0115312': { fju: { hospitalCode: 'MFSZ00B002', purchasePrice: 6500 } },
  '0115322': { fju: { hospitalCode: 'MFSZ00B005', purchasePrice: 6500 } },
  // 速巴定
  '0113115': { fju: { hospitalCode: 'MFSPF13115', purchasePrice: 9048 } },
  // Ventralex ST
  '5950007': { fju: { hospitalCode: 'MFSP645007', purchasePrice: 11795 } },
  '5950008': { fju: { hospitalCode: 'MFSP645008', purchasePrice: 11795 } },
  '5950009': { fju: { hospitalCode: 'MFSP645009', purchasePrice: 11795 } },
  // Ventralight ST
  '5954460': { fju: { hospitalCode: 'MFSP644460', purchasePrice: 20634 } },
  '5954680': { fju: { hospitalCode: 'MFSP644680', purchasePrice: 22220 } },
  '5954790': { fju: { hospitalCode: 'MFSP644790', purchasePrice: 26156 } },
  // Hermesh 8
  'Hermesh 8 6×11':  { fju: { hospitalCode: 'MFSP610611', purchasePrice: 710 } },
  'Hermesh 8 10×15': { fju: { hospitalCode: 'MFSP611015', purchasePrice: 1200 }, wgh: { purchasePrice: 1107 } },
  'Hermesh 8 15×15': { fju: { hospitalCode: 'MFSP61H515', purchasePrice: 1250 }, wgh: { purchasePrice: 1210 } },
  // 愛沛斯（輔大 IS-1／IS-6／HELICO 表上同一個院內碼）
  'IS-M1':        { fju: { hospitalCode: 'MFSZ02CL11', purchasePrice: 26900 } },
  'IS-TOMS-1':    { fju: { hospitalCode: 'MFSP721000', purchasePrice: 77000 } },
  'IS-1':         { fju: { hospitalCode: 'MFSP710106', purchasePrice: 10112 } },
  'IS-6':         { fju: { hospitalCode: 'MFSP710106', purchasePrice: 10112 } },
  'IS-HELICO-01': { fju: { hospitalCode: 'MFSP710106', purchasePrice: 10112 }, wgh: { hospitalCode: '52706', purchasePrice: 9500 } },
  'P-STOP-8':     { wgh: { purchasePrice: 40000 } },
};

// 雲端還沒有的型號：補進指定產品
const NEW_VARIANTS: { productId: string; modelNumber: string; description: string }[] = [
  { productId: 'seed_3DMAX', modelNumber: '0115312', description: '極大/左' },
  { productId: 'seed_3DMAX', modelNumber: '0115322', description: '極大/右' },
];

/** 套用增量更新；回傳新陣列與是否有變動 */
export function applyHospitalInfoPatch(products: Product[]): { products: Product[]; changed: boolean } {
  let changed = false;
  const next = products.map(p => {
    const variants = [...p.variants];
    for (const nv of NEW_VARIANTS) {
      if (nv.productId !== p.id || variants.some(v => v.modelNumber === nv.modelNumber)) continue;
      const base = variants[0];
      variants.push({
        id: 'seed_' + nv.modelNumber, modelNumber: nv.modelNumber, description: nv.description,
        selfPayCode: base?.selfPayCode, nhiCode: base?.nhiCode,
        hospitalPrice: base?.hospitalPrice ?? 0, patientPrice: base?.patientPrice ?? 0,
        unit: base?.unit ?? '片', hospitalPrices: {}, hospitalInfo: {},
      });
      changed = true;
    }
    const patched = variants.map(v => {
      const patch = HOSPITAL_INFO_PATCH[v.modelNumber];
      if (!patch) return v;
      const hospitalInfo: Record<string, HospitalVariantInfo> = { ...(v.hospitalInfo ?? {}) };
      const hospitalPrices: Record<string, number> = { ...(v.hospitalPrices ?? {}) };
      let vChanged = false;
      for (const [hid, info] of Object.entries(patch)) {
        const merged = { ...hospitalInfo[hid], ...info };
        if (JSON.stringify(merged) !== JSON.stringify(hospitalInfo[hid])) { hospitalInfo[hid] = merged; vChanged = true; }
        const net = Math.round(info.purchasePrice / 1.05);
        if (hospitalPrices[hid] !== net) { hospitalPrices[hid] = net; vChanged = true; }
      }
      if (!vChanged) return v;
      changed = true;
      return { ...v, hospitalInfo, hospitalPrices };
    });
    return patched === p.variants ? p : { ...p, variants: patched };
  });
  return { products: next, changed };
}
