import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

// 所有要同步的 localStorage key
export const SYNC_KEYS = [
  'doctors',
  'visits',
  'products-db',
  'hospitals-data',
  'hospital-strategies',
  'weekly-starred',
  'personal-calendar',
  'global-todos',
  'perf-doctors',
  'perf-claims',
  'seminars',
  'sponsorship-state',
] as const;

export type SyncKey = typeof SYNC_KEYS[number];

// ── 同步模型（2026-10-26 改）────────────────────────────────────────────
// 雲端為準。網站與 Elon（Telegram bot）會同時寫同一份資料，所以寫入不能整包覆蓋：
// 以「上次同步的版本」(base) 為基準做三方合併 —— 只把本機這次真的改過／刪掉的那幾筆
// 套到雲端最新版上，Elon 在這段期間新增的資料會保留。
//   陣列（元素有 id，如 doctors、visits）→ 依 id 合併
//   物件（如 perf-doctors、sponsorship-state）→ 依第一層 key 合併
// 推送失敗會留下 dirty 標記，下次載入時先合併推送再拉雲端，本機修改不會被蓋掉。

const BASE = (k: string) => `__sync_base:${k}`;
const DIRTY = (k: string) => `__sync_dirty:${k}`;

const parse = (v: unknown) => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
};
const readLocal = (k: string): unknown => {
  try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; }
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isIdArray = (v: unknown): v is { id: string }[] =>
  Array.isArray(v) && v.every(x => x && typeof x === 'object' && 'id' in x);
const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** 三方合併：把 local 相對於 base 的變更套到 remote 上 */
export function merge3(base: unknown, local: unknown, remote: unknown): unknown {
  if (remote === null || remote === undefined) return local;
  if (isIdArray(local) && isIdArray(remote) && (base == null || isIdArray(base))) {
    const b = new Map((base as { id: string }[] | null ?? []).map(x => [x.id, x]));
    const l = new Map(local.map(x => [x.id, x]));
    const deleted = (id: string) => b.has(id) && !l.has(id);
    const edited = (id: string) => l.has(id) && (!b.has(id) || !same(l.get(id), b.get(id)));
    const out = remote.filter(x => !deleted(x.id)).map(x => (edited(x.id) ? l.get(x.id)! : x));
    const seen = new Set(out.map(x => x.id));
    for (const x of local) if (!seen.has(x.id) && !b.has(x.id)) out.push(x);    // 本機新增
    return out;
  }
  if (isPlainObj(local) && isPlainObj(remote) && (base == null || isPlainObj(base))) {
    const b = (base as Record<string, unknown> | null) ?? {};
    const out: Record<string, unknown> = { ...remote };
    for (const k of Object.keys(local)) if (!(k in b) || !same(local[k], b[k])) out[k] = local[k];
    for (const k of Object.keys(b)) if (!(k in local)) delete out[k];
    return out;
  }
  return local;   // 其他型別：本機為準
}

async function fetchRemote(k: SyncKey): Promise<{ ok: boolean; value: unknown }> {
  if (!supabase) return { ok: false, value: null };
  const { data, error } = await supabase.from('app_storage').select('value').eq('key', k).maybeSingle();
  if (error) return { ok: false, value: null };
  return { ok: true, value: data ? parse(data.value) : null };
}

function adoptLocal(k: string, v: unknown) {
  const changed = !same(readLocal(k), v);
  localStorage.setItem(k, JSON.stringify(v));
  localStorage.setItem(BASE(k), JSON.stringify(v));
  return changed;
}

// 同一個 key 的推送依序執行，避免兩次存檔互相覆蓋
const queues: Partial<Record<SyncKey, Promise<void>>> = {};

/** 寫入 Supabase（三方合併，靜默失敗，不影響 UI） */
export function pushToCloud(k: SyncKey, value: unknown): Promise<void> {
  if (!supabase || typeof window === 'undefined') return Promise.resolve();
  localStorage.setItem(DIRTY(k), '1');
  const run = async () => {
    try {
      const remote = await fetchRemote(k);
      if (!remote.ok) return;
      let base: unknown = null;
      try { base = JSON.parse(localStorage.getItem(BASE(k)) ?? 'null'); } catch {}
      // 以本機當下的最新值為準（排隊期間可能又改過）
      const local = readLocal(k) ?? value;
      const merged = merge3(base, local, remote.value);
      const { error } = await supabase!.from('app_storage').upsert({ key: k, value: merged, updated_at: new Date().toISOString() });
      if (error) return;
      localStorage.removeItem(DIRTY(k));
      if (adoptLocal(k, merged)) window.dispatchEvent(new CustomEvent('cloud-synced', { detail: { key: k } }));
    } catch {}
  };
  const p = (queues[k] ?? Promise.resolve()).then(run);
  queues[k] = p;
  return p;
}

/** 拉雲端最新版到本機；本機有未推送的修改就先合併推送 */
async function syncKey(k: SyncKey, remoteValue?: unknown): Promise<boolean> {
  if (localStorage.getItem(DIRTY(k))) {
    const before = localStorage.getItem(k);
    await pushToCloud(k, readLocal(k));
    return localStorage.getItem(k) !== before;
  }
  const remote = remoteValue !== undefined ? { ok: true, value: remoteValue } : await fetchRemote(k);
  if (!remote.ok || remote.value === null || remote.value === undefined) return false;
  return adoptLocal(k, remote.value);
}

/** 從 Supabase 同步指定 key（雲端為準） */
export async function forceSync(k: SyncKey): Promise<boolean> {
  if (!supabase) return false;
  try { await syncKey(k); return true; } catch { return false; }
}

/** 同步所有 SYNC_KEYS（頁面載入時使用）；回傳是否有資料變動 */
export async function syncAllFromCloud(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.from('app_storage').select('key, value');
    if (error || !data) return false;
    const remote = new Map(data.map(r => [r.key, parse(r.value)]));
    let changed = false;
    for (const k of SYNC_KEYS) {
      if (await syncKey(k, remote.has(k) ? remote.get(k) : null)) changed = true;
    }
    if (changed) window.dispatchEvent(new CustomEvent('cloud-synced'));
    return changed;
  } catch {
    return false;
  }
}

/** 舊名稱保留：行為同 syncAllFromCloud（雲端為準＋合併本機未推送修改） */
export const pullFromCloud = syncAllFromCloud;
