#!/usr/bin/env python3
"""臺北醫學大學附設醫院門診時刻表解析器（col-1_4 結構版）"""
import urllib.request, re, json, sys, time

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Referer': 'https://www.tmuh.org.tw/',
    'Accept-Language': 'zh-TW,zh;q=0.9',
}

DEPT_PAGES = [
    ('08',  '泌尿外科'),
    ('09',  '耳鼻喉科'),
    ('BW',  '一般外科'),
    ('BA',  '一般外科'),
]

# 婦產科用個人掛號頁，確保名字和診間完整對應
# 來源：/team/team/052（婦科）、/team/team/053（產科）、/team/team/054（生殖醫學）
OBGYN_DOCTORS = [
    ('金宏諺', '052/050018'), ('林弘慈', '052/050029'), ('侯容琇', '052/050139'),
    ('邱德生', '052/052094'), ('張景文', '052/050006'), ('王懿德', '052/050242'),
    ('黃佩慎', '052/050017'), ('邱彥諧', '052/052008'), ('王培儀', '052/052092'),
    ('林芸卉', '052/050026'), ('陳子健', '052/050027'), ('傅皓聲', '052/052105'),
    ('吳彥蓁', '052/052106'), ('林秉侖', '052/052108'), ('林貝珊', '052/050030'),
    ('劉偉民', '052/052107'),
    ('區慶建', '053/050216'), ('簡立維', '053/050117'),
    ('陳啟煌', '054/050054'), ('仇思源', '054/052100'),
]

DAY_CN = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        return urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')
    except Exception:
        return ''


def parse_dept(html: str, dept_name: str, seen: set) -> list:
    clinics = []

    # 以 doctor_name 分割成各醫師區塊
    # 結構: <p class="doctor_name">醫師名 醫師</p> ... <div class="...d_calandar">...</div>
    blocks = re.split(r'(?=<p class="doctor_name">)', html)

    for block in blocks:
        # 提取醫師名字
        name_m = re.search(
            r'<p class="doctor_name">\s*\r?\n?\s*([一-鿿 ()（）]{2,8})\s*\r?\n?\s*(?:醫師\s*)?\r?\n?\s*<!--.*?-->\s*\r?\n?\s*</p>',
            block, re.DOTALL
        )
        if not name_m:
            continue
        raw = name_m.group(1).strip()
        doctor = re.sub(r'[（(].+', '', raw).strip().replace('　', '').replace(' ', '')
        if len(doctor) < 2:
            continue

        # 找 d_calandar
        cal_m = re.search(r'd_calandar">(.*?)(?=<p class="doctor_name">|$)', block, re.DOTALL)
        if not cal_m:
            continue
        cal = cal_m.group(1)

        # 取所有 col-1_4 cells 的文字
        cells = []
        for c in re.findall(r'class="col-sm-2 col-xs-2 col-1_4"[^>]*>(.*?)</div>', cal, re.DOTALL):
            text = re.sub(r'<[^>]+>', ' ', c)
            text = re.sub(r'\s+', ' ', text).strip()
            cells.append(text)

        if len(cells) < 8:
            continue

        # 前 7 cells = 日期標頭，取星期幾
        day_headers = []
        for cell in cells[:7]:
            m = re.search(r'星期([一二三四五六日])', cell)
            day_headers.append(DAY_CN.get(m.group(1), -1) if m else -1)

        # 後面 cells 依時段分組（每 7 個 = 一個時段列）
        session_cells = cells[7:]
        sessions = ['早', '午', '晚']

        for si, session in enumerate(sessions):
            group = session_cells[si * 7:(si + 1) * 7]
            for col, (day_of_week, cell_text) in enumerate(zip(day_headers, group)):
                if day_of_week < 0:
                    continue
                # 移除時段標籤本身，看剩餘有沒有診室碼
                remainder = cell_text
                for s in sessions:
                    remainder = remainder.replace(s, '', 1).strip()
                remainder = remainder.strip()

                # 有診室碼 OR 停診（停診也代表平常有那個時段的門診）
                has_clinic = bool(remainder) and len(remainder) >= 2

                if has_clinic:
                    key = f'{doctor}_{day_of_week}_{session}'
                    if key not in seen:
                        seen.add(key)
                        clinics.append({
                            'doctor': doctor,
                            'department': dept_name,
                            'dayOfWeek': day_of_week,
                            'session': session,
                        })

    return clinics


def parse_individual(html: str, doctor_name: str, dept_name: str, seen: set) -> list:
    """解析單一醫師的個人掛號頁（與 parse_dept 相同邏輯）"""
    cells = re.findall(
        r'class="col-sm-2 col-xs-2 col-1_4"[^>]*>(.*?)</div>', html, re.DOTALL
    )
    cells = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', c)).strip() for c in cells]
    if len(cells) < 8:
        return []

    day_headers = []
    for cell in cells[:7]:
        m = re.search(r'星期([一二三四五六日])', cell)
        day_headers.append(DAY_CN.get(m.group(1), -1) if m else -1)

    sessions = ['早', '午', '晚']
    clinics = []
    session_cells = cells[7:]

    for si, session in enumerate(sessions):
        group = session_cells[si * 7:(si + 1) * 7]
        for day_of_week, cell_text in zip(day_headers, group):
            if day_of_week < 0:
                continue
            remainder = cell_text
            for s in sessions:
                remainder = remainder.replace(s, '', 1).strip()
            remainder = remainder.strip()
            if remainder and len(remainder) >= 2:
                key = f'{doctor_name}_{day_of_week}_{session}'
                if key not in seen:
                    seen.add(key)
                    clinics.append({
                        'doctor': doctor_name,
                        'department': dept_name,
                        'dayOfWeek': day_of_week,
                        'session': session,
                    })
    return clinics


def main():
    all_clinics = []
    seen = set()

    # 其他科用部門掛號頁
    for code, dept_name in DEPT_PAGES:
        html = fetch(f'https://www.tmuh.org.tw/service/regist/{code}')
        if html:
            clinics = parse_dept(html, dept_name, seen)
            all_clinics.extend(clinics)
        time.sleep(0.5)

    # 婦產科用個人掛號頁（更精準）
    for doctor_name, url_path in OBGYN_DOCTORS:
        html = fetch(f'https://www.tmuh.org.tw/service/regist/{url_path}')
        if html:
            clinics = parse_individual(html, doctor_name, '婦產科', seen)
            all_clinics.extend(clinics)
        time.sleep(0.3)

    print(json.dumps({'clinics': all_clinics, 'news': []}, ensure_ascii=False))


if __name__ == '__main__':
    main()
