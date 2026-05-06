import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// 有 Python 解析器的醫院
const PYTHON_PARSERS: Record<string, string> = {
  eck: 'parse_eck.py',
};

export async function POST(req: NextRequest) {
  try {
    const { hospitalId } = await req.json();

    const scriptName = PYTHON_PARSERS[hospitalId];

    if (!scriptName) {
      return NextResponse.json({
        success: false,
        error: `${hospitalId} 的解析器尚未建立`,
      });
    }

    const scriptPath = path.join(process.cwd(), 'scripts', scriptName);
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`, {
      timeout: 30000,
    });

    if (stderr && !stdout) {
      return NextResponse.json({ success: false, error: stderr });
    }

    const result = JSON.parse(stdout);

    if (result.error) {
      return NextResponse.json({ success: false, error: result.error });
    }

    return NextResponse.json({ success: true, clinics: result.clinics, news: result.news ?? [] });

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
