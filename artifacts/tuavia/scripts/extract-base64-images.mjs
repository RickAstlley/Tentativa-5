#!/usr/bin/env node
/**
 * scripts/extract-base64-images.mjs
 * 
 * Extrai imagens em base64 embutidas nos arquivos de dados para arquivos estáticos em public/images/.
 * Isso reduz o payload do HTML inicial de ~33MB para ~100KB, evitando travamento de renderização,
 * timeouts de proxy reverso e estouramento de memória em dispositivos móveis.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PUBLIC_IMAGES_DIR = path.resolve(ROOT_DIR, 'public/images');
const ARTICLES_IMG_DIR = path.resolve(PUBLIC_IMAGES_DIR, 'articles');
const BIKES_IMG_DIR = path.resolve(PUBLIC_IMAGES_DIR, 'bikes');

fs.mkdirSync(ARTICLES_IMG_DIR, { recursive: true });
fs.mkdirSync(BIKES_IMG_DIR, { recursive: true });

function extractAndSave(dataUri, outPathPrefix) {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
    return dataUri;
  }
  const match = dataUri.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
  if (!match) return dataUri;

  const mime = match[1].toLowerCase();
  let ext = 'webp';
  if (mime.includes('svg')) ext = 'svg';
  else if (mime.includes('png')) ext = 'png';
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';

  const fullPath = outPathPrefix.endsWith('.' + ext) ? outPathPrefix : `${outPathPrefix}.${ext}`;
  const buffer = Buffer.from(match[2], 'base64');
  fs.writeFileSync(fullPath, buffer);

  const relPath = '/' + path.relative(path.resolve(ROOT_DIR, 'public'), fullPath).replace(/\\/g, '/');
  return relPath;
}

// 1. Extrair imagens dos artigos
const articleFiles = ['data/articles.json', 'data/published_articles.json'];
for (const file of articleFiles) {
  const fullPath = path.resolve(ROOT_DIR, file);
  if (!fs.existsSync(fullPath)) continue;
  try {
    const articles = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    let count = 0;
    if (Array.isArray(articles)) {
      for (const art of articles) {
        if (art.coverImage && art.coverImage.startsWith('data:image/')) {
          const slug = (art.slug || 'article-' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '-');
          art.coverImage = extractAndSave(art.coverImage, path.resolve(ARTICLES_IMG_DIR, slug));
          count++;
        }
      }
    }
    if (count > 0) {
      fs.writeFileSync(fullPath, JSON.stringify(articles, null, 2), 'utf8');
      console.log(`[extract-base64] ✅ ${count} imagens de artigos extraídas de ${file}`);
    }
  } catch (err) {
    console.warn(`[extract-base64] ⚠️ Erro ao processar ${file}:`, err.message);
  }
}

// 2. Extrair imagens das bikes
const bikeFiles = ['data/published_bikes.json'];
for (const file of bikeFiles) {
  const fullPath = path.resolve(ROOT_DIR, file);
  if (!fs.existsSync(fullPath)) continue;
  try {
    const bikes = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    let count = 0;
    if (Array.isArray(bikes)) {
      for (const b of bikes) {
        if (b.imagemUrl && b.imagemUrl.startsWith('data:image/')) {
          const slug = (b.slug || b.id || 'bike-' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '-');
          b.imagemUrl = extractAndSave(b.imagemUrl, path.resolve(BIKES_IMG_DIR, slug));
          count++;
        }
      }
    }
    if (count > 0) {
      fs.writeFileSync(fullPath, JSON.stringify(bikes, null, 2), 'utf8');
      console.log(`[extract-base64] ✅ ${count} imagens de bikes extraídas de ${file}`);
    }
  } catch (err) {
    console.warn(`[extract-base64] ⚠️ Erro ao processar ${file}:`, err.message);
  }
}

// 3. Extrair da curadoria da Home
const curationPath = path.resolve(ROOT_DIR, 'data/home_ai_curation.json');
if (fs.existsSync(curationPath)) {
  try {
    const curation = JSON.parse(fs.readFileSync(curationPath, 'utf8'));
    let count = 0;
    if (curation && curation.bikes) {
      for (const key of Object.keys(curation.bikes)) {
        const b = curation.bikes[key];
        if (b && b.imagemUrl && b.imagemUrl.startsWith('data:image/')) {
          const slug = (b.slug || b.id || key).replace(/[^a-zA-Z0-9_-]/g, '-');
          b.imagemUrl = extractAndSave(b.imagemUrl, path.resolve(BIKES_IMG_DIR, slug));
          count++;
        }
      }
    }
    if (count > 0) {
      fs.writeFileSync(curationPath, JSON.stringify(curation, null, 2), 'utf8');
      console.log(`[extract-base64] ✅ ${count} imagens extraídas de data/home_ai_curation.json`);
    }
  } catch (err) {
    console.warn('[extract-base64] ⚠️ Erro ao processar curadoria:', err.message);
  }
}

console.log('[extract-base64] ✨ Extração de imagens concluída.');
