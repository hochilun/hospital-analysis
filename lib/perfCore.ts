// 業績核心計算 —— 由 /performance 與 /customers 共用，避免兩頁邏輯各算各的。
// 這裡只放「純計算＋localStorage 存取」，不含任何畫面。
import {
  SHARED_HOSPITALS, SHARED_PERFORMANCE, SHARED_AUTO, isSettledMonth,
  type DoctorEntry, type HospProdEntry, type MonthPerf,
} from '@/data/myPerformance';
import { SALES_BY_YEAR } from '@/data/salesHistory';
import { pushToCloud } from '@/lib/supabase';


// 醫師資料統一存成單一物件 perf-doctors（key = `${月}-${醫院}-${產品}`），
// 接上 Supabase 同步，避免動態 key 無法備份、跨裝置/本地線上不一致的問題。
export const PERF_DOCTORS_KEY = 'perf-doctors';
export type PerfDoctorsMap = Record<string, DoctorEntry[]>;
export const subKey = (month: string, hosp: string, prod: string) => `${month}-${hosp}-${prod}`;

export const loadAllDoctors = (): PerfDoctorsMap => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(PERF_DOCTORS_KEY) ?? '{}'); }
  catch { return {}; }
};

export const persistAllDoctors = (map: PerfDoctorsMap) => {
  localStorage.setItem(PERF_DOCTORS_KEY, JSON.stringify(map));
  pushToCloud('perf-doctors', map);
};

export const loadDoctors = (month: string, hosp: string, prod: string): DoctorEntry[] =>
  loadAllDoctors()[subKey(month, hosp, prod)] ?? [];

export const saveDoctors = (month: string, hosp: string, prod: string, data: DoctorEntry[]) => {
  const map = loadAllDoctors();
  if (data.length) map[subKey(month, hosp, prod)] = data;
  else delete map[subKey(month, hosp, prod)];
  persistAllDoctors(map);
};

/** 一次性遷移：把舊版分散的 perf-doctors-{月}-{醫院}-{產品} 個別 key 合併進統一物件並推上雲端 */
export const migrateOldDoctorKeys = (): boolean => {
  if (typeof window === 'undefined') return false;
  const map = loadAllDoctors();
  let changed = false;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('perf-doctors-')) continue; // 舊格式（含尾端 dash），排除統一 key 本身
    const sub = k.slice('perf-doctors-'.length);
    if (map[sub]?.length) continue; // 已遷移過就不覆蓋
    try {
      const v = JSON.parse(localStorage.getItem(k) ?? '[]');
      if (Array.isArray(v) && v.length) { map[sub] = v; changed = true; }
    } catch {}
  }
  if (changed) persistAllDoctors(map);
  return changed;
};

// ── 認領：共跑醫院（北慈/土長）Mars 只認領自己的那幾支 ─────────────────────
// perf-claims：單一物件，key = `${月}-${醫院}-${產品}` → 我的支數，接 Supabase 同步。
export const PERF_CLAIMS_KEY = 'perf-claims';
export type ClaimsMap = Record<string, number>;
export const isShared = (h: string) => (SHARED_HOSPITALS as readonly string[]).includes(h);

export const loadClaims = (): ClaimsMap => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(PERF_CLAIMS_KEY) ?? '{}'); }
  catch { return {}; }
};
export const getClaim = (claims: ClaimsMap, month: string, hosp: string, prod: string): number =>
  claims[subKey(month, hosp, prod)] ?? 0;
export const saveClaim = (month: string, hosp: string, prod: string, myQty: number) => {
  const map = loadClaims();
  const k = subKey(month, hosp, prod);
  if (myQty > 0) map[k] = myQty; else delete map[k];
  localStorage.setItem(PERF_CLAIMS_KEY, JSON.stringify(map));
  pushToCloud('perf-claims', map);
};

// 共跑醫院視圖：整院產品逐列。auto=true 表示 Mars 檔本人業績（全計、不需認領）；否則為整院認領池。
export type SharedProdView = HospProdEntry & { gross: number; grossQty: number; mine: number; shared: true; auto: boolean };

