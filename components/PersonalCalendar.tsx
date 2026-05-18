'use client';

import { useState, useEffect, useRef } from 'react';
import { pushToCloud } from '@/lib/supabase';

const DAYS = ['一', '二', '三', '四', '五', '六', '日'];
const SLOTS = ['早', '下午', '晚', '活動'] as const;
type Slot = typeof SLOTS[number];

type CalendarData = Record<number, Record<Slot, string>>;

const SLOT_COLOR: Record<Slot, string> = {
  '早':  'bg-amber-50 border-amber-200',
  '下午': 'bg-sky-50 border-sky-200',
  '晚':  'bg-indigo-50 border-indigo-200',
  '活動': 'bg-emerald-50 border-emerald-200',
};

const SLOT_LABEL_COLOR: Record<Slot, string> = {
  '早':  'text-amber-600',
  '下午': 'text-sky-600',
  '晚':  'text-indigo-600',
  '活動': 'text-emerald-600',
};

function emptyWeek(): CalendarData {
  const w: CalendarData = {};
  for (let d = 0; d < 7; d++) {
    w[d] = { '早': '', '下午': '', '晚': '', '活動': '' };
  }
  return w;
}

type EditingCell = { day: number; slot: Slot } | null;

export default function PersonalCalendar() {
  const [data, setData] = useState<CalendarData>(emptyWeek);
  const [editing, setEditing] = useState<EditingCell>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem('personal-calendar');
      if (saved) {
        try { setData(JSON.parse(saved)); } catch {}
      }
    };
    load();
    window.addEventListener('cloud-synced', load);
    return () => window.removeEventListener('cloud-synced', load);
  }, []);

  const save = (next: CalendarData) => {
    setData(next);
    localStorage.setItem('personal-calendar', JSON.stringify(next));
    pushToCloud('personal-calendar', next);
  };

  const startEdit = (day: number, slot: Slot) => {
    setEditing({ day, slot });
    setDraft(data[day][slot]);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commitEdit = () => {
    if (!editing) return;
    const next = { ...data, [editing.day]: { ...data[editing.day], [editing.slot]: draft } };
    save(next);
    setEditing(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditing(null);
  };

  const clearAll = () => {
    if (confirm('確定清空本週行程？')) save(emptyWeek());
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">我的行程規劃</h2>
        <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-400 transition-colors">
          清空
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="w-14 py-2 px-3 text-left text-xs text-gray-400">時段</th>
              {DAYS.map((d, i) => (
                <th key={i} className={`py-2 px-2 text-center text-xs font-medium ${i >= 5 ? 'text-rose-400' : 'text-gray-600'}`}>
                  週{d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map(slot => (
              <tr key={slot} className="border-b border-gray-50 last:border-0">
                <td className={`py-2 px-3 text-xs font-semibold ${SLOT_LABEL_COLOR[slot]}`}>
                  {slot}
                </td>
                {DAYS.map((_, day) => {
                  const isEditing = editing?.day === day && editing?.slot === slot;
                  const value = data[day]?.[slot] ?? '';
                  return (
                    <td
                      key={day}
                      className={`py-1 px-1 align-top h-14 ${day >= 5 ? 'bg-rose-50/30' : ''}`}
                    >
                      {isEditing ? (
                        <textarea
                          ref={inputRef}
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          className={`w-full h-12 text-xs p-1.5 rounded border resize-none outline-none focus:ring-1 focus:ring-blue-400 ${SLOT_COLOR[slot]}`}
                          placeholder="輸入行程..."
                        />
                      ) : (
                        <div
                          onClick={() => startEdit(day, slot)}
                          className={`w-full h-12 text-xs p-1.5 rounded border cursor-pointer hover:opacity-80 transition-opacity whitespace-pre-wrap ${
                            value ? SLOT_COLOR[slot] : 'border-transparent hover:border-gray-200'
                          }`}
                        >
                          {value || <span className="text-gray-300 text-[10px]">點擊輸入</span>}
                        </div>
                      )}
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
