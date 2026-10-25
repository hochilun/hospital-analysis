'use client';

// 需跟進客戶：上方「本週優先」少數幾位（寫明醫院、下次門診），其餘依醫院收折；
// 長期嚴重逾期（≥3 倍目標）另列，可一鍵把頻率調低到實際跑得到的範圍。
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Doctor, VisitRecord } from '@/types';
import { visitStatus, freqLabel, VISIT_FREQ_OPTIONS } from '@/lib/visitFrequency';
import { getHospitalsData, saveDoctor } from '@/lib/storage';
import { HOSPITALS, DEPT_LABEL } from '@/data/hospitals';

const PRIORITY_N = 8;
const SEVERE_RATIO = 3;
// 等級權重：S/A 主力、B 分用（有成長空間）、C 待開發、D 暫不觸碰
const GRADE_W: Record<string, number> = { S: 3, A: 2.5, B: 2, C: 1.2, D: 0.5, X: 1, Y: 1, '': 1 };
const GRADE_BADGE: Record<string, string> = {
  S: 'bg-amber-100 text-amber-800', A: 'bg-green-100 text-green-700', B: 'bg-blue-100 text-blue-700',
  C: 'bg-gray-100 text-gray-500', D: 'bg-red-50 text-red-400', X: 'bg-violet-100 text-violet-700', Y: 'bg-slate-100 text-slate-500',
};
const DAY = ['日', '一', '二', '三', '四', '五', '六'];
const SESSION_ORDER = { 早: 0, 午: 1, 晚: 2 } as const;
const SESSION_END_HOUR = { 早: 12, 午: 17, 晚: 21 } as const;

type Slot = { dayOfWeek: number; session: '早' | '午' | '晚'; where?: string };
type Item = {
  d: Doctor; hospId: string; hospName: string;
  daysSince: number | null; never: boolean; ratio: number; score: number;
  next: string | null;
};

/** 從現在起最近的一個門診（7 天內），回傳「今天午／明天早／週三午」 */
function nextClinic(slots: Slot[], now: Date): string | null {
  if (!slots.length) return null;
  for (let add = 0; add < 7; add++) {
    const day = (now.getDay() + add) % 7;
    const today = slots
      .filter(s => s.dayOfWeek === day && (add > 0 || now.getHours() < SESSION_END_HOUR[s.session]))
      .sort((a, b) => SESSION_ORDER[a.session] - SESSION_ORDER[b.session]);
    if (today.length) {
      const s = today[0];
      const when = add === 0 ? '今天' : add === 1 ? '明天' : `週${DAY[day]}`;
      return `${when}${s.session}${s.where ? `（${s.where}）` : ''}`;
    }
  }
  return null;
}

/** 頻率調低一級（每週→每兩週→每月→每季） */
function lowerFreq(days: number): number | null {
  const opts = VISIT_FREQ_OPTIONS.map(o => o.days).filter(d => d > 0).sort((a, b) => a - b);
  return opts.find(d => d > days) ?? null;
}

