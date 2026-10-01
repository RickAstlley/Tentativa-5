import { NextRequest, NextResponse } from 'next/server';
import { addCommunityReview, getCommunityReviews, voteHelpful, deleteCommunityReview } from '@/lib/reviews.server';
import { calculateRealRangeStats } from '@/lib/reviews';
import { checkRateLimit, sanitizeInputString, validateNumberMargin, getClientIp } from '@/lib/security';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSlug = searchParams.get('slug');

    if (!rawSlug) {
      return NextResponse.json({ success: false, error: 'Slug da bike é obrigatório' }, { status: 400 });
    }

    const slug = sanitizeInputString(rawSlug, 100);
    const advertisedKm = validateNumberMargin(searchParams.get('autonomiaKm'), 10, 300, 45);
    const modelo = sanitizeInputString(searchParams.get('modelo') || 'E-Bike', 80);
    const marca = sanitizeInputString(searchParams.get('marca') || 'Marca', 60);
    const potenciaW = validateNumberMargin(searchParams.get('potenciaW'), 100, 5000, 350);

    const reviews = await getCommunityReviews({
      slug,
      modelo,
      marca,
      autonomiaKm: advertisedKm,
      potenciaW,
    });

    const stats = calculateRealRangeStats(reviews, advertisedKm);

    return NextResponse.json({
      success: true,
      reviews,
      stats,
      totalCount: reviews.length,
    });
  } catch (error: any) {
    console.error('[API Reviews GET] Erro:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro ao carregar avaliações' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);

    // Proteção contra payload excessivo (> 32KB)
    const contentLength = Number(req.headers.get('content-length') || '0');
    if (contentLength > 32768) {
      return NextResponse.json(
        { success: false, error: 'Payload excede o limite máximo permitido.' },
        { status: 413 }
      );
    }

    const body = await req.json();

    // 1. Verificação de voto útil com Rate Limit (máx 30 votos por minuto)
    if (body.action === 'helpful' && body.reviewId) {
      const voteRate = checkRateLimit(`vote_${clientIp}`, { windowMs: 60000, maxRequests: 30 });
      if (!voteRate.allowed) {
        return NextResponse.json(
          { success: false, error: 'Muitos votos em pouco tempo. Aguarde um instante.' },
          { status: 429 }
        );
      }

      const cleanReviewId = sanitizeInputString(body.reviewId, 80);
      const newVotes = await voteHelpful(cleanReviewId);
      return NextResponse.json({ success: true, helpfulCount: newVotes });
    }

    // 2. Rate Limit para publicação de nova avaliação (máx 5 por minuto por IP)
    const postRate = checkRateLimit(`review_post_${clientIp}`, { windowMs: 60000, maxRequests: 5 });
    if (!postRate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Limite de publicações atingido. Por favor, aguarde alguns minutos antes de enviar outro relato.' },
        { status: 429 }
      );
    }

    const {
      bikeSlug,
      author,
      city,
      userWeightKg,
      usageProfile,
      terrain,
      assistanceModeUsed,
      realRangeKm,
      advertisedRangeKm,
      rating,
      criteria,
      title,
      comment,
      timeUsing,
      honeypot, // Campo de segurança anti-bot
    } = body;

    // Se o honeypot foi preenchido, é um bot malicioso descartado silenciosamente
    if (honeypot && String(honeypot).trim() !== '') {
      return NextResponse.json({ success: true, message: 'Avaliação recebida com sucesso.' });
    }

    // Sanitização e validação de campos obrigatórios
    const cleanSlug = sanitizeInputString(bikeSlug, 100);
    const cleanAuthor = sanitizeInputString(author, 60);
    const cleanTitle = sanitizeInputString(title, 120);
    const cleanComment = sanitizeInputString(comment, 1500, true);

    if (!cleanSlug || !cleanAuthor || !cleanTitle || !cleanComment || !realRangeKm) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios ausentes ou com conteúdo inválido.' },
        { status: 400 }
      );
    }

    // Margem rígida para autonomia real (entre 5 e 300 km)
    const parsedRange = validateNumberMargin(realRangeKm, 5, 300, 0);
    if (parsedRange === 0) {
      return NextResponse.json(
        { success: false, error: 'Autonomia real deve ser um valor numérico entre 5 e 300 km.' },
        { status: 400 }
      );
    }

    // Margens rígidas para notas e peso
    const cleanRating = validateNumberMargin(rating, 1, 5, 5);
    const cleanWeight = userWeightKg ? validateNumberMargin(userWeightKg, 35, 200, 75) : undefined;
    const cleanAdvertised = advertisedRangeKm ? validateNumberMargin(advertisedRangeKm, 10, 300, 45) : undefined;

    const validTerrain: 'plano' | 'misto' | 'íngreme' =
      ['plano', 'misto', 'íngreme'].includes(terrain) ? terrain : 'misto';

    const cleanCriteria = criteria && typeof criteria === 'object' ? {
      batteryAutonomy: validateNumberMargin(criteria.batteryAutonomy, 1, 5, cleanRating),
      motorPower: validateNumberMargin(criteria.motorPower, 1, 5, cleanRating),
      comfort: validateNumberMargin(criteria.comfort, 1, 5, cleanRating),
      reliability: validateNumberMargin(criteria.reliability, 1, 5, cleanRating),
    } : undefined;

    const createdReview = await addCommunityReview({
      bikeSlug: cleanSlug,
      author: cleanAuthor,
      city: city ? sanitizeInputString(city, 60) : undefined,
      userWeightKg: cleanWeight,
      usageProfile: usageProfile ? sanitizeInputString(usageProfile, 100) : undefined,
      terrain: validTerrain,
      assistanceModeUsed: assistanceModeUsed ? sanitizeInputString(assistanceModeUsed, 80) : undefined,
      realRangeKm: parsedRange,
      advertisedRangeKm: cleanAdvertised,
      rating: cleanRating,
      criteria: cleanCriteria,
      title: cleanTitle,
      comment: cleanComment,
      timeUsing: timeUsing ? sanitizeInputString(timeUsing, 50) : undefined,
    });

    return NextResponse.json({
      success: true,
      review: createdReview,
      message: 'Avaliação enviada com sucesso!',
    });
  } catch (error: any) {
    console.error('[API Reviews POST] Erro:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro ao registrar avaliação' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 1. Verificação de credenciais de Administrador
    const authCheck = verifyServerAdmin(req);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado. Apenas administradores podem excluir avaliações.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawReviewId = searchParams.get('reviewId') || searchParams.get('id');

    if (!rawReviewId) {
      return NextResponse.json(
        { success: false, error: 'O ID da avaliação é obrigatório para exclusão.' },
        { status: 400 }
      );
    }

    const reviewId = sanitizeInputString(rawReviewId, 120);

    // 2. Executa exclusão no Firestore e no cache local com tombstone permanente
    const success = await deleteCommunityReview(reviewId);

    return NextResponse.json({
      success,
      deletedId: reviewId,
      message: 'Comentário removido com sucesso!',
    });
  } catch (error: any) {
    console.error('[API Reviews DELETE] Erro ao excluir comentário:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao excluir comentário.' },
      { status: 500 }
    );
  }
}

