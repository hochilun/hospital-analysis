#!/usr/bin/env python3
"""恩主公醫院門診時刻表解析器"""
import urllib.request, pdfplumber, io, json, re, sys

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.eck.org.tw/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9',
}

TARGET_DEPTS = {
    '婦產科': ['婦產科', '優生保健', '羊水診'],
    '泌尿外科': ['泌尿科'],
    '一般外科': ['一般外科'],
}

COL_MAP_P4 = {
    3:  (1, '早'), 4:  (1, '午'), 5:  (1, '晚'),
    6:  (2, '早'), 7:  (2, '午'), 8:  (2, '晚'),
    9:  (3, '早'), 10: (3, '午'), 11: (3, '晚'),
    12: (4, '早'), 13: (4, '午'), 14: (4, '晚'),
    15: (5, '早'), 16: (5, '午'), 17: (5, '晚'),
    18: (6, '早'),
}

def extract_doctor_name(cell_text):
    if not cell_text:
        return None
    text = str(cell_text).strip()
    if not text or text in ('', 'None'):
        return None
    name = text.split('\n')[0].strip()
    name = re.sub(r'\s*\d{4,5}$', '', name).strip()
    name = name.lstrip('*').strip()
    if re.match(r'^\d+$', name) or len(name) < 2:
        return None
    return name

def get_dept_key(text):
    if not text:
        return None
    for key, patterns in TARGET_DEPTS.items():
        for p in patterns:
            if p in str(text):
                return key
    return None

def is_new_dept_header(text):
    """判斷是否為新科別標題列（非空、非數字、包含科別字眼）"""
    if not text or str(text) in ('None', ''):
        return False
    t = str(text).strip()
    if re.match(r'^\d+$', t):
        return False
    return any(kw in t for kw in ['科', '部門', '中心'])

def parse_page4_table(table, clinics):
    current_dept_key = None
    for row in table:
        if not row or len(row) < 4:
            continue
        # 跳過標題列
        if row[1] in ('科別', None) and row[2] in ('診室', None):
            continue

        dept_text = str(row[1] or '')
        cat_text = str(row[0] or '')

        # 優先從科別欄位判斷
        new_key = get_dept_key(dept_text)
        if new_key:
            current_dept_key = new_key
        elif dept_text and dept_text not in ('None', '') and is_new_dept_header(dept_text):
            # 遇到新的非目標科別 → 重置（離開了目標科別範圍）
            current_dept_key = None
        # cat_text 只用來補充判斷，不用來重置
        if not current_dept_key and get_dept_key(cat_text):
            current_dept_key = get_dept_key(cat_text)

        if not current_dept_key:
            continue
        for col_idx, (day, session) in COL_MAP_P4.items():
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
        req = urllib.request.Request(
            'https://www.eck.org.tw/guide/outpatient/registered/%e9%96%80%e8%a8%ba%e6%99%82%e5%88%bb%e8%a1%a8%e4%b8%8b%e8%bc%89/',
            headers=HEADERS
        )
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        pdfs = re.findall(r'href="(https://www\.eck\.org\.tw/wp-content/uploads/[^"]+\.pdf)"', html)
        # 找門診時間表 PDF
        schedule_pdfs = [p for p in pdfs if '%E9%96%80%E8%A8%BA%E6%99%82%E9%96%93%E8%A1%A8' in p or '門診' in urllib.request.unquote(p)]
        return schedule_pdfs[-1] if schedule_pdfs else None
    except Exception as e:
        return None

def parse():
    url = fetch_latest_pdf_url()
    if not url:
        return {'error': '找不到最新的門診PDF連結，請確認網路連線'}

    req = urllib.request.Request(url, headers=HEADERS)
    data = urllib.request.urlopen(req, timeout=20).read()

    clinics = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        if len(pdf.pages) >= 4:
            tables = pdf.pages[3].extract_tables()
            for table in tables:
                parse_page4_table(table, clinics)

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
