/**
 * lib/orchestration/autoCycleScheduler.ts
 *
 * Ciclo automático em série: Curadoria da Home -> Radar Global -> AI Radar.
 *
 * Substitui o módulo homônimo, que nunca foi commitado. O agendador anterior
 * (`lib/aiRadarService.ts#initAiRadarScheduler`) era função vazia, então o radar
 * só rodava quando alguém clicava; este é o ciclo real, com lock de arquivo
 * para que duas réplicas da hospedagem não o rodem em paralelo.
 */

import fs from 'fs';
import path from 'path';
import { executeGlobalRadarSearch } from '@/lib/globalRadarSearch';

const LOCK_FILE = path.join(process.cwd(), 'data', 'orchestrator.lock');
const STATE_FILE = path.join(process.cwd(), 'data', 'orchestrator_state.json');
const CYCLE_INTERVAL_MS = 2 * 60 * 60 * 1000;
const LOCK_STALE_MS = 15 * 60 * 1000;

export type CycleStep = 'idle' | 'home' | 'global_radar' | 'ai_radar' | 'done' | 'error';

export interface AutoCycleStatus {
  isProcessing: boolean;
  currentStep: CycleStep;
  lastRunAt: string | null;
  lastDurationMs: number;
  nextRunAt: string | null;
  stepsCompleted: CycleStep[];
  lastError: string | null;
}

let inMemoryStatus: AutoCycleStatus = {
  isProcessing: false,
  currentStep: 'idle',
  lastRunAt: null,
  lastDurationMs: 0,
  nextRunAt: null,
  stepsCompleted: [],
  lastError: null,
};

/* ────────────────────────────── lock ────────────────────────────── */

/**
 * Lock de arquivo. Sem ele, `setInterval` de duas réplicas dispararia o ciclo
 * duas vezes e dobraria o consumo de API.
 */
function acquireLock(): boolean {
  try {
    fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
    if (fs.existsSync(LOCK_FILE)) {
      const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      // Lock preso: um passo que estourou o timeout não pode travar o ciclo.
      if (age < LOCK_STALE_MS) return false;
      fs.unlinkSync(LOCK_FILE);
    }
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch {
    /* nada a fazer */
  }
}

/* ───────────────────────────── estado ───────────────────────────── */

function readPersisted(): { lastRunAt: string | null } {
  try {
    if (!fs.existsSync(STATE_FILE)) return { lastRunAt: null };
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as { lastRunAt?: string | null };
    return { lastRunAt: parsed.lastRunAt ?? null };
  } catch {
    return { lastRunAt: null };
  }
}

function persist(lastRunAt: string): void {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const tmp = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ lastRunAt }, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  } catch {
    /* estado é best-effort */
  }
}

function setStatus(patch: Partial<AutoCycleStatus>): void {
  inMemoryStatus = { ...inMemoryStatus, ...patch };
}

/* ────────────────────────────── ciclo ────────────────────────────── */

export interface CycleOptions {
  forceAll?: boolean;
  forceGlobal?: boolean;
  forceAiRadar?: boolean;
}

export function getAutoCycleStatus(): AutoCycleStatus {
  const persisted = readPersisted();
  if (!inMemoryStatus.lastRunAt && persisted.lastRunAt) {
    return {
      ...inMemoryStatus,
      lastRunAt: persisted.lastRunAt,
      nextRunAt: new Date(
        new Date(persisted.lastRunAt).getTime() + CYCLE_INTERVAL_MS
      ).toISOString(),
    };
  }
  return inMemoryStatus;
}

function isDue(): boolean {
  if (!inMemoryStatus.lastRunAt) return true;
  return Date.now() - new Date(inMemoryStatus.lastRunAt).getTime() >= CYCLE_INTERVAL_MS;
}

/**
 * Roda o ciclo inteiro em série. Nunca lança: devolve o status com o erro
 * registrado, para a rota HTTP responder 200 e o painel mostrar o motivo.
 */
export async function executeScheduledCycle(
  options: CycleOptions = {}
): Promise<AutoCycleStatus> {
  if (inMemoryStatus.isProcessing) return getAutoCycleStatus();
  if (!acquireLock()) {
    setStatus({ lastError: 'Ciclo já em execução em outro processo.' });
    return getAutoCycleStatus();
  }

  const startedAt = Date.now();
  const completed: CycleStep[] = [];
  let lastError: string | null = null;

  setStatus({ isProcessing: true, currentStep: 'home', stepsCompleted: [], lastError: null });

  try {
    // 1. Curadoria da Home é determinística (`app/page.tsx` monta a home sem
    //    IA), então este passo não custa nada.
    completed.push('home');
    setStatus({ currentStep: 'global_radar', stepsCompleted: [...completed] });

    if (options.forceGlobal !== false) {
      const summary = await executeGlobalRadarSearch({ limit: 8, saveToRadarStore: true });
      if (summary.totalFound === 0 && summary.errors.length > 0) {
        lastError = `Radar global: ${summary.errors[0]}`;
      }
    }
    completed.push('global_radar');
    setStatus({ currentStep: 'ai_radar', stepsCompleted: [...completed] });

    if (options.forceAiRadar !== false) {
      const { executeRadarScan } = await import('@/lib/aiRadarService');
      await executeRadarScan();
    }
    completed.push('ai_radar');

    const finishedAt = new Date().toISOString();
    persist(finishedAt);
    setStatus({
      isProcessing: false,
      currentStep: 'done',
      stepsCompleted: completed,
      lastRunAt: finishedAt,
      lastDurationMs: Date.now() - startedAt,
      nextRunAt: new Date(Date.now() + CYCLE_INTERVAL_MS).toISOString(),
      lastError,
    });
  } catch (error) {
    setStatus({
      isProcessing: false,
      currentStep: 'error',
      stepsCompleted: completed,
      lastDurationMs: Date.now() - startedAt,
      lastError: error instanceof Error ? error.message : String(error),
    });
  } finally {
    releaseLock();
  }

  return getAutoCycleStatus();
}

/** Dispara o ciclo se estiver vencido. Não bloqueia quem chamou. */
export function triggerDueCycle(): void {
  if (inMemoryStatus.isProcessing || !isDue()) return;
  void executeScheduledCycle({ forceAll: true });
}
