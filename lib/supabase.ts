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
] as const;

export type SyncKey = typeof SYNC_KEYS[number];

/** 單筆寫入 Supabase（靜默失敗，不影響 UI） */
export async function pushToCloud(key: SyncKey, value: unknown) {
  if (!supabase) return;
  try {
    await supabase.from('app_storage').upsert({ key, value, updated_at: new Date().toISOString() });
  } catch {}
}

/** 強制從 Supabase 覆蓋指定 key（不管本機有沒有資料） */
export async function forceSync(key: SyncKey): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.from('app_storage').select('value').eq('key', key).single();
    if (error || !data) return false;
    localStorage.setItem(key, JSON.stringify(data.value));
    return true;
  } catch {
    return false;
  }
}

/** 一次從 Supabase 覆蓋所有 SYNC_KEYS（頁面載入時使用） */
export async function syncAllFromCloud(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('app_storage').select('key, value');
    if (error || !data?.length) return;
    for (const row of data) {
      if (SYNC_KEYS.includes(row.key as SyncKey)) {
        localStorage.setItem(row.key, JSON.stringify(row.value));
      }
    }
  } catch {}
}

/**
 * 從 Supabase 拉回資料，合併策略：
 * - 若 localStorage 該 key 是空的 → 用雲端資料補上
 * - 若 localStorage 有資料 → 保留本機（本機永遠比雲端新）
 */
export async function pullFromCloud(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.from('app_storage').select('key, value');
    if (error || !data?.length) return false;
    let filled = 0;
    for (const row of data) {
      if (!SYNC_KEYS.includes(row.key as SyncKey)) continue;
      const existing = localStorage.getItem(row.key);
      // 只有在本機完全沒有資料時才從雲端補
      if (!existing || existing === '[]' || existing === '{}' || existing === 'null') {
        localStorage.setItem(row.key, JSON.stringify(row.value));
        filled++;
      }
    }
    return filled > 0;
  } catch {
    return false;
  }
}
