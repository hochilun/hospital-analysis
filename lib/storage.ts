import { Doctor, VisitRecord, Product } from '@/types';

// ── Doctors ──
export const getDoctors = (): Doctor[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('doctors') || '[]'); } catch { return []; }
};
export const saveDoctors = (data: Doctor[]) =>
  localStorage.setItem('doctors', JSON.stringify(data));

export const saveDoctor = (doc: Doctor) => {
  const all = getDoctors();
  const idx = all.findIndex(d => d.id === doc.id);
  idx >= 0 ? all.splice(idx, 1, doc) : all.push(doc);
  saveDoctors(all);
};

export const deleteDoctor = (id: string) =>
  saveDoctors(getDoctors().filter(d => d.id !== id));

// ── Visit Records ──
export const getVisits = (): VisitRecord[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('visits') || '[]'); } catch { return []; }
};
export const saveVisit = (v: VisitRecord) => {
  const all = getVisits();
  const idx = all.findIndex(x => x.id === v.id);
  idx >= 0 ? all.splice(idx, 1, v) : all.push(v);
  localStorage.setItem('visits', JSON.stringify(all));
};
export const deleteVisit = (id: string) => {
  const all = getVisits().filter(v => v.id !== id);
  localStorage.setItem('visits', JSON.stringify(all));
};

// ── Products ──
export const getProducts = (): Product[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('products-db') || '[]'); } catch { return []; }
};
export const saveProduct = (p: Product) => {
  const all = getProducts();
  const idx = all.findIndex(x => x.id === p.id);
  idx >= 0 ? all.splice(idx, 1, p) : all.push(p);
  localStorage.setItem('products-db', JSON.stringify(all));
};
export const deleteProduct = (id: string) => {
  const all = getProducts().filter(p => p.id !== id);
  localStorage.setItem('products-db', JSON.stringify(all));
};
