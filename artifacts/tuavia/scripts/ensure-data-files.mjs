#!/usr/bin/env node
/**
 * scripts/ensure-data-files.mjs
 *
 * Pre-build validation and repair script.
 * Ensures all data files in /data/ exist and contain valid JSON before build.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.resolve(ROOT_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Clean up any stray temporary files
try {
  const files = fs.readdirSync(DATA_DIR);
  for (const file of files) {
    if (file.includes('.tmp.') || file.endsWith('.tmp')) {
      try {
        fs.unlinkSync(path.join(DATA_DIR, file));
      } catch (_) {}
    }
  }
} catch (_) {}

const JSON_FILES_CONFIG = [
  { name: 'articles.json', defaultContent: '[]\n' },
  { name: 'published_articles.json', defaultContent: '[]\n' },
  { name: 'ebikes.json', defaultContent: '[]\n' },
  { name: 'published_bikes.json', defaultContent: '[]\n' },
  { name: 'published_rankings.json', defaultContent: '[]\n' },
  { name: 'deleted_slugs.json', defaultContent: '{"bikes":[],"articles":[],"rankings":[]}\n' },
  { name: 'global_radar_feed.json', defaultContent: '[]\n' },
  { name: 'ai_radar_pautas.json', defaultContent: '[]\n' },
  { name: 'home_ai_curation.json', defaultContent: '{}\n' },
  { name: 'last_firestore_sync.json', defaultContent: '{}\n' },
  { name: 'llm_jobs.json', defaultContent: '[]\n' },
];

// Ensure firebase-applet-config.json exists for safe compilation
const APPLET_CONFIG_PATH = path.resolve(ROOT_DIR, 'firebase-applet-config.json');
if (!fs.existsSync(APPLET_CONFIG_PATH)) {
  fs.writeFileSync(APPLET_CONFIG_PATH, '{}\n', 'utf-8');
}

for (const { name, defaultContent } of JSON_FILES_CONFIG) {
  const filePath = path.join(DATA_DIR, name);
  let shouldRepair = false;

  if (!fs.existsSync(filePath)) {
    shouldRepair = true;
  } else {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        shouldRepair = true;
      } else {
        const text = fs.readFileSync(filePath, 'utf-8');
        if (!text.trim()) {
          shouldRepair = true;
        } else {
          JSON.parse(text);
        }
      }
    } catch (_) {
      shouldRepair = true;
    }
  }

  if (shouldRepair) {
    fs.writeFileSync(filePath, defaultContent, 'utf-8');
  }
}

console.log('[ensure-data] Arquivos de dados validados com sucesso para o build.');