// 單月的「共跑醫院業績」聚合 = 本人業績(SHARED_AUTO，全計) + 整院認領(SHARED_PERFORMANCE，依認領支數)
export function claimedSharedMonth(monthKey: string, claims: ClaimsMap) {
  const byHospital: Record<string, number> = {};      // 有效加權（本人+認領）
  const byHospitalRev: Record<string, number> = {};   // 有效應收
  const hospitalProducts: Record<string, SharedProdView[]> = {};
  const byCategory: Record<string, number> = {};
  const byProductMap: Record<string, HospProdEntry> = {};
  let weightedTotal = 0, revTotal = 0;
  const pool = SHARED_PERFORMANCE[monthKey] ?? {};
  const auto = SHARED_AUTO[monthKey] ?? {};
  const hosps = Array.from(new Set([...Object.keys(pool), ...Object.keys(auto)]));
  if (!hosps.length) return { byHospital, byHospitalRev, hospitalProducts, byCategory, byProduct: [] as HospProdEntry[], weightedTotal, revTotal };

  const addAgg = (hosp: string, cat: string, name: string, w: number, r: number, qty: number) => {
    byHospital[hosp] += w; byHospitalRev[hosp] += r;
    byCategory[cat] = (byCategory[cat] ?? 0) + w;
    if (byProductMap[name]) byProductMap[name] = { ...byProductMap[name], qty: byProductMap[name].qty + qty, rev: byProductMap[name].rev + w };
    else byProductMap[name] = { name, category: cat, qty, rev: w };
    weightedTotal += w; revTotal += r;
  };

  for (const hosp of hosps) {
    byHospital[hosp] = 0; byHospitalRev[hosp] = 0;   // 一律列出，讓使用者能點進去認領
    const views: SharedProdView[] = [];
    // 本人業績（Mars 檔）→ 全計，不需認領
    for (const p of (auto[hosp] ?? [])) {
      const aw = p.weighted ?? p.rev;
      views.push({ name: p.name, category: p.category, qty: p.qty, rev: aw, weighted: aw, gross: aw, grossQty: p.qty, mine: p.qty, shared: true, auto: true });
      addAgg(hosp, p.category, p.name, aw, p.rev, p.qty);
    }
    // 整院認領池 → 依認領支數比例。
    // 已定案月份完全跳過：SHARED_AUTO 與整院池是同一批貨（重疊），再列一次會重複計算，
    // 且同一產品會出現兩列（本人／整院）造成 key 衝突與畫面混淆。
    if (isSettledMonth(monthKey)) { hospitalProducts[hosp] = views; continue; }
    for (const p of (pool[hosp] ?? [])) {
      const grossW = p.weighted ?? p.rev;
      const mine = Math.min(getClaim(claims, monthKey, hosp, p.name), p.qty);
      const ratio = p.qty > 0 ? mine / p.qty : 0;
      const cw = Math.round(grossW * ratio);
      const cr = Math.round(p.rev * ratio);
      views.push({ name: p.name, category: p.category, qty: mine, rev: cw, weighted: cw, gross: grossW, grossQty: p.qty, mine, shared: true, auto: false });
      if (cw > 0) addAgg(hosp, p.category, p.name, cw, cr, mine);
    }
    hospitalProducts[hosp] = views;
  }
  return { byHospital, byHospitalRev, hospitalProducts, byCategory, byProduct: Object.values(byProductMap), weightedTotal, revTotal };
}

// 單月「有效業績」= 獨跑醫院全額（加權）+ 共跑醫院已認領部分
export function effectiveMonth(m: MonthPerf, claims: ClaimsMap) {
  const w = toWeighted(m);
  const cs = claimedSharedMonth(m.month, claims);
  const byHospital: Record<string, number> = {};
  const hospitalProducts: Record<string, HospProdEntry[]> = {};
  for (const [h, v] of Object.entries(w.byHospital)) if (!isShared(h)) byHospital[h] = v;
  for (const [h, prods] of Object.entries(w.hospitalProducts)) if (!isShared(h)) hospitalProducts[h] = prods;
  const byCategory: Record<string, number> = { ...w.byCategory };
  for (const [h, v] of Object.entries(cs.byHospital)) byHospital[h] = v;
  for (const [h, prods] of Object.entries(cs.hospitalProducts)) hospitalProducts[h] = prods;
  for (const [c, v] of Object.entries(cs.byCategory)) byCategory[c] = (byCategory[c] ?? 0) + v;
  const bpMap: Record<string, HospProdEntry> = {};
  for (const p of w.byProduct) bpMap[p.name] = { ...p };
  for (const p of cs.byProduct) {
    if (bpMap[p.name]) bpMap[p.name] = { ...bpMap[p.name], qty: bpMap[p.name].qty + p.qty, rev: bpMap[p.name].rev + p.rev };
    else bpMap[p.name] = { ...p };
  }
  const byProduct = Object.values(bpMap).sort((a, b) => b.rev - a.rev);
  const weighted = Object.values(byHospital).reduce((s, v) => s + v, 0);
  const revenueApplied = m.revenue + cs.revTotal;   // 應收（獨跑全額 + 共跑認領）
  return { revenue: weighted, weighted, byHospital, byCategory, byProduct, hospitalProducts, revenueApplied };
}

