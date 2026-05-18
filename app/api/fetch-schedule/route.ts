import { NextRequest, NextResponse } from 'next/server';
import { parseHospital } from './parsers';

export async function POST(req: NextRequest) {
  try {
    const { hospitalId } = await req.json();
    const result = await parseHospital(hospitalId);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error });
    }
    return NextResponse.json({ success: true, clinics: result.clinics, news: result.news ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
