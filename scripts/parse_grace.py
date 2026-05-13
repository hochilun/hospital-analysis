#!/usr/bin/env python3
"""宏恩綜合醫院門診時刻表解析器"""
import urllib.request, re, json, sys

URL = 'https://www.country.org.tw/Medguide/DoctorSchedule'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-TW,zh;q=0.9',
}

# 欄位索引 → dayOfWeek (0=日,1=一...6=六)
DAY_COLS = {3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 0}

TARGET_DEPTS = {
    'GYN':  ['GYN', '婦產'],
    'GU': ['泌尿科', 'GU'],
    'GS': ['外科'],
    'ENT': ['ENT', '耳鼻喉'],
}
# 排除含有這些字的「外科」（非一般外科）
EXCLUDE_SURGERY = ['神經', '骨', '整形', '整型', '心臟', '胸腔', '直腸', '大腸']

def get_dept_key(text):
    if not text:
        return None
    t = text.strip()
    for key, patterns in TARGET_DEPTS.items():
        for p in patterns:
            if p in t:
                if key == 'GS' and any(x in t for x in EXCLUDE_SURGERY):
                    continue
                return key
    return None

def time_to_session(time_str):
    try:
        h = int(time_str[:2])
        if h < 12:
            return '早'
        elif h < 18:
            return '午'
        else:
            return '晚'
    except:
        return None

def extract_cells(row_html):
    cells = []
    for m in re.finditer(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL | re.IGNORECASE):
        text = re.sub(r'<[^>]+>', ' ', m.group(1))
        text = text.replace('&nbsp;', ' ').replace('&#160;', ' ').replace('&amp;', '&')
        text = re.sub(r'\s+', ' ', text).strip()
        cells.append(text)
    return cells

def parse():
    req = urllib.request.Request(URL, headers=HEADERS)
    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')

    m = re.search(r'<table[^>]*id="dataTableX"[^>]*>(.*?)</table>', html, re.DOTALL | re.IGNORECASE)
    if not m:
        return {'error': '找不到 dataTableX 表格'}

    table_html = m.group(1)
    clinics = []
    seen = set()

    for row_m in re.finditer(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL | re.IGNORECASE):
        cells = extract_cells(row_m.group(1))
        if len(cells) < 10:
            continue

        dept_text = cells[1] if len(cells) > 1 else ''
        doctor = cells[2].strip() if len(cells) > 2 else ''

        if not doctor or len(doctor) < 2:
            continue

        dept_key = get_dept_key(dept_text)
        if not dept_key:
            continue

        for col_idx, day_of_week in DAY_COLS.items():
            if col_idx >= len(cells):
                continue
            cell = cells[col_idx].strip()
            if not cell:
                continue

            times = re.findall(r'\d{4}-\d{4}', cell)
            sessions_seen = set()
            for t in times:
                session = time_to_session(t)
                if session and session not in sessions_seen:
                    sessions_seen.add(session)
                    key = (doctor, dept_key, day_of_week, session)
                    if key not in seen:
                        seen.add(key)
                        clinics.append({
                            'doctor': doctor,
                            'department': dept_key,
                            'dayOfWeek': day_of_week,
                            'session': session,
                        })

    return {'clinics': clinics, 'news': []}

if __name__ == '__main__':
    try:
        result = parse()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
