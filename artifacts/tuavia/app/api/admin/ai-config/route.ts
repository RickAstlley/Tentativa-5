import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_FILE = path.join(process.cwd(), '.ai-config.json');

interface AIConfig {
  isLocalNIM: boolean;
  baseUrl: string;
  apiKeys: string[];
  selectedModels: string[];
  workerSecret?: string;
  executorUrl?: string;
}

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Não autorizado', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const config: AIConfig = {
      isLocalNIM: body.isLocalNIM,
      baseUrl: body.baseUrl,
      apiKeys: body.apiKeys || [],
      selectedModels: body.selectedModels || [],
      workerSecret: body.workerSecret,
      executorUrl: body.executorUrl,
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    // Also update process.env for immediate use (will persist until restart)
    if (config.isLocalNIM) {
      process.env.NVIDIA_BASE_URL = config.baseUrl;
      process.env.NVIDIA_API_KEY = config.apiKeys[0] || 'local-nim-key';
    } else {
      process.env.NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
      if (config.apiKeys[0]) process.env.NVIDIA_API_KEY = config.apiKeys[0];
    }
    if (config.workerSecret) process.env.LLM_WORKER_SECRET = config.workerSecret;
    if (config.executorUrl) process.env.LLM_EXECUTOR_BASE_URL = config.executorUrl;

    return NextResponse.json({ success: true, message: 'Configuração salva' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, errorCode: 'SAVE_FAILED' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Não autorizado', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    let config: AIConfig | null = null;
    if (fs.existsSync(CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, errorCode: 'READ_FAILED' },
      { status: 500 }
    );
  }
}