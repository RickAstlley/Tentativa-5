#!/usr/bin/env node

/**
 * TuaVia — Instalador do cron do pipeline de IA
 *
 * Instala (ou remove) uma entrada de crontab do sistema que roda
 * `scripts/cron-ai-pipeline.mjs` em intervalos fixos (padrão: a cada 10 min):
 *
 *   node scripts/install-cron.mjs            # instala (idempotente)
 *   node scripts/install-cron.mjs --uninstall
 *   node scripts/install-cron.mjs --show
 *   node scripts/install-cron.mjs --print    # só imprime a linha, não instala
 *
 * A entrada é escrita entre marcadores, então rodar o instalador de novo
 * substitui a linha anterior em vez de acumular duplicatas.
 *
 * Por que a entrada é relativa ao diretório do app: o worker precisa ler
 * `.env` e encontrar a fila. O crontab roda com o HOME do usuário e sem o
 * ambiente do shell, então nem o `cd` nem as variáveis do PM2 estariam lá.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BEGIN_MARKER = '# >>> tuavia ai pipeline >>>';
const END_MARKER = '# <<< tuavia ai pipeline <<<';

/** A cada 10 minutos. A drenagem é barata quando a fila está vazia. */
const DEFAULT_SCHEDULE = '*/10 * * * *';

const args = process.argv.slice(2);
const wantsUninstall = args.includes('--uninstall');
const wantsShow = args.includes('--show');
const wantsPrint = args.includes('--print');

const scheduleFlagIndex = args.indexOf('--schedule');
const schedule =
  scheduleFlagIndex !== -1 && args[scheduleFlagIndex + 1]
    ? args[scheduleFlagIndex + 1]
    : process.env.LLM_CRON_SCHEDULE || DEFAULT_SCHEDULE;

function resolveNodeBin() {
  // `node` do PATH é o que o cron vai usar; se o processo atual veio de um
  // nvm/PM2, é esse binário que o cron precisa enxergar.
  return process.execPath && fs.existsSync(process.execPath) ? process.execPath : 'node';
}

function buildCrontabBlock() {
  const nodeBin = resolveNodeBin();
  const logFile = path.join(rootDir, 'data', 'cron.log');

  return [
    BEGIN_MARKER,
    '# Gerado por scripts/install-cron.mjs. Não editar à mão.',
    '# Drenagem da fila de jobs de IA + ciclo de curadoria do radar.',
    `${schedule} cd ${rootDir} && ${nodeBin} scripts/cron-ai-pipeline.mjs >> ${logFile} 2>&1`,
    END_MARKER,
  ].join('\n');
}

function readCrontab() {
  try {
    return execFileSync('crontab', ['-l'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Saída 1 com "no crontab for user" é o estado inicial normal.
    return '';
  }
}

function writeCrontab(content) {
  execFileSync('crontab', ['-'], { input: content, encoding: 'utf8' });
}

function hasCrontabBinary() {
  for (const [cmd, argv] of [
    ['command', ['-v', 'crontab']],
    ['which', ['crontab']],
  ]) {
    try {
      execFileSync(cmd, argv, { shell: cmd === 'command', stdio: 'ignore' });
      return true;
    } catch {
      /* tenta o próximo */
    }
  }
  return false;
}

function stripExisting(content) {
  const begin = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (begin === -1 || end === -1) return content;
  const before = content.slice(0, begin);
  const after = content.slice(end + END_MARKER.length);
  return `${before}${after}`.replace(/\n{3,}/g, '\n\n');
}

function main() {
  const block = buildCrontabBlock();

  if (wantsPrint) {
    console.log(block);
    return;
  }

  if (wantsShow) {
    const current = readCrontab();
    if (!current.includes(BEGIN_MARKER)) {
      console.log('Nenhuma entrada do TuaVia encontrada no crontab.');
      return;
    }
    const begin = current.indexOf(BEGIN_MARKER);
    const end = current.indexOf(END_MARKER);
    console.log(current.slice(begin, end + END_MARKER.length));
    return;
  }

  if (!hasCrontabBinary()) {
    console.error('Comando `crontab` não encontrado neste ambiente.');
    console.error('');
    console.error('Alternativas:');
    console.error('  1. Hospedagem com painel (hPanel/cPanel): adicione um trabalho cron');
    console.error(`     com este conteúdo:\n\n${block}\n`);
    console.error('  2. Se o supervisor contínuo estiver ativo, ele já cobre a fila.');
    console.error('     O painel "Status" dentro do Copiloto mostra se ele está no ar.');
    process.exitCode = 1;
    return;
  }

  if (wantsUninstall) {
    const current = readCrontab();
    if (!current.includes(BEGIN_MARKER)) {
      console.log('Nada a remover: não há entrada do TuaVia no crontab.');
      return;
    }
    writeCrontab(stripExisting(current));
    console.log('Entrada do TuaVia removida do crontab.');
    return;
  }

  const current = readCrontab();
  const next = `${stripExisting(current).replace(/\s*$/, '\n')}\n${block}\n`;
  writeCrontab(next);

  console.log('Cron do pipeline de IA instalado:');
  console.log(block);
  console.log('');
  console.log(`Logs em: ${path.join(rootDir, 'data', 'cron.log')}`);
  console.log('Remova com: node scripts/install-cron.mjs --uninstall');
}

main();
