#!/usr/bin/env python3
"""新店慈濟醫院門診時刻表解析器（掛號系統 HTML）"""
import urllib.request, re, json, sys
from collections import defaultdict

BASE_URL = 'https://reg-prod.tzuchi-healthcare.org.tw/tchw/HIS5OpdReg/OpdTimeShow?Pass=XD;'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept-Language': 'zh-TW,zh;q=0.9',
    'Accept': 'text/html,application/xhtml+xml',
}

# 科別代碼 → 我們的分類
TARGET_DEPTS = {
    '15': 'GU',
    '03': 'GS',
}

DAY_MAP = {
    '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4,
    '星期五': 5, '星期六': 6, '星期日': 0,
}

SESSION_COLS = ['早', '午', '晚']  # 對應 上午/下午/夜間

def extract_doctors_from_cell(cell_html):
    """從一個時段格子中提取醫師名，排除停診"""
    doctors = []
    # 去掉 style 中有紅色 (#cc) 的停診文字 span
    # 策略：先找有 <a href=> 的（可掛號），再找沒有停診標記的
    # 移除「停診」相關區塊
    clean = re.sub(
        r'(?:[對廣公]?[\w\s]*?)?(?:[^\n<]*?停診[^\n<]*)',
        '', cell_html
    )
    # 從 <a> 連結提取醫師名
    for m in re.finditer(r'<a\s[^>]*>\s*([^\s<][^<]*?)\s*</a>', clean, re.IGNORECASE):
        name = m.group(1).strip()
        if name and len(name) >= 2 and not any(x in name for x in ['停診', '掛號', '診間', '第', '診']):
            doctors.append(name)
    # 也補捉有特殊門診標記的醫師（如脊髓損傷特別門診）但只取名字
    # 去重
    return list(dict.fromkeys(doctors))

def parse_dept(dept_code, dept_name):
    url = BASE_URL + dept_code
    req = urllib.request.Request(url, headers=HEADERS)
    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')

    # 找主要排班表
    m = re.search(r'<table[^>]*id="MainContent_gvOpdList"[^>]*>(.*?)</table>',
                  html, re.DOTALL | re.IGNORECASE)
    if not m:
        return []

    table_html = m.group(1)
    rows = re.findall(r'<tr[^>]*class="OpdListD"[^>]*>(.*?)</tr>',
                      table_html, re.DOTALL | re.IGNORECASE)

    # (day_of_week, session) → set of doctors
    schedule = defaultdict(set)

    for row_html in rows:
        # 提取 4 個 <td>
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL | re.IGNORECASE)
        if len(cells) < 4:
            continue

        # 第 1 欄：日期含星期
        date_text = re.sub(r'<[^>]+>', ' ', cells[0])
        day_of_week = None
        for day_str, day_num in DAY_MAP.items():
            if day_str in date_text:
                day_of_week = day_num
                break
        if day_of_week is None:
            continue

        # 第 2-4 欄：上午/下午/夜間
        for col_i, session in enumerate(SESSION_COLS):
            cell = cells[col_i + 1]
            for doctor in extract_doctors_from_cell(cell):
                schedule[(day_of_week, session)].add(doctor)

    clinics = []
    seen = set()
    for (day_of_week, session), doctors in schedule.items():
        for doctor in sorted(doctors):
            key = (doctor, dept_name, day_of_week, session)
            if key not in seen:
                seen.add(key)
                clinics.append({
                    'doctor': doctor,
                    'department': dept_name,
                    'dayOfWeek': day_of_week,
                    'session': session,
                })

    return clinics

def parse():
    all_clinics = []
    seen = set()
    for code, dept_name in TARGET_DEPTS.items():
        try:
            clinics = parse_dept(code, dept_name)
            for c in clinics:
                key = (c['doctor'], c['department'], c['dayOfWeek'], c['session'])
                if key not in seen:
                    seen.add(key)
                    all_clinics.append(c)
        except Exception as e:
            pass  # 單一科別失敗不影響其他
    return {'clinics': all_clinics, 'news': []}

if __name__ == '__main__':
    try:
        result = parse()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
