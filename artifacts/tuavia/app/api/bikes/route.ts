import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, withAdminTimeout, markFirestoreUnavailable, isFirestoreDatabaseAvailable } from '@/lib/firebaseAdmin';
import { collectionsFor } from '@/lib/firestoreCollections';
import { EBikeGrouped } from '@/types/ebike';
import {
  getAllBikesServer,
  getBikeBySlugServer,
  saveBikeToServerFile,
  deleteBikeFromServerFile,
  getDeletedSlugsServer,
} from '@/lib/serverStorage';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { invalidateBikesServerCache } from '@/lib/ebikes.server';
import { sanitizeInputString, sanitizeUrl, validateNumberMargin } from '@/lib/security';
import { allocateAndNormalizeSpecSections } from '@/lib/specAllocations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    
    // Suporte para contagem rápida (?count=1) - usado pelo NavigationRail
    const countOnly = searchParams.get('count') === '1';

    const adminDb = getAdminDb();
    const deleted = await getDeletedSlugsServer();
    const deletedSet = new Set(deleted.bikes || []);

    if (slug) {
      if (deletedSet.has(slug)) {
        return NextResponse.json({ success: false, error: 'Bike was deleted', deleted: true }, { status: 404 });
      }

      // 1. Tenta no Firestore Admin se disponível com timeout rápido
      if (adminDb && isFirestoreDatabaseAvailable()) {
        try {
          const docSnap = await withAdminTimeout(adminDb.collection('bikes').doc(slug).get(), 1500, null);
          if (docSnap && docSnap.exists) {
            return NextResponse.json({ success: true, bike: docSnap.data() as EBikeGrouped, source: 'firebase' });
          }
        } catch (dbErr) {
          console.warn('Erro ao consultar Firestore para bike:', dbErr);
        }
      }

      // 2. Fallback resiliente no armazenamento em arquivo do servidor
      const serverBike = await getBikeBySlugServer(slug);
      if (serverBike) {
        return NextResponse.json({ success: true, bike: serverBike, source: 'local-fallback' });
      }

      return NextResponse.json({ success: false, error: 'Bike not found' }, { status: 404 });
    }

    // Busca todas as bikes excluindo as deletadas
    const map = new Map<string, EBikeGrouped>();
    const serverBikes = await getAllBikesServer();
    serverBikes.forEach((b) => {
      if (b && b.slug && !deletedSet.has(b.slug)) {
        map.set(b.slug, b);
      }
    });
    let source: 'firebase' | 'local-fallback' = 'local-fallback';

    if (adminDb && isFirestoreDatabaseAvailable()) {
      const bikeCollections = collectionsFor('bikes');
      for (const colName of bikeCollections) {
        try {
          const snapshot = await withAdminTimeout(() => adminDb.collection(colName).get(), 1200, null);
          if (snapshot && !snapshot.empty) {
            snapshot.forEach((doc) => {
              const b = doc.data() as EBikeGrouped;
              if (b && b.slug && !deletedSet.has(b.slug)) {
                // Sanitização defensiva para garantir que nunca quebre renderização
                const sanitizedBike: EBikeGrouped = {
                  slug: String(b.slug),
                  modelo: String(b.modelo || 'E-Bike'),
                  marca: String(b.marca || 'Genérica'),
                  usoPrincipal: b.usoPrincipal || 'Urbana',
                  autonomiaKm: typeof b.autonomiaKm === 'number' ? b.autonomiaKm : (Number(b.autonomiaKm) || 0),
                  potenciaW: typeof b.potenciaW === 'number' ? b.potenciaW : (Number(b.potenciaW) || 0),
                  pesoKg: typeof b.pesoKg === 'number' ? b.pesoKg : (Number(b.pesoKg) || null as unknown as number),
                  tempoCargaHoras: typeof b.tempoCargaHoras === 'number' ? b.tempoCargaHoras : (Number(b.tempoCargaHoras) || null as unknown as number),
                  imagemUrl: String(b.imagemUrl || ''),
                  galleryImages: Array.isArray(b.galleryImages) ? b.galleryImages.filter((img) => typeof img === 'string') : [],
                  menorPreco: typeof b.menorPreco === 'number' ? b.menorPreco : (Number(b.menorPreco) || 0),
                  maiorPreco: typeof b.maiorPreco === 'number' ? b.maiorPreco : (Number(b.maiorPreco) || 0),
                  ofertas: Array.isArray(b.ofertas) ? b.ofertas : [],
                  destaque: b.destaque ? String(b.destaque) : undefined,
                  createdAt: b.createdAt ? String(b.createdAt) : undefined,
                  updatedAt: b.updatedAt ? String(b.updatedAt) : undefined,
                  publishedAt: b.publishedAt ? String(b.publishedAt) : undefined,
                };
                map.set(sanitizedBike.slug, sanitizedBike);
              }
            });
            source = 'firebase';
          }
        } catch (dbErr) {
          console.warn(`Erro ao consultar coleção ${colName} no Firestore:`, dbErr);
        }
      }
    }

    const sortedBikes = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || a.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
      const timeB = new Date(b.createdAt || b.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
      return timeB - timeA;
    });

    // Resposta otimizada para contagem
    if (countOnly) {
      return NextResponse.json(
        { success: true, count: sortedBikes.length },
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        bikes: sortedBikes,
        deletedSlugs: deleted.bikes,
        source,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching bikes from API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // A checagem de admin é o gate da escrita. Antes ela só servia para permitir
  // recriar um item deletado por tombstone — ou seja, qualquer cliente sem
  // credencial publicava e-bikes livremente.
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { bike } = body;

    if (!bike || !bike.slug || !bike.marca || !bike.modelo) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios ausentes (slug, marca, modelo).' },
        { status: 400 }
      );
    }

    const cleanSlug = String(bike.slug).trim();
    const deleted = await getDeletedSlugsServer();
    const isDeleted = (deleted.bikes || []).includes(cleanSlug);

    // Item removido por administrador não volta por auto-sync do cliente.
    if (isDeleted && !auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Item foi removido por administrador.', deleted: true },
        { status: 410 }
      );
    }

    const cleanBike: EBikeGrouped = {
      slug: sanitizeInputString(cleanSlug, 100).toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
      modelo: sanitizeInputString(bike.modelo, 100),
      marca: sanitizeInputString(bike.marca, 80),
      usoPrincipal: bike.usoPrincipal || 'Urbana',
      autonomiaKm: validateNumberMargin(bike.autonomiaKm, 5, 350, 45),
      potenciaW: validateNumberMargin(bike.potenciaW, 100, 5000, 350),
      pesoKg: bike.pesoKg !== null && bike.pesoKg !== undefined
        ? validateNumberMargin(bike.pesoKg, 5, 95, 24)
        : (null as unknown as number),
      tempoCargaHoras: bike.tempoCargaHoras !== null && bike.tempoCargaHoras !== undefined
        ? validateNumberMargin(bike.tempoCargaHoras, 0.5, 24, 5)
        : (null as unknown as number),
      imagemUrl: sanitizeUrl(bike.imagemUrl, ''),
      galleryImages: Array.isArray(bike.galleryImages)
        ? bike.galleryImages
            .map((img: any) => sanitizeUrl(img))
            .filter((img: string) => img.length > 0)
        : [],
      menorPreco: validateNumberMargin(bike.menorPreco, 500, 250000, 5000),
      maiorPreco: validateNumberMargin(bike.maiorPreco, 500, 250000, 5000),
      ofertas: Array.isArray(bike.ofertas)
        ? bike.ofertas.map((o: any) => ({
            ...o,
            loja: sanitizeInputString(o.loja, 60),
            preco: validateNumberMargin(o.preco, 500, 250000, 5000),
            linkProduto: sanitizeUrl(o.linkProduto, ''),
          }))
        : [],
      specSections: Array.isArray(bike.specSections) && bike.specSections.length > 0
        ? allocateAndNormalizeSpecSections(undefined, bike.specSections, {
            potenciaW: bike.potenciaW,
            autonomiaKm: bike.autonomiaKm,
            pesoKg: bike.pesoKg,
            tempoCargaHoras: bike.tempoCargaHoras,
            usoPrincipal: bike.usoPrincipal,
            marca: bike.marca,
            modelo: bike.modelo,
          })
        : [],
      pros: Array.isArray(bike.pros)
        ? bike.pros.map((p: any) => sanitizeInputString(p, 150)).filter((p: string) => p.length > 0)
        : [],
      cons: Array.isArray(bike.cons)
        ? bike.cons.map((c: any) => sanitizeInputString(c, 150)).filter((c: string) => c.length > 0)
        : [],
      idealFor: sanitizeInputString(bike.idealFor, 300),
      resumoExecutivo: sanitizeInputString(bike.resumoExecutivo, 1500, true),
      verdict: sanitizeInputString(bike.verdict, 1500, true),
      badge: sanitizeInputString(bike.badge, 60),
      createdAt: bike.createdAt || new Date().toISOString(),
    };

    // Salva no storage de arquivos do servidor para persistência permanente local
    try {
      await saveBikeToServerFile(cleanBike);
    } catch (saveErr) {
      console.warn('Falha ao salvar no storage local do servidor:', saveErr);
    }

    const adminDb = getAdminDb();

    if (adminDb) {
      try {
        await adminDb.collection('bikes').doc(cleanBike.slug).set(cleanBike, { merge: true });
        return NextResponse.json({
          success: true,
          storage: 'firestore_admin_and_server',
          bike: cleanBike,
        });
      } catch (adminErr: any) {
        if (adminErr?.code === 5 || String(adminErr).includes('5 NOT_FOUND') || String(adminErr).includes('does not exist')) {
          markFirestoreUnavailable();
          console.info('[bikes] Banco Firestore (default) indisponível. Bike salva com sucesso no storage do servidor.');
        } else {
          console.warn('Falha no Firestore Admin ao salvar bike, retornando payload seguro:', adminErr?.message || adminErr);
        }
      }
    }

    invalidateBikesServerCache();

    return NextResponse.json({
      success: true,
      storage: 'server_file_storage',
      bike: cleanBike,
    });
  } catch (error: any) {
    console.error('Erro na API de salvar bike:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  // Exclusão não passa por tombstone: apaga do disco e do Firestore. Sem
  // credencial, qualquer cliente HTTP apagava conteúdo publicado.
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug obrigatório.' }, { status: 400 });
    }

    await deleteBikeFromServerFile(slug);

    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        await adminDb.collection('bikes').doc(slug).delete();
      } catch (err) {
        console.warn('Erro ao deletar no Firestore Admin:', err);
      }
    }

    invalidateBikesServerCache();

    return NextResponse.json({ success: true, deletedSlug: slug });
  } catch (error: any) {
    console.error('Erro ao deletar bike:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
