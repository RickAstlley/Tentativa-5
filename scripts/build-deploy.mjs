#!/usr/bin/env node
/**
 * scripts/build-deploy.mjs
 *
 * Build de produção do app, agnóstico ao gerenciador de pacotes.
 *
 * Contexto: a raiz do repositório é um monorepo pnpm, mas a hospedagem roda
 * `npm install` e `npm run build` na raiz. O script anterior era
 *
 *   pnpm run typecheck && pnpm -r --if-present run build
 *
 * que (a) exige pnpm no PATH e (b) dispara o typecheck de todos os pacotes do
 * workspace, inclusive `lib/db` e `lib/api-client-react`, cujas dependências
 * usam `catalog:` e não instalam com npm.
 *
 * Este script:
 *   1. Descobre se quem o chamou é pnpm ou npm e usa a sintaxe correta.
 *   2. Constrói apenas `artifacts/tuavia`, que não tem dependência de
 *      workspace nenhuma.
 *   3. Expõe o diretório de saída na raiz, porque a hospedagem declara
 *      "Output directory: .next" e o Next.js escreve em
 *      `artifacts/tuavia/.next`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(ROOT_DIR, 'artifacts', 'tuavia');
const APP_WORKSPACE = 'artifacts/tuavia';

const userAgent = process.env.npm_config_user_agent || '';
const isPnpm = userAgent.startsWith('pnpm');

/** Executa o build do app com a sintaxe do gerenciador em uso. */
function buildApp() {
  const args = isPnpm
    ? ['--filter', APP_WORKSPACE, 'run', 'build']
    : ['run', 'build', '--workspace', APP_WORKSPACE];

  const label = isPnpm ? `pnpm ${args.join(' ')}` : `npm ${args.join(' ')}`;

  console.log(`[build-deploy] Executando: ${label}`);
  const result = spawnSync('npm', args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  if (result.error) {
    console.error(`[build-deploy] Falha ao iniciar o build: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[build-deploy] O build do app falhou (status ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

/**
 * Aponta `<repo>/.next` para `<repo>/artifacts/tuavia/.next`.
 *
 * A hospedagem procura o diretório de saída na raiz do código-fonte. Sem este
 * link, um build bem-sucedido ainda resulta em "output directory not found".
 * Substitui com segurança um link ou diretório anterior; nunca apaga uma
 * árvore de build por engano.
 */
function linkOutputDirectory() {
  const linkPath = path.join(ROOT_DIR, '.next');
  const targetPath = path.join(APP_DIR, '.next');

  if (!fs.existsSync(targetPath)) {
    console.error(`[build-deploy] Não encontrei o diretório de saída do app em: ${targetPath}`);
    process.exit(1);
  }

  try {
    const stats = fs.lstatSync(linkPath, { throwIfNoEntry: false });
    if (stats) {
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      } else {
        // Só um alvo de link anterior pode ser removido com segurança. Um
        // diretório de verdade indica que algo unexpectedemente rodou um
        // build na raiz; avisa em vez de apagar.
        console.warn(
          `[build-deploy] Já existe um diretório real em ${linkPath}; foi mantido. Remova-o se quiser o link.`
        );
        return;
      }
    }

    fs.symlinkSync(path.relative(ROOT_DIR, targetPath), linkPath, 'dir');
    console.log(`[build-deploy] .next da raiz -> ${path.relative(ROOT_DIR, targetPath)}`);
  } catch (err) {
    console.error(`[build-deploy] Não consegui criar o link de saída: ${err.message}`);
    process.exit(1);
  }
}

if (!fs.existsSync(path.join(APP_DIR, 'package.json'))) {
  console.error(`[build-deploy] App não encontrado em ${APP_DIR}.`);
  process.exit(1);
}

buildApp();
linkOutputDirectory();

console.log('[build-deploy] Build concluído. Pacote standalone em artifacts/tuavia/.next/standalone');
