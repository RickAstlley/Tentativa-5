import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, isFirestoreDatabaseAvailable, withAdminTimeout } from '@/lib/firebaseAdmin';
import { RankingComment } from '@/types/ranking';
import { checkRateLimit, sanitizeInputString, getClientIp } from '@/lib/security';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMMENTS_DIR = path.join(process.cwd(), 'data', 'ranking_comments');

function ensureDir() {
  try {
    if (!fs.existsSync(COMMENTS_DIR)) {
      fs.mkdirSync(COMMENTS_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Erro ao criar diretório de ranking_comments:', err);
  }
}

function getFilePath(slug: string) {
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(COMMENTS_DIR, `${safeSlug}.json`);
}

function loadLocalComments(slug: string): RankingComment[] {
  try {
    ensureDir();
    const fp = getFilePath(slug);
    if (fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[comments] Erro ao ler comentários locais:', err);
  }
  return [];
}

function saveLocalComments(slug: string, comments: RankingComment[]) {
  try {
    ensureDir();
    const fp = getFilePath(slug);
    fs.writeFileSync(fp, JSON.stringify(comments, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[comments] Erro ao salvar comentários locais:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug do ranking é obrigatório' }, { status: 400 });
    }

    let comments: RankingComment[] = [];

    // 1. Tentar Firestore Admin se disponível
    const adminDb = getAdminDb();
    if (adminDb && isFirestoreDatabaseAvailable()) {
      try {
        const snap = await withAdminTimeout(
          adminDb.collection('ranking_comments').where('rankingSlug', '==', slug).get(),
          1500,
          null
        );
        if (snap && !snap.empty) {
          snap.forEach((doc) => {
            comments.push(doc.data() as RankingComment);
          });
        }
      } catch (fErr) {
        console.warn('[comments] Falha ao consultar Firestore Admin, usando fallback local:', fErr);
      }
    }

    // 2. Se vazio ou offline, busca fallback local
    if (comments.length === 0) {
      comments = loadLocalComments(slug);
    }

    // Ordenar do mais recente para o mais antigo
    comments.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error: any) {
    console.error('[API /api/rankings/comments GET] Erro:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro ao buscar comentários' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Comentário é público, mas era aceito sem limite e sem sanitizar: qualquer
  // cliente podia inundar o arquivo e injetar HTML.
  const clientIp = getClientIp(req);
  const rate = checkRateLimit(`comment_${clientIp}`, { windowMs: 60_000, maxRequests: 3 });
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: 'Muitos comentários seguidos. Tente de novo em um minuto.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { rankingSlug, autor, cidade, texto } = body || {};

    if (!rankingSlug || !autor?.trim() || !texto?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Ranking, Nome do autor e Mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    // Campo honeypot: bots preenchem tudo, humanos não veem o campo.
    if (typeof body.website === 'string' && body.website.trim()) {
      return NextResponse.json({ success: true });
    }

    const newComment: RankingComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      rankingSlug: sanitizeInputString(rankingSlug, 120),
      autor: sanitizeInputString(autor, 60),
      cidade: cidade ? sanitizeInputString(cidade, 40) : undefined,
      texto: sanitizeInputString(texto, 1000),
      data: new Date().toISOString(),
      likes: 0,
    };

    // 1. Salvar localmente no servidor
    const currentList = loadLocalComments(rankingSlug);
    const updatedList = [newComment, ...currentList];
    saveLocalComments(rankingSlug, updatedList);

    // 2. Salvar no Firestore Admin se disponível
    const adminDb = getAdminDb();
    if (adminDb && isFirestoreDatabaseAvailable()) {
      try {
        await adminDb.collection('ranking_comments').doc(newComment.id).set(newComment);
      } catch (fErr) {
        console.warn('[comments] Falha no Firestore Admin ao salvar comentário:', fErr);
      }
    }

    return NextResponse.json({
      success: true,
      comment: newComment,
      message: 'Comentário publicado com sucesso!',
    });
  } catch (error: any) {
    console.error('[API /api/rankings/comments POST] Erro:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro ao publicar comentário' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // PATCH só incrementa curtida. Autenticação de admin é exigida para as demais
  // operações de moderação (remover, editar), que não vivem nesta rota.
  const clientIp = getClientIp(req);
  const rate = checkRateLimit(`comment_like_${clientIp}`, { windowMs: 60_000, maxRequests: 20 });
  if (!rate.allowed) {
    return NextResponse.json({ success: false, error: 'Muitas curtidas seguidas.' }, { status: 429 });
  }

  void verifyServerAdmin;

  try {
    const body = await req.json();
    const { commentId, rankingSlug } = body || {};

    if (!commentId || !rankingSlug) {
      return NextResponse.json({ success: false, error: 'ID do comentário e slug são obrigatórios' }, { status: 400 });
    }

    const currentList = loadLocalComments(rankingSlug);
    const targetIdx = currentList.findIndex((c) => c.id === commentId);
    if (targetIdx !== -1) {
      currentList[targetIdx].likes = (currentList[targetIdx].likes || 0) + 1;
      saveLocalComments(rankingSlug, currentList);
    }

    const adminDb = getAdminDb();
    if (adminDb && isFirestoreDatabaseAvailable()) {
      try {
        const docRef = adminDb.collection('ranking_comments').doc(commentId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const currentLikes = docSnap.data()?.likes || 0;
          await docRef.update({ likes: currentLikes + 1 });
        }
      } catch (fErr) {
        console.warn('[comments] Falha ao atualizar like no Firestore:', fErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
