export type Department = '婦產科' | '泌尿外科' | '一般外科' | '耳鼻喉科';

export type ClinicSlot = {
  doctor: string;
  department: Department;
  dayOfWeek: number; // 0=日, 1=一, 2=二, 3=三, 4=四, 5=五, 6=六
  session: '早' | '午' | '晚';
};

export type Hospital = {
  id: string;
  name: string;
  shortName: string;
  url: string;
  scheduleUrl: string;
  address?: string;
  clinics: ClinicSlot[];
  news: NewsItem[];
  lastUpdated: string | null;
};

export type NewsItem = {
  title: string;
  date: string;
  url?: string;
};

// ── 客戶資料庫 ──────────────────────────────────────────

export type ProductTarget = {
  productId: string;
  productName: string;
  targetQty: number;
  actualQty: number;
  unit: string;
};

export type Doctor = {
  id: string;
  name: string;
  hospitalId: string;
  hospitalName: string;
  department: string;
  title: string;
  phone: string;
  habits: string;
  visitHabit: string;
  attitude: string;
  visitPlan: string;
  productTargets: ProductTarget[];
  monthlyInvestment: number;
  createdAt: string;
};

export type VisitRecord = {
  id: string;
  doctorId: string;
  date: string;
  content: string;
  nextAction: string;
};

// ── 產品資料庫 ──────────────────────────────────────────

export type ProductVariant = {
  id: string;
  modelNumber: string;
  description: string;
  hospitalPrice: number;        // 預設價（或平均價）
  patientPrice: number;
  hospitalPrices?: Record<string, number>; // 各醫院個別售價 {hospitalId: price}
  unit: string;
};

export type ProductCategory = 'Hemostasis' | 'Adhesion Prevention' | 'Hernia' | 'Urinary Incontinence' | '';

export type Product = {
  id: string;
  name: string;
  category?: ProductCategory;
  hospitalId: string;
  hospitalName: string;
  variants: ProductVariant[];
  notes: string;
  createdAt: string;
};
