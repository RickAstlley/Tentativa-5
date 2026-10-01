'use client';

/**
 * components/admin/copilot/CopilotSystemStatusView.tsx
 *
 * Status de operação do pipeline de IA: provedor, fila de jobs, worker,
 * executor e os jobs mais recentes.
 *
 * Existe porque `/api/admin/llm/health` já devolvia `queue.*` e `worker.*`
 * desde o começo, mas nenhuma tela do admin consumia — o operador só descobria
 * que o worker estava parado quando um artigo não voltava da geração. Este
 * painel é o primeiro consumidor desses dados.
 *
 * O modo `telemetry` do copilot apontava para `/admin/telemetry`, que importa o
 * ring buffer de telemetria do servidor: no browser ele é sempre vazio (ver
 * `lib/ai/telemetry.ts`, onde `persist()` retorna cedo no cliente). Por isso o
 * modo passou a renderizar este painel, que fala com a API de verdade.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  HardDrive,
  Bot,
  Link2,
  Cpu,
  ListChecks,
  ExternalLink,
} from 'lucide-react';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import { NVIDIA_MODELS } from '@/lib/ai/nvidiaModelCatalog';
import { cn } from '@/lib/utils';

type Tone = 'ok' | 'warn' | 'error' | 'neutral';

interface HealthPayload {
  success: boolean;
  queue?: {
    configured?: boolean;
    fileExists?: boolean;
    fileWritable?: boolean;
    queued?: number;
    running?: number;
    failedRetryable?: number;
    total?: number;
    status?: string;
    errorCode?: string;
  };
  worker?: {
    enabled?: boolean;
    mode?: string;
    intervalMs?: number;
    secretConfigured?: boolean;
    status?: string;
  };
  executor?: {
    baseUrlConfigured?: boolean;
    mode?: string;
    status?: string;
  };
  providers?: {
    nvidiaConfigured?: boolean;
    nvidiaBaseUrl?: string;
    isLocalNIM?: boolean;
    nvidiaConnectivity?: string;
  };
  models?: Record<string, { operational: boolean; latencyMs?: number; error?: string }>;
  textProvider?: string;
  visionProvider?: string;
}

interface JobRow {
  id: string;
  type: string;
  status: string;
  progress: number;
  stage?: string;
  createdAt: string;
  error?: string;
  errorCode?: string;
  attempts?: number;
}

interface JobsPayload {
  success: boolean;
  jobs: JobRow[];
}

const REFRESH_MS = 15_000;

const STATUS_LABEL: Record<string, string> = {
  queued: 'Na fila',
  running: 'Executando',
  partial: 'Parcial',
  completed: 'Concluído',
  failed: 'Falhou',
};

function statusTone(status?: string): Tone {
  if (!status) return 'neutral';
  if (status === 'completed' || status === 'ok' || status === 'QUEUE_OK') return 'ok';
  if (status === 'partial' || status === 'queued' || status === 'running') return 'warn';
  return 'error';
}

function connectivityTone(value?: string): Tone {
  if (!value) return 'neutral';
  if (value === 'ok') return 'ok';
  if (value === 'not_configured') return 'neutral';
  return 'error';
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const styles: Record<Tone, string> = {
    ok: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warn: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    error: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    neutral: 'bg-stone-500/15 text-stone-300 border-stone-500/30',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        styles[tone]
      )}
    >
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
}) {
  const valueTone: Record<Tone, string> = {
    ok: 'text-emerald-300',
    warn: 'text-amber-300',
    error: 'text-rose-300',
    neutral: 'text-stone-100',
  };
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</p>
      <p className={cn('mt-1 font-mono text-xl font-bold', valueTone[tone])}>{value}</p>
    </div>
  );
}

function Card({
  icon,
  title,
  status,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status?: string;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-800 bg-stone-900/40 p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-300">
          <span className="text-emerald-400">{icon}</span>
          <span className="truncate">{title}</span>
        </h3>
        {status ? <Pill tone={tone}>{status}</Pill> : null}
      </header>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-stone-800/60 py-1.5 last:border-0">
      <span className="text-[11px] text-stone-500">{label}</span>
      <span className="break-all text-right font-mono text-[11px] text-stone-200">{value}</span>
    </div>
  );
}

export function CopilotSystemStatusView(): React.ReactElement {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const [healthRes, jobsRes] = await Promise.all([
        fetchAdminJson<HealthPayload>('/api/admin/llm/health'),
        fetchAdminJson<JobsPayload>('/api/admin/llm/jobs'),
      ]);

      if (!mountedRef.current) return;

      if (healthRes.ok && healthRes.data?.success) {
        setHealth(healthRes.data);
        setError(null);
      } else {
        setError(healthRes.error || 'Não foi possível ler o status do pipeline de IA.');
      }

      if (jobsRes.ok && jobsRes.data?.success && Array.isArray(jobsRes.data.jobs)) {
        setJobs(jobsRes.data.jobs);
      }

      setLastUpdated(
        new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const queue = health?.queue;
  const worker = health?.worker;
  const executor = health?.executor;
  const providers = health?.providers;

  const queueTone = statusTone(queue?.status);
  const workerTone: Tone = !worker?.enabled ? 'error' : !worker?.secretConfigured ? 'error' : 'ok';
  const providerTone = providers?.nvidiaConfigured
    ? connectivityTone(providers.nvidiaConnectivity)
    : 'neutral';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Activity className="h-4 w-4 text-emerald-400" />
            Status do pipeline de IA
          </h2>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {loading
              ? 'Consultando o servidor…'
              : lastUpdated
                ? `Atualizado às ${lastUpdated} · renova sozinho a cada ${REFRESH_MS / 1000}s`
                : 'Aguardando primeira leitura'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-700 bg-stone-800 px-3 py-2 text-xs font-bold text-stone-200 transition-colors hover:bg-stone-700 hover:text-white"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Na fila"
          value={queue?.queued ?? '—'}
          tone={(queue?.queued ?? 0) > 0 ? 'warn' : 'neutral'}
        />
        <Metric
          label="Executando"
          value={queue?.running ?? '—'}
          tone={(queue?.running ?? 0) > 0 ? 'warn' : 'neutral'}
        />
        <Metric
          label="Falhas reTentáveis"
          value={queue?.failedRetryable ?? '—'}
          tone={(queue?.failedRetryable ?? 0) > 0 ? 'error' : 'neutral'}
        />
        <Metric label="Total" value={queue?.total ?? '—'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          icon={<Server className="h-4 w-4" />}
          title="Provedor de IA"
          status={providers?.nvidiaConnectivity ?? 'desconhecido'}
          tone={providerTone}
        >
          <Row label="Chave NVIDIA" value={providers?.nvidiaConfigured ? 'configurada' : 'ausente'} />
          <Row label="Endpoint" value={providers?.nvidiaBaseUrl ?? '—'} />
          <Row label="NIM local" value={providers?.isLocalNIM ? 'sim' : 'não'} />
          <Row label="Texto" value={health?.textProvider ?? '—'} />
          <Row label="Visão" value={health?.visionProvider ?? '—'} />
        </Card>

        <Card
          icon={<HardDrive className="h-4 w-4" />}
          title="Fila de jobs"
          status={queue?.status ?? 'desconhecida'}
          tone={queueTone}
        >
          <Row label="Arquivo configurado" value={queue?.configured ? 'sim' : 'não'} />
          <Row label="Arquivo existe" value={queue?.fileExists ? 'sim' : 'não'} />
          <Row label="Gravável" value={queue?.fileWritable ? 'sim' : 'não'} />
          {queue?.errorCode ? <Row label="Erro" value={queue.errorCode} /> : null}
        </Card>

        <Card
          icon={<Bot className="h-4 w-4" />}
          title="Worker"
          status={worker?.enabled ? 'ativo' : 'desligado'}
          tone={workerTone}
        >
          <Row label="Supervisor contínuo" value={worker?.enabled ? 'habilitado' : 'desabilitado'} />
          <Row label="Intervalo" value={`${Math.round((worker?.intervalMs ?? 0) / 1000)}s por ciclo`} />
          <Row
            label="Segredo compartilhado"
            value={worker?.secretConfigured ? 'configurado' : 'ausente'}
          />
          <Row label="Modo" value={worker?.mode ?? '—'} />
        </Card>

        <Card
          icon={<Link2 className="h-4 w-4" />}
          title="Executor"
          status={executor?.baseUrlConfigured ? 'ok' : 'sem url'}
          tone={executor?.baseUrlConfigured ? 'ok' : 'error'}
        >
          <Row
            label="URL de callback"
            value={executor?.baseUrlConfigured ? 'configurada' : 'LLM_EXECUTOR_BASE_URL ausente'}
          />
          <Row label="Modo" value={executor?.mode ?? '—'} />
        </Card>
      </div>

      <Card
        icon={<Cpu className="h-4 w-4" />}
        title="Catálogo de modelos"
        status={`${Object.keys(NVIDIA_MODELS).length} modelos`}
        tone="neutral"
      >
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {Object.values(NVIDIA_MODELS).map((model) => {
            const status = health?.models?.[model.id];
            return (
              <li
                key={model.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-950/60 px-2.5 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[11px] text-stone-200">
                    {model.id}
                  </span>
                  <span className="block text-[10px] text-stone-500">
                    {model.name} · {model.multimodal ? 'visão' : model.category}
                  </span>
                </span>
                {status ? (
                  <Pill tone={status.operational ? 'ok' : 'error'}>
                    {status.operational ? 'ok' : 'erro'}
                  </Pill>
                ) : (
                  <Pill tone="neutral">sem leitura</Pill>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        icon={<ListChecks className="h-4 w-4" />}
        title="Jobs recentes"
        status={`${jobs.length} na lista`}
        tone="neutral"
      >
        {jobs.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-stone-500">
            Nenhum job registrado ainda.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-lg border border-stone-800 bg-stone-950/60 px-2.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-[11px] text-stone-200">
                    {job.type}
                  </span>
                  <Pill tone={statusTone(job.status)}>{STATUS_LABEL[job.status] ?? job.status}</Pill>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-stone-500">
                  <span>{new Date(job.createdAt).toLocaleString('pt-BR')}</span>
                  {job.attempts ? <span>{job.attempts} tentativa(s)</span> : null}
                  {job.stage ? <span className="truncate">{job.stage}</span> : null}
                </div>
                {job.error ? (
                  <p className="mt-1 break-words text-[10px] text-rose-300">
                    {job.errorCode ? `${job.errorCode}: ` : ''}
                    {job.error}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { href: '/admin/ia/pipelines', label: 'Pipelines' },
            { href: '/admin/ia/playground', label: 'Playground' },
            { href: '/admin/ia/setup', label: 'Setup de chaves' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 px-3 py-2 text-xs font-bold text-stone-200 transition-colors hover:bg-stone-700"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </Card>

      <p className="flex items-start gap-2 text-[10px] leading-relaxed text-stone-500">
        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
        <span>
          O status operacional dos modelos reflete uma única sondagem ao endpoint{' '}
          <code className="font-mono text-stone-400">/models</code> do provedor, replicada por
          modelo. Indica alcance do provedor, não disponibilidade individual de cada modelo.
        </span>
      </p>
    </div>
  );
}

export default CopilotSystemStatusView;
