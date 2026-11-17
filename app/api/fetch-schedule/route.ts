import { NextRequest, NextResponse } from 'next/server';
import { parseHospital } from './parsers';

// 北醫、北慈的掛號網站擋國外 IP，Vercel 預設美國機房抓回來是空的 → 指定在亞洲機房跑
export const preferredRegion = ['hkg1', 'hnd1'];
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { hospitalId } = await req.json();
    const result = await parseHospital(hospitalId);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error });
    }
    // 抓到 0 筆幾乎都是網站擋連線或改版，不是真的沒門診；回報失敗，前端就不會把原本的門診洗掉
    if (result.clinics.length === 0) {
      return NextResponse.json({ success: false, error: '抓不到任何門診（網站可能擋連線或改版），保留原資料' });
    }
    return NextResponse.json({ success: true, clinics: result.clinics, news: result.news ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
