import { Hospital } from '@/types';

export const HOSPITALS: Hospital[] = [
  {
    id: 'tmuh',
    name: '臺北醫學大學附設醫院',
    shortName: '北醫附醫',
    url: 'https://www.tmuh.org.tw',
    scheduleUrl: 'https://www.tmuh.org.tw/service/regist',
    clinics: [],
    news: [],
    lastUpdated: null,
  },
  {
    id: 'eck',
    name: '恩主公醫院',
    shortName: '恩主公',
    url: 'https://www.eck.org.tw',
    scheduleUrl: 'https://www.eck.org.tw/guide/outpatient/registered/',
    clinics: [],
    news: [],
    lastUpdated: null,
  },
  {
    id: 'sph',
    name: '聖保祿醫院',
    shortName: '聖保祿',
    url: 'https://www.sph.org.tw',
    scheduleUrl: 'https://www.sph.org.tw/registration/registration-online-home.html',
    clinics: [],
    news: [],
    lastUpdated: null,
  },
  {
    id: 'clinic',
    name: '中心綜合醫院',
    shortName: '中心綜合',
    url: 'https://www.clinic.org.tw',
    scheduleUrl: 'https://www.clinic.org.tw/timetable',
    clinics: [],
    news: [],
    lastUpdated: null,
  },
  {
    id: 'grace',
    name: '宏恩綜合醫院',
    shortName: '宏恩',
    url: 'https://www.country.org.tw',
    scheduleUrl: 'https://www.country.org.tw/Medguide/DoctorSchedule',
    clinics: [],
    news: [],
    lastUpdated: null,
  },
  {
    id: 'tzuchi',
    name: '台北慈濟醫院',
    shortName: '台北慈濟',
    url: 'https://taipei.tzuchi.com.tw',
    scheduleUrl: 'https://taipei.tzuchi.com.tw/門診表/',
    clinics: [],
    news: [],
    lastUpdated: null,
  },
  {
    id: 'tucheng',
    name: '新北市立土城醫院',
    shortName: '土城醫院',
    url: 'https://www.ntcgh.ntpc.gov.tw',
    scheduleUrl: 'https://www.ntcgh.ntpc.gov.tw/index.php?inter=clinic',
    clinics: [],
    news: [],
    lastUpdated: null,
  },
];

export const TARGET_DEPARTMENTS = ['婦產科', '泌尿外科', '一般外科'] as const;
export const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
export const SESSION_LABELS = ['早', '午', '晚'];
