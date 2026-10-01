#!/usr/bin/env node
/**
 * scripts/guard-install.mjs
 *
 * Substitui o `preinstall` que existia em forma de shell one-liner:
 *
 *   rm -f package-lock.json yarn.lock; case "$npm_config_user_agent" in
 *     pnpm/*) ;; *) echo "Use pnpm instead" >&2; exit 1 ;; esac
 *
 * Aquele script encerrava a instalação com status 1 sempre que o gerenciador
 * não fosse pnpm. Como a hospedagem roda `npm install` por padrão, o build
 * morria em ~6s antes de qualquer dependência ser baixada — e o log da
 * Hostinger era só `Use pnpm instead`.
 *
 * O que este script preserva da intenção original:
 *   - `pnpm-lock.yaml` é a única fonte de verdade do workspace, então o
 *     lockfile do yarn é removido: o yarn não entende `catalog:`.
 *   - Um aviso explica o estado quando alguém usa npm de propósito.
 *
 * O que mudou: npm deixa de ser proibido. A raiz declara `workspaces`, e só
 * `artifacts/tuavia` entra nela — o único pacote sem dependências `catalog:`,
 * que o npm não sabe resolver.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userAgent = process.env.npm_config_user_agent || '';
const packageManager = userAgent.split('/')[0] || 'desconhecido';

// O yarn não resolve o protocolo `catalog:` do pnpm-workspace.yaml, e um
// yarn.lock versionado faria o yarn ser usado no lugar do pnpm por engano.
const yarnLock = path.join(ROOT_DIR, 'yarn.lock');
if (fs.existsSync(yarnLock)) {
  fs.rmSync(yarnLock, { force: true });
  console.log('[guard-install] yarn.lock removido: este workspace usa pnpm como fonte de verdade.');
}

if (packageManager !== 'pnpm') {
  console.log(
    [
      '',
      `[guard-install] Gerenciador detectado: ${packageManager} (esperado: pnpm).`,
      '[guard-install] Seguindo mesmo assim: este workspace declara `workspaces` para npm',
      '[guard-install] e o app em artifacts/tuavia não usa dependências `catalog:`, então a',
      '[guard-install] instalação com npm é válida.',
      '[guard-install] O pnpm-lock.yaml continua sendo a fonte de verdade para desenvolvimento.',
      '',
    ].join('\n')
  );
}
