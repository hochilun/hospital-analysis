'use client';

import { Hospital, Department } from '@/types';
import { DAY_LABELS } from '@/data/hospitals';

type Props = {
  hospital: Hospital;
  selectedDept: Department;
  onUpdate: () => void;
  updating: boolean;
};

export default function HospitalCard({ hospital, selectedDept, onUpdate, updating }: Props) {
  const deptClinics = hospital.clinics.filter(c => c.department === selectedDept);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{hospital.name}</h3>
          {hospital.lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              更新：{new Date(hospital.lastUpdated).toLocaleDateString('zh-TW')}
            </p>
          )}
        </div>
        <button
          onClick={onUpdate}
          disabled={updating}
          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
        >
          {updating ? '更新中...' : '更新'}
        </button>
      </div>

      {deptClinics.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">尚無 {selectedDept} 門診資料</p>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-2">{selectedDept} · {deptClinics.length} 個診次</p>
          <div className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map((label, day) => {
              const slots = deptClinics.filter(c => c.dayOfWeek === day);
              return (
                <div key={day} className="text-center">
                  <div className="text-xs text-gray-400 mb-1">週{label}</div>
                  <div className={`h-6 rounded text-xs flex items-center justify-center font-medium ${
                    slots.length > 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300'
                  }`}>
                    {slots.length > 0 ? slots.length : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hospital.news.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">最新動態</p>
          {hospital.news.slice(0, 2).map((n, i) => (
            <p key={i} className="text-xs text-gray-600 truncate">{n.title}</p>
          ))}
        </div>
      )}
    </div>
  );
}
