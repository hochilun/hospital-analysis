// 所有醫院的門診時刻表解析器（JavaScript 版，可在 Vercel 執行）

type Clinic = { doctor: string; department: string; dayOfWeek: number; session: '早' | '午' | '晚' };
type ParseResult = { clinics: Clinic[]; news: never[]; error?: string };

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DAY_CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0 };

async function fetchHtml(url: string, referer?: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-TW,zh;q=0.9', ...(referer ? { Referer: referer } : {}) },
      signal: AbortSignal.timeout(20000),
    });
    const buf = await res.arrayBuffer();
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } catch { return ''; }
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── TMUH 北醫附醫 ────────────────────────────────────────────────────────
const TMUH_DEPT_PAGES: [string, string][] = [['08', 'GU']];
const TMUH_ENT: [string, string][] = [
  ['林哲玄','09/090227'],['李飛鵬','09/090132'],['張廷碩','09/090233'],
  ['陳彥均','09/090238'],['陳資穎','09/090137'],['葉啟偉','09/090135'],
  ['薛如茵','09/090004'],['林飛麟','09/090123'],['趙品植','09/090209'],['周揚','09/090011'],
];
const TMUH_GS: [string, string][] = [
  ['黃昱閔','BW/030042'],['王偉','BW/031009'],['湯堯舜','BW/030087'],
  ['林雨寧','BW/030114'],['陳瑞杰','BW/031023'],['周大鈞','BW/031032'],
  ['黃彥鈞','BA/032044'],['魏柏立','BA/031008'],['郭立人','BA/030032'],['王偉林','BA/030085'],
];
const TMUH_GYN: [string, string][] = [
  ['金宏諺','052/050018'],['林弘慈','052/050029'],['侯容琇','052/050139'],
  ['邱德生','052/052094'],['張景文','052/050006'],['王懿德','052/050242'],
  ['黃佩慎','052/050017'],['邱彥諧','052/052008'],['王培儀','052/052092'],
  ['林芸卉','052/050026'],['陳子健','052/050027'],['傅皓聲','052/052105'],
  ['吳彥蓁','052/052106'],['林秉侖','052/052108'],['林貝珊','052/050030'],
  ['劉偉民','052/052107'],['區慶建','053/050216'],['簡立維','053/050117'],
  ['陳啟煌','054/050054'],['仇思源','054/052100'],
];

function parseTmuhIndividual(html: string, doctorName: string, dept: string, seen: Set<string>): Clinic[] {
  const cells: string[] = [];
  const re = /class="col-sm-2 col-xs-2 col-1_4"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    cells.push(stripTags(m[1]));
  }
  if (cells.length < 8) return [];
  const dayHeaders = cells.slice(0, 7).map(cell => {
    const dm = cell.match(/星期([一二三四五六日])/);
    return dm ? (DAY_CN[dm[1]] ?? -1) : -1;
  });
  const sessions = ['早', '午', '晚'] as const;
  const clinics: Clinic[] = [];
  const sessionCells = cells.slice(7);
  for (let si = 0; si < 3; si++) {
    const session = sessions[si];
    const group = sessionCells.slice(si * 7, (si + 1) * 7);
    for (let col = 0; col < dayHeaders.length; col++) {
      const dow = dayHeaders[col];
      if (dow < 0) continue;
      let rem = group[col] ?? '';
      for (const s of sessions) rem = rem.replace(s, '').trim();
      if (rem.length >= 2) {
        const key = `${doctorName}_${dow}_${session}`;
        if (!seen.has(key)) { seen.add(key); clinics.push({ doctor: doctorName, department: dept, dayOfWeek: dow, session }); }
      }
    }
  }
  return clinics;
}

