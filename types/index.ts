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

// ── 手動門診時段（院外或補充）──────────────────────────────
export type ExtraClinicSlot = {
  location: string;             // 診所名稱，例如「津久診所」
  dayOfWeek: number;            // 1=一 … 6=六, 0=日
  session: '早' | '午' | '晚';
};

// ── 客戶資料庫 ──────────────────────────────────────────

export type DoctorGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'X' | 'Y' | '';

export type ProductTarget = {
  productId: string;
  productName: string;
  category?: ProductCategory;
  targetQty: number;
  unit: string;
  monthlyData?: Record<string, number>; // "2026-01" -> qty
};

export type Doctor = {
  id: string;
  name: string;
  grade: DoctorGrade;
  hospitalId: string;       // 主要醫院（第一間，向下相容）
  hospitalName: string;     // 主要醫院名稱
  hospitalIds?: string[];   // 所有醫院 ID（多選）
  department: string;
  title: string;
  phone: string;
  habits: string;
  visitHabit: string;
  attitude: string;
  visitPlan: string;
  productTargets: ProductTarget[];
  monthlyInvestment: number;
  extraClinicSlots: ExtraClinicSlot[];
  createdAt: string;
};

export type VisitRecord = {
  id: string;
  doctorId: string;
  date: string;
  companions: string;
  content: string;
  nextAction: string;
};

// ── 產品資料庫 ──────────────────────────────────────────

export type HospitalVariantInfo = {
  hospitalCode?: string;   // 院內碼
  patientPrice?: number;   // 末端售價（含稅，病人付）
  purchasePrice?: number;  // 採購價（含稅）= hospitalPrice × 1.05
};

export type ProductVariant = {
  id: string;
  modelNumber: string;
  description: string;
  selfPayCode?: string;    // 自費碼
  nhiCode?: string;        // 健保碼
  hospitalPrice: number;        // 預設採購價（未稅）
  patientPrice: number;         // 預設末端售價
  hospitalPrices?: Record<string, number>;          // hospitalId -> 採購價(未稅)
  hospitalInfo?: Record<string, HospitalVariantInfo>; // hospitalId -> {院內碼, 末端售價}
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
