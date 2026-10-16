// 學術贊助核心計算 —— /sponsorship 頁使用。
// 學贊看「使用月」，業績看「發票月」：一般醫院兩者相同；北醫累計一個月、次月才開票，
// 所以北醫第 U 月的使用量 = 第 U+1 月的發票（業績資料）與該月登記的醫師。
import { MY_PERFORMANCE, HOSP_ORDER, type DoctorEntry } from '@/data/myPerformance';
import { sponsorRate } from '@/data/sponsorship';
import { effectiveMonth, loadAllDoctors, loadClaims, subKey } from '@/lib/perfCore';
import { pushToCloud } from '@/lib/supabase';

export const DELAYED_HOSPITALS = ['台北醫學'];   // 發票延後一個月的醫院
export const SETTLED_MONTHS: Record<string, string> = {   // 已對帳結清的使用月（唯讀）
  '2026-07': '2026-09-04 對帳結清',
  '2026-08': '2026-09-04 對帳結清',
};
export const FIRST_MONTH = '2026-07';

export const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (ym: string) => `${Number(ym.split('-')[1])}月`;

// ── 狀態（雲端同步 key：sponsorship-state）──────────────────────────────
export type ManualItem = {
  id: string; month: string; hosp: string; dept: string; name: string;
  product: string; qty: number; unit: number; note?: string;
};
export type SponsorState = {
  done: Record<string, { at: string; amount: number }>;   // 醫師列 key → 勾選日期與當時金額
  excluded: Record<string, string>;                        // 醫師列 key → 不請原因
  notes: Record<string, string>;                           // 醫師列 key → 備註
  rateOverride: Record<string, number>;                    // 品項 key → 自訂單價
  manual: ManualItem[];                                    // 手動加列
};
export const SPONSOR_STATE_KEY = 'sponsorship-state';
export const emptyState = (): SponsorState => ({ done: {}, excluded: {}, notes: {}, rateOverride: {}, manual: [] });

export const loadSponsorState = (): SponsorState => {
  if (typeof window === 'undefined') return emptyState();
  try { return { ...emptyState(), ...JSON.parse(localStorage.getItem(SPONSOR_STATE_KEY) ?? '{}') }; }
  catch { return emptyState(); }
};
export const saveSponsorState = (s: SponsorState) => {
  localStorage.setItem(SPONSOR_STATE_KEY, JSON.stringify(s));
  pushToCloud('sponsorship-state', s);
};

export const rowKey = (month: string, hosp: string, name: string) => `${month}|${hosp}|${name}`;
export const itemKey = (month: string, hosp: string, name: string, product: string) => `${month}|${hosp}|${name}|${product}`;

// ── 計算 ────────────────────────────────────────────────────────────
export type SponsorItem = {
  product: string; qty: number; unit: number; amount: number;
  note?: string; manual?: ManualItem; overridden?: boolean;
};
export type DoctorRow = {
  key: string; hosp: string; dept: string; name: string;
  items: SponsorItem[]; amount: number;
  excluded?: string; done?: { at: string; amount: number }; note?: string;
  changed: boolean;   // 勾選後金額有變動
};
export type Unassigned = { product: string; qty: number; amount: number };
export type HospBlock = {
  hosp: string; invoiceMonth: string; delayed: boolean; available: boolean;
  rows: DoctorRow[]; unassigned: Unassigned[];
  total: number; doneTotal: number; unassignedTotal: number;
};
export type MonthResult = {
  month: string; settled?: string; blocks: HospBlock[];
  total: number; doneTotal: number; pendingTotal: number; unassignedTotal: number;
  rowCount: number; doneCount: number; excludedTotal: number;
};

const perfOf = (month: string) => MY_PERFORMANCE.find(m => m.month === month);

