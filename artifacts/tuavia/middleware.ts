import { NextResponse, type NextRequest } from 'next/server';

/**
 * Guarda de rota no servidor.
 *
 * Até aqui a proteção do painel era só no cliente: `app/admin/layout.tsx` lia a
 * sessão do `localStorage` e redirecionava. Sem esta camada, qualquer pessoa
 * baixava o HTML de `/admin/...` — componentes, textos e estrutura — mesmo sem
 * credencial. O que impedia o uso era a API, não a página.
 *
 * DELINEAMENTO (importante):
 *
 *   O middleware NÃO decide autorização. Ele só recusa requisição **sem
 *   nenhuma credencial**, o que evita gastar ciclo do Node em requisições
 *   anônimas. Toda decisão de validade continua em `verifyServerAdmin()`, dentro
 *   de cada rota, usando o mesmo código do Node.
 *
 *   Isso é deliberado. Uma verificação de assinatura duplicada aqui poderia
 *   divergir da do servidor em um detalhe e trancar o painel inteiro fora do
 *   ar. Fail-closed numa camada que não é a responsável é pior que fail-open
 *   numa camada que não é a de segurança.
 *
 *   O que sobra aqui e não existia antes: noindex no painel, X-Frame-Options
 *   e corte na borda de requisições anônimas.
 */

const PUBLIC_ADMIN_API = ['/api/admin/auth/login', '/api/admin/auth/logout'];

function isPublicAdminApi(pathname: string): boolean {
  return PUBLIC_ADMIN_API.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Recolhe qualquer credencial que o cliente tenha enviado, sem validar. */
function hasAnyCredential(request: NextRequest): boolean {
  if (request.headers.get('x-admin-token')) return true;
  if (request.headers.get('x-admin-passcode')) return true;
  if (request.headers.get('x-admin-email')) return true;
  if (request.headers.get('x-worker-secret')) return true;
  if (request.headers.get('x-csrf-token')) return true;
  if (request.headers.get('authorization')?.startsWith('Bearer ')) return true;

  // Sessão em cookie: o middleware ainda não a lê, mas sua presença indica
  // que o cliente tentou se autenticar. A validação é da rota.
  const cookie = request.headers.get('cookie') ?? '';
  return cookie.includes('admin_session=') || cookie.includes('tva_');
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // 1. API do admin sem credencial alguma: corta na borda, sem chegar ao Node.
  if (pathname.startsWith('/api/admin') && !isPublicAdminApi(pathname)) {
    if (!hasAnyCredential(request)) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    // Com credencial presente, quem valida é `verifyServerAdmin()` na rota.
    return NextResponse.next();
  }

  // 2. Páginas do painel: acessíveis (o cliente valida a sessão), mas nunca
  //    indexadas nem embutidas em frame.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('X-Frame-Options', 'DENY');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Só API do admin e páginas do painel. O restante do site não paga o custo.
  matcher: ['/api/admin/:path*', '/admin/:path*', '/admin'],
};
