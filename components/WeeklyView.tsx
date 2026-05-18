'use client';

import { useState, useEffect } from 'react';
import { Hospital, Department } from '@/types';
import { DAY_LABELS, SESSION_LABELS, TARGET_DEPARTMENTS, DEPT_LABEL } from '@/data/hospitals';
import { pushToCloud } from '@/lib/supabase';

type Props = {
  hospitals: Hospital[];
  selectedDepts: Set<Department>;
};

const DEPT_COLOR: Record<string, string> = {
  GYN: 'bg-pink-100 text-pink-800 border-pink-200',
  GU:  'bg-blue-100 text-blue-800 border-blue-200',
  GS:  'bg-green-100 text-green-800 border-green-200',
  ENT: 'bg-orange-100 text-orange-800 border-orange-200',
};

const DEPT_DOT: Record<string, string> = {
  GYN: 'bg-pink-400',
  GU:  'bg-blue-400',
  GS:  'bg-green-400',
  ENT: 'bg-orange-400',
};

function starKey(hospitalId: string, doctor: string) {
  return `${hospitalId}:${doctor}`;
}

function loadStarred(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('weekly-starred');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveStarred(set: Set<string>) {
  const arr = [...set];
  localStorage.setItem('weekly-starred', JSON.stringify(arr));
  pushToCloud('weekly-starred', arr);
}

export default function WeeklyView({ hospitals, selectedDepts }: Props) {
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [starOnly, setStarOnly] = useState(false);
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());

  const toggleSession = (session: string) => {
    setCollapsedSessions(prev => {
      const next = new Set(prev);
      next.has(session) ? next.delete(session) : next.add(session);
      return next;
    });
  };

  useEffect(() => { setStarred(loadStarred()); }, []);

  const toggleStar = (hospitalId: string, doctor: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      const key = starKey(hospitalId, doctor);
      next.has(key) ? next.delete(key) : next.add(key);
      saveStarred(next);
      return next;
    });
  };

  const getStarredByHospital = (day: number) => {
    const map = new Map<string, Set<string>>();
    hospitals.forEach(h => {
      h.clinics.forEach(c => {
        if (c.dayOfWeek !== day || !selectedDepts.has(c.department)) return;
        const key = starKey(h.id, c.doctor);
        if (!starred.has(key)) return;
        if (!map.has(h.shortName)) map.set(h.shortName, new Set());
        map.get(h.shortName)!.add(c.doctor);
      });
    });
    return [...map.entries()]
      .map(([shortName, docs]) => ({ shortName, count: docs.size }))
      .sort((a, b) => b.count - a.count);
  };

  const getSlots = (day: number, session: string) => {
    const result: { hospital: Hospital; doctor: string; department: Department; absent?: boolean }[] = [];
    hospitals.forEach(h => {
      h.clinics
        .filter(c => {
          if (c.dayOfWeek !== day || c.session !== session || !selectedDepts.has(c.department)) return false;
          if (starOnly && !starred.has(starKey(h.id, c.doctor))) return false;
          return true;
        })
        .forEach(c => {
          const absent = h.weeklyAbsences?.some(a => a.doctor === c.doctor && a.dayOfWeek === day && a.session === session) ?? false;
          result.push({ hospital: h, doctor: c.doctor, department: c.department, absent });
        });
    });
    return result;
  };

  const hasAnyData = hospitals.some(h => h.clinics.length > 0);
  const showDeptLabel = selectedDepts.size > 1;

  if (!hasAnyData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
        <p className="text-4xl mb-4">🏥</p>
        <p className="text-lg font-medium text-gray-700 mb-2">還沒有門診資料</p>
        <p className="text-sm text-gray-400">點右上角「全部更新」從各醫院網站抓取門診時間表</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 重點客戶門診分佈 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">重點客戶門診分佈 ★</h2>
          <button
            onClick={() => setStarOnly(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-colors ${
              starOnly
                ? 'bg-yellow-400 border-yellow-400 text-white font-semibold'
                : 'bg-white border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-500'
            }`}
          >
            ★ {starOnly ? '僅顯示星號' : '全部顯示'}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, day) => {
            const breakdown = getStarredByHospital(day);
            const isWeekend = day === 0 || day === 6;
            const total = breakdown.reduce((s, h) => s + h.count, 0);
            return (
              <div
                key={day}
                className={`rounded-lg p-3 min-h-[72px] ${
                  isWeekend ? 'bg-gray-50' :
                  total > 0 ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50'
                }`}
              >
                <div className={`text-xs font-medium mb-2 ${isWeekend ? 'text-gray-300' : 'text-gray-500'}`}>
                  週{label}
                </div>
                {isWeekend ? (
                  <div className="text-gray-300 text-sm text-center">-</div>
                ) : breakdown.length === 0 ? (
                  <div className="text-gray-300 text-xs">-</div>
                ) : (
                  <div className="space-y-1">
                    {breakdown.map(({ shortName, count }) => (
                      <div key={shortName} className="flex items-center justify-between gap-1">
                        <span className="text-xs text-gray-600 truncate">{shortName}</span>
                        <span className="text-xs font-bold text-yellow-600 shrink-0">{count}位</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 週曆詳細 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-12 py-3 px-3 text-left text-xs text-gray-500">時段</th>
              {DAY_LABELS.map((label, i) => (
                <th key={i} className={`py-3 px-2 text-center text-xs font-medium ${i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-600'}`}>
                  週{label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SESSION_LABELS.map(session => {
              const collapsed = collapsedSessions.has(session);
              return (
              <tr key={session} className="border-b-2 border-gray-200 last:border-0">
                <td
                  className="py-3 px-3 bg-gray-50 align-top cursor-pointer select-none group"
                  onClick={() => toggleSession(session)}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-500">{session}診</span>
                    <span className={`text-[10px] text-gray-400 transition-transform ${collapsed ? 'rotate-0' : 'rotate-180'}`}>▲</span>
                  </div>
                </td>
                {collapsed ? (
                  <td colSpan={DAY_LABELS.length} className="py-2 px-3 text-xs text-gray-300 bg-gray-50/50">
                    已收起
                  </td>
                ) : DAY_LABELS.map((_, day) => {
                  const slots = getSlots(day, session);
                  return (
                    <td key={day} className="py-2 px-1 align-top min-w-[80px]">
                      <div className="space-y-1">
                        {slots.map((s, i) => {
                          const key = starKey(s.hospital.id, s.doctor);
                          const isStarred = starred.has(key);
                          return (
                            <div
                              key={i}
                              className={`text-xs px-2 py-1 rounded border ${s.absent ? 'bg-gray-50 border-gray-200 opacity-60' : DEPT_COLOR[s.department]}`}
                            >
                              <div className="font-medium flex items-center gap-1">
                                {s.hospital.shortName}
                                {s.absent && <span className="text-[10px] bg-gray-200 text-gray-500 px-1 rounded">停診</span>}
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className={s.absent ? 'line-through text-gray-400' : ''}>{s.doctor}</span>
                                <button
                                  onClick={e => toggleStar(s.hospital.id, s.doctor, e)}
                                  className={`shrink-0 text-[11px] leading-none transition-colors ${
                                    isStarred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                                  }`}
                                  title={isStarred ? '取消星號' : '標記星號'}
                                >
                                  ★
                                </button>
                              </div>
                              {showDeptLabel && (
                                <div className="opacity-60 text-[10px]">{s.department}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
