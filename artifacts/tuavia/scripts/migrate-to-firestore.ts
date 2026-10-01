import fs from 'fs';
import path from 'path';
import { getAdminDb } from '../lib/firebaseAdmin';
import { EBikeOfferFlat, EBikeGrouped, EBikeStoreOffer } from '../types/ebike';
import { getAllArticlesServer, getAllBikesServer } from '../lib/serverStorage';
import { normalizeArticle } from '../lib/articles';

export function generateSlug(marca: string, modelo: string): string {
  return `${marca}-${modelo}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function cleanUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export async function migrateDataToFirestore() {
  console.log('🚀 Iniciando migração de dados do disco/servidor para o Firestore...');
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Firestore Admin não está configurado ou autenticado.');
  }

  // 1. Carrega E-Bikes (mescla estático + servidor)
  const serverBikes = await getAllBikesServer();
  let flatBikes: EBikeOfferFlat[] = [];
  try {
    const rawContent = fs.readFileSync(path.join(process.cwd(), 'data', 'ebikes.json'), 'utf-8');
    if (rawContent && rawContent.trim()) {
      flatBikes = JSON.parse(rawContent) as EBikeOfferFlat[];
    }
  } catch (_) {}
  const groupedMap: { [key: string]: EBikeGrouped } = {};

  flatBikes.forEach((bike) => {
    const slug = generateSlug(bike.marca, bike.modelo);
    const storeOffer: EBikeStoreOffer = {
      id: bike.id,
      loja: bike.loja,
      preco: bike.preco,
      linkProduto: bike.linkProduto,
      disponibilidade: bike.disponibilidade,
      dataAtualizacao: bike.dataAtualizacao,
      observacoes: bike.observacoes || '',
    };

    if (!groupedMap[slug]) {
      groupedMap[slug] = {
        slug,
        modelo: bike.modelo,
        marca: bike.marca,
        autonomiaKm: bike.autonomiaKm,
        potenciaW: bike.potenciaW,
        usoPrincipal: bike.usoPrincipal,
        imagemUrl: bike.imagemUrl,
        menorPreco: bike.preco,
        maiorPreco: bike.preco,
        ofertas: [storeOffer],
        pesoKg: bike.pesoKg ?? (null as unknown as number),
        tempoCargaHoras: bike.tempoCargaHoras ?? (null as unknown as number),
      };
    } else {
      groupedMap[slug].ofertas.push(storeOffer);
      if (bike.preco < groupedMap[slug].menorPreco) groupedMap[slug].menorPreco = bike.preco;
      if (bike.preco > groupedMap[slug].maiorPreco) groupedMap[slug].maiorPreco = bike.preco;
    }
  });

  serverBikes.forEach((sb) => {
    if (sb && sb.slug) {
      groupedMap[sb.slug] = sb;
    }
  });

  const bikesList = Object.values(groupedMap);
  console.log(`🚲 Gravando ${bikesList.length} modelos de e-bikes no Firestore...`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < bikesList.length; i += BATCH_SIZE) {
    const chunk = bikesList.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();
    chunk.forEach((bike) => {
      const cleanedBike = cleanUndefined(bike);
      const docRef = adminDb.collection('bikes').doc(bike.slug);
      batch.set(docRef, cleanedBike, { merge: true });
    });
    await batch.commit();
  }
  console.log('✅ E-Bikes salvas no Firestore com sucesso!');

  // 2. Carrega e envia todos os Artigos do Servidor
  const articlesList = await getAllArticlesServer();
  console.log(`📰 Gravando ${articlesList.length} artigos no Firestore...`);

  for (let i = 0; i < articlesList.length; i += BATCH_SIZE) {
    const chunk = articlesList.slice(i, i + BATCH_SIZE);
    const articlesBatch = adminDb.batch();
    chunk.forEach((article) => {
      const cleanedArticle = cleanUndefined(normalizeArticle(article));
      const docRef = adminDb.collection('artigos').doc(cleanedArticle.slug);
      articlesBatch.set(docRef, cleanedArticle, { merge: true });
    });
    await articlesBatch.commit();
  }
  console.log('✅ Artigos salvos no Firestore com sucesso!');

  // 3. Salvar Configurações Iniciais do Site (settings/site)
  console.log('⚙️ Verificando configurações do site (settings/site)...');
  const settingsRef = adminDb.collection('settings').doc('site');
  const settingsSnap = await settingsRef.get();
  if (!settingsSnap.exists) {
    await settingsRef.set({
      heroTitulo: 'Encontre a e-bike perfeita para a sua rotina.',
      heroDescricao: 'Comparador neutro de autonomia, potência do motor e preço real em lojas parceiras. Sem pegadinhas.',
      sidebarConfianca: '100% Curadoria Manual: preços verificados por humanos, não por robô.',
      footerConfianca: 'Sem robôs ou scraping quebrado: cada preço listado aqui foi conferido manualmente pela nossa equipe.',
      guiaRapidoTitulo: 'Como escolher sua e-bike ideal?',
      guiaRapidoDescricao: 'Não sabe por onde começar? Responda às perguntas abaixo e encontre a categoria certa para a sua rotina:',
      updatedAt: new Date().toISOString(),
    });
    console.log('✅ Configurações iniciais do site criadas no Firestore!');
  } else {
    console.log('ℹ️ Configurações do site já existem no Firestore.');
  }

  return {
    bikesCount: bikesList.length,
    articlesCount: articlesList.length,
    settingsConfigured: true,
  };
}

if (require.main === module) {
  migrateDataToFirestore()
    .then((result) => {
      console.log('🎉 Migração concluída com sucesso!', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Erro na migração:', err);
      process.exit(1);
    });
}
