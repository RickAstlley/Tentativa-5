'use client';

/**
 * components/admin/copilot/CopilotEBikeAnalysisView.tsx
 *
 * Vista de análise de e-bike dentro do copilot. Compõe o `BikeAiAssistantCard`
 * que já existe em vez de criar uma segunda tela, acrescentando só o que falta:
 * extrair a ficha determinística primeiro, mostrar o score de integridade e
 * encaminhar para o formulário.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSearch, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import BikeAiAssistantCard from '@/components/admin/BikeAiAssistantCard';
import { Button, Card } from '@/components/admin/ui';
import { auditEBikeSpecs } from '@/lib/ai/deterministicAuditor';
import { allocateAndNormalizeSpecSections } from '@/lib/specAllocations';
import { saveAIDraft } from '@/lib/aiDraftCache';
import type { EBikeSpecSection } from '@/types/ebike';

export interface CopilotEBikeAnalysisViewProps {
  onRefreshDraftCount: () => void;
  className?: string;
}

export function CopilotEBikeAnalysisView({
  onRefreshDraftCount,
  className,
}: CopilotEBikeAnalysisViewProps): React.ReactElement {
  const router = useRouter();
  const [sections, setSections] = useState<EBikeSpecSection[]>([]);
  const [integrity, setIntegrity] = useState<{ score: number; unconfirmed: number } | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  function handleExtracted(data: any) {
    // A extração determinística já devolve as seções; normalizamos no mesmo
    // alocador que o formulário usa, para os dois caminhos produzirem igual.
    const normalized = allocateAndNormalizeSpecSections(undefined, data?.specSections ?? [], {
      potenciaW: data?.potenciaW,
      autonomiaKm: data?.autonomiaKm,
      pesoKg: data?.pesoKg,
      tempoCargaHoras: data?.tempoCargaHoras,
      usoPrincipal: data?.usoPrincipal ?? data?.categoria,
      marca: data?.marca,
      modelo: data?.modelo,
    });
    setSections(normalized);

    const audit = auditEBikeSpecs(normalized as never);
    setIntegrity({
      score: audit.auditSummary.integrityScore,
      unconfirmed: audit.auditSummary.unconfirmedCount,
    });
    setShowAudit(true);

    saveAIDraft({
      taskType: 'ebike_autofill',
      title: `${data?.marca ?? ''} ${data?.modelo ?? ''}`.trim() || 'Ficha extraída',
      summary: `${normalized.length} seções canônicas · score ${audit.auditSummary.integrityScore}`,
      model: 'Copiloto TuaVia IA',
      rawContent: JSON.stringify(data, null, 2),
      parsedData: data,
    });
    onRefreshDraftCount();
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <BikeAiAssistantCard onDataExtracted={handleExtracted} />

      {showAudit && integrity ? (
        <Card variant="default" padding="md">
          <div className="mb-3 flex items-center gap-2">
            {integrity.score >= 70 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )}
            <h3 className="font-display text-sm font-bold text-stone-800 dark:text-stone-200">
              Auditoria da ficha — score {integrity.score}/100
            </h3>
            <span className="ml-auto text-[11px] text-stone-500">
              {integrity.unconfirmed} campo(s) sem fonte
            </span>
          </div>

          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.title} className="text-[11px] text-stone-600 dark:text-stone-400">
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {section.title}
                </span>{' '}
                — {section.items.length} item(ns)
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => router.push('/admin/bikes/novo')}>
              <ArrowRight className="h-3.5 w-3.5" />
              Abrir no formulário
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAudit(false)}>
              Fechar auditoria
            </Button>
          </div>
        </Card>
      ) : (
        <Card variant="outlined" padding="lg" className="text-center">
          <FileSearch className="mx-auto mb-2 h-5 w-5 text-stone-400" />
          <p className="text-xs text-stone-500">
            Cole uma ficha técnica, um PDF ou uma URL de fabricante. A extração é determinística
            primeiro; a IA só entra para fechar o que faltar.
          </p>
        </Card>
      )}
    </div>
  );
}

export default CopilotEBikeAnalysisView;
