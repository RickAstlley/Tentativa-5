#!/usr/bin/env node
/**
 * scripts/migrate-collections.mjs
 *
 * Funde as coleções legadas do Firestore na coleção canônica de cada entidade.
 *
 * Rodar uma vez depois de aplicar `lib/firestoreCollections.ts`. Sem isso, os
 * documentos que estavam em `bicicletas`/`ebikes`/`articles`/`publicacoes`/
 * `posts`/`top_rankings` deixariam de aparecer, porque as leituras passam a
 * consultar só a canônica.
 *
 *   node scripts/migrate-collections.mjs            # simula (dry-run)
 *   node scripts/migrate-collections.mjs --apply    # executa
 *
 * Depois de migrar, defina FIRESTORE_LEGACY_COLLECTIONS=true por um tempo se
 * precisar reverter; nunca deixe ligado em produção.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const APPLY = process.argv.includes('--apply');

const LEGACY = {
  bikes: ['bicicletas', 'ebikes'],
  articles: ['articles', 'publicacoes', 'posts'],
  rankings: ['top_rankings'],
};

async function loadAdminDb() {
  for (const path of [
    'node_modules/firebase-admin',
  ]) {
    if (fs.existsSync(path)) break;
  }
  const { getAdminDb } = await import('../lib/firebaseAdmin.ts').catch(() => ({}));
  return getAdminDb?.();
}

function report(scope, legacy, slug) {
  const verb = APPLY ? 'MOVIDO' : 'seria movido';
  console.log(`  ${verb}: ${scope}/${legacy} -> ${scope}  (${slug})`);
}

async function main() {
  const adminModule = await loadAdminDb();
  const db = adminModule ?? null;

  if (!db) {
    console.error(
      'Firestore Admin indisponível. Rode com as variáveis de ambiente do servidor:\n' +
        '  FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=...'
    );
    process.exit(1);
  }

  let totalMoved = 0;

  for (const [canonical, aliases] of Object.entries(LEGACY)) {
    console.log(`\n${canonical}:`);

    for (const alias of aliases) {
      const legacySnapshot = await db.collection(alias).get();
      if (legacySnapshot.empty) {
        console.log(`  ${alias}: vazia`);
        continue;
      }

      console.log(`  ${alias}: ${legacySnapshot.size} documento(s)`);

      for (const doc of legacySnapshot.docs) {
        const data = doc.data();
        const slug = data?.slug || doc.id;
        report(alias, alias, slug);
        totalMoved += 1;

        if (APPLY) {
          const target = db.collection(canonical).doc(doc.id);
          const existing = await target.get();
          const incomingTime = new Date(data?.updatedAt || data?.publishedAt || 0).getTime();
          const existingTime = new Date(
            existing.data()?.updatedAt || existing.data()?.publishedAt || 0
          ).getTime();

          // Não sobrescreve um documento canônico mais novo.
          if (existing.exists && incomingTime < existingTime) {
            console.log(`    ignorado (canônico é mais recente): ${slug}`);
          } else {
            await target.set(data, { merge: true });
          }
          await doc.ref.delete();
        }
      }
    }
  }

  console.log(
    `\n${APPLY ? 'Migrados' : 'Simulados'}: ${totalMoved} documento(s).` +
      (APPLY
        ? ' As coleções legadas agora estão vazias e podem ser removidas no console.'
        : ' Rode com --apply para executar.')
  );
}

main().catch((error) => {
  console.error('Falha na migração:', error?.message ?? error);
  process.exit(1);
});
