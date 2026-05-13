#!/usr/bin/env python3
"""新北市立土城醫院（長庚土城）門診時刻表解析器（本地PDF）"""
import pdfplumber, json, sys, re, os

TARGET_DEPTS = {
    'GYN':   ['GYN', '婦產'],
    'GU': ['GU', '泌尿'],
    'GS': ['GS'],   # 必須完整寫法，避免大類「外科」誤觸
    'ENT': ['ENT', '耳鼻喉'],
}

def get_dept_key(text):
    t = str(text or '').replace('\n', '').replace(' ', '')
    for key, patterns in TARGET_DEPTS.items():
        for p in patterns:
            if p in t:
                return key
    return None

def extract_doctors(cell):
    """從格子中提取所有醫師名，格式：5碼ID + 姓名(備注)"""
    if not cell:
        return []
    names = []
    for m in re.finditer(r'\d{5}([^\d\n(（]+)', str(cell)):
        name = m.group(1).strip()
        if len(name) >= 2:
            names.append(name)
    return names

def build_col_map_full(row0, row1):
    """15 欄格式：row0 有日期, row1 有上午/下午"""
    DAY_NUM = {'星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6}
    SESSION_MAP = {'上午': '早', '下午': '午', '夜間': '晚'}
    col_map = {}
    current_day = None
    for i, cell in enumerate(row0):
        n = re.sub(r'\s+', '', str(cell or ''))
        for d, num in DAY_NUM.items():
            if d in n:
                current_day = num
                break
        s = re.sub(r'\s+', '', str(row1[i] if i < len(row1) else '') or '')
        if current_day and s in SESSION_MAP:
            col_map[i] = (current_day, SESSION_MAP[s])
    return col_map

def build_col_map_simple(row0):
    """9 欄格式：只有日期列，Mon-Fri 上午，星期六下午"""
    DAY_NUM = {'星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5}
    col_map = {}
    for i, cell in enumerate(row0):
        n = re.sub(r'\s+', '', str(cell or ''))
        for d, num in DAY_NUM.items():
            if d in n:
                session = '早'
                # 如果標題裡有「下午」則是下午診
                if '下午' in n:
                    session = '午'
                col_map[i] = (num, session)
                break
        if '星期六下午' in n or ('星期六' in n and '下午' in n):
            col_map[i] = (6, '午')
        elif '星期六' in n and i not in col_map:
            col_map[i] = (6, '早')
        elif '星期日' in n:
            col_map[i] = (0, '早')
    return col_map

def parse_table(table, clinics, seen):
    if not table or len(table) < 2:
        return

    row0 = table[0]
    row1 = table[1]
    n_cols = len(row0)

    # 判斷格式：是否有 上午/下午 row
    has_session_row = any(
        re.sub(r'\s+', '', str(c or '')) in ('上午', '下午', '夜間')
        for c in row1
    )

    if has_session_row:
        col_map = build_col_map_full(row0, row1)
        data_start = 2
    else:
        col_map = build_col_map_simple(row0)
        data_start = 1

    if not col_map:
        return

    # 判斷科別欄位 (通常 col 0，有時 merged 到 col 1)
    dept_carry = ''
    for row in table[data_start:]:
        if not row:
            continue

        # 更新科別
        cell0 = str(row[0] or '').strip()
        if cell0:
            dept_carry = cell0
        candidate = dept_carry

        dept_key = get_dept_key(candidate)
        if not dept_key:
            continue

        for col_idx, (day_num, session) in col_map.items():
            if col_idx >= len(row):
                continue
            for doctor in extract_doctors(row[col_idx]):
                key = (doctor, dept_key, day_num, session)
                if key not in seen:
                    seen.add(key)
                    clinics.append({
                        'doctor': doctor,
                        'department': dept_key,
                        'dayOfWeek': day_num,
                        'session': session,
                    })

def parse(pdf_path=None):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_path = os.path.join(script_dir, 'pdfs', 'tucheng.pdf')
    path = pdf_path or os.environ.get('TUCHENG_PDF_PATH', default_path)
    if not path or not os.path.exists(path):
        return {'error': f'找不到土城醫院 PDF，請將最新門診表存為 scripts/pdfs/tucheng.pdf'}

    clinics = []
    seen = set()

    with pdfplumber.open(path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table in tables:
                parse_table(table, clinics, seen)

    return {'clinics': clinics, 'news': []}

if __name__ == '__main__':
    pdf_arg = sys.argv[1] if len(sys.argv) > 1 else None
    try:
        result = parse(pdf_arg)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
