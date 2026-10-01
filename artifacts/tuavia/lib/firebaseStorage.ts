import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getAdminDb, getAdminStorage, isFirestoreDatabaseAvailable, withAdminTimeout } from '@/lib/firebaseAdmin';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'images', 'uploads');
const CACHE_DIR = path.join(process.cwd(), 'data', 'media_cache');

const MIME_MAP: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

export async function ensureLocalMediaDirs(): Promise<void> {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (_) {}
}

/**
 * Faz upload de imagem com sincronização cruzada:
 * 1. Grava no cache local do servidor (disco).
 * 2. Tenta upload no Firebase Storage Bucket (se disponível e com bucket ativo).
 * 3. Grava no Firestore na coleção 'media_files' para permitir que o site na Hostinger
 *    baixe e sirva a imagem automaticamente mesmo sem sincronização de disco.
 * 
 * Retorna a URL pública ou caminho relativo do proxy de mídia (/api/media/[filename]).
 */
export async function uploadImageMedia(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<{ url: string; mediaUrl: string; filename: string }> {
  await ensureLocalMediaDirs();

  const cleanFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '');
  const ext = path.extname(cleanFilename).toLowerCase() || '.webp';
  const effectiveMime = mimeType || MIME_MAP[ext] || 'image/webp';

  // 1. Grava nos discos locais
  const publicPath = path.join(UPLOADS_DIR, cleanFilename);
  const cachePath = path.join(CACHE_DIR, cleanFilename);
  await Promise.all([
    fs.writeFile(publicPath, buffer).catch(() => {}),
    fs.writeFile(cachePath, buffer).catch(() => {}),
  ]);

  let publicUrl = `/api/media/${cleanFilename}`;

  // 2. Tenta upload no Firebase Storage Bucket se configurado
  try {
    const storage = getAdminStorage();
    if (storage) {
      const bucket = storage.bucket();
      const storageFile = bucket.file(`media/${cleanFilename}`);
      await storageFile.save(buffer, {
        metadata: {
          contentType: effectiveMime,
          cacheControl: 'public, max-age=31536000',
        },
      });

      try {
        await storageFile.makePublic();
        publicUrl = `https://storage.googleapis.com/${bucket.name}/media/${cleanFilename}`;
      } catch {
        // Se bucket não permitir makePublic direto, gera link padrão de download do Firebase Storage
        publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(`media/${cleanFilename}`)}?alt=media`;
      }
    }
  } catch (storageErr) {
    // Se Firebase Storage bucket não estiver habilitado/criado, prossegue para o Firestore
  }

  // 3. Grava sempre no Firestore na coleção 'media_files' (Garante sincronização imediata Hostinger <-> AI Studio)
  const adminDb = getAdminDb();
  if (adminDb && isFirestoreDatabaseAvailable()) {
    try {
      // Limite de segurança de 900KB para caber perfeitamente no limite de 1MB do documento Firestore
      if (buffer.length <= 950 * 1024) {
        const base64Data = buffer.toString('base64');
        await withAdminTimeout(
          adminDb.collection('media_files').doc(cleanFilename).set(
            {
              filename: cleanFilename,
              mimeType: effectiveMime,
              dataBase64: base64Data,
              sizeBytes: buffer.length,
              storageUrl: publicUrl,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ),
          4000,
          null
        );
      }
    } catch (dbErr) {
      console.warn('[firebaseStorage] Aviso ao persistir mídia no Firestore:', dbErr);
    }
  }

  return {
    url: publicUrl,
    mediaUrl: `/api/media/${cleanFilename}`,
    filename: cleanFilename,
  };
}

/**
 * Recupera imagem do disco ou busca no Firestore/Firebase Storage caso o arquivo
 * ainda não esteja no servidor local (ex: rodando na Hostinger após upload no AI Studio).
 */
export async function getMediaBuffer(
  filename: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const cleanFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleanFilename) return null;

  const ext = path.extname(cleanFilename).toLowerCase() || '.webp';
  const contentType = MIME_MAP[ext] || 'application/octet-stream';

  const searchDirs = [
    path.join(process.cwd(), 'public', 'images', 'uploads'),
    path.join(process.cwd(), 'public', 'images', 'bikes'),
    path.join(process.cwd(), 'public', 'images', 'articles'),
    path.join(process.cwd(), 'data', 'media_cache'),
  ];

  // 1. Tenta carregar do disco local
  for (const dir of searchDirs) {
    try {
      const fullPath = path.join(dir, cleanFilename);
      const buffer = await fs.readFile(fullPath);
      return { buffer, contentType };
    } catch (_) {}
  }

  // 2. Se não existir no disco (ambiente Hostinger), busca no Firestore Central
  const adminDb = getAdminDb();
  if (adminDb && isFirestoreDatabaseAvailable()) {
    try {
      const docSnap = await withAdminTimeout(
        adminDb.collection('media_files').doc(cleanFilename).get(),
        3500,
        null
      );

      if (docSnap && docSnap.exists) {
        const data = docSnap.data() as any;
        if (data?.dataBase64) {
          const buffer = Buffer.from(data.dataBase64, 'base64');
          const effectiveMime = data.mimeType || contentType;

          // Salva no cache local para que as próximas requisições sejam servidas em 1ms
          await ensureLocalMediaDirs();
          await fs.writeFile(path.join(CACHE_DIR, cleanFilename), buffer).catch(() => {});

          return { buffer, contentType: effectiveMime };
        }
      }
    } catch (dbErr) {
      console.warn('[firebaseStorage] Falha ao recuperar mídia do Firestore:', dbErr);
    }
  }

  // 3. Tenta baixar do Firebase Storage se disponível
  try {
    const storage = getAdminStorage();
    if (storage) {
      const bucket = storage.bucket();
      const file = bucket.file(`media/${cleanFilename}`);
      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        await ensureLocalMediaDirs();
        await fs.writeFile(path.join(CACHE_DIR, cleanFilename), buffer).catch(() => {});
        return { buffer, contentType };
      }
    }
  } catch (_) {}

  return null;
}
