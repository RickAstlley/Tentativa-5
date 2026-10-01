#!/usr/bin/env node

/**
 * TuaVia — Gerador de Sitemap Físico (sitemap.xml)
 * 
 * Gera um sitemap XML estático em public/sitemap.xml baseado nos dados locais e dinâmicos de produção.
 * Útil para servidores como Nginx/Hostinger que preferem arquivos físicos para evitar 404/403.
 */

import fs from 'node:fs';
import path from 'node:path';

// Carrega e sanitiza variáveis de ambiente
import './env-loader.mjs';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const SITEMAP_PATH = path.resolve(PUBLIC_DIR, 'sitemap.xml');

// Garante que a pasta public existe
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const rawBaseUrl = process.env.APP_URL || 'https://tuavia.com.br';
const baseUrl = rawBaseUrl.replace(/\/+$/, '');

console.log(`[Sitemap Generator] Base URL: ${baseUrl}`);

// 1. Rotas estáticas
const staticPaths = [
  { url: '', priority: '1.0', changefreq: 'daily' },
  { url: '/pesquisa', priority: '0.7', changefreq: 'daily' },
  { url: '/comparar', priority: '0.6', changefreq: 'weekly' },
  { url: '/artigos', priority: '0.7', changefreq: 'weekly' },
  { url: '/termos', priority: '0.5', changefreq: 'yearly' },
  { url: '/privacidade', priority: '0.5', changefreq: 'yearly' },
  { url: '/contato', priority: '0.5', changefreq: 'monthly' },
];

// Helper para gerar slug exatamente como em lib/ebikes.ts
function generateSlug(marca, modelo) {
  if (!marca || !modelo) return '';
  return `${marca}-${modelo}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífens
    .replace(/(^-|-$)+/g, ''); // Remove hífens no início/fim
}

const urls = [];

// Adiciona rotas estáticas
const todayStr = new Date().toISOString().split('T')[0];
for (const p of staticPaths) {
  urls.push({
    loc: `${baseUrl}${p.url}`,
    lastmod: todayStr,
    changefreq: p.changefreq,
    priority: p.priority,
  });
}

// 2. Processar E-bikes
try {
  const bikeSlugs = new Set();

  // Carregar estáticas
  const staticBikesPath = path.join(DATA_DIR, 'ebikes.json');
  if (fs.existsSync(staticBikesPath)) {
    const content = fs.readFileSync(staticBikesPath, 'utf-8');
    const bikes = JSON.parse(content);
    if (Array.isArray(bikes)) {
      bikes.forEach(b => {
        if (b.slug) {
          bikeSlugs.add(b.slug);
        } else if (b.marca && b.modelo) {
          const slug = generateSlug(b.marca, b.modelo);
          if (slug) bikeSlugs.add(slug);
        }
      });
    }
  }

  // Carregar dinâmicas (publicadas pelo admin)
  const publishedBikesPath = path.join(DATA_DIR, 'published_bikes.json');
  if (fs.existsSync(publishedBikesPath)) {
    const content = fs.readFileSync(publishedBikesPath, 'utf-8');
    const bikes = JSON.parse(content);
    if (Array.isArray(bikes)) {
      bikes.forEach(b => {
        if (b.slug) {
          bikeSlugs.add(b.slug);
        } else if (b.marca && b.modelo) {
          const slug = generateSlug(b.marca, b.modelo);
          if (slug) bikeSlugs.add(slug);
        }
      });
    }
  }

  console.log(`[Sitemap Generator] Encontradas ${bikeSlugs.size} e-bikes.`);
  for (const slug of bikeSlugs) {
    urls.push({
      loc: `${baseUrl}/bike/${slug}`,
      lastmod: todayStr,
      changefreq: 'daily',
      priority: '0.8',
    });
  }
} catch (err) {
  console.error('[Sitemap Generator] Erro ao processar e-bikes:', err.message);
}

// 3. Processar Artigos
try {
  const articleMap = new Map();

  // Carregar estáticos
  const staticArticlesPath = path.join(DATA_DIR, 'articles.json');
  if (fs.existsSync(staticArticlesPath)) {
    const content = fs.readFileSync(staticArticlesPath, 'utf-8');
    const articles = JSON.parse(content);
    if (Array.isArray(articles)) {
      articles.forEach(art => {
        if (art.slug) {
          articleMap.set(art.slug, art.publishedAt || todayStr);
        }
      });
    }
  }

  // Carregar dinâmicos (publicados)
  const publishedArticlesPath = path.join(DATA_DIR, 'published_articles.json');
  if (fs.existsSync(publishedArticlesPath)) {
    const content = fs.readFileSync(publishedArticlesPath, 'utf-8');
    const articles = JSON.parse(content);
    if (Array.isArray(articles)) {
      articles.forEach(art => {
        if (art.slug) {
          articleMap.set(art.slug, art.publishedAt || todayStr);
        }
      });
    }
  }

  console.log(`[Sitemap Generator] Encontrados ${articleMap.size} artigos.`);
  for (const [slug, publishedAt] of articleMap.entries()) {
    let lastmod = todayStr;
    try {
      if (publishedAt) {
        lastmod = new Date(publishedAt).toISOString().split('T')[0];
      }
    } catch (_) {}

    urls.push({
      loc: `${baseUrl}/artigos/${slug}`,
      lastmod,
      changefreq: 'monthly',
      priority: '0.6',
    });
  }
} catch (err) {
  console.error('[Sitemap Generator] Erro ao processar artigos:', err.message);
}

// 4. Gerar conteúdo XML
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

for (const u of urls) {
  xml += '  <url>\n';
  xml += `    <loc>${u.loc}</loc>\n`;
  xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
  xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
  xml += `    <priority>${u.priority}</priority>\n`;
  xml += '  </url>\n';
}

xml += '</urlset>\n';

// Salvar sitemap.xml
fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
console.log(`[Sitemap Generator] ✅ Sitemap físico gerado com sucesso em: ${SITEMAP_PATH}`);
