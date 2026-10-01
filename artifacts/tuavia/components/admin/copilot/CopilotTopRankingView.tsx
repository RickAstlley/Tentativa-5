'use client';

/**
 * components/admin/copilot/CopilotTopRankingView.tsx
 *
 * Geração de ranking dentro do copilot. Compõe o `RankingAiAssistantCard` já
 * existente em vez de criar uma segunda tela de geração.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, ArrowRight } from 'lucide-react';
import RankingAiAssistantCard from '@/components/admin/RankingAiAssistantCard';
import { Button, Card, Badge } from '@/components/admin/ui';
import { saveAIDraft } from '@/lib/aiDraftCache';

export interface CopilotTopRankingViewProps {
  onRefreshDraftCount: () => void;
  className?: string;
}

interface RankingPreview {
  titulo: string;
  categoria: string;
  itens: Array<{ tituloItem?: string; marca?: string }>;
}

export function CopilotTopRankingView({
  onRefreshDraftCount,
  className,
}: CopilotTopRankingViewProps): React.ReactElement {
  const router = useRouter();
  const [preview, setPreview] = React.useState<RankingPreview | null>(null);

  function handleGenerated(data: any) {
    setPreview({
      titulo: data?.titulo ?? 'Ranking sem título',
      categoria: data?.categoria ?? 'ebikes',
      itens: Array.isArray(data?.itens) ? data.itens : [],
    });

    saveAIDraft({
      taskType: 'ranking_generation',
      title: data?.titulo ?? 'Ranking gerado',
      summary: `${data?.itens?.length ?? 0} modelos avaliados`,
      model: 'Copiloto TuaVia IA',
      rawContent: JSON.stringify(data, null, 2),
      parsedData: data,
    });
    onRefreshDraftCount();
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <RankingAiAssistantCard onRankingGenerated={handleGenerated} />

      {preview ? (
        <Card variant="default" padding="md">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="font-display text-sm font-bold text-stone-800 dark:text-stone-200">
              {preview.titulo}
            </h3>
            <Badge tone="info" className="ml-auto">
              {preview.categoria}
            </Badge>
          </div>

          <ol className="space-y-1">
            {preview.itens.slice(0, 10).map((item, index) => (
              <li
                key={`${item.tituloItem ?? index}`}
                className="flex items-baseline gap-2 text-xs text-stone-600 dark:text-stone-400"
              >
                <span className="w-5 font-mono text-[10px] text-stone-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {item.marca} {item.tituloItem}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-4">
            <Button size="sm" onClick={() => router.push('/admin/rankings/novo')}>
              <ArrowRight className="h-3.5 w-3.5" />
              Revisar e publicar
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export default CopilotTopRankingView;