// 整年度累積（有效業績）
export function effectiveAggregate(months: MonthPerf[], claims: ClaimsMap) {
  const byHospital: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byProductMap: Record<string, HospProdEntry> = {};
  const hospProdMap: Record<string, Record<string, HospProdEntry>> = {};
  let weighted = 0, revenueApplied = 0;
  for (const m of months) {
    const e = effectiveMonth(m, claims);
    weighted += e.weighted;
    revenueApplied += e.revenueApplied;
    for (const [h, v] of Object.entries(e.byHospital)) byHospital[h] = (byHospital[h] ?? 0) + v;
    for (const [c, v] of Object.entries(e.byCategory)) byCategory[c] = (byCategory[c] ?? 0) + v;
    for (const p of e.byProduct) {
      if (byProductMap[p.name]) byProductMap[p.name] = { ...byProductMap[p.name], qty: byProductMap[p.name].qty + p.qty, rev: byProductMap[p.name].rev + p.rev };
      else byProductMap[p.name] = { ...p };
    }
    for (const [h, prods] of Object.entries(e.hospitalProducts)) {
      if (!hospProdMap[h]) hospProdMap[h] = {};
      for (const p of prods) {
        const cur = hospProdMap[h][p.name];
        if (cur) {
          const sv = p as SharedProdView;
          hospProdMap[h][p.name] = {
            ...cur, qty: cur.qty + p.qty, rev: cur.rev + p.rev,
            ...(sv.shared ? { gross: ((cur as SharedProdView).gross ?? 0) + sv.gross, grossQty: ((cur as SharedProdView).grossQty ?? 0) + sv.grossQty, mine: ((cur as SharedProdView).mine ?? 0) + sv.mine } : {}),
          };
        } else hospProdMap[h][p.name] = { ...p };
      }
    }
  }
  return {
    revenue: weighted, weighted, revenueApplied, byHospital, byCategory,
    byProduct: Object.values(byProductMap).sort((a, b) => b.rev - a.rev),
    hospitalProducts: Object.fromEntries(
      Object.entries(hospProdMap).map(([h, mp]) => [h, Object.values(mp).sort((a, b) => b.rev - a.rev)])
    ),
  };
}

// 將單月 myPerformance（應收）轉換為加權業績
export function toWeighted(m: MonthPerf) {
  const overallRatio = m.revenue > 0 ? m.weighted / m.revenue : 1;

  // byHospital：優先用 salesHistory 精確加權值
  const hospRow = SALES_BY_YEAR['2026'].MONTHLY_BY_HOSPITAL.find(r => r.month === m.label);
  const byHospital: Record<string, number> = {};
  if (hospRow) {
    for (const [k, v] of Object.entries(hospRow)) {
      if (k !== 'month' && typeof v === 'number' && v > 0) byHospital[k] = v;
    }
  } else {
    for (const [h, v] of Object.entries(m.byHospital)) {
      byHospital[h] = Math.round(v * overallRatio);
    }
  }

  // byCategory：優先用 salesHistory 精確加權值
  const catRow = SALES_BY_YEAR['2026'].MONTHLY_BY_CATEGORY.find(r => r.month === m.label);
  const byCategory: Record<string, number> = {};
  if (catRow) {
    for (const cat of ['Hemostasis', 'Adhesion Prevention', 'Hernia', 'Urinary Incontinence']) {
      const v = catRow[cat] as number | undefined;
      if (v && v > 0) byCategory[cat] = v;
    }
  } else {
    for (const [c, v] of Object.entries(m.byCategory)) {
      byCategory[c] = Math.round(v * overallRatio);
    }
  }

  // hospitalProducts：依各醫院實際加權比例換算
  const hospitalProducts: Record<string, HospProdEntry[]> = {};
  for (const [h, prods] of Object.entries(m.hospitalProducts)) {
    const hRev = m.byHospital[h] ?? 0;
    const hW   = byHospital[h]  ?? 0;
    const hRatio = hRev > 0 ? hW / hRev : overallRatio;
    hospitalProducts[h] = prods.map(p => ({ ...p, rev: Math.round(p.rev * hRatio) }));
  }

  // byProduct：用整體比例換算
  const byProduct = m.byProduct.map(p => ({ ...p, rev: Math.round(p.rev * overallRatio) }));

  return { revenue: m.weighted, weighted: m.weighted, byHospital, byCategory, byProduct, hospitalProducts };
}
