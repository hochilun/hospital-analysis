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
] as const;

export type SyncKey = typeof SYNC_KEYS[number];

/** 單筆寫入 Supabase（靜默失敗，不影響 UI） */
export async function pushToCloud(key: SyncKey, value: unknown) {
  if (!supabase) return;
  try {
    await supabase.from('app_storage').upsert({ key, value, updated_at: new Date().toISOString() });
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
