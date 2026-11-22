// 拜訪洞察：把「拜訪紀錄」和「醫師業績」放在一起看，挑出該採取行動的客戶。
// 取代原本只算數量的「拜訪頻率規劃」（2026-11-23 Mars：數字沒意義，要告訴我該做什麼）。
//
// 四種提醒：
//   stop    拜訪很多次卻一直沒業績 → 考慮停損
//   care    持續有業績，拜訪卻沒跟上 → 該去關心
//   lapsed  以前有用、最近都沒用   → 去看看發生什麼事
//   decline 還在用但量明顯變少     → 去關心
//
// 業績只有月資料（醫師歸屬是逐月填的），所以「最近」都以月為單位比較。
// 醫師歸屬還沒填完的月份（例：當月報表剛進來，只填了一部分醫師）不能拿來判斷「沒業績」，
// 只能當作「有在用」的證據，否則會誤報一堆人沒用。
import { type Doctor, type VisitRecord } from '@/types';
import { type MonthPerf } from '@/data/myPerformance';
import { buildDoctorPerf, linkDoctors } from '@/lib/doctorPerf';
import { effectiveMonth, loadDoctors, type ClaimsMap } from '@/lib/perfCore';

export type InsightKind = 'stop' | 'care' | 'lapsed' | 'decline';

export type Insight = {
  kind: InsightKind;
  doctor: Doctor;
  reason: string;          // 一句話說明，直接顯示在卡片上
  score: number;           // 同類排序用，越大越前面
  lastVisit: string | null;
  visitedRecently: boolean; // 14 天內拜訪過（已處理中，畫面上淡化）
};

export type InsightInput = {
  months: MonthPerf[];                       // 依時間排序
  revById: Record<string, number[]>;         // 醫師 id → 與 months 對齊的逐月業績
  hospsById: Record<string, string[]>;       // 醫師 id → 曾有業績的醫院（業績報表院名）
  coverage: Record<string, Record<string, number>>; // 月 → 院 → 醫師歸屬比例 0–1
};

const DAY_MS = 86_400_000;
const RELIABLE = 0.8;          // 醫院當月歸屬 ≥ 80% 才相信「這位醫師 0 業績」
const STOP_MIN_VISITS = 6;     // 半年內拜訪 ≥ 6 次
const STOP_MAX_PER_VISIT = 1500; // 平均每次拜訪換到的業績低於這個數字算「沒業績」
const CARE_MIN_ACTIVE = 4;     // 近 6 個完整月至少 4 個月有業績才算「持續」
const LAPSE_MIN_TOTAL = 20_000;
const DECLINE_MIN_BASE = 15_000;
const DECLINE_RATIO = 0.5;

const wan = (n: number) => `${(n / 10_000).toFixed(1)} 萬`;
const daysBetween = (a: Date, iso: string) => Math.floor((a.getTime() - new Date(iso + 'T00:00:00').getTime()) / DAY_MS);

/** 在瀏覽器端組出洞察需要的業績資料（醫師逐月業績＋各院醫師歸屬比例） */
export function buildInsightInput(months: MonthPerf[], claims: ClaimsMap, doctors: Doctor[]): InsightInput {
  const perf = buildDoctorPerf(months, claims);
  const { byName } = linkDoctors(perf, doctors);
  const revById: Record<string, number[]> = {};
  const hospsById: Record<string, string[]> = {};
  for (const p of perf) {
    const doc = byName[p.name];
    if (!doc) continue;
    const cur = revById[doc.id] ?? months.map(() => 0);
    p.monthly.forEach((m, i) => { cur[i] += m.rev; });
    revById[doc.id] = cur;
    hospsById[doc.id] = [...new Set([...(hospsById[doc.id] ?? []), ...p.products.map(x => x.hosp)])];
  }
  const coverage: InputCoverage = {};
  for (const m of months) {
    const e = effectiveMonth(m, claims);
    const byHosp: Record<string, number> = {};
    for (const [h, prods] of Object.entries(e.hospitalProducts)) {
      let total = 0, attr = 0;
      for (const prod of prods) {
        total += prod.rev;
        const q = loadDoctors(m.month, h, prod.name).reduce((t, d) => t + d.qty, 0);
        attr += prod.qty > 0 ? prod.rev * Math.min(q, prod.qty) / prod.qty : 0;
      }
      byHosp[h] = total > 0 ? attr / total : 0;   // 整院還沒認領（0 元）= 不知道
    }
    coverage[m.month] = byHosp;
  }
  return { months, revById, hospsById, coverage };
}
type InputCoverage = InsightInput['coverage'];

