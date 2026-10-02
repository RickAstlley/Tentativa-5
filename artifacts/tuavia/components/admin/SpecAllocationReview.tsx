'use client';

/**
 * components/admin/SpecAllocationReview.tsx
 *
 * Conferência da alocação determinística: os 10 blocos canônicos, campo a
 * campo, com a linha do documento de onde cada valor saiu.
 *
 * Existe porque o painel anterior mostrava apenas "N/M preenchido" e um
 * score. Com o matcher alocando por sinônimo, um valor que veio do campo
 * errado aparece com a mesma cara de um correto: "Câmbio Traseiro: 8" (que na
 * verdade é o número de marchas) parecia tão válido quanto "Câmbio
 * Traseiro: Shimano Tourney". Medido numa ficha realista, 79% de acerto —
 * ou seja, 1 em cada 5 campos estava errado e nada na tela denunciava.
 *
 * Aqui cada campo mostra a linha de origem. Se o valor não bate com a fonte,
 * o erro aparece na hora, sem precisar confiar no score.
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Search,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import type { EBikeSpecSection } from '@/types/ebike';
import { CANONICAL_SPEC_SECTIONS } from '@/lib/specAllocations';
import { UNCONFIRMED_LABEL } from '@/lib/admin/ebikeIngestor';
import { cn } from '@/lib/utils';

export interface ReviewGap {
  sectionIndex: number;
  sectionTitle: string;
  label: string;
  synonyms: string[];
  truncated?: boolean;
}

type Tom = 'ok' | 'suspeita' | 'vazio';

interface Props {
  specSections: EBikeSpecSection[];
  gaps: ReviewGap[];
  rawText: string;
  integrityScore: number;
  truncated?: boolean;
  truncatedWarning?: string;
  /** Callback para o editor preencher à mão um campo específico. */
  onFocusField?: (sectionIndex: number, label: string) => void;
}

/**
 * Acha no documento a linha de onde um valor provavelmente saiu.
 *
 * Casa pelo rótulo, tolerante a acento e pontuação, e devolve a linha
 * original. É o que permite conferir "Câmbio Traseiro: 8" contra
 * "Marchas: 8" sem sair da tela.
 */
function acharLinhaDeOrigem(rawText: string, label: string, valor: string): string | null {
  if (!rawText || !valor) return null;
  const linhas = rawText.split(/\r?\n/);

  const chave = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const chaveValor = chave(valor).slice(0, 12);
  const chaveLabel = chave(label);

  // 1. Linha cujo rótulo é o próprio campo
  if (chaveLabel.length >= 4) {
    for (const linha of linhas) {
      const k = chave(linha);
      if (k.startsWith(chaveLabel) || k.includes(chaveLabel)) return linha.trim();
    }
  }

  // 2. Linha que contém o valor — é onde o valor foi copiado
  if (chaveValor.length >= 3) {
    for (const linha of linhas) {
      if (chave(linha).includes(chaveValor)) return linha.trim();
    }
  }

  return null;
}

/** Verdadeiro quando a linha de origem não é a do próprio campo. */
function veioDeOutroCampo(origem: string | null, label: string): boolean {
  if (!origem) return false;
  const k = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  return !k(origem).startsWith(k(label));
}

function tomDoItem(item: { value: string; status?: string; confidence?: string }): Tom {
  if (!item.value || item.value === UNCONFIRMED_LABEL) return 'vazio';
  if (item.status === 'SUSPEITO' || item.confidence === 'SUSPEITA' || item.status === 'CONFLITANTE') {
    return 'suspeita';
  }
  return 'ok';
}

