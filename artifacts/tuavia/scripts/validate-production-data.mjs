#!/usr/bin/env node
/**
 * scripts/validate-production-data.mjs
 * 
 * Validação rigorosa dos dados de catálogo e persistência local para produção no TuaVia.
 * Impede que arquivos vazios, 0 bytes, ou com JSON corrompido avancem para o build/deploy.
 */

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ALLOW_EMPTY = process.env.ALLOW_EMPTY_CATALOG === 'true';

console.log('[validate-data] Iniciando validação de dados de produção...');

function validateJsonFile(filename, options = { requireArray: true, requireNonEmpty: false, validateBikeSchema: false }) {
  const filePath = path.join(DATA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`[validate-data] ⚠️ Arquivo ${filename} ausente. Criando com []...`);
    fs.writeFileSync(filePath, '[]\n', 'utf-8');
  }

  let stat = fs.statSync(filePath);
  if (stat.size === 0) {
    console.warn(`[validate-data] ⚠️ Arquivo ${filename} estava com 0 bytes. Reparando com []...`);
    fs.writeFileSync(filePath, '[]\n', 'utf-8');
    stat = fs.statSync(filePath);
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`[validate-data] ❌ Falha ao ler ${filename}: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`[validate-data] ❌ Arquivo ${filename} contém JSON inválido: ${err.message}`);
  }

  if (options.requireArray && !Array.isArray(parsed)) {
    throw new Error(`[validate-data] ❌ ${filename} deve ser um Array JSON, recebido: ${typeof parsed}`);
  }

  if (options.requireNonEmpty && !ALLOW_EMPTY) {
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(
        `[validate-data] ❌ Catálogo em ${filename} está vazio! Produção exige ao menos 1 e-bike publicada (ou defina ALLOW_EMPTY_CATALOG=true).`
      );
    }
  }

  if (options.validateBikeSchema && Array.isArray(parsed) && parsed.length > 0) {
    parsed.forEach((bike, index) => {
      if (!bike || typeof bike !== 'object') {
        throw new Error(`[validate-data] ❌ Item #${index} em ${filename} não é um objeto válido.`);
      }
      if (!bike.slug || typeof bike.slug !== 'string' || !bike.slug.trim()) {
        throw new Error(`[validate-data] ❌ Item #${index} em ${filename} não possui 'slug' válido.`);
      }
      if (!bike.marca || typeof bike.marca !== 'string') {
        throw new Error(`[validate-data] ❌ Bike '${bike.slug}' em ${filename} não possui 'marca'.`);
      }
      if (!bike.modelo || typeof bike.modelo !== 'string') {
        throw new Error(`[validate-data] ❌ Bike '${bike.slug}' em ${filename} não possui 'modelo'.`);
      }
    });
  }

  const count = Array.isArray(parsed) ? `${parsed.length} itens` : 'objeto';
  console.log(`[validate-data] ✅ ${filename}: Válido (${count}, ${stat.size} bytes)`);
  return parsed;
}

try {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`[validate-data] ❌ Diretório data/ ausente em: ${DATA_DIR}`);
  }

  // 1. Validar catálogo estático principal de ofertas de e-bikes (pode ser vazio quando limpo pelo admin)
  const staticOffers = validateJsonFile('ebikes.json', {
    requireArray: true,
    requireNonEmpty: false,
  });

  // 2. Validar overrides/publicações dinâmicas do admin (obrigatório existir e ser array válido, pode ser [])
  const publishedBikes = validateJsonFile('published_bikes.json', {
    requireArray: true,
    requireNonEmpty: false,
    validateBikeSchema: true,
  });

  // 3. Validar listas de artigos e rankings (podem ser listas vazias iniciais)
  validateJsonFile('published_articles.json', { requireArray: true, requireNonEmpty: false });
  validateJsonFile('published_rankings.json', { requireArray: true, requireNonEmpty: false });
  validateJsonFile('articles.json', { requireArray: true, requireNonEmpty: false });

  console.log(
    `[validate-data] ✨ Validação de dados concluída com SUCESSO! Catálogo estático contém ${staticOffers.length} ofertas ativas e ${publishedBikes.length} overrides dinâmicos publicados.`
  );
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