export function computeInsights(
  doctors: Doctor[], visits: VisitRecord[], input: InsightInput, now: Date = new Date(),
): Insight[] {
  const { months, revById, hospsById, coverage } = input;
  if (!months.length) return [];

  // 當月若還沒結算（有 asOf 且不是月底），只當作參考月
  const last = months[months.length - 1];
  const partial = !!last.asOf && Number(last.asOf.slice(8, 10)) < new Date(Number(last.asOf.slice(0, 4)), Number(last.asOf.slice(5, 7)), 0).getDate();
  const doneIdx = months.map((_, i) => i).filter(i => !(partial && i === months.length - 1)).slice(-6);
  if (doneIdx.length < 4) return [];
  const curIdx = partial ? months.length - 1 : -1;
  const curElapsed = partial ? Number(last.asOf!.slice(8, 10)) / new Date(Number(last.asOf!.slice(0, 4)), Number(last.asOf!.slice(5, 7)), 0).getDate() : 1;

  const visitsBy: Record<string, string[]> = {};
  for (const v of visits) (visitsBy[v.doctorId] ??= []).push(v.date);
  const since = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
  const d60 = since(60), d90 = since(90), d180 = since(180), d14 = since(14);

  const out: Insight[] = [];
  for (const doc of doctors) {
    if (doc.grade === 'X' || doc.grade === 'Y') continue;   // 護理師、行政不看業績
    if (doc.strategy === 'paused') continue;                // 已經決定停損的不再提醒
    const dates = (visitsBy[doc.id] ?? []).sort();
    const lastVisit = dates.length ? dates[dates.length - 1] : null;
    const visitedRecently = !!lastVisit && lastVisit >= d14;
    const rev = revById[doc.id] ?? months.map(() => 0);
    const hosps = hospsById[doc.id] ?? [];
    // 這個月的「0 業績」可信嗎：醫師待過的醫院當月歸屬都填得夠完整
    // 完整月沒出現的醫院 = 真的沒業績；未結算的當月沒出現 = 還不知道
    const reliable = (i: number) => hosps.every(h => (coverage[months[i].month]?.[h] ?? (i === curIdx ? 0 : 1)) >= RELIABLE);
    const curRev = curIdx >= 0 ? rev[curIdx] : 0;
    const curReliable = curIdx >= 0 && reliable(curIdx) && curElapsed >= 0.5;

    const done = doneIdx.map(i => rev[i]);
    const totalDone = done.reduce((s, x) => s + x, 0);
    const active = done.filter(x => x > 0).length;
    const base = { doctor: doc, lastVisit, visitedRecently };

    // ── 停損：半年拜訪很多次，業績幾乎是零，最近兩個月也沒動靜 ──
    const v180 = dates.filter(d => d >= d180).length;
    const firstVisit = dates[0];
    const recentRev = done.slice(-2).reduce((s, x) => s + x, 0) + curRev;
    if (v180 >= STOP_MIN_VISITS && firstVisit && daysBetween(now, firstVisit) >= 90
        && recentRev === 0 && (totalDone + curRev) / v180 < STOP_MAX_PER_VISIT) {
      const revTxt = totalDone + curRev > 0 ? `只有零星 ${wan(totalDone + curRev)}` : '一直沒有業績';
      out.push({ ...base, kind: 'stop', score: v180 - (totalDone + curRev) / 10_000,
        reason: `半年拜訪 ${v180} 次，${revTxt}` });
      continue;
    }

    // ── 很久沒用：之前有業績，最近連續兩個月（含夠完整的當月）都是 0 ──
    let gap = 0;
    const tail = [...doneIdx];
    if (curReliable) tail.push(curIdx);
    else if (curRev > 0) gap = -1;                 // 當月歸屬沒填完但已經看到業績 → 不算沒用
    if (gap === 0) for (let k = tail.length - 1; k >= 0 && rev[tail[k]] === 0 && reliable(tail[k]); k--) gap++;
    const prior = tail.slice(0, tail.length - gap).map(i => rev[i]);
    const priorTotal = prior.reduce((s, x) => s + x, 0);
    const priorActive = prior.filter(x => x > 0).length;
    if (gap >= 2 && (priorActive >= 2 || priorTotal >= LAPSE_MIN_TOTAL)) {
      const lastIdx = tail[tail.length - gap - 1];
      out.push({ ...base, kind: 'lapsed', score: priorTotal / 10_000 * gap,
        reason: `${months[lastIdx]?.label ?? ''}之後就沒有業績（之前共 ${wan(priorTotal)}）` });
      continue;
    }

    // ── 持續有業績，拜訪沒跟上 ──
    const v60 = dates.filter(d => d >= d60).length;
    const v90 = dates.filter(d => d >= d90).length;
    const vPrev90 = dates.filter(d => d >= d180 && d < d90).length;
    const avg = totalDone / done.length;
    if (active >= CARE_MIN_ACTIVE && avg >= 10_000) {
      const r3 = done.slice(-3).reduce((s, x) => s + x, 0);
      const p3 = done.slice(-6, -3).reduce((s, x) => s + x, 0);
      const fewVisits = v60 <= 2;
      const visitsDropped = vPrev90 >= 4 && v90 <= vPrev90 * 0.6 && r3 >= p3 * 0.8;
      if (fewVisits || visitsDropped) {
        const lv = lastVisit ? `上次拜訪 ${daysBetween(now, lastVisit)} 天前` : '沒有拜訪紀錄';
        out.push({ ...base, kind: 'care', score: avg / 10_000 * (fewVisits ? 2 : 1),
          reason: visitsDropped && !fewVisits
            ? `業績穩定（月均 ${wan(avg)}），拜訪從 ${vPrev90} 次降到 ${v90} 次（近 3 月）`
            : `${active}/${done.length} 個月有業績（月均 ${wan(avg)}），近 2 個月只拜訪 ${v60} 次・${lv}` });
        continue;
      }
    }

    // ── 用量下滑：最近兩個月（當月可信就按天數換算）比之前少一半以上 ──
    const baseMonths = done.slice(0, -2).filter(x => x > 0);
    if (baseMonths.length >= 2) {
      const baseAvg = done.slice(0, -2).reduce((s, x) => s + x, 0) / done.slice(0, -2).length;
      const recent = done.slice(-2);
      if (curReliable) recent.push(curRev / curElapsed);
      const recentAvg = recent.reduce((s, x) => s + x, 0) / recent.length;
      if (baseAvg >= DECLINE_MIN_BASE && recentAvg < baseAvg * DECLINE_RATIO) {
        out.push({ ...base, kind: 'decline', score: (baseAvg - recentAvg) / 10_000,
          reason: `月均從 ${wan(baseAvg)} 掉到 ${wan(recentAvg)}（近 ${recent.length} 個月）` });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
