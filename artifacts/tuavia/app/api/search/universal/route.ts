import { NextRequest, NextResponse } from 'next/server';
import { getPublishedBikesServer } from '@/lib/ebikes.server';
import { getPublishedArticlesServer } from '@/lib/articles.server';
import { getPublishedRankingsServer } from '@/lib/rankings.server';
import { checkRateLimit, sanitizeInputString, getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface UniversalSearchResultItem {
  id: string;
  type: 'ebike' | 'article' | 'ranking';
  title: string;
  subtitle: string;
  url: string;
  imageUrl?: string;
  badge?: string;
  price?: number;
  highlight?: string;
}

export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const searchRate = checkRateLimit(`search_${clientIp}`, { windowMs: 60000, maxRequests: 60 });
    if (!searchRate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Muitas pesquisas em pouco tempo. Aguarde um instante.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get('q') || '';
    const scope = searchParams.get('scope') || 'all'; // 'all' | 'ebikes' | 'articles' | 'rankings'
    const limit = Math.min(Number(searchParams.get('limit')) || 15, 30);

    const query = sanitizeInputString(rawQuery, 80).toLowerCase();

    if (!query) {
      return NextResponse.json({
        success: true,
        query: '',
        scope,
        results: {
          ebikes: [],
          articles: [],
          rankings: [],
          total: 0,
        },
      });
    }

    const promises: [
      Promise<any[]>,
      Promise<any[]>,
      Promise<any[]>
    ] = [
      scope === 'all' || scope === 'ebikes' ? getPublishedBikesServer() : Promise.resolve([]),
      scope === 'all' || scope === 'articles' ? getPublishedArticlesServer() : Promise.resolve([]),
      scope === 'all' || scope === 'rankings' ? getPublishedRankingsServer() : Promise.resolve([]),
    ];

    const [bikes, articles, rankings] = await Promise.all(promises);

    // 1. Filtrar E-Bikes
    const matchedBikes: UniversalSearchResultItem[] = bikes
      .filter((b) => {
        if (!b) return false;
        const name = (b.name || '').toLowerCase();
        const brand = (b.brand || '').toLowerCase();
        const category = (b.usoPrincipal || b.category || '').toLowerCase();
        const motor = (b.specs?.motor || '').toLowerCase();
        return (
          name.includes(query) ||
          brand.includes(query) ||
          category.includes(query) ||
          motor.includes(query)
        );
      })
      .slice(0, scope === 'ebikes' ? limit : 6)
      .map((b) => ({
        id: b.slug || b.id,
        type: 'ebike',
        title: `${b.brand} ${b.name}`,
        subtitle: `${b.usoPrincipal || 'E-Bike'} • ${b.specs?.motor || 'Motor elétrico'} • Autonomia ${b.specs?.autonomia || 'N/D'}`,
        url: `/bike/${b.slug || b.id}`,
        imageUrl: b.imageUrl,
        badge: b.usoPrincipal || 'E-Bike',
        price: b.bestOffer?.price,
        highlight: b.specs?.autonomia ? `Autonomia ${b.specs.autonomia}` : undefined,
      }));

    // 2. Filtrar Artigos
    const matchedArticles: UniversalSearchResultItem[] = articles
      .filter((a) => {
        if (!a) return false;
        const title = (a.title || '').toLowerCase();
        const excerpt = (a.excerpt || '').toLowerCase();
        const category = (a.category || '').toLowerCase();
        const tags = Array.isArray(a.tags) ? a.tags.join(' ').toLowerCase() : '';
        return (
          title.includes(query) ||
          excerpt.includes(query) ||
          category.includes(query) ||
          tags.includes(query)
        );
      })
      .slice(0, scope === 'articles' ? limit : 5)
      .map((a) => ({
        id: a.slug || a.id,
        type: 'article',
        title: a.title,
        subtitle: a.excerpt || a.category || 'Dossiê Técnico',
        url: `/artigos/${a.slug}`,
        imageUrl: a.featuredImage || a.imageUrl,
        badge: a.category || 'Artigo',
        highlight: a.readTime ? `${a.readTime} min de leitura` : undefined,
      }));

    // 3. Filtrar Rankings
    const matchedRankings: UniversalSearchResultItem[] = rankings
      .filter((r) => {
        if (!r || r.publicado === false) return false;
        const title = (r.titulo || '').toLowerCase();
        const subtitle = (r.subtitulo || '').toLowerCase();
        const cat = (r.categoria || '').toLowerCase();
        const items = Array.isArray(r.itens)
          ? r.itens.map((i: any) => `${i.tituloItem || ''} ${i.marca || ''}`).join(' ').toLowerCase()
          : '';
        return (
          title.includes(query) ||
          subtitle.includes(query) ||
          cat.includes(query) ||
          items.includes(query)
        );
      })
      .slice(0, scope === 'rankings' ? limit : 4)
      .map((r) => ({
        id: r.slug || r.id,
        type: 'ranking',
        title: r.titulo,
        subtitle: r.subtitulo || 'Pódio de Destaques e Avaliação Técnica',
        url: `/rankings/${r.slug}`,
        imageUrl: r.itens?.[0]?.imagemUrl,
        badge: 'Top Ranking',
        highlight: r.quantidadeItens ? `${r.quantidadeItens} modelos avaliados` : undefined,
      }));

    const total = matchedBikes.length + matchedArticles.length + matchedRankings.length;

    return NextResponse.json({
      success: true,
      query: rawQuery,
      scope,
      results: {
        ebikes: matchedBikes,
        articles: matchedArticles,
        rankings: matchedRankings,
        total,
      },
    });
  } catch (err: any) {
    console.error('[API Universal Search] Erro:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao realizar busca' },
      { status: 500 }
    );
  }
}