function parseTmuhDept(html: string, dept: string, seen: Set<string>): Clinic[] {
  const clinics: Clinic[] = [];
  const blocks = html.split(/<p class="doctor_name">/);
  for (const block of blocks) {
    const nm = block.match(/^\s*([一-鿿 ()（）]{2,8})\s*(?:醫師\s*)?<!--[\s\S]*?-->\s*<\/p>/s);
    if (!nm) continue;
    const raw = nm[1].trim();
    const doctor = raw.replace(/[（(].+/, '').trim().replace(/　| /g, '');
    if (doctor.length < 2) continue;
    const calM = block.match(/d_calandar">([\s\S]*?)(?=<p class="doctor_name">|$)/s);
    if (!calM) continue;
    clinics.push(...parseTmuhIndividual(calM[1], doctor, dept, seen));
  }
  return clinics;
}

export async function parseTmuh(): Promise<ParseResult> {
  const seen = new Set<string>();
  const all: Clinic[] = [];
  const BASE = 'https://www.tmuh.org.tw/service/regist';
  const REF = 'https://www.tmuh.org.tw/';

  // GU dept page
  for (const [code, dept] of TMUH_DEPT_PAGES) {
    const html = await fetchHtml(`${BASE}/${code}`, REF);
    if (html) all.push(...parseTmuhDept(html, dept, seen));
  }
  // Individual pages (parallel batches of 5)
  const allDocs: [string, string, string][] = [
    ...TMUH_ENT.map(([n, p]) => [n, p, 'ENT'] as [string, string, string]),
    ...TMUH_GS.map(([n, p]) => [n, p, 'GS'] as [string, string, string]),
    ...TMUH_GYN.map(([n, p]) => [n, p, 'GYN'] as [string, string, string]),
  ];
  for (let i = 0; i < allDocs.length; i += 5) {
    const batch = allDocs.slice(i, i + 5);
    const htmls = await Promise.all(batch.map(([, path]) => fetchHtml(`${BASE}/${path}`, REF)));
    for (let j = 0; j < batch.length; j++) {
      const [name, , dept] = batch[j];
      if (htmls[j]) all.push(...parseTmuhIndividual(htmls[j], name, dept, seen));
    }
  }
  return { clinics: all, news: [] };
}

// ── 中心綜合醫院 ─────────────────────────────────────────────────────────
const CLINIC_DEPTS: Record<string, string> = { '05': 'GYN', '03': 'GS', '08': 'GU', '09': 'ENT' };
const COL_MAP: Record<number, [number, '早'|'午'|'晚']> = {
  1:[1,'早'],2:[1,'午'],3:[2,'早'],4:[2,'午'],5:[3,'早'],6:[3,'午'],
  7:[4,'早'],8:[4,'午'],9:[5,'早'],10:[5,'午'],11:[6,'早'],12:[6,'午'],13:[0,'早'],14:[0,'午'],
};

function parseClinicTable(html: string, dept: string, seen: Set<string>): Clinic[] {
  const clinics: Clinic[] = [];
  const tableRe = /<table[^>]*id="(TableDay|TableNight)"[^>]*>([\s\S]*?)<\/table>/gi;
  let tm;
  while ((tm = tableRe.exec(html)) !== null) {
    const isNight = tm[1] === 'TableNight';
    const rows = [...tm[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(r => r[1]);
    for (const row of rows.slice(3)) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => stripTags(c[1]));
      for (const [idx, [dow, daySess]] of Object.entries(COL_MAP)) {
        const ci = parseInt(idx);
        if (ci >= cells.length) continue;
        const session = isNight ? '晚' : daySess;
        const cell = cells[ci];
        const dm = cell.match(/^(.+?)\s*\(\d+\)/);
        const name = dm ? dm[1].trim() : (cell.match(/^[一-鿿]{2,5}$/) ? cell : null);
        if (name) {
          const key = `${name}_${dow}_${session}`;
          if (!seen.has(key)) { seen.add(key); clinics.push({ doctor: name, department: dept, dayOfWeek: dow, session }); }
        }
      }
    }
  }
  return clinics;
}

export async function parseClinic(): Promise<ParseResult> {
  const seen = new Set<string>();
  const all: Clinic[] = [];
  const htmls = await Promise.all(
    Object.entries(CLINIC_DEPTS).map(([code]) =>
      fetchHtml(`http://59.120.35.134/netreg/kreg/DoctorList.aspx?Func=&DivInfo=${code}`)
    )
  );
  Object.entries(CLINIC_DEPTS).forEach(([, dept], i) => {
    if (htmls[i]) all.push(...parseClinicTable(htmls[i], dept, seen));
  });
  return { clinics: all, news: [] };
}

// ── 土城長庚 ─────────────────────────────────────────────────────────────
const TUCHENG_DEPTS: Record<string, string> = { V7000A: 'GYN', V2100A: 'GS', V2100E: 'GS', V2600A: 'GU', V3500A: 'ENT' };
const DAY_KAN: Record<string, number> = { 日: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

function parseTuchengPage(html: string, dept: string, seen: Set<string>): Clinic[] {
  const clinics: Clinic[] = [];
  const tableM = html.match(/<table class="department-table">([\s\S]*?)<\/table>/s);
  if (!tableM) return clinics;
  const rows = [...tableM[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r => r[1]);
  for (const row of rows) {
    const thM = row.match(/<th>[\d\/]+（([日一二三四五六])）<\/th>/);
    if (!thM) continue;
    const dow = DAY_KAN[thM[1]] ?? -1;
    if (dow < 0) continue;
    const tds = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(t => t[1]);
    for (let col = 0; col < Math.min(3, tds.length); col++) {
      const session = (['早', '午', '晚'] as const)[col];
      const doctors = [...tds[col].matchAll(/<a[^>]*>\d{5}\s*([^<(（]+)/g)].map(m => m[1].trim());
      for (const name of doctors) {
        if (!name || name.length < 2) continue;
        const key = `${name}_${dow}_${session}`;
        if (!seen.has(key)) { seen.add(key); clinics.push({ doctor: name, department: dept, dayOfWeek: dow, session }); }
      }
    }
  }
  return clinics;
}

export async function parseTucheng(): Promise<ParseResult> {
  const seen = new Set<string>();
  const all: Clinic[] = [];
  const entries = Object.entries(TUCHENG_DEPTS);
  const htmls = await Promise.all(entries.map(([code]) =>
    fetchHtml(`https://register.cgmh.org.tw/Department_WEEK/V/${code}`)
  ));
  entries.forEach(([, dept], i) => {
    if (htmls[i]) all.push(...parseTuchengPage(htmls[i], dept, seen));
  });
  return { clinics: all, news: [] };
}

// ── 聖保祿 ────────────────────────────────────────────────────────────────
const SPH_DEPTS: Record<string, string[]> = {
  GYN: ['婦產科','婦產'], GU: ['泌尿\n外科','泌尿外科','泌尿'],
  GS:  ['一\n般\n外\n科','一般外科','一般\n外科'], ENT: ['耳鼻喉科','耳鼻喉'],
};

export async function parseSph(): Promise<ParseResult> {
  const html = await fetchHtml('https://www.sph.org.tw/registration/registration-online-home.html');
  if (!html) return { clinics: [], news: [] };
  const seen = new Set<string>();
  const all: Clinic[] = [];
  // find department sections in the HTML table structure
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(r => stripTags(r[1]));
  let currentDept = '';
  let currentDoc = '';
  const DOW_MAP: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
  for (const row of rows) {
    // Check if this row contains a department name
    for (const [dept, patterns] of Object.entries(SPH_DEPTS)) {
      if (patterns.some(p => row.includes(p.replace(/\n/g, '')))) { currentDept = dept; break; }
    }
    if (!currentDept) continue;
    // Doctor name pattern
    const docM = row.match(/^([一-鿿]{2,5})\s/);
    if (docM) currentDoc = docM[1];
    if (!currentDoc) continue;
    // Day + session
    const dayM = row.match(/([一二三四五六日])[^\s]*(早|上午|午|下午|晚)/);
    if (dayM) {
      const dow = DOW_MAP[dayM[1]] ?? -1;
      const sessRaw = dayM[2];
      const session: '早'|'午'|'晚' = sessRaw === '早' || sessRaw === '上午' ? '早' : sessRaw === '午' || sessRaw === '下午' ? '午' : '晚';
      if (dow >= 0) {
        const key = `${currentDoc}_${dow}_${session}`;
        if (!seen.has(key)) { seen.add(key); all.push({ doctor: currentDoc, department: currentDept, dayOfWeek: dow, session }); }
      }
    }
  }
  return { clinics: all, news: [] };
}

// ── 宏恩 ─────────────────────────────────────────────────────────────────
const GRACE_DEPTS: Record<string, string[]> = {
  GYN: ['婦產科','婦產'], GU: ['泌尿科','泌尿外科'],
  GS:  ['外科'], ENT: ['耳鼻喉科','耳鼻喉'],
};
const GRACE_EXCL = ['心臟', '胸腔', '神經', '骨科', '整形', '泌尿'];

export async function parseGrace(): Promise<ParseResult> {
  const html = await fetchHtml('https://www.country.org.tw/Medguide/DoctorSchedule');
  if (!html) return { clinics: [], news: [] };
  const seen = new Set<string>();
  const all: Clinic[] = [];
  // Parse the schedule grid
  const tableM = html.match(/<table[^>]*class="[^"]*schedule[^"]*"[^>]*>([\s\S]*?)<\/table>/is)
    ?? html.match(/<table[^>]*>([\s\S]*?)<\/table>/is);
  if (!tableM) return { clinics: all, news: [] };
  const rows = [...tableM[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(r => stripTags(r[1]));
  // Day mapping from column headers
  let dayHeaders: number[] = [];
  const DOW_MAP: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
  let currentDept = '';
  for (const row of rows) {
    if (/星期/.test(row)) {
      dayHeaders = [];
      for (const [ch, n] of Object.entries(DOW_MAP)) {
        if (row.includes(`星期${ch}`)) dayHeaders.push(n);
      }
      continue;
    }
    // Department check
    for (const [dept, patterns] of Object.entries(GRACE_DEPTS)) {
      if (dept === 'GS' && GRACE_EXCL.some(e => row.includes(e))) continue;
      if (patterns.some(p => row.includes(p))) { currentDept = dept; break; }
    }
    if (!currentDept || dayHeaders.length === 0) continue;
    // Check for doctor names in columns
    const parts = row.split(/\s{2,}/);
    for (let i = 0; i < parts.length && i < dayHeaders.length; i++) {
      const part = parts[i].trim();
      const nameM = part.match(/^([一-鿿]{2,5})/);
      if (!nameM) continue;
      const doctor = nameM[1];
      const sessM = part.match(/(早|上午|午|下午|晚)/);
      const session: '早'|'午'|'晚' = sessM ? (sessM[1] === '上午' ? '早' : sessM[1] === '下午' ? '午' : sessM[1] as '早'|'午'|'晚') : '早';
      const dow = dayHeaders[i];
      const key = `${doctor}_${dow}_${session}`;
      if (!seen.has(key)) { seen.add(key); all.push({ doctor, department: currentDept, dayOfWeek: dow, session }); }
    }
  }
  return { clinics: all, news: [] };
}

// ── 台北慈濟 ────────────────────────────────────────────────────────────
const TZUCHI_DEPTS: Record<string, string> = { '15': 'GU', '03': 'GS' };

export async function parseTzuchi(): Promise<ParseResult> {
  const seen = new Set<string>();
  const all: Clinic[] = [];
  for (const [divNo, dept] of Object.entries(TZUCHI_DEPTS)) {
    const url = `http://59.120.35.134/NetReg/KReg/DoctorList.aspx?Func=Query&DivInfo=${divNo}`;
    const html = await fetchHtml(url);
    if (html) all.push(...parseClinicTable(html, dept, seen));
  }
  return { clinics: all, news: [] };
}

// ── 恩主公 (hCaptcha，無法自動更新) ─────────────────────────────────────
export async function parseEck(): Promise<ParseResult> {
  return {
    clinics: [],
    news: [],
    error: '恩主公需要手動更新：網站有 hCaptcha 保護，請直接在瀏覽器開啟門診頁面後點更新',
  };
}

// ── dispatch ──────────────────────────────────────────────────────────────
export async function parseHospital(hospitalId: string): Promise<ParseResult> {
  switch (hospitalId) {
    case 'tmuh':    return parseTmuh();
    case 'clinic':  return parseClinic();
    case 'tucheng': return parseTucheng();
    case 'sph':     return parseSph();
    case 'grace':   return parseGrace();
    case 'tzuchi':  return parseTzuchi();
    case 'eck':     return parseEck();
    default:        return { clinics: [], news: [], error: `${hospitalId} 的解析器尚未建立` };
  }
}
