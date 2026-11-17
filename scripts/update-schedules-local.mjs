// 在 Mars 的 Mac 上排程執行（launchd：com.mars.crm-schedule），每天更新只能從台灣網路抓的醫院門診。
// 北醫、北慈的掛號網站擋國外 IP，Vercel（美國、香港機房都試過）抓回來都是空的，CRM 上按「更新」會失敗，
// 所以改由本機抓完直接寫進 Supabase 的 hospitals-data（只換這幾家的 clinics，其他醫院不動）。
// 網站跟 CRM 都以雲端為準、依醫院 id 合併，開著的網頁下次載入就會拿到新資料。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createJiti } from 'jiti';

const HOSPITALS = ['tzuchi', 'tmuh'];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env.local'), 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)).filter(Boolean).map(m => [m[1], m[2]])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const jiti = createJiti(import.meta.url, { alias: { '@': root } });
const { parseHospital } = await jiti.import(join(root, 'app/api/fetch-schedule/parsers.ts'));

const results = {};
for (const id of HOSPITALS) {
  const r = await parseHospital(id);
  // 0 筆＝網站擋連線或改版，不是真的沒門診 → 跳過，保留原資料
  if (r.error || !r.clinics.length) { console.log(`${id}: 抓不到（${r.error ?? '0 筆'}），保留原資料`); continue; }
  results[id] = r.clinics;
}
if (!Object.keys(results).length) process.exit(1);

const res = await fetch(`${URL_}/rest/v1/app_storage?key=eq.hospitals-data&select=value`, { headers });
const [row] = await res.json();
const hospitals = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
const now = new Date().toISOString();
for (const h of hospitals) {
  if (!results[h.id]) continue;
  console.log(`${h.id}: ${h.clinics.length} → ${results[h.id].length} 個時段`);
  h.clinics = results[h.id];
  h.lastUpdated = now;
  delete h.weeklyAbsences;
}
const up = await fetch(`${URL_}/rest/v1/app_storage`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ key: 'hospitals-data', value: hospitals, updated_at: now }),
});
console.log(`${now} 寫入 Supabase：${up.status}`);
if (!up.ok) process.exit(1);
