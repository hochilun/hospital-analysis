'use client';

import { useState, useEffect } from 'react';
import { Hospital, Department, ClinicSlot } from '@/types';
import { HOSPITALS, TARGET_DEPARTMENTS, DEPT_LABEL } from '@/data/hospitals';
import Link from 'next/link';
import HospitalCard from '@/components/HospitalCard';
import WeeklyView from '@/components/WeeklyView';
import PersonalCalendar from '@/components/PersonalCalendar';
import { getDoctors } from '@/lib/storage';
import { pullFromCloud } from '@/lib/supabase';
import GlobalTodosPanel from '@/components/GlobalTodosPanel';

const VALID_DEPTS = new Set(['GYN', 'GU', 'GS', 'ENT']);

function buildExtraHospitals(hospitals: Hospital[]): Hospital[] {
  if (typeof window === 'undefined') return hospitals;
  const doctors = getDoctors();
  // 以 location 為 key，累積 ClinicSlot
  const locationMap = new Map<string, ClinicSlot[]>();
  for (const doc of doctors) {
    const dept = VALID_DEPTS.has(doc.department) ? doc.department as Department : null;
    if (!dept) continue;
    for (const slot of (doc.extraClinicSlots ?? [])) {
      if (!slot.location) continue;
      const slots = locationMap.get(slot.location) ?? [];
      slots.push({ doctor: doc.name, department: dept, dayOfWeek: slot.dayOfWeek, session: slot.session });
      locationMap.set(slot.location, slots);
    }
  }
  const extras: Hospital[] = [];
  for (const [location, clinics] of locationMap) {
    extras.push({
      id: `extra_${location}`,
      name: location,
      shortName: location,
      url: '',
      scheduleUrl: '',
      clinics,
      news: [],
      lastUpdated: null,
    });
  }
  return [...hospitals, ...extras];
}

export default function Home() {
  const [hospitals, setHospitals] = useState<Hospital[]>(HOSPITALS);
  const [selectedDepts, setSelectedDepts] = useState<Set<Department>>(new Set(TARGET_DEPARTMENTS));
  const [selectedHospitals, setSelectedHospitals] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'hospitals' | 'weekly'>('weekly');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const loadData = () => {
      const saved = localStorage.getItem('hospitals-data');
      let base: Hospital[] = HOSPITALS;
      if (saved) {
        try { base = JSON.parse(saved); } catch {}
      }
      setHospitals(buildExtraHospitals(base));
    };

    // 啟動時先從雲端同步，再載入本機資料
    pullFromCloud().then(synced => {
      if (synced) loadData();
    });
    loadData();

    // 處理 bfcache（瀏覽器上一頁快取）與切換分頁後返回的情況
    window.addEventListener('pageshow', loadData);
    // 同分頁內新增/修改客戶院外門診時，立即同步週曆
    window.addEventListener('doctors-updated', loadData);
    // 跨分頁同步
    const onVisibility = () => { if (!document.hidden) loadData(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pageshow', loadData);
      window.removeEventListener('doctors-updated', loadData);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const saveHospitals = (data: Hospital[]) => {
    // 只存真正的醫院資料，過濾掉 extra_xxx 的院外門診假醫院
    const baseOnly = data.filter(h => !h.id.startsWith('extra_'));
    localStorage.setItem('hospitals-data', JSON.stringify(baseOnly));
    setHospitals(buildExtraHospitals(baseOnly));
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
          <div className="flex items-center gap-3">
            <Link href="/customers" className="text-sm text-gray-600 hover:text-blue-600 font-medium">客戶</Link>
            <Link href="/products" className="text-sm text-gray-600 hover:text-blue-600 font-medium">產品</Link>
            <Link href="/sales" className="text-sm text-gray-600 hover:text-blue-600 font-medium">業績</Link>
            <button
              onClick={handleUpdateAll}
              disabled={!!updating}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updating ? '更新中...' : '全部更新'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <GlobalTodosPanel />

        {/* 科別複選 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-gray-500 w-10">科別</span>
          <button
            onClick={() => setSelectedDepts(new Set(TARGET_DEPARTMENTS))}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedDepts.size === TARGET_DEPARTMENTS.length
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-400 hover:border-blue-300'
            }`}
          >
            全選
          </button>
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
              {DEPT_LABEL[dept] ?? dept}
            </button>
          ))}
        </div>

        {/* 醫院複選 */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm text-gray-500 w-10">醫院</span>
          <button
            onClick={() => setSelectedHospitals(new Set())}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedHospitals.size === 0
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-400'
            }`}
          >
            全選
          </button>
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
                selectedDept={selectedDepts.size > 0 ? Array.from(selectedDepts)[0] : 'GYN'}
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
