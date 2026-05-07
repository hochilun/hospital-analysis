'use client';

import { useState, useEffect } from 'react';
import { Hospital, Department } from '@/types';
import { HOSPITALS, TARGET_DEPARTMENTS } from '@/data/hospitals';
import HospitalCard from '@/components/HospitalCard';
import WeeklyView from '@/components/WeeklyView';
import PersonalCalendar from '@/components/PersonalCalendar';

export default function Home() {
  const [hospitals, setHospitals] = useState<Hospital[]>(HOSPITALS);
  const [selectedDepts, setSelectedDepts] = useState<Set<Department>>(new Set(TARGET_DEPARTMENTS));
  const [selectedHospitals, setSelectedHospitals] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'hospitals' | 'weekly'>('weekly');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hospitals-data');
    if (saved) {
      try { setHospitals(JSON.parse(saved)); } catch {}
    }
  }, []);

  const saveHospitals = (data: Hospital[]) => {
    setHospitals(data);
    localStorage.setItem('hospitals-data', JSON.stringify(data));
  };

  const toggleDept = (dept: Department) => {
    setSelectedDepts(prev => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next.size === 0 ? new Set(TARGET_DEPARTMENTS) : next;
    });
  };

  const toggleHospital = (shortName: string) => {
    setSelectedHospitals(prev => {
      const next = new Set(prev);
      next.has(shortName) ? next.delete(shortName) : next.add(shortName);
      return next;
    });
  };

  const filteredHospitals = selectedHospitals.size === 0
    ? hospitals
    : hospitals.filter(h => selectedHospitals.has(h.shortName));

  const handleUpdate = async (hospitalId: string) => {
    setUpdating(hospitalId);
    try {
      const res = await fetch('/api/fetch-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = hospitals.map(h =>
          h.id === hospitalId
            ? { ...h, clinics: data.clinics, news: data.news, lastUpdated: new Date().toISOString() }
            : h
        );
        saveHospitals(updated);
      } else {
        alert(`更新失敗：${data.error}`);
      }
    } catch {
      alert('更新失敗，請稍後再試');
    }
    setUpdating(null);
  };

  const handleUpdateAll = async () => {
    for (const h of hospitals) await handleUpdate(h.id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">醫院分析表</h1>
            <p className="text-sm text-gray-500">門診分佈 · 行程規劃</p>
          </div>
          <button
            onClick={handleUpdateAll}
            disabled={!!updating}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updating ? '更新中...' : '全部更新'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* 科別複選 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-gray-500 w-10">科別</span>
          {TARGET_DEPARTMENTS.map(dept => (
            <button
              key={dept}
              onClick={() => toggleDept(dept as Department)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedDepts.has(dept as Department)
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-400 hover:border-blue-300'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* 醫院複選 */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm text-gray-500 w-10">醫院</span>
          {hospitals.map(h => (
            <button
              key={h.id}
              onClick={() => toggleHospital(h.shortName)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedHospitals.has(h.shortName)
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-400'
              }`}
            >
              {h.shortName}
            </button>
          ))}
          {selectedHospitals.size > 0 && (
            <button
              onClick={() => setSelectedHospitals(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
            >
              清除
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setView('weekly')}
              className={`px-3 py-1.5 rounded-lg text-sm ${view === 'weekly' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              週曆
            </button>
            <button
              onClick={() => setView('hospitals')}
              className={`px-3 py-1.5 rounded-lg text-sm ${view === 'hospitals' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              醫院列表
            </button>
          </div>
        </div>

        {view === 'weekly' ? (
          <div className="space-y-6">
            <WeeklyView hospitals={filteredHospitals} selectedDepts={selectedDepts} />
            <PersonalCalendar />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitals.map(hospital => (
              <HospitalCard
                key={hospital.id}
                hospital={hospital}
                selectedDept={selectedDepts.size > 0 ? Array.from(selectedDepts)[0] : '婦產科'}
                onUpdate={() => handleUpdate(hospital.id)}
                updating={updating === hospital.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
