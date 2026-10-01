import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { invalidateArticlesServerCache } from '@/lib/articles.server';
import { invalidateBikesServerCache } from '@/lib/ebikes.server';
import { invalidateRankingsServerCache } from '@/lib/rankings.server';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';
import { getAdminDb, isFirestoreDatabaseAvailable } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    ensureServerEnvLoaded();
    const syncSecret = cleanEnvValue(process.env.TUAVIA_SYNC_SECRET || process.env.ADMIN_SECRET_KEY);
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-sync-secret');

    if (syncSecret) {
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader?.trim();
      if (!token || token !== syncSecret) {
        return NextResponse.json({ success: false, error: 'Não autorizado: Token de sincronização inválido.' }, { status: 401 });
      }
    }

    // Invalida caches em memória dos dados
    invalidateArticlesServerCache();
    invalidateBikesServerCache();
    invalidateRankingsServerCache();

    // Revalidação sob demanda do Next.js App Router
    try {
      revalidatePath('/');
      revalidatePath('/artigos');
      revalidatePath('/radar');
      revalidatePath('/ebike');
      revalidatePath('/top-rankings');
      revalidatePath('/comparador');
    } catch (_) {}

    const firestoreOnline = isFirestoreDatabaseAvailable() && Boolean(getAdminDb());

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Sincronização e revalidação de cache executadas com sucesso.',
      firestoreOnline,
    });
  } catch (err: any) {
    console.error('[API /api/sync/ping] Erro:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
