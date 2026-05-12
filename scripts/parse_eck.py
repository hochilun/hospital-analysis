#!/usr/bin/env python3
"""恩主公醫院門診時刻表解析器
注意：恩主公網站有 hCaptcha 保護，無法自動抓取。
請在 app 內手動點選「恩主公」更新鍵，並在瀏覽器完成驗證。
科別連結：
  婦產科: https://www.eck.org.tw/guide/outpatient/registered/我要掛號/?getDiv=GetDivDoctorListInfoWeb&DivNo=5000
  耳鼻喉科: https://www.eck.org.tw/guide/outpatient/registered/我要掛號/?getDiv=GetDivDoctorListInfoWeb&DivNo=5400
  一般外科: https://www.eck.org.tw/guide/outpatient/registered/我要掛號/?getDiv=GetDivDoctorListInfoWeb&DivNo=3100
  泌尿科: https://www.eck.org.tw/guide/outpatient/registered/我要掛號/?getDiv=GetDivDoctorListInfoWeb&DivNo=3400
"""
import json, sys

print(json.dumps({
    'error': '恩主公需要手動更新：網站有 hCaptcha 保護，請直接在瀏覽器開啟門診頁面後點更新',
    'manualUrls': {
        '婦產科': 'https://www.eck.org.tw/guide/outpatient/registered/%e6%88%91%e8%a6%81%e6%8e%9b%e8%99%9f/?getDiv=GetDivDoctorListInfoWeb&DivNo=5000',
        '耳鼻喉科': 'https://www.eck.org.tw/guide/outpatient/registered/%e6%88%91%e8%a6%81%e6%8e%9b%e8%99%9f/?getDiv=GetDivDoctorListInfoWeb&DivNo=5400',
        '一般外科': 'https://www.eck.org.tw/guide/outpatient/registered/%e6%88%91%e8%a6%81%e6%8e%9b%e8%99%9f/?getDiv=GetDivDoctorListInfoWeb&DivNo=3100',
        '泌尿科': 'https://www.eck.org.tw/guide/outpatient/registered/%e6%88%91%e8%a6%81%e6%8e%9b%e8%99%9f/?getDiv=GetDivDoctorListInfoWeb&DivNo=3400',
    }
}, ensure_ascii=False))
