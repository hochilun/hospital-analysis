import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { ClinicSlot, NewsItem } from '@/types';

// 各醫院爬蟲解析器（之後逐一實作）
const parsers: Record<string, (html: string) => { clinics: ClinicSlot[]; news: NewsItem[] }> = {
  // 各醫院解析器後續加入
};

export async function POST(req: NextRequest) {
  try {
    const { hospitalId } = await req.json();
    const hospital = HOSPITALS.find(h => h.id === hospitalId);

    if (!hospital) {
      return NextResponse.json({ success: false, error: '找不到醫院' });
    }

    // 抓取頁面
    const response = await fetch(hospital.scheduleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `無法連線到醫院網站（${response.status}）` });
    }

    const html = await response.text();
    const parser = parsers[hospitalId];

    if (!parser) {
      // 尚未實作此醫院的解析器，回傳原始 HTML 給前端提示
      return NextResponse.json({
        success: false,
        error: `${hospital.name} 的門診解析器尚未建立，請稍後`,
      });
    }

    const { clinics, news } = parser(html);
    return NextResponse.json({ success: true, clinics, news });

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
