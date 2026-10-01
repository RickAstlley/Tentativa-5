import { getAdminDb } from '../lib/firebaseAdmin';

const db = getAdminDb();
if (!db) {
  console.log('Firebase Admin Db could not be initialized');
  process.exit(1);
}

async function test() {
  if (!db) return;
  const collections = ['artigos', 'articles', 'publicacoes', 'posts'];
  for (const col of collections) {
    try {
      const snap = await db.collection(col).get();
      console.log('Collection:', col, 'size:', snap.size);
      if (snap.size > 0) {
        snap.forEach(doc => {
          const data = doc.data();
          console.log(' - Document ID:', doc.id, 'Title:', data.title || data.titulo, 'PublishedAt:', data.publishedAt);
        });
      }
    } catch (e: any) {
      console.log('Error reading collection:', col, e.message);
    }
  }
}

test().catch(console.error);