/** 該使用月有資料的月份清單（從 FIRST_MONTH 到最新業績月） */
export function sponsorMonths(): string[] {
  const latest = MY_PERFORMANCE[MY_PERFORMANCE.length - 1]?.month ?? FIRST_MONTH;
  const out: string[] = [];
  for (let m = FIRST_MONTH; m <= latest; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

export function computeMonth(month: string, state: SponsorState): MonthResult {
  const doctorsMap = loadAllDoctors();
  const claims = loadClaims();
  const settled = SETTLED_MONTHS[month];
  const hospOrder = [...HOSP_ORDER] as string[];
  const blocks: Record<string, HospBlock> = {};

  const ensureBlock = (hosp: string, invoiceMonth: string, delayed: boolean, available: boolean) =>
    (blocks[hosp] ??= { hosp, invoiceMonth, delayed, available, rows: [], unassigned: [], total: 0, doneTotal: 0, unassignedTotal: 0 });

  // 每間醫院依自己的發票月取產品與登記醫師
  const rowMaps: Record<string, Record<string, DoctorRow>> = {};
  for (const hosp of hospOrder) {
    const delayed = DELAYED_HOSPITALS.includes(hosp);
    const invoiceMonth = delayed ? shiftMonth(month, 1) : month;
    const perf = perfOf(invoiceMonth);
    const eff = perf ? effectiveMonth(perf, claims) : null;
    const prods = eff?.hospitalProducts[hosp] ?? [];
    // 產品清單＝業績品項 ∪ 該月已登記醫師的品項（避免漏掉）
    const prefix = `${invoiceMonth}-${hosp}-`;
    const names = new Set<string>(prods.map(p => p.name));
    for (const k of Object.keys(doctorsMap)) if (k.startsWith(prefix)) names.add(k.slice(prefix.length));

    const block = ensureBlock(hosp, invoiceMonth, delayed, !!perf);
    const rows: Record<string, DoctorRow> = (rowMaps[hosp] = {});
    for (const prod of names) {
      if (sponsorRate(prod, hosp) === 0 && !doctorsMap[subKey(invoiceMonth, hosp, prod)]?.some(d => sponsorRate(prod, hosp, d.name) > 0)) continue;
      const entries: DoctorEntry[] = doctorsMap[subKey(invoiceMonth, hosp, prod)] ?? [];
      let registered = 0;
      for (const d of entries) {
        registered += d.qty;
        const k = rowKey(month, hosp, d.name);
        const row = (rows[k] ??= { key: k, hosp, dept: d.dept, name: d.name, items: [], amount: 0, changed: false });
        const ik = itemKey(month, hosp, d.name, prod);
        const ov = state.rateOverride[ik];
        const unit = ov ?? sponsorRate(prod, hosp, d.name);
        const existing = row.items.find(i => i.product === prod && !i.manual);
        if (existing) {
          existing.qty += d.qty; existing.amount = existing.qty * existing.unit;
          if (d.note) existing.note = [existing.note, d.note].filter(Boolean).join('；');
        } else {
          row.items.push({ product: prod, qty: d.qty, unit, amount: unit * d.qty, note: d.note, overridden: ov !== undefined });
        }
      }
      const sold = prods.find(p => p.name === prod)?.qty ?? 0;
      const left = sold - registered;
      if (left > 0) {
        const unit = sponsorRate(prod, hosp);
        if (unit > 0) block.unassigned.push({ product: prod, qty: left, amount: unit * left });
      }
    }
  }

  // 手動加列（可能是系統沒有的醫院，如林口長庚）
  for (const m of state.manual.filter(x => x.month === month)) {
    if (!rowMaps[m.hosp]) { rowMaps[m.hosp] = {}; ensureBlock(m.hosp, month, false, true); }
    const k = rowKey(month, m.hosp, m.name);
    const row = (rowMaps[m.hosp][k] ??= { key: k, hosp: m.hosp, dept: m.dept, name: m.name, items: [], amount: 0, changed: false });
    row.items.push({ product: m.product, qty: m.qty, unit: m.unit, amount: m.qty * m.unit, note: m.note, manual: m });
  }

  const res: MonthResult = { month, settled, blocks: [], total: 0, doneTotal: 0, pendingTotal: 0, unassignedTotal: 0, rowCount: 0, doneCount: 0, excludedTotal: 0 };
  const order = [...hospOrder, ...Object.keys(blocks).filter(h => !hospOrder.includes(h))];
  for (const hosp of order) {
    const block = blocks[hosp];
    if (!block) continue;
    block.rows = Object.values(rowMaps[hosp] ?? {})
      .map(r => {
        r.amount = r.items.reduce((s, i) => s + i.amount, 0);
        r.excluded = state.excluded[r.key];
        r.note = state.notes[r.key];
        r.done = settled ? { at: settled, amount: r.amount } : state.done[r.key];
        r.changed = !!(r.done && !settled && r.done.amount !== r.amount);
        return r;
      })
      .filter(r => r.amount > 0 || r.excluded)
      .sort((a, b) => b.amount - a.amount);
    block.unassignedTotal = block.unassigned.reduce((s, u) => s + u.amount, 0);
    for (const r of block.rows) {
      if (r.excluded) { res.excludedTotal += r.amount; continue; }
      block.total += r.amount; res.rowCount++;
      if (r.done) { block.doneTotal += r.amount; res.doneCount++; }
    }
    if (!block.rows.length && !block.unassigned.length && block.available) continue;
    res.blocks.push(block);
    res.total += block.total; res.doneTotal += block.doneTotal; res.unassignedTotal += block.unassignedTotal;
  }
  res.pendingTotal = res.total - res.doneTotal;
  return res;
}
