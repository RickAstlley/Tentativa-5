import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { syncDiskToFirestore } from '@/lib/syncDiskToFirestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYNC_ROUTE_TIMEOUT_MS = 8000;

type SyncResult = Awaited<ReturnType<typeof syncDiskToFirestore>>;

async function runSyncWithTimeout(force: boolean): Promise<SyncResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), SYNC_ROUTE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([syncDiskToFirestore(force), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function timeoutResponse() {
  return NextResponse.json(
    {
      success: false,
      error: `A sincronização excedeu ${SYNC_ROUTE_TIMEOUT_MS / 1000}s e foi liberada para não bloquear o painel. O processo pode continuar em segundo plano.`,
      errorCode: 'SYNC_TIMEOUT',
      retryable: true,
    },
    { status: 504 }
  );
}

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  const result = await runSyncWithTimeout(false);
  if (!result) return timeoutResponse();
  return NextResponse.json({ success: true, syncStatus: result });
}

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  const result = await runSyncWithTimeout(true);
  if (!result) return timeoutResponse();
  return NextResponse.json({
    success: true,
    message: 'Sincronização manual acionada com sucesso!',
    syncStatus: result,
  });
}
