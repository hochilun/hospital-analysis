#!/usr/bin/env python3
"""聖保祿醫院門診時刻表解析器"""
import urllib.request, urllib.parse, pdfplumber, io, json, re, sys

BASE_URL = 'https://www.sph.org.tw'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Referer': 'https://www.sph.org.tw/',
    'Accept-Language': 'zh-TW,zh;q=0.9',
}

TARGET_DEPTS = {
    'GYN': ['GYN', '婦產'],
    'GU': ['泌尿\n外科', 'GU', '泌尿'],
    'GS': ['一\n般\n外\n科', 'GS', '一般\n外科'],
    'ENT': ['ENT', '耳鼻喉'],
}

# 頁1 (22 cols): col0=category, col1=dept, col2=subdept, col3=room, col4~21=schedule
COL_MAP_P1 = {
    4: (1,'早'), 5: (1,'午'), 6: (1,'晚'),
    7: (2,'早'), 8: (2,'午'), 9: (2,'晚'),
    10:(3,'早'),11: (3,'午'),12: (3,'晚'),
    13:(4,'早'),14: (4,'午'),15: (4,'晚'),
    16:(5,'早'),17: (5,'午'),18: (5,'晚'),
    19:(6,'早'),20: (6,'午'),21: (6,'晚'),
}

# 頁2 (21 cols): col0=dept, col1=subdept, col2=room, col3~20=schedule
COL_MAP_P2 = {
    3: (1,'早'), 4: (1,'午'), 5: (1,'晚'),
    6: (2,'早'), 7: (2,'午'), 8: (2,'晚'),
    9: (3,'早'),10: (3,'午'),11: (3,'晚'),
    12:(4,'早'),13: (4,'午'),14: (4,'晚'),
    15:(5,'早'),16: (5,'午'),17: (5,'晚'),
    18:(6,'早'),19: (6,'午'),20: (6,'晚'),
}

def extract_doctor_name(cell):
    """SPH格式：代碼\n醫師名字，取第二行"""
    if not cell:
        return None
    text = str(cell).strip()
    if not text or text == 'None':
        return None
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return None
    # 第一行若為純數字（醫師代碼），取第二行
    if re.match(r'^\d{4}$', lines[0]):
        name = lines[1] if len(lines) > 1 else None
    else:
        name = lines[0]
    if not name or len(name) < 2 or re.match(r'^\d+$', name):
        return None
    # 過濾主治說明文字
    if name.startswith('主治') or name.startswith('※') or len(name) > 15:
        return None
    return name

def get_dept_key(text):
    if not text:
        return None
    t = str(text)
    for key, patterns in TARGET_DEPTS.items():
        for p in patterns:
            if p in t:
                return key
    return None

def is_new_dept_header(text):
    if not text or str(text) in ('None', ''):
        return False
    t = str(text).strip().replace('\n', '')
    return len(t) > 1 and not re.match(r'^\d+$', t) and any(k in t for k in ['科','部','門診'])

def parse_table(table, col_map, dept_col, clinics):
    """通用表格解析"""
    current_dept_key = None
    for row in table:
        if not row or len(row) < 4:
            continue
        dept_text = str(row[dept_col] or '')
        new_key = get_dept_key(dept_text)
        if new_key:
            current_dept_key = new_key
        elif dept_text and is_new_dept_header(dept_text) and not new_key:
            current_dept_key = None
        if not current_dept_key:
            continue
        for col_idx, (day, session) in col_map.items():
            if col_idx >= len(row):
                continue
            doctor = extract_doctor_name(row[col_idx])
            if doctor:
                clinics.append({
                    'doctor': doctor,
                    'department': current_dept_key,
                    'dayOfWeek': day,
                    'session': session,
                })

def fetch_latest_pdf_url():
    try:
        req = urllib.request.Request(BASE_URL, headers=HEADERS)
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        pdfs = re.findall(r'href=["\']([^"\']*\.pdf)["\']', html)
        for pdf in reversed(pdfs):
            if '門診表' in urllib.parse.unquote(pdf):
                if pdf.startswith('http'):
                    return pdf
                return BASE_URL + pdf
    except:
        pass
    return None

def parse():
    url = fetch_latest_pdf_url()
    if not url:
        return {'error': '找不到最新的門診PDF連結'}

    encoded_url = urllib.parse.quote(url, safe=':/?=&%')
    req = urllib.request.Request(encoded_url, headers=HEADERS)
    data = urllib.request.urlopen(req, timeout=20).read()
    clinics = []

    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for pi, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                # 判斷是頁1(22col)還是頁2(21col)格式
                header = table[0] if table else []
                n_cols = len(header)
                if n_cols >= 22:
                    parse_table(table, COL_MAP_P1, dept_col=1, clinics=clinics)
                else:
                    parse_table(table, COL_MAP_P2, dept_col=0, clinics=clinics)

    # 去重
    seen = set()
    unique = []
    for c in clinics:
        key = (c['doctor'], c['department'], c['dayOfWeek'], c['session'])
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return {'clinics': unique, 'news': []}

if __name__ == '__main__':
    try:
        result = parse()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
