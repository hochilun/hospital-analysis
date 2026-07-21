'use client';

import { useState, useEffect } from 'react';
import { Hospital, Department, ClinicSlot, WeeklyAbsence } from '@/types';
import { HOSPITALS, TARGET_DEPARTMENTS, DEPT_LABEL, DAY_LABELS, SESSION_LABELS } from '@/data/hospitals';
import Link from 'next/link';
import HospitalCard from '@/components/HospitalCard';
import WeeklyView from '@/components/WeeklyView';
import PersonalCalendar from '@/components/PersonalCalendar';
import { getDoctors } from '@/lib/storage';
import { pullFromCloud, syncAllFromCloud } from '@/lib/supabase';
import GlobalTodosPanel from '@/components/GlobalTodosPanel';

const VALID_DEPTS = new Set(['GYN', 'GU', 'GS', 'ENT', 'TS', 'BS']);

const DEPT_COLOR: Record<string, string> = {
  GYN: 'bg-pink-50 text-pink-700 border-pink-200',
  GU:  'bg-blue-50 text-blue-700 border-blue-200',
  GS:  'bg-green-50 text-green-700 border-green-200',
  ENT: 'bg-orange-50 text-orange-700 border-orange-200',
  TS:  'bg-purple-50 text-purple-700 border-purple-200',
  BS:  'bg-rose-50 text-rose-700 border-rose-200',
};

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
  const [doctorSearch, setDoctorSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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
      if (synced) {
        loadData();
        window.dispatchEvent(new CustomEvent('cloud-synced'));
      }
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

  // 從雲端拉最新資料覆蓋本機（解決 localStorage 優先、看不到雲端更新的問題）
  const handleSyncFromCloud = async () => {
    if (!confirm('從雲端拉取最新資料並覆蓋本機？\n（會用雲端資料蓋掉本機；尚未同步到雲端的本機修改會遺失）')) return;
    setSyncing(true);
    try {
      await syncAllFromCloud();
      window.location.reload();
    } catch {
      setSyncing(false);
      alert('同步失敗，請稍後再試');
    }
  };

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

  const doctorSuggestions = (() => {
    const q = doctorSearch.trim();
    if (!q) return [];
    const map = new Map<string, Set<string>>();
    for (const h of hospitals) {
      for (const c of h.clinics) {
        if (c.doctor.includes(q)) {
          if (!map.has(c.doctor)) map.set(c.doctor, new Set());
          map.get(c.doctor)!.add(h.shortName);
        }
      }
    }
    return [...map.entries()].map(([name, hosps]) => ({ name, hospitals: [...hosps] })).slice(0, 8);
  })();

  const selectedDoctorSlots = (() => {
    if (!selectedDoctor) return [];
    const result: { hospitalName: string; dept: string; dayOfWeek: number; session: string }[] = [];
    for (const h of hospitals) {
      for (const c of h.clinics) {
        if (c.doctor === selectedDoctor) {
          result.push({ hospitalName: h.shortName, dept: c.department, dayOfWeek: c.dayOfWeek, session: c.session });
        }
      }
    }
    return result.sort((a, b) =>
      a.dayOfWeek !== b.dayOfWeek
        ? a.dayOfWeek - b.dayOfWeek
        : SESSION_LABELS.indexOf(a.session) - SESSION_LABELS.indexOf(b.session)
    );
  })();

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
        // tucheng 用合併模式（長庚掛號頁只顯示未來7天，取代會漏掉請假那週的固定班次）
        const mergeMode = hospitalId === 'tucheng';
        const updated = hospitals.map(h => {
          if (h.id !== hospitalId) return h;
          let clinics = data.clinics as ClinicSlot[];
          let weeklyAbsences: WeeklyAbsence[] | undefined;
          if (mergeMode) {
            const existingKeys = new Set(h.clinics.map((c: ClinicSlot) => `${c.doctor}_${c.dayOfWeek}_${c.session}`));
            const extra = clinics.filter(c => !existingKeys.has(`${c.doctor}_${c.dayOfWeek}_${c.session}`));
            clinics = [...h.clinics, ...extra];
            // 偵測本週停診：固定班表有、但本週抓不到的
            const thisWeekKeys = new Set((data.clinics as ClinicSlot[]).map(c => `${c.doctor}_${c.dayOfWeek}_${c.session}`));
            weeklyAbsences = h.clinics
              .filter(c => !thisWeekKeys.has(`${c.doctor}_${c.dayOfWeek}_${c.session}`))
              .map(c => ({ doctor: c.doctor, dayOfWeek: c.dayOfWeek, session: c.session as '早'|'午'|'晚', department: c.department }));
          }
          return { ...h, clinics, news: data.news, lastUpdated: new Date().toISOString(), weeklyAbsences };
        });
        saveHospitals(updated);
      } else {
        console.warn(`更新失敗 [${hospitalId}]:`, data.error);
      }
    } catch (e) {
      console.warn(`更新失敗 [${hospitalId}]:`, e);
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
            <Link href="/visits" className="text-sm text-gray-600 hover:text-blue-600 font-medium">拜訪</Link>
            <Link href="/products" className="text-sm text-gray-600 hover:text-blue-600 font-medium">產品</Link>
            <Link href="/sales" className="text-sm text-gray-600 hover:text-blue-600 font-medium">業績</Link>
            <Link href="/performance" className="text-sm text-blue-600 font-semibold hover:text-blue-700">我的</Link>
            <button
              onClick={handleUpdateAll}
              disabled={!!updating}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updating ? '更新中...' : '全部更新'}
            </button>
            <button
              onClick={handleSyncFromCloud}
              disabled={syncing}
              title="從雲端拉取最新資料覆蓋本機"
              className="text-sm px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {syncing ? '同步中…' : '⟳ 從雲端同步'}
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

        {/* 醫師搜尋 */}
        <div className="relative mb-4">
          <input
            type="text"
            value={doctorSearch}
            onChange={e => { setDoctorSearch(e.target.value); setShowDropdown(true); setSelectedDoctor(null); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="搜尋醫師姓名..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          />
          {showDropdown && doctorSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {doctorSuggestions.map(({ name, hospitals: hospNames }) => (
                <button
                  key={name}
                  onMouseDown={() => { setSelectedDoctor(name); setDoctorSearch(name); setShowDropdown(false); }}
                  className="w-full px-4 py-2.5 text-left hover:bg-blue-50 flex items-center justify-between gap-3 border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-gray-800 text-sm">{name}</span>
                  <span className="text-xs text-gray-400">{hospNames.join(' · ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 選定醫師的門診時段 */}
        {selectedDoctor && selectedDoctorSlots.length > 0 && (
          <div className="bg-white rounded-xl border border-blue-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-800">{selectedDoctor} 的門診時間</h3>
                <span className="text-xs text-gray-400">{selectedDoctorSlots.length} 個時段</span>
              </div>
              <button
                onClick={() => { setSelectedDoctor(null); setDoctorSearch(''); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕ 關閉
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedDoctorSlots.map((s, i) => (
                <div key={i} className={`text-xs px-3 py-1.5 rounded-lg border ${DEPT_COLOR[s.dept] ?? 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  <span className="font-medium">{s.hospitalName}</span>
                  <span className="mx-1 opacity-40">·</span>
                  <span>週{DAY_LABELS[s.dayOfWeek]}{s.session}診</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
