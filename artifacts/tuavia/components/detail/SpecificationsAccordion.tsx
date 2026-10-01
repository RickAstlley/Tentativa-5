'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { EBikeSpecSection, EBikeSpecItem } from '@/types/ebike';

interface SpecificationsAccordionProps {
  specSections: EBikeSpecSection[];
  expandedSpecs: Record<number, boolean>;
  toggleSpecSection: (index: number) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export default function SpecificationsAccordion({
  specSections,
  expandedSpecs,
  toggleSpecSection,
  onExpandAll,
  onCollapseAll,
}: SpecificationsAccordionProps) {
  const allOpen = specSections.every((_, idx) => expandedSpecs[idx]);

  const handleToggleAll = () => {
    if (allOpen) {
      if (onCollapseAll) onCollapseAll();
    } else {
      if (onExpandAll) onExpandAll();
    }
  };

  return (
    <div 
      id="especificacoes-tecnicas" 
      className="bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-4 scroll-mt-6"
    >
      <div className="border-b border-line pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
            Ficha Técnica Auditada
          </span>
          <h2 className="font-display font-black text-ink uppercase tracking-wider text-sm sm:text-base mt-1">
            Especificações Técnicas Completas
          </h2>
          <p className="text-ink/70 font-sans text-xs mt-0.5">
            Dados auditados com rastreabilidade de fontes oficiais e verificação técnica independente.
          </p>
        </div>

        {specSections.length > 1 && (
          <button
            type="button"
            onClick={handleToggleAll}
            className="self-start sm:self-auto text-xs font-mono font-bold text-ink bg-neutral-100 hover:bg-neutral-200 border border-ink/30 px-3 py-1 rounded-lg transition-all shadow-2xs cursor-pointer select-none"
          >
            {allOpen ? 'Recolher Todos' : 'Expandir Todos'}
          </button>
        )}
      </div>

      {/* Accordions Expansivos em Grid Branco de Alto Contraste */}
      <div className="flex flex-col gap-2.5">
        {specSections.map((section, idx) => {
          const isOpen = expandedSpecs[idx];
          return (
            <div 
              key={idx} 
              className="bg-neutral-50/60 border border-ink/70 rounded-xl overflow-hidden shadow-2xs transition-all"
            >
              <button
                onClick={() => toggleSpecSection(idx)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left font-display font-bold text-ink bg-white hover:bg-neutral-50 transition-colors cursor-pointer text-xs sm:text-sm"
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  <span>{section.title}</span>
                </span>
                <span className="p-1 rounded-lg bg-neutral-100 border border-line text-ink">
                  {isOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-ink" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-ink" />
                  )}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    {section.auditReport && (
                      <div className="mx-3 sm:mx-4 my-2.5 p-2.5 bg-neutral-100/70 border border-line/60 rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="flex items-center gap-1.5 text-ink/80 font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>Auditoria de Ficha Técnica</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-ink/70">
                          {typeof section.auditReport.confirmados === 'number' && section.auditReport.confirmados > 0 && (
                            <span className="text-emerald-700 font-bold">{section.auditReport.confirmados} auditados</span>
                          )}
                          {typeof section.auditReport.calculados === 'number' && section.auditReport.calculados > 0 && (
                            <span className="text-blue-700 font-medium">• {section.auditReport.calculados} calculados</span>
                          )}
                          {typeof section.auditReport.comerciais === 'number' && section.auditReport.comerciais > 0 && (
                            <span className="text-amber-800 font-medium">• {section.auditReport.comerciais} comerciais</span>
                          )}
                          {typeof section.auditReport.naoInformados === 'number' && section.auditReport.naoInformados > 0 && (
                            <span className="text-stone-600 font-medium">• {section.auditReport.naoInformados} não informados</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-3 sm:p-4 border-t border-line bg-neutral-50/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {section.items.map((item, itemIdx) => {
                        const isNaoInformado = item.status === 'NAO_INFORMADO' || item.value === 'Não informado pelo fabricante' || item.value === 'Não informado';
                        const isCalculado = item.status === 'CALCULADO';
                        const isComercial = item.status === 'FONTE_COMERCIAL' || item.confidence === 'MEDIA';
                        const isConfirmado = (item.status === 'CONFIRMADO' || item.confidence === 'ALTA') && !isNaoInformado;

                        return (
                          <div 
                            key={itemIdx} 
                            className={`bg-white border rounded-xl p-3 flex flex-col justify-between gap-1.5 shadow-2xs transition-colors ${
                              isNaoInformado 
                                ? 'border-dashed border-stone-300 bg-stone-50/50' 
                                : 'border-line hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] font-mono font-bold text-ink/60 uppercase tracking-wider leading-tight">
                                {item.label}
                              </span>

                              <span
                                className={`inline-flex items-center gap-1 text-[8.5px] font-mono px-1.5 py-0.5 rounded-full border shrink-0 ${
                                  isConfirmado
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : isCalculado
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : isComercial
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : 'bg-stone-100 text-stone-600 border-stone-200'
                                }`}
                                title={item.source ? `Fonte: ${item.source}` : isNaoInformado ? 'Não informado pelo fabricante' : `Status: ${item.status || item.confidence}`}
                              >
                                {isConfirmado && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                                {isCalculado && <ShieldCheck className="w-2.5 h-2.5 text-blue-600 shrink-0" />}
                                {isComercial && <ShieldCheck className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                                {isNaoInformado && <AlertCircle className="w-2.5 h-2.5 text-stone-400 shrink-0" />}
                                <span className="font-semibold">
                                  {isConfirmado ? 'Auditado' : isCalculado ? 'Calculado' : isComercial ? 'Comercial' : 'Não Informado'}
                                </span>
                              </span>
                            </div>

                            <div className={`font-mono font-bold text-xs leading-snug break-words ${
                              isNaoInformado ? 'text-stone-400 font-normal italic' : 'text-ink'
                            }`}>
                              {item.value}
                            </div>

                            {item.source && !isNaoInformado && (
                              <span 
                                className="text-[9px] text-ink/45 font-mono tracking-tight pt-1 border-t border-line/40 truncate"
                                title={`Fonte: ${item.source}`}
                              >
                                Fonte: {item.source}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
