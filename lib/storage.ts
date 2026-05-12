import { Doctor, VisitRecord, Product, Hospital } from '@/types';
import { pushToCloud } from './supabase';

// ── Doctors ──
export const getDoctors = (): Doctor[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('doctors') || '[]'); } catch { return []; }
};
export const saveDoctors = (data: Doctor[]) => {
  localStorage.setItem('doctors', JSON.stringify(data));
  pushToCloud('doctors', data);
};

export const saveDoctor = (doc: Doctor) => {
  const all = getDoctors();
  const idx = all.findIndex(d => d.id === doc.id);
  idx >= 0 ? all.splice(idx, 1, doc) : all.push(doc);
  saveDoctors(all);
  localStorage.setItem('doctors-updated', Date.now().toString());
  window.dispatchEvent(new Event('doctors-updated'));
};

export const deleteDoctor = (id: string) =>
  saveDoctors(getDoctors().filter(d => d.id !== id));

// ── Visit Records ──
export const getVisits = (): VisitRecord[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('visits') || '[]'); } catch { return []; }
};
const syncVisits = (all: VisitRecord[]) => {
  localStorage.setItem('visits', JSON.stringify(all));
  pushToCloud('visits', all);
};
export const saveVisit = (v: VisitRecord) => {
  const all = getVisits();
  const idx = all.findIndex(x => x.id === v.id);
  idx >= 0 ? all.splice(idx, 1, v) : all.push(v);
  syncVisits(all);
};
export const deleteVisit = (id: string) =>
  syncVisits(getVisits().filter(v => v.id !== id));

// ── Hospitals Data (含門診表) ──
export const getHospitalsData = (): Hospital[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('hospitals-data') || '[]'); } catch { return []; }
};
export const saveHospitalsData = (data: Hospital[]) => {
  localStorage.setItem('hospitals-data', JSON.stringify(data));
  pushToCloud('hospitals-data', data);
};

// ── Hospital Strategies ──
export const getHospitalStrategies = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem('hospital-strategies') || '{}'); } catch { return {}; }
};
export const saveHospitalStrategy = (hospitalId: string, strategy: string) => {
  const all = getHospitalStrategies();
  all[hospitalId] = strategy;
  localStorage.setItem('hospital-strategies', JSON.stringify(all));
  pushToCloud('hospital-strategies', all);
};

// ── Products ──
export const getProducts = (): Product[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('products-db') || '[]'); } catch { return []; }
};
const syncProducts = (all: Product[]) => {
  localStorage.setItem('products-db', JSON.stringify(all));
  pushToCloud('products-db', all);
};
export const saveProduct = (p: Product) => {
  const all = getProducts();
  const idx = all.findIndex(x => x.id === p.id);
  idx >= 0 ? all.splice(idx, 1, p) : all.push(p);
  syncProducts(all);
};
export const deleteProduct = (id: string) =>
  syncProducts(getProducts().filter(p => p.id !== id));
