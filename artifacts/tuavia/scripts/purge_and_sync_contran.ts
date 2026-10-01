import { getAdminDb } from '../lib/firebaseAdmin';
import fs from 'fs/promises';
import path from 'path';

const KEEP_SLUG = 'legislacao-bicicletas-eletricas-contran';

async function purgeAndSyncContran() {
  console.log('🚀 Iniciando processo de limpeza do banco de dados e arquivos locais...');
  console.log(`📌 Mantendo unicamente o artigo: "${KEEP_SLUG}"`);

  // 1. Atualizar data/articles.json mantendo apenas o artigo do CONTRAN 996
  const articlesJsonPath = path.join(process.cwd(), 'data', 'articles.json');
  try {
    const rawContent = await fs.readFile(articlesJsonPath, 'utf-8');
    const articles = JSON.parse(rawContent);
    const contranArticle = articles.find((a: any) => a.slug === KEEP_SLUG || a.slug.includes('contran'));
    
    if (contranArticle) {
      // Garante que o slug é o oficial e as tags e subtópicos estão 100% enriquecidos
      contranArticle.slug = KEEP_SLUG;
      contranArticle.isLegislationFeatured = true;
      await fs.writeFile(articlesJsonPath, JSON.stringify([contranArticle], null, 2), 'utf-8');
      console.log('✅ data/articles.json atualizado mantendo apenas o artigo CONTRAN 996.');
    }
  } catch (err: any) {
    console.error('❌ Erro ao atualizar data/articles.json:', err.message);
  }

  // 2. Limpar data/published_articles.json
  const publishedArticlesPath = path.join(process.cwd(), 'data', 'published_articles.json');
  try {
    await fs.writeFile(publishedArticlesPath, JSON.stringify([], null, 2), 'utf-8');
    console.log('✅ data/published_articles.json limpo com sucesso.');
  } catch (err: any) {
    console.error('❌ Erro ao limpar published_articles.json:', err.message);
  }

  // 3. Atualizar data/deleted_slugs.json com os outros slugs
  const deletedSlugsPath = path.join(process.cwd(), 'data', 'deleted_slugs.json');
  try {
    const currentDeleted = JSON.parse(await fs.readFile(deletedSlugsPath, 'utf-8').catch(() => '{"bikes":[],"articles":[],"rankings":[]}'));
    const deletedArticlesSet = new Set<string>(currentDeleted.articles || []);
    
    const slugsToDelete = [
      'como-cuidar-bateria-litio-ebike-durabilidade',
      'guia-de-compra-primeira-bicicleta-eletrica-urbana',
      'motor-central-vs-motor-cubo-analise-tecnica',
      'honeywhale-b20-dobravel-440w-guia-compra',
      'ciclovias-em-sp-mapa-e-dicas-para-pedalar'
    ];

    slugsToDelete.forEach(s => deletedArticlesSet.add(s));
    deletedArticlesSet.delete(KEEP_SLUG);

    currentDeleted.articles = Array.from(deletedArticlesSet);
    await fs.writeFile(deletedSlugsPath, JSON.stringify(currentDeleted, null, 2), 'utf-8');
    console.log('✅ data/deleted_slugs.json atualizado.');
  } catch (err: any) {
    console.error('❌ Erro ao atualizar deleted_slugs.json:', err.message);
  }

  // 4. Deletar do Firestore todos os artigos exceto o CONTRAN 996 e subir o CONTRAN 996
  const db = getAdminDb();
  if (db) {
    const collections = ['artigos', 'articles', 'publicacoes', 'posts'];
    for (const col of collections) {
      try {
        const snap = await db.collection(col).get();
        console.log(`📡 Varrendo coleção "${col}" (total: ${snap.size} documentos)...`);
        for (const doc of snap.docs) {
          if (doc.id !== KEEP_SLUG) {
            await db.collection(col).doc(doc.id).delete();
            console.log(` 🗑️ Deletado do Firestore [${col}]: ${doc.id}`);
          }
        }
      } catch (e: any) {
        console.warn(`Aviso ao limpar coleção ${col}:`, e.message);
      }
    }

    // Subir o artigo CONTRAN 996 atualizado para a coleção 'artigos' no Firestore
    try {
      const rawContent = await fs.readFile(articlesJsonPath, 'utf-8');
      const articles = JSON.parse(rawContent);
      const contranArticle = articles[0];
      if (contranArticle) {
        await db.collection('artigos').doc(KEEP_SLUG).set(contranArticle, { merge: true });
        console.log(`✨ Artigo CONTRAN 996 salvo com sucesso no Firestore: artigos/${KEEP_SLUG}`);
      }
    } catch (e: any) {
      console.error('Erro ao enviar CONTRAN 996 para o Firestore:', e.message);
    }
  }

  console.log('🎉 Operação concluída com sucesso!');
}

purgeAndSyncContran().catch(console.error);
