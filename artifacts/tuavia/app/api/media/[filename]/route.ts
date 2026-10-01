import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { getMediaBuffer } from '@/lib/firebaseStorage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    const cleanFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!cleanFilename) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    // Busca do disco local ou recupera do Firestore/Firebase Storage automaticamente
    const media = await getMediaBuffer(cleanFilename);
    if (!media) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const etag = `"${crypto.createHash('md5').update(media.buffer).digest('hex').slice(0, 16)}"`;

    // Verifica cache 304 Not Modified
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // `Buffer` é um `Uint8Array`, aceito em runtime, mas o tipo `BodyInit` do
    // DOM não o conhece. O `Uint8Array` é o mesmo objeto com o tipo certo.
    return new NextResponse(new Uint8Array(media.buffer), {
      status: 200,
      headers: {
        'Content-Type': media.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[api/media] Erro ao servir imagem:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
