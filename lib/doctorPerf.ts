// 醫師業績歸屬 —— 把 perf-doctors（哪位醫師用了哪支產品幾支）換算成金額，
// 供 /performance 的醫師卡片牆與 /customers 的客戶卡共用。
//
// 歸屬公式：該醫師業績 = 產品期間業績 × 該醫師支數 ÷ 該產品總支數
import { type DoctorEntry, type HospProdEntry, type MonthPerf } from '@/data/myPerformance';
import { sponsorAmount } from '@/data/sponsorship';
import { type Doctor } from '@/types';
import {
  loadDoctors, effectiveMonth, effectiveAggregate, type ClaimsMap,
} from '@/lib/perfCore';

export type DocPerf = {
  name: string; dept: string; qty: number; rev: number;
  sponsor: number;                                   // 學術贊助金額
  activeMonths: number;                              // 有使用紀錄的月份數
  monthly: { label: string; rev: number }[];         // 逐月業績貢獻
  products: { name: string; qty: number; rev: number; sponsor: number; hosp: string }[];
  // 同名產品跨院合併後的組成（供卡片色帶與主力產品使用；products 保留分院明細）
  merged: { name: string; cat: string; qty: number; rev: number; sponsor: number }[];
};

/** 期間內某醫院＋產品的醫師用量（跨月合計，同科同名合併） */
export function loadDoctorsForPeriod(
  monthKeys: string[], hosp: string, prod: string,
  source: (month: string, hosp: string, prod: string) => DoctorEntry[] = loadDoctors,
) {
  const map: Record<string, { dept: string; name: string; qty: number }> = {};
  for (const mk of monthKeys) {
    for (const d of source(mk, hosp, prod)) {
      const k = `${d.dept}|${d.name}`;
      if (map[k]) map[k].qty += d.qty;
      else map[k] = { dept: d.dept, name: d.name, qty: d.qty };
    }
  }
  return Object.values(map);
}

/**
 * 算出期間內每位醫師的業績貢獻，依金額由大到小。
 * @param months 要涵蓋的月份（給 MY_PERFORMANCE 的子集）
 * @param claims 共跑醫院認領
 * @param hosps  只算這幾間醫院（中文名）；不給就算全部
 * @param monthData 已算好的期間聚合；不給就自己算（兩者結果相同，給了可省一次計算）
 */
export function buildDoctorPerf(
  months: MonthPerf[],
  claims: ClaimsMap,
  hosps?: string[],
  monthData?: { hospitalProducts: Record<string, HospProdEntry[]> },
  source: (month: string, hosp: string, prod: string) => DoctorEntry[] = loadDoctors,
): DocPerf[] {
  if (!months.length) return [];
  const agg1 = monthData
    ?? (months.length === 1 ? effectiveMonth(months[0], claims) : effectiveAggregate(months, claims));
  const targetHosps = hosps ?? Object.keys(agg1.hospitalProducts);
  const monthKeys = months.map(m => m.month);

  const agg: Record<string, DocPerf> = {};
  const seenMonth: Record<string, Set<string>> = {};

  for (const h of targetHosps) {
    for (const p of (agg1.hospitalProducts[h] ?? [])) {
      for (const d of loadDoctorsForPeriod(monthKeys, h, p.name, source)) {
        const revShare = p.qty > 0 ? Math.round(p.rev * d.qty / p.qty) : 0;
        const spon = sponsorAmount(p.name, h, d.qty);
        const key = `${d.dept}|${d.name}`;
        if (!agg[key]) {
          agg[key] = { name: d.name, dept: d.dept, qty: 0, rev: 0, sponsor: 0, activeMonths: 0,
                       monthly: months.map(m => ({ label: m.label, rev: 0 })), products: [], merged: [] };
          seenMonth[key] = new Set();
        }
        agg[key].qty += d.qty;
        agg[key].rev += revShare;
        agg[key].sponsor += spon;
        agg[key].products.push({ name: p.name, qty: d.qty, rev: revShare, sponsor: spon, hosp: h });
      }
      // 逐月拆解：該產品在各月的醫師用量 × 當月單價
      months.forEach((m, mi) => {
        const mp = (effectiveMonth(m, claims).hospitalProducts[h] ?? []).find(x => x.name === p.name);
        if (!mp || mp.qty <= 0) return;
        for (const d of source(m.month, h, p.name)) {
          const key = `${d.dept}|${d.name}`;
          if (!agg[key]) continue;
          agg[key].monthly[mi].rev += Math.round(mp.rev * d.qty / mp.qty);
          seenMonth[key].add(m.label);
        }
      });
    }
  }

  for (const k of Object.keys(agg)) {
    agg[k].activeMonths = seenMonth[k].size;
    // 同名產品跨院合併：同一位醫師在兩間醫院用同一支產品，先前會重複列出
    const m: Record<string, { name: string; cat: string; qty: number; rev: number; sponsor: number }> = {};
    for (const p of agg[k].products) {
      if (!m[p.name]) m[p.name] = { name: p.name, cat: '', qty: 0, rev: 0, sponsor: 0 };
      m[p.name].qty += p.qty; m[p.name].rev += p.rev; m[p.name].sponsor += p.sponsor;
    }
    for (const h of Object.keys(agg1.hospitalProducts)) {
      for (const p of agg1.hospitalProducts[h]) if (m[p.name] && !m[p.name].cat) m[p.name].cat = p.category;
    }
    agg[k].merged = Object.values(m).sort((x, y) => y.rev - x.rev);
  }
  return Object.values(agg).sort((a, b) => b.rev - a.rev);
}

// ── 業績報表 ↔ 客戶資料庫 對接 ─────────────────────────────────────────
// 兩邊唯一的共同欄位是「醫師姓名」。姓名打錯就接不起來，所以這裡一律回報
// 對不上的名字，讓畫面能直接提示，而不是默默漏掉業績。

export type DoctorLink = {
  byName: Record<string, Doctor>;   // 醫師姓名 → CRM 客戶
  unmatched: string[];              // 業績報表有、CRM 找不到的姓名（多半是打錯字）
};

/** 正規化：去空白，並把常見誤植的注音符號 ㄧ 還原成國字一 */
export const normName = (s: string) => s.replace(/\s/g, '').replace(/ㄧ/g, '一');

export function linkDoctors(perf: { name: string }[], crm: Doctor[]): DoctorLink {
  const index: Record<string, Doctor> = {};
  for (const d of crm) {
    const k = normName(d.name);
    // 同名多筆時保留資料較完整的那筆（有等級 > 有產品目標 > 先到者）
    const cur = index[k];
    if (!cur) { index[k] = d; continue; }
    const score = (x: Doctor) => (x.grade ? 2 : 0) + (x.productTargets?.length ? 1 : 0);
    if (score(d) > score(cur)) index[k] = d;
  }
  const byName: Record<string, Doctor> = {};
  const unmatched: string[] = [];
  for (const p of perf) {
    const hit = index[normName(p.name)];
    if (hit) byName[p.name] = hit;
    else if (!unmatched.includes(p.name)) unmatched.push(p.name);
  }
  return { byName, unmatched };
}
