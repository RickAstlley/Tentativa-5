import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'images', 'uploads');
const CACHE_DIR = path.join(process.cwd(), 'data', 'media_cache');
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

function detectImageMime(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length < 4) return null;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { ext: '.png', mime: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }

  // GIF: GIF87a ou GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { ext: '.gif', mime: 'image/gif' };
  }

  // SVG: texto com tag <svg
  const headerText = buffer.slice(0, 512).toString('utf-8').toLowerCase();
  if (headerText.includes('<svg') || (headerText.includes('<?xml') && headerText.includes('<svg'))) {
    return { ext: '.svg', mime: 'image/svg+xml' };
  }

  // AVIF: ftypavif
  if (buffer.length >= 12 && headerText.includes('ftypavif')) {
    return { ext: '.avif', mime: 'image/avif' };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  }

  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `O arquivo excede o limite máximo de 15 MB (${Math.round(file.size / 1024 / 1024)} MB).` },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // SVG é recusado: servido da própria origem, executa script. Se algum dia
    // for necessário, precisa passar por sanitização em allow-list de tags.
    if (detectImageMime(buffer)?.mime === 'image/svg+xml') {
      return NextResponse.json(
        { error: 'SVG não é aceito por risco de XSS. Envie PNG, JPEG, WebP, GIF ou AVIF.' },
        { status: 415 }
      );
    }

    // Validação estrita de Magic Bytes
    const detected = detectImageMime(buffer);
    const declaredExt = path.extname(file.name).toLowerCase();
    const ext = detected?.ext || (['.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif'].includes(declaredExt) ? declaredExt : '.webp');

    // Gera hash determinístico único do conteúdo (SHA-256 truncado para 16 chars)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);

    const safeBaseName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 32)
      .toLowerCase();

    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
    const filename = `${safeFolder}_${safeBaseName}_${hash}${ext}`;

    const { uploadImageMedia } = await import('@/lib/firebaseStorage');
    const uploadResult = await uploadImageMedia(buffer, filename, detected?.mime || 'image/webp');

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      mediaUrl: uploadResult.mediaUrl,
      filename: uploadResult.filename,
      sizeBytes: buffer.length,
      mimeType: detected?.mime || 'image/webp',
    });
  } catch (err: any) {
    console.error('[api/upload] Erro no upload:', err);
    return NextResponse.json({ error: 'Falha no upload do arquivo' }, { status: 500 });
  }
}
