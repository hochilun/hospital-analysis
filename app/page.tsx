'use client';

import { useState, useEffect } from 'react';
import { Hospital, Department } from '@/types';
import { HOSPITALS, TARGET_DEPARTMENTS } from '@/data/hospitals';
import HospitalCard from '@/components/HospitalCard';
import WeeklyView from '@/components/WeeklyView';

type DeptFilter = Department | '全部';

export default function Home() {
  const [hospitals, setHospitals] = useState<Hospital[]>(HOSPITALS);
  const [selectedDept, setSelectedDept] = useState<DeptFilter>('全部');
  const [selectedHospital, setSelectedHospital] = useState<string>('全部');
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
    for (const h of hospitals) {
      await handleUpdate(h.id);
    }
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
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-sm text-gray-500">科別：</span>
          {(['全部', ...TARGET_DEPARTMENTS] as DeptFilter[]).map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedDept === dept
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm text-gray-500">醫院：</span>
          {['全部', ...hospitals.map(h => h.shortName)].map(name => (
            <button
              key={name}
              onClick={() => setSelectedHospital(name)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedHospital === name
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {name}
            </button>
          ))}
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
          <WeeklyView
            hospitals={selectedHospital === '全部' ? hospitals : hospitals.filter(h => h.shortName === selectedHospital)}
            selectedDept={selectedDept}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitals.map(hospital => (
              <HospitalCard
                key={hospital.id}
                hospital={hospital}
                selectedDept={selectedDept === '全部' ? '婦產科' : selectedDept}
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
