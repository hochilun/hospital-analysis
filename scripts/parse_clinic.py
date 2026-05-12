#!/usr/bin/env python3
"""中心綜合醫院門診時刻表解析器"""
import urllib.request, re, json, sys

BASE = 'https://clinicr.org.tw/NetReg/KReg'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-TW,zh;q=0.9',
}

TARGET_DEPTS = {
    '05': '婦產科',
    '03': '一般外科',
    '08': '泌尿外科',
    '09': '耳鼻喉科',
}

# TableDay / TableNight 固定欄位對應
# col 0 = 診室(空白)，col 1,2 = 週一上午/下午，col 3,4 = 週二...
DAY_COL_MAP = {
    1: (1, '早'), 2: (1, '午'),
    3: (2, '早'), 4: (2, '午'),
    5: (3, '早'), 6: (3, '午'),
    7: (4, '早'), 8: (4, '午'),
    9: (5, '早'), 10: (5, '午'),
    11: (6, '早'), 12: (6, '午'),
    13: (0, '早'), 14: (0, '午'),
}
NIGHT_COL_MAP = {i: (day, '晚') for i, (day, _) in DAY_COL_MAP.items()}

def extract_cell_text(cell_html):
    text = re.sub(r'<[^>]+>', ' ', cell_html)
    text = text.replace('&nbsp;', ' ').replace('&#160;', ' ').replace('\r', '')
    return re.sub(r'\s+', ' ', text).strip()

def extract_doctor(cell_text):
    """格式：名字 (員工ID)，取名字"""
    m = re.match(r'^(.+?)\s*\(\d+\)', cell_text.strip())
    if m:
        return m.group(1).strip()
    # fallback: 純中文姓名
    name = cell_text.strip().split()[0] if cell_text.strip() else ''
    if re.match(r'^[一-鿿]{2,5}$', name):
        return name
    return None

def parse_schedule_table(table_html, col_map, dept_key, clinics, seen):
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL | re.IGNORECASE)
    # 前 3 列是標題（總標題、星期列、上午/下午列），從第 4 列開始是資料
    for row_html in rows[3:]:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL | re.IGNORECASE)
        cell_texts = [extract_cell_text(c) for c in cells]
        for col_idx, (day_num, session) in col_map.items():
            if col_idx >= len(cell_texts):
                continue
            doctor = extract_doctor(cell_texts[col_idx])
            if doctor:
                key = (doctor, dept_key, day_num, session)
                if key not in seen:
                    seen.add(key)
                    clinics.append({
                        'doctor': doctor,
                        'department': dept_key,
                        'dayOfWeek': day_num,
                        'session': session,
                    })

def parse_dept_page(code, dept_key, clinics, seen):
    url = f'{BASE}/DoctorList.aspx?Func=Query&DivInfo={code}'
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    except Exception:
        return

    # 找 TableDay
    m = re.search(r'<table[^>]*id="TableDay"[^>]*>(.*?)</table>', html, re.DOTALL | re.IGNORECASE)
    if m:
        parse_schedule_table(m.group(0), DAY_COL_MAP, dept_key, clinics, seen)

    # 找 TableNight（夜班）
    m2 = re.search(r'<table[^>]*id="TableNight"[^>]*>(.*?)</table>', html, re.DOTALL | re.IGNORECASE)
    if m2:
        parse_schedule_table(m2.group(0), NIGHT_COL_MAP, dept_key, clinics, seen)

def parse():
    clinics = []
    seen = set()
    for code, dept_key in TARGET_DEPTS.items():
        parse_dept_page(code, dept_key, clinics, seen)
    return {'clinics': clinics, 'news': []}

if __name__ == '__main__':
    try:
        result = parse()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