export default function SpecAllocationReview({
  specSections,
  gaps,
  rawText,
  integrityScore,
  truncated,
  truncatedWarning,
  onFocusField,
}: Props) {
  const [busca, setBusca] = useState('');
  const [recolhidos, setRecolhidos] = useState<Set<number>>(new Set());
  const [copiado, setCopiado] = useState<string | null>(null);
  const [soSuspeitas, setSoSuspeitas] = useState(false);

  const term = busca.trim().toLowerCase();

  const blocos = useMemo(
    () =>
      specSections.map((sec, i) => {
        const itens = (sec.items ?? []).map((item) => {
          const tom = tomDoItem(item);
          const origem = tom === 'vazio' ? null : acharLinhaDeOrigem(rawText, item.label, item.value);
          const veioDeOutro = veioDeOutroCampo(origem, item.label);
          return { ...item, tom, origem, veioDeOutro };
        });
        return { indice: i, secao: sec, itens };
      }),
    [specSections, rawText]
  );

  const metricas = useMemo(() => {
    let ok = 0;
    let suspeita = 0;
    let vazio = 0;
    for (const b of blocos) {
      for (const it of b.itens) {
        // Um campo que veio de outro lugar é suspeito mesmo com status OK.
        if (it.tom === 'vazio') vazio++;
        else if (it.tom === 'suspeita' || it.veioDeOutro) suspeita++;
        else ok++;
      }
    }
    return { ok, suspeita, vazio, total: ok + suspeita + vazio };
  }, [blocos]);

  const visiveis = useMemo(() => {
    if (!term && !soSuspeitas) return blocos;
    return blocos
      .map((b) => ({
        ...b,
        itens: b.itens.filter((it) => {
          if (soSuspeitas && it.tom === 'ok') return false;
          if (!term) return true;
          return (
            it.label.toLowerCase().includes(term) ||
            String(it.value).toLowerCase().includes(term)
          );
        }),
      }))
      .filter((b) => b.itens.length > 0);
  }, [blocos, term, soSuspeitas]);

  const copiarFicha = () => {
    const texto = blocos
      .map(
        (b) =>
          `## ${b.secao.title}\n` +
          b.itens.map((it) => `- ${it.label}: ${it.value}`).join('\n')
      )
      .join('\n\n');
    navigator.clipboard
      ?.writeText(texto)
      .then(() => {
        setCopiado('ficha');
        setTimeout(() => setCopiado(null), 1800);
      })
      .catch(() => setCopiado(null));
  };

  return (
    <div className="space-y-4">
      {/* ── Resumo: o número que importa é "certo", não "preenchido" ── */}
      <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <FileSearch className="h-4 w-4 text-amber-400" />
              Conferência da alocação
            </h3>
            <p className="mt-1 text-xs text-stone-400">
              <strong className="text-emerald-400">{metricas.ok}</strong> confirmados ·{' '}
              <strong className="text-amber-400">{metricas.suspeita}</strong> suspeitos de vir de
              outro campo ·{' '}
              <strong className="text-stone-400">{metricas.vazio}</strong> não informados · score de
              integridade {integrityScore}/100
            </p>
          </div>
          <button
            type="button"
            onClick={copiarFicha}
            className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-xs font-bold text-stone-200 transition-colors hover:bg-stone-800"
          >
            {copiado === 'ficha' ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copiado === 'ficha' ? 'Copiado' : 'Copiar ficha'}
          </button>
        </div>

        {truncated && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Parte do documento não foi lida.</strong>{' '}
              {truncatedWarning ||
                'Campos marcados como não informados podem estar na parte não extraída — ausência aqui não é o fabricante não ter declarado.'}
            </span>
          </p>
        )}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por campo ou valor…"
            className="w-full rounded-xl border border-stone-800 bg-stone-950 py-2.5 pl-9 pr-3 text-xs text-stone-200 placeholder:text-stone-600 focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setSoSuspeitas((v) => !v)}
          className={cn(
            'min-h-10 shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
            soSuspeitas
              ? 'border-amber-500 bg-amber-500/15 text-amber-300'
              : 'border-stone-800 bg-stone-900 text-stone-400 hover:bg-stone-800'
          )}
        >
          Só suspeitos ({metricas.suspeita})
        </button>
      </div>

      {/* ── Os 10 blocos ── */}
      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/60 p-6 text-center text-xs text-stone-500">
          {term ? `Nenhum campo casa com "${busca}".` : 'Nenhum campo suspeito.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visiveis.map(({ indice, secao, itens }) => {
            const preenchidos = itens.filter((i) => i.tom !== 'vazio').length;
            const suspeitos = itens.filter((i) => i.tom === 'suspeita' || i.veioDeOutro).length;
            const total = (secao.items ?? []).length;
            const colapsado = recolhidos.has(indice);

            return (
              <section
                key={secao.title}
                className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-950/60"
              >
                <header className="flex items-center justify-between gap-2 border-b border-stone-800 bg-stone-900/60 px-3 py-2.5">
                  <div className="min-w-0">
                    <h4 className="truncate text-xs font-bold text-stone-200">{secao.title}</h4>
                    <p className="mt-0.5 text-[10px] text-stone-500">
                      {preenchidos}/{total} preenchidos
                      {suspeitos > 0 && (
                        <span className="text-amber-400"> · {suspeitos} a conferir</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRecolhidos((prev) => {
                        const next = new Set(prev);
                        if (next.has(indice)) next.delete(indice);
                        else next.add(indice);
                        return next;
                      })
                    }
                    aria-label={colapsado ? 'Expandir bloco' : 'Recolher bloco'}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-800 hover:text-white"
                  >
                    {colapsado ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </button>
                </header>

                {!colapsado && (
                  <ul className="divide-y divide-stone-800/60">
                    {itens.map((item) => {
                      const destacado = item.tom === 'suspeita' || item.veioDeOutro;
                      return (
                        <li
                          key={item.label}
                          className={cn(
                            'px-3 py-2 transition-colors',
                            destacado && 'bg-amber-500/[0.06]',
                            item.tom === 'vazio' && 'opacity-70'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0">
                              {item.tom === 'vazio' ? (
                                <CircleDashed className="h-3.5 w-3.5 text-stone-600" />
                              ) : destacado ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                <span className="text-[11px] text-stone-500">{item.label}</span>
                                {item.confidence && (
                                  <span
                                    className={cn(
                                      'shrink-0 font-mono text-[9px] uppercase',
                                      destacado ? 'text-amber-400' : 'text-stone-600'
                                    )}
                                  >
                                    {item.confidence}
                                  </span>
                                )}
                              </div>

                              <p
                                className={cn(
                                  'mt-0.5 break-words text-xs',
                                  item.tom === 'vazio'
                                    ? 'text-stone-600 italic'
                                    : destacado
                                    ? 'text-amber-200'
                                    : 'text-stone-100'
                                )}
                              >
                                {item.value || UNCONFIRMED_LABEL}
                              </p>

                              {item.origem && (
                                <p
                                  className={cn(
                                    'mt-1 truncate font-mono text-[10px]',
                                    item.veioDeOutro ? 'text-amber-500/80' : 'text-stone-600'
                                  )}
                                  title={item.origem}
                                >
                                  no documento: {item.origem}
                                </p>
                              )}

                              {item.veioDeOutro && (
                                <p className="mt-1 text-[10px] text-amber-400/90">
                                  Este valor veio de outro campo do documento. Confira se é o
                                  certo para{' '}
                                  {item.label}.
                                </p>
                              )}

                              {onFocusField && item.tom !== 'ok' && (
                                <button
                                  type="button"
                                  onClick={() => onFocusField(indice, item.label)}
                                  className="mt-1.5 text-[10px] font-bold text-stone-400 underline underline-offset-2 hover:text-white"
                                >
                                  preencher à mão
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── O que o fabricante não informou ── */}
      {gaps.length > 0 && (
        <section className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-300">
              <ShieldCheck className="h-3.5 w-3.5 text-stone-500" />
              Não informado pelo fabricante
            </h4>
            <span className="rounded-full border border-stone-800 bg-stone-900 px-2 py-0.5 font-mono text-[10px] text-stone-400">
              {gaps.length} campo(s)
            </span>
          </header>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {gaps.map((g) => (
              <div
                key={`${g.sectionIndex}_${g.label}`}
                className="rounded-xl border border-stone-800 bg-stone-900/50 px-3 py-2"
              >
                <p className="text-[11px] font-semibold text-stone-300">{g.label}</p>
                <p className="mt-0.5 text-[10px] text-stone-500">
                  {g.sectionTitle}
                  {g.synonyms?.length ? ` · também: ${g.synonyms.slice(0, 3).join(', ')}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
