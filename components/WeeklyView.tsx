'use client';

import { Hospital, Department } from '@/types';
import { DAY_LABELS, SESSION_LABELS, TARGET_DEPARTMENTS } from '@/data/hospitals';

type Props = {
  hospitals: Hospital[];
  selectedDepts: Set<Department>;
};

const DEPT_COLOR: Record<string, string> = {
  '婦產科': 'bg-pink-100 text-pink-800 border-pink-200',
  '泌尿外科': 'bg-blue-100 text-blue-800 border-blue-200',
  '一般外科': 'bg-green-100 text-green-800 border-green-200',
};

const DEPT_DOT: Record<string, string> = {
  '婦產科': 'bg-pink-400',
  '泌尿外科': 'bg-blue-400',
  '一般外科': 'bg-green-400',
};

export default function WeeklyView({ hospitals, selectedDepts }: Props) {
  const getDayCount = (day: number) =>
    hospitals.filter(h =>
      h.clinics.some(c => c.dayOfWeek === day && selectedDepts.has(c.department))
    ).length;

  const getSlots = (day: number, session: string) => {
    const result: { hospital: Hospital; doctor: string; department: Department }[] = [];
    hospitals.forEach(h => {
      h.clinics
        .filter(c => c.dayOfWeek === day && c.session === session && selectedDepts.has(c.department))
        .forEach(c => result.push({ hospital: h, doctor: c.doctor, department: c.department }));
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
      {/* 推薦拜訪日 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">本週推薦拜訪日</h2>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {TARGET_DEPARTMENTS.filter(d => selectedDepts.has(d as Department)).map(d => (
              <span key={d} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full inline-block ${DEPT_DOT[d]}`} />
                {d}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, day) => {
            const count = getDayCount(day);
            const isWeekend = day === 0 || day === 6;
            return (
              <div
                key={day}
                className={`rounded-lg p-3 text-center ${
                  isWeekend ? 'bg-gray-50' :
                  count >= 3 ? 'bg-blue-600 text-white' :
                  count >= 2 ? 'bg-blue-100' :
                  count >= 1 ? 'bg-blue-50' : 'bg-gray-50'
                }`}
              >
                <div className={`text-xs font-medium ${isWeekend ? 'text-gray-400' : count >= 3 ? 'text-white' : 'text-gray-500'}`}>
                  週{label}
                </div>
                <div className={`text-lg font-bold mt-1 ${isWeekend ? 'text-gray-300' : count >= 3 ? 'text-white' : 'text-blue-600'}`}>
                  {isWeekend ? '-' : count}
                </div>
                {!isWeekend && count > 0 && (
                  <div className={`text-xs mt-0.5 ${count >= 3 ? 'text-blue-100' : 'text-gray-400'}`}>間</div>
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
            {SESSION_LABELS.map(session => (
              <tr key={session} className="border-b border-gray-100 last:border-0">
                <td className="py-3 px-3 text-xs font-medium text-gray-400">{session}診</td>
                {DAY_LABELS.map((_, day) => {
                  const slots = getSlots(day, session);
                  return (
                    <td key={day} className="py-2 px-1 align-top min-w-[80px]">
                      <div className="space-y-1">
                        {slots.map((s, i) => (
                          <div
                            key={i}
                            className={`text-xs px-2 py-1 rounded border ${DEPT_COLOR[s.department]}`}
                          >
                            <div className="font-medium">{s.hospital.shortName}</div>
                            <div>{s.doctor}</div>
                            {showDeptLabel && (
                              <div className="opacity-60 text-[10px]">{s.department}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
