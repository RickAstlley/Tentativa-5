'use client';

/**
 * lib/media/upload.ts
 *
 * CAMINHO ÚNICO DE UPLOAD DE MÍDIA DO ADMIN.
 *
 * Substitui os cinco caminhos que existiam antes (`lib/storage.ts#uploadImage`,
 * `uploadBase64ToCentralMedia`, `uploadFileToCentralMedia`,
 * `sanitizeAndUploadArticleImages` e o `POST /api/upload` chamado direto).
 * Tudo agora passa por `uploadMedia()`.
 *
 * O destino é sempre a API central `/api/upload`, que por sua vez grava em disco,
 * Firebase Storage e (abaixo de 950 KB) em Firestore — ver `lib/firebaseStorage.ts`.
 * O retorno é o `mediaUrl` relativo (`/api/media/<arquivo>`), que o
 * `lib/articles.ts#normalizeArticle` e o `next.config.ts` rewrite já sabem servir.
 */

import { optimizeImageClientSide, compressDataUrlForFirestore } from '@/lib/storage';

export type MediaFolder = 'bikes' | 'articles' | 'rankings' | 'uploads';

export interface UploadOptions {
  folder?: MediaFolder | string;
  /** Usado só para gerar um nome legível; o hash de conteúdo é a chave real. */
  slug?: string;
  onProgress?: (message: string) => void;
}

export interface UploadResult {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

const FOLDER_ALIAS: Record<string, MediaFolder> = {
  artigos: 'articles',
  artigo: 'articles',
  bike: 'bikes',
  ranking: 'rankings',
};

function normalizeFolder(folder?: string): MediaFolder {
  if (!folder) return 'uploads';
  const key = folder.trim().toLowerCase();
  if (FOLDER_ALIAS[key]) return FOLDER_ALIAS[key];
  if (key === 'bikes' || key === 'articles' || key === 'rankings' || key === 'uploads') return key;
  return 'uploads';
}

function isDataUrl(value: string): boolean {
  return /^data:image\//i.test(value.trim());
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/avif': return 'avif';
    default: return 'webp';
  }
}

/**
 * Anexa os headers de admin quando existirem. O upload continua funcionando sem
 * credencial (o site público também usa), mas o painel sempre manda a sua.
 */
function adminUploadHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const headers: Record<string, string> = {};
  try {
    for (const storage of [window.sessionStorage, window.localStorage]) {
      const raw = storage.getItem('tuavia_admin_session_auth_v1');
      if (!raw) continue;
      const session = JSON.parse(raw) as { token?: string; email?: string };
      if (session.token && !headers['x-admin-token']) headers['x-admin-token'] = session.token;
      if (session.email && !headers['x-admin-email']) {
        headers['x-admin-email'] = String(session.email).toLowerCase();
      }
    }
  } catch {
    /* storage indisponível */
  }
  return headers;
}

async function postToCentralApi(
  blob: Blob,
  filename: string,
  folder: MediaFolder
): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('folder', folder);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: form,
    headers: adminUploadHeaders(),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* resposta sem JSON */
    }
    throw new Error(`Falha no upload para a API de mídia: ${detail}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    mediaUrl?: string;
    url?: string;
    filename?: string;
    sizeBytes?: number;
    mimeType?: string;
  };

  const mediaUrl = data.mediaUrl || data.url;
  if (!data.success || !mediaUrl) {
    throw new Error('A API de mídia respondeu sem URL utilizável.');
  }

  return {
    url: mediaUrl,
    filename: data.filename || filename,
    sizeBytes: data.sizeBytes ?? blob.size,
    mimeType: data.mimeType || 'image/webp',
  };
}

function buildFilename(source: string, folder: MediaFolder, slug?: string, mime?: string): string {
  const ext = mime ? extensionFromMime(mime) : 'webp';
  const base = (slug || source || 'imagem')
    .replace(/^data:image\/[a-z+]+;base64,/i, '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 32)
    .toLowerCase();
  return `${folder}-${base || 'imagem'}.${ext}`;
}

/**
 * Entrada única de upload. Aceita File, Blob ou data URL e sempre devolve a
 * URL relativa servível (`/api/media/...`).
 */
export async function uploadMedia(
  input: File | Blob | string,
  options: UploadOptions = {}
): Promise<string> {
  const folder = normalizeFolder(options.folder);
  options.onProgress?.('Preparando imagem…');

  if (typeof input === 'string') {
    if (!isDataUrl(input)) return input; // já é URL

    options.onProgress?.('Convertendo imagem para upload…');
    const response = await fetch(input);
    const blob = await response.blob();
    options.onProgress?.('Otimizando imagem…');
    const optimized = await optimizeImageClientSide(
      new File([blob], buildFilename(input, folder, options.slug, blob.type), { type: blob.type })
    );
    options.onProgress?.('Enviando para a API de mídia…');
    return (
      await postToCentralApi(
        optimized.blob,
        buildFilename(options.slug || 'imagem', folder, options.slug, optimized.format),
        folder
      )
    ).url;
  }

  options.onProgress?.('Otimizando imagem…');
  const file = input instanceof File ? input : new File([input], 'imagem.webp', { type: input.type });
  const optimized = await optimizeImageClientSide(file);
  options.onProgress?.('Enviando para a API de mídia…');
  return (
    await postToCentralApi(
      optimized.blob,
      buildFilename(file.name, folder, options.slug, optimized.format),
      folder
    )
  ).url;
}

/**
 * Variante que nunca lança: devolve a entrada original (comprimida, se possível)
 * quando o upload falha. Usada no fluxo de save, onde perder a imagem não pode
 * impedir a publicação do conteúdo.
 */
export async function uploadMediaOrKeep(
  input: string,
  options: UploadOptions = {}
): Promise<string> {
  if (!isDataUrl(input)) return input;
  try {
    return await uploadMedia(input, options);
  } catch (error) {
    console.warn('[media/upload] Upload falhou, mantendo versão comprimida local:', error);
    return compressDataUrlForFirestore(input, 900, 0.7);
  }
}

export interface ArticleImages {
  slug: string;
  coverImage: string;
  galleryImages: string[];
  body: string;
}

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\((data:image\/[a-z+]+;base64,[^)]+)\)/gi;

/**
 * Varre capa, galeria e markdown de um artigo, enviando cada data URL para a API
 * central. Imagens que já são URL passam intactas.
 */
export async function sanitizeAndUploadArticleImages(
  article: ArticleImages,
  onProgress?: (message: string) => void
): Promise<ArticleImages> {
  const folder = normalizeFolder('articles');

  const coverImage = await uploadMediaOrKeep(article.coverImage, {
    folder,
    slug: article.slug,
    onProgress,
  });

  const galleryImages: string[] = [];
  for (let index = 0; index < article.galleryImages.length; index += 1) {
    const image = article.galleryImages[index];
    if (typeof image !== 'string' || !image.trim()) continue;
    galleryImages.push(
      await uploadMediaOrKeep(image, { folder, slug: `${article.slug}-g${index}`, onProgress })
    );
  }

  const markdownMatches = [...article.body.matchAll(MARKDOWN_IMAGE_RE)];
  let body = article.body;
  for (let index = markdownMatches.length - 1; index >= 0; index -= 1) {
    const match = markdownMatches[index];
    if (!match) continue;
    const uploaded = await uploadMediaOrKeep(match[2], {
      folder,
      slug: `${article.slug}-m${index}`,
      onProgress,
    });
    body = body.replace(match[0], `![${match[1] || ''}](${uploaded})`);
  }

  return { ...article, coverImage, galleryImages, body };
}
