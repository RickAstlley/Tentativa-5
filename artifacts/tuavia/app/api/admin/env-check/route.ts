import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { parseServiceAccount, getRawServiceAccountEnv } from '@/lib/firebaseAdmin';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function maskSecret(val?: string, visibleChars = 4): string {
  if (!val) return '❌ Não configurado';
  const cleaned = cleanEnvValue(val);
  if (cleaned.length === 0) return '❌ Não configurado';
  if (cleaned.length <= visibleChars * 2) {
    return `${cleaned.substring(0, 2)}***${cleaned.substring(cleaned.length - 2)}`;
  }
  return `${cleaned.substring(0, visibleChars)}...${cleaned.substring(cleaned.length - visibleChars)} (${cleaned.length} chars)`;
}

export async function GET(req: NextRequest) {
  const envStatus = ensureServerEnvLoaded();
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      {
        success: false,
        message: 'Acesso não autorizado ao diagnóstico de variáveis de ambiente.',
      },
      { status: 401 }
    );
  }

  const rawSA = getRawServiceAccountEnv();
  const parsedSA = parseServiceAccount(rawSA);

  const envs = {
    // 1. URLs do Site e Servidor
    APP_URL: {
      status: Boolean(cleanEnvValue(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL)),
      value: cleanEnvValue(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL) || 'Não configurado',
      required: true,
      description: 'URL canônica do site na Hostinger (usada em sitemaps e SEO)',
    },

    // 2. Acesso Admin
    ADMIN_PASSCODE: {
      status: Boolean(cleanEnvValue(process.env.ADMIN_PASSCODE)),
      masked: maskSecret(process.env.ADMIN_PASSCODE),
      required: true,
      description: 'Senha principal de login no painel /admin',
    },
    ADMIN_SESSION_SECRET: {
      status: Boolean(cleanEnvValue(process.env.ADMIN_SESSION_SECRET)),
      masked: maskSecret(process.env.ADMIN_SESSION_SECRET),
      required: true,
      description: 'Segredo de criptografia do cookie de sessão admin',
    },


    // 3. Firebase Client & Admin
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: {
      status: Boolean(cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID)),
      value: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID) || 'gen-lang-client-0046421177',
      required: true,
      description: 'ID do projeto Firebase no cliente/servidor',
    },
    FIREBASE_ADMIN_SERVICE_ACCOUNT: {
      status: Boolean(rawSA && parsedSA),
      masked: rawSA ? (parsedSA ? `✅ Válido (Project: ${parsedSA.project_id || 'OK'})` : '⚠️ Presente mas inválido/mal-formatado') : '❌ Não configurado',
      required: false,
      description: 'JSON da conta de serviço para sincronização direta do Firestore',
    },
  };

  const missingRequired = Object.entries(envs)
    .filter(([_, info]) => info.required && !info.status)
    .map(([key]) => key);

  const isConfigCorrect = missingRequired.length === 0;

  return NextResponse.json({
    success: true,
    hostingerConfigured: isConfigCorrect,
    missingRequired,
    loadedFiles: envStatus.loadedFiles,
    summaryMessage: isConfigCorrect
      ? 'Todas as variáveis de ambiente obrigatórias para a Hostinger estão perfeitamente configuradas e ativas!'
      : `Atenção: Existem ${missingRequired.length} variável(is) obrigatória(s) ausente(s) no ambiente da Hostinger: ${missingRequired.join(', ')}`,
    environments: envs,
  });
}
