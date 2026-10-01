'use client';

/**
 * components/admin/create/CreateWizard.tsx
 *
 * Hub de criação do admin. Módulo importado por `app/admin/criar/page.tsx`
 * que nunca foi commitado.
 *
 * Mantém a escolha de tipo (e-bike, artigo, ranking) e mostra, para cada um,
 * quantas fontes você já tem pronta — a informação que o editor precisa antes
 * de começar.
 */

import React from 'react';
import Link from 'next/link';
import { Bike, FileText, Trophy, ArrowRight, Upload, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, Badge } from '@/components/admin/ui';
import { CANONICAL_SPEC_SECTIONS } from '@/lib/specAllocations';
import { getActiveExtractionCache } from '@/lib/admin/extractionCache';

interface CreateOption {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  hint: string;
}

const OPTIONS: CreateOption[] = [
  {
    href: '/admin/bikes/novo',
    title: 'E-Bike',
    description: 'Ficha técnica completa com as 10 seções canônicas, auditoria e ofertas.',
    icon: <Bike className="h-6 w-6" />,
    accent: 'text-emerald-600',
    hint: 'Arraste um PDF/XLSX do fabricante para preencher automaticamente.',
  },
  {
    href: '/admin/artigos/novo',
    title: 'Artigo',
    description: 'Texto editorial com SEO, FAQ, GEO e imagens pesquisadas.',
    icon: <FileText className="h-6 w-6" />,
    accent: 'text-sky-600',
    hint: 'Um radar existente pode virar pauta pré-preenchida.',
  },
  {
    href: '/admin/rankings/novo',
    title: 'Ranking',
    description: 'Top N com critérios, matriz de avaliação e lojas por item.',
    icon: <Trophy className="h-6 w-6" />,
    accent: 'text-amber-500',
    hint: 'Publicar o ranking sincroniza as e-bikes citadas com o catálogo.',
  },
];

export function CreateWizard(): React.ReactElement {
  const [activeCache, setActiveCache] = React.useState<{ fileName: string; mode: string } | null>(
    null
  );

  React.useEffect(() => {
    try {
      const cache = getActiveExtractionCache();
      if (cache) setActiveCache({ fileName: cache.fileName, mode: cache.mode });
    } catch {
      setActiveCache(null);
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="font-display text-xl font-extrabold text-stone-900 dark:text-stone-100">
          Criar novo
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Escolha o tipo de conteúdo. A extração de documentos é determinística; a IA completa
          apenas o que não veio com fonte.
        </p>
      </header>

      {activeCache ? (
        <Card
          variant="default"
          padding="md"
          className="border-amber-300 bg-amber-50 dark:bg-amber-900/20"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Extração em andamento: {activeCache.fileName}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                Ao criar uma {activeCache.mode === 'ebike' ? 'e-bike' : activeCache.mode}, o cache
                será reaproveitado em vez de reenviar o arquivo.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <Link key={option.href} href={option.href} className="group">
            <Card
              variant="elevated"
              padding="lg"
              hover
              className="h-full transition-transform group-hover:-translate-y-0.5"
            >
              <div className={`mb-3 ${option.accent}`}>{option.icon}</div>
              <h2 className="font-display text-base font-extrabold text-stone-900 dark:text-stone-100">
                {option.title}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                {option.description}
              </p>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-stone-500">
                <Upload className="mt-0.5 h-3 w-3 shrink-0" />
                {option.hint}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Abrir
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Card>
          </Link>
        ))}
      </div>

      <Card variant="outlined" padding="md">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          <div className="text-[11px] text-stone-500">
            <p className="font-semibold text-stone-700 dark:text-stone-300">
              A ficha de e-bike tem {CANONICAL_SPEC_SECTIONS.length} seções canônicas
            </p>
            <p className="mt-0.5">
              Todo campo nasce marcado como “Não informado pelo fabricante” até haver uma fonte
              verificável. O score de integridade aparece no topo do formulário.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CANONICAL_SPEC_SECTIONS.map((section) => (
            <Badge key={section.title} tone="neutral">
              {section.title.replace(/^\d+\.\s*/, '')}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default CreateWizard;