export default function FollowUpPanel({ doctors, lastVisitMap, onChanged }: {
  doctors: Doctor[]; lastVisitMap: Record<string, VisitRecord>; onChanged: () => void;
}) {
  const [openHosp, setOpenHosp] = useState<string | null>(null);
  const [showSevere, setShowSevere] = useState(false);

  const items = useMemo<Item[]>(() => {
    const now = new Date();
    const slotsByName: Record<string, Slot[]> = {};
    for (const h of getHospitalsData()) for (const c of h.clinics) (slotsByName[c.doctor] ??= []).push({ dayOfWeek: c.dayOfWeek, session: c.session });
    const hospName = Object.fromEntries(HOSPITALS.map(h => [h.id, h.shortName]));
    return doctors.flatMap(d => {
      const st = visitStatus(d.visitFrequencyDays, lastVisitMap[d.id]?.date, now);
      if (st.state !== 'overdue' && st.state !== 'never') return [];
      const never = st.state === 'never';
      const ratio = never ? 2 : (st.daysSince ?? 0) / st.freqDays;
      const hospId = (d.hospitalIds?.[0] ?? d.hospitalId) || '';
      const slots: Slot[] = [
        ...(slotsByName[d.name] ?? []),
        ...(d.extraClinicSlots ?? []).map(s => ({ dayOfWeek: s.dayOfWeek, session: s.session, where: s.location })),
      ];
      return [{
        d, hospId, hospName: hospName[hospId] ?? d.hospitalName ?? '其他',
        daysSince: st.daysSince, never, ratio,
        // 倍數封頂 3：超過 3 倍的多半是頻率設太密（另列檢視），不該壓過客戶等級
        score: Math.min(ratio, 3) * (GRADE_W[d.grade ?? ''] ?? 1),
        next: nextClinic(slots, now),
      }];
    });
  }, [doctors, lastVisitMap]);

  if (!items.length) return null;

  const priority = [...items].filter(i => i.d.grade !== 'D').sort((a, b) => b.score - a.score).slice(0, PRIORITY_N);
  const pIds = new Set(priority.map(i => i.d.id));
  const rest = items.filter(i => !pIds.has(i.d.id));
  const order = HOSPITALS.map(h => h.id);
  const groups = Object.values(rest.reduce<Record<string, { id: string; name: string; list: Item[] }>>((acc, i) => {
    (acc[i.hospId] ??= { id: i.hospId, name: i.hospName, list: [] }).list.push(i);
    return acc;
  }, {}))
    .map(g => ({ ...g, list: g.list.sort((a, b) => b.score - a.score) }))
    .sort((a, b) => (order.indexOf(a.id) + 99) % 99 - (order.indexOf(b.id) + 99) % 99);
  const severe = items.filter(i => !i.never && i.ratio >= SEVERE_RATIO && lowerFreq(i.d.visitFrequencyDays ?? 0) !== null)
    .sort((a, b) => b.ratio - a.ratio);

  const adjust = (i: Item) => {
    const nf = lowerFreq(i.d.visitFrequencyDays ?? 0);
    if (!nf) return;
    saveDoctor({ ...i.d, visitFrequencyDays: nf });
    onChanged();
  };

  const ago = (i: Item) => i.never ? '從未拜訪' : `上次 ${i.daysSince} 天前`;
  const ratioCls = (r: number) => r >= SEVERE_RATIO ? 'text-red-600' : 'text-amber-700';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* 本週優先 */}
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          🎯 本週優先拜訪
          <span className="text-xs font-normal text-gray-400">逾期倍數 × 客戶等級，前 {priority.length} 位</span>
        </h2>
        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {priority.map(i => (
            <Link key={i.d.id} href={`/customers/${i.d.id}`}
              className="block border border-gray-200 rounded-lg px-3 py-2.5 hover:border-gray-400 transition-colors">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900">{i.d.name}</span>
                {i.d.grade && <span className={`text-[10px] font-bold px-1.5 rounded ${GRADE_BADGE[i.d.grade] ?? ''}`}>{i.d.grade}</span>}
                <span className="text-[11px] text-gray-400 truncate">{DEPT_LABEL[i.d.department] ?? i.d.department}・{i.hospName}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                目標{freqLabel(i.d.visitFrequencyDays)}・{ago(i)}
                {!i.never && <span className={`ml-1 font-semibold ${ratioCls(i.ratio)}`}>{i.ratio.toFixed(1)}×</span>}
              </p>
              <p className={`text-xs mt-1 ${i.next ? 'text-blue-700' : 'text-gray-300'}`}>
                ▸ {i.next ? `下次門診：${i.next}` : '7 天內無門診資料'}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* 其他依醫院 */}
      {groups.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-500 mb-2">其他逾期 {rest.length} 位（點醫院展開，排該院行程時用）</p>
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <button key={g.id} onClick={() => setOpenHosp(openHosp === g.id ? null : g.id)}
                className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                  openHosp === g.id ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}>
                {g.name} <span className={openHosp === g.id ? 'text-gray-300' : 'text-gray-400'}>{g.list.length}</span>
              </button>
            ))}
          </div>
          {openHosp && (
            <div className="mt-3 flex flex-wrap gap-2">
              {groups.find(g => g.id === openHosp)?.list.map(i => (
                <Link key={i.d.id} href={`/customers/${i.d.id}`}
                  className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400">
                  <span className="text-sm font-medium text-gray-800">{i.d.name}</span>
                  {i.d.grade && <span className={`text-[10px] font-bold px-1 rounded ${GRADE_BADGE[i.d.grade] ?? ''}`}>{i.d.grade}</span>}
                  <span className="text-[11px] text-gray-400">{DEPT_LABEL[i.d.department] ?? i.d.department}</span>
                  <span className={`text-xs font-semibold ${i.never ? 'text-gray-500' : ratioCls(i.ratio)}`}>
                    {i.never ? '從未拜訪' : `${i.ratio.toFixed(1)}×`}
                  </span>
                  {i.next && <span className="text-[11px] text-blue-600">{i.next}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 頻率檢視 */}
      {severe.length > 0 && (
        <div className="border-t border-gray-100 bg-amber-50/50 px-5 py-3">
          <button onClick={() => setShowSevere(v => !v)} className="text-xs text-amber-800 font-medium">
            ⚠ {severe.length} 位逾期超過目標 {SEVERE_RATIO} 倍 —— 頻率可能設得太密，提醒才會變噪音 {showSevere ? '▲' : '▼ 檢視'}
          </button>
          {showSevere && (
            <div className="mt-2 divide-y divide-amber-100">
              {severe.map(i => {
                const nf = lowerFreq(i.d.visitFrequencyDays ?? 0)!;
                return (
                  <div key={i.d.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-800">
                      {i.d.name}
                      <span className="ml-2 text-xs text-gray-400">{i.hospName}・目標{freqLabel(i.d.visitFrequencyDays)}・{ago(i)}</span>
                      <span className="ml-1 text-xs font-semibold text-red-600">{i.ratio.toFixed(1)}×</span>
                    </span>
                    <button onClick={() => adjust(i)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 whitespace-nowrap">
                      改成{freqLabel(nf)}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
