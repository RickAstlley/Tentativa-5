import { NextRequest, NextResponse } from 'next/server';
import { migrateDataToFirestore } from '@/scripts/migrate-to-firestore';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado. Autenticação de administrador necessária.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const result = await migrateDataToFirestore();
    return NextResponse.json({
      success: true,
      message: 'Migração de dados para o Firestore concluída com sucesso!',
      data: result,
    });
  } catch (error: unknown) {
    console.error('Erro na rota de migração:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na migração';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
