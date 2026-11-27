'use client';

// 拜訪洞察：拜訪紀錄 × 醫師業績，挑出該採取行動的客戶（計算見 lib/visitInsights.ts）
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Doctor, VisitRecord } from '@/types';
import { MY_PERFORMANCE } from '@/data/myPerformance';
import { DEPT_LABEL } from '@/data/hospitals';
import { loadClaims } from '@/lib/perfCore';
import { saveDoctor } from '@/lib/storage';
import { syncAllFromCloud } from '@/lib/supabase';
import { strategyOf } from '@/lib/strategy';
import { buildInsightInput, computeInsights, type Insight, type InsightKind } from '@/lib/visitInsights';

const SHOW_N = 4;

const KINDS: { key: InsightKind; emoji: string; title: string; hint: string; cls: string }[] = [
  { key: 'care',    emoji: '💛', title: '該去關心', hint: '持續有業績，拜訪沒跟上',       cls: 'border-amber-200 bg-amber-50/60' },
  { key: 'decline', emoji: '📉', title: '用量下滑', hint: '還在用，但量比之前少一半以上', cls: 'border-orange-200 bg-orange-50/60' },
  { key: 'lapsed',  emoji: '💤', title: '很久沒用', hint: '之前有業績，連續兩個月沒有',   cls: 'border-sky-200 bg-sky-50/60' },
  { key: 'stop',    emoji: '🛑', title: '考慮停損', hint: '半年拜訪 6 次以上，幾乎沒業績', cls: 'border-gray-200 bg-gray-50' },
];

export default function VisitInsightsPanel({ doctors, visits, onChanged }: {
  doctors: Doctor[]; visits: VisitRecord[]; onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<InsightKind>>(new Set());
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState(() => new Date());

  // 每次載入頁面、或拜訪紀錄／醫師資料變動都會重算；按鈕是給「別處（手機、Elon）剛記了拜訪」時，不用整頁重整就拉雲端最新
  const refresh = async () => {
    setBusy(true);
    await syncAllFromCloud();
    onChanged();
    setAt(new Date());
    setBusy(false);
  };

  // 每位醫師最近一次拜訪的內容（近況）
  const lastNote = useMemo(() => {
    const m: Record<string, VisitRecord> = {};
    for (const v of visits) if (v.content?.trim() && (!m[v.doctorId] || v.date > m[v.doctorId].date)) m[v.doctorId] = v;
    return m;
  }, [visits]);

  const byKind = useMemo(() => {
    const input = buildInsightInput(MY_PERFORMANCE, loadClaims(), doctors);
    const all = computeInsights(doctors, visits, input);
    const g: Record<InsightKind, Insight[]> = { care: [], decline: [], lapsed: [], stop: [] };
    for (const i of all) g[i.kind].push(i);
    // 14 天內拜訪過的排到後面（已經在處理）
    for (const k of Object.keys(g) as InsightKind[]) g[k].sort((a, b) => Number(a.visitedRecently) - Number(b.visitedRecently));
    return g;
  }, [doctors, visits]);

  const pause = (d: Doctor) => {
    if (!confirm(`把「${d.name}」設為停損？之後不會再排進優先拜訪。`)) return;
    saveDoctor({ ...d, strategy: 'paused' });
    onChanged();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">🔎 拜訪洞察</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 hidden sm:inline">拜訪紀錄 × 醫師業績，月為單位；當月醫師歸屬未填完的不算「沒業績」</span>
          <span className="text-[11px] text-gray-400">依 {visits.length} 筆拜訪・{String(at.getHours()).padStart(2, '0')}:{String(at.getMinutes()).padStart(2, '0')} 更新</span>
          <button onClick={refresh} disabled={busy}
            className="text-xs px-2 py-0.5 border border-gray-200 rounded-md text-gray-600 hover:border-gray-400 disabled:opacity-50">
            {busy ? '更新中…' : '↻ 更新'}
          </button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {KINDS.map(k => {
          const list = byKind[k.key];
          const open = expanded.has(k.key);
          return (
            <div key={k.key} className={`rounded-lg border p-3 ${k.cls}`}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-800">{k.emoji} {k.title}</span>
                <span className="text-xs font-bold text-gray-700">{list.length}</span>
                <span className="text-[11px] text-gray-400 truncate">{k.hint}</span>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">目前沒有</p>
              ) : (
                <ul className="space-y-1.5">
                  {(open ? list : list.slice(0, SHOW_N)).map(i => (
                    <li key={i.doctor.id} className={`bg-white rounded-md border border-gray-100 px-2.5 py-1.5 ${i.visitedRecently ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/customers/${i.doctor.id}`} className="text-sm font-semibold text-gray-900 hover:underline">{i.doctor.name}</Link>
                        {strategyOf(i.doctor.strategy) && <span className={`text-[10px] px-1 rounded ${strategyOf(i.doctor.strategy)!.cls}`}>{strategyOf(i.doctor.strategy)!.emoji}</span>}
                        <span className="text-[11px] text-gray-400 truncate">{DEPT_LABEL[i.doctor.department] ?? i.doctor.department}・{i.doctor.hospitalName}</span>
                        {i.visitedRecently && <span className="text-[10px] text-emerald-700 shrink-0">✓ {i.lastVisit!.slice(5).replace('-', '/')} 已拜訪</span>}
                        {k.key === 'stop' && (
                          <button onClick={() => pause(i.doctor)}
                            className="ml-auto shrink-0 text-[11px] text-gray-500 border border-gray-200 rounded px-1.5 hover:border-gray-500 hover:text-gray-800">
                            設為停損
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{i.reason}</p>
                      {lastNote[i.doctor.id] && (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1" title={lastNote[i.doctor.id].content}>
                          💬 {lastNote[i.doctor.id].date.slice(5).replace('-', '/')}：{lastNote[i.doctor.id].content}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {list.length > SHOW_N && (
                <button onClick={() => setExpanded(s => { const n = new Set(s); n.has(k.key) ? n.delete(k.key) : n.add(k.key); return n; })}
                  className="mt-2 text-xs text-blue-600 hover:underline">
                  {open ? '收起' : `顯示全部 ${list.length} 位`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
