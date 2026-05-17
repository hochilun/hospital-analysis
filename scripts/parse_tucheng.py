#!/usr/bin/env python3
"""新北市立土城醫院（長庚土城）門診時刻表解析器（掛號頁面版）"""
import urllib.request, re, json, sys, time

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-TW,zh;q=0.9',
}

# 科別代碼 → (dept_key, 頁面代碼清單)
DEPT_PAGES = {
    'GYN': ['V7000A'],
    'GS':  ['V2100A', 'V2100E'],
    'GU':  ['V2600A'],
    'ENT': ['V3500A'],
}

DAY_MAP = {'日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6}
SESSION_MAP = {0: '早', 1: '午', 2: '晚'}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        return urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')
    except Exception:
        return ''


def parse_page(html: str, dept_key: str, seen: set) -> list:
    clinics = []
    m = re.search(r'<table class="department-table">(.*?)</table>', html, re.DOTALL)
    if not m:
        return clinics
    table = m.group(1)

    rows = re.findall(r'<tr>(.*?)</tr>', table, re.DOTALL)
    for row in rows:
        # 取日期標題
        th = re.search(r'<th>[\d/]+（([日一二三四五六])）</th>', row)
        if not th:
            continue
        day_of_week = DAY_MAP.get(th.group(1), -1)
        if day_of_week < 0:
            continue

        # 取三個 <td>（上午/下午/晚間）
        tds = re.findall(r'<td>(.*?)</td>', row, re.DOTALL)
        for col_idx, td in enumerate(tds[:3]):
            session = SESSION_MAP.get(col_idx)
            if not session:
                continue
            # 找 <a> 裡的醫師名（格式：「1xxxx 姓名」，去掉開頭數字）
            for a in re.findall(r'<a[^>]*>(\d{5})\s*([^<(（]+)', td):
                name = a[1].strip()
                if not name or len(name) < 2:
                    continue
                key = f'{name}_{day_of_week}_{session}'
                if key not in seen:
                    seen.add(key)
                    clinics.append({
                        'doctor': name,
                        'department': dept_key,
                        'dayOfWeek': day_of_week,
                        'session': session,
                    })
    return clinics


def main():
    all_clinics = []
    seen = set()

    for dept_key, page_codes in DEPT_PAGES.items():
        for code in page_codes:
            url = f'https://register.cgmh.org.tw/Department_WEEK/V/{code}'
            html = fetch(url)
            if html:
                clinics = parse_page(html, dept_key, seen)
                all_clinics.extend(clinics)
            time.sleep(0.5)

    print(json.dumps({'clinics': all_clinics, 'news': []}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
