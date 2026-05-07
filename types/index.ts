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
