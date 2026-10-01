'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ShieldCheck, Sparkles, Check, Info, FileCheck } from 'lucide-react';
import { EBikeGrouped, EBikeSEOReport } from '@/types/ebike';

interface BikeFAQSectionProps {
  bike: EBikeGrouped;
  seoReport?: EBikeSEOReport;
}

export default function BikeFAQSection({ bike, seoReport }: BikeFAQSectionProps) {
  const [openIndices, setOpenIndices] = useState<number[]>([0]);

  const toggleFAQ = (index: number) => {
    if (openIndices.includes(index)) {
      setOpenIndices(openIndices.filter((i) => i !== index));
    } else {
      setOpenIndices([...openIndices, index]);
    }
  };

  const defaultFaqs = [
    {
      question: `Qual é a autonomia real da e-bike ${bike.marca} ${bike.modelo}?`,
      answer: `A ${bike.marca} ${bike.modelo} possui autonomia declarada de até ${bike.autonomiaKm} km por recarga em condições ideais de pedal assistido em modo econômico. Em trânsito urbano real com aclives e uso intensivo da assistência, a média estimada fica entre ${(bike.autonomiaKm * 0.7).toFixed(0)} km e ${(bike.autonomiaKm * 0.85).toFixed(0)} km.`
    },
    {
      question: `A ${bike.marca} ${bike.modelo} precisa de CNH, emplacamento ou IPVA?`,
      answer: `Não. Conforme a Resolução CONTRAN nº 996/2023, bicicletas elétricas com pedal assistido de potência até 1000W e velocidade limitada a 32 km/h não exigem CNH, emplacamento nem IPVA, sendo 100% liberadas para ciclovias e ciclofaixas no Brasil.`
    },
    {
      question: `A bateria é removível e como funciona a recarga?`,
      answer: `A bateria conta com chave de segurança contra furto e pode ser facilmente removida para ser recarregada em tomadas convencionais residenciais de 110V ou 220V. O tempo de carga total é de cerca de ${bike.tempoCargaHoras || 5} horas.`
    },
    {
      question: `A ${bike.marca} ${bike.modelo} sobe ladeiras íngremes?`,
      answer: `Com motor elétrico de ${bike.potenciaW}W, ela oferece assistência forte para superar aclives urbanos moderados a íngremes sem exigir esforço excessivo do ciclista.`
    }
  ];

  const faqs = seoReport?.faqSchema && seoReport.faqSchema.length > 0 ? seoReport.faqSchema : defaultFaqs;
  const contranCat = seoReport?.contranCategory || 'Bicicleta Elétrica Assistida (Resolução CONTRAN 996/2023)';

  return (
    <div className="bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-accent-gold rounded-xl border border-ink shadow-2xs text-ink">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-black text-ink tracking-tight text-sm sm:text-base">
              Perguntas Frequentes &amp; Conformidade CONTRAN
            </h3>
            <p className="text-[11px] font-mono text-ink/70 mt-0.5">
              Tire dúvidas técnicas, regulatórias e de uso sobre a {bike.marca} {bike.modelo}
            </p>
          </div>
        </div>

        {/* Badge CONTRAN 996 */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-600/30 rounded-lg text-emerald-800 font-mono text-[11px] font-bold self-start sm:self-auto shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Resolução CONTRAN 996/2023 (Sem CNH)</span>
        </div>
      </div>

      {/* Síntese GEO / AI Overview */}
      {seoReport?.llmGeoSummary && (
        <div className="p-3.5 bg-accent-charge/15 border border-ink/80 rounded-xl space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-ink uppercase">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Veredito Semântico &amp; Resumo Rápido da IA</span>
            </div>
            <span className="text-[10px] font-mono text-ink/60 bg-white/80 border border-line/60 px-2 py-0.5 rounded">
              Google AI Overviews Ready
            </span>
          </div>
          <p className="text-xs text-ink/85 leading-relaxed font-sans">
            {seoReport.llmGeoSummary}
          </p>
        </div>
      )}

      {/* 3 Pilares Legais do CONTRAN 996 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-neutral-50/90 border border-line/70 rounded-xl p-2.5 flex items-start gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-tight text-ink/85">
            <strong className="block font-bold text-ink mb-0.5">Sem CNH ou ACC</strong>
            Dispensada de carteira nacional de habilitação para condução.
          </div>
        </div>
        <div className="bg-neutral-50/90 border border-line/70 rounded-xl p-2.5 flex items-start gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-tight text-ink/85">
            <strong className="block font-bold text-ink mb-0.5">Sem Emplacamento / IPVA</strong>
            Sem taxas veiculares, IPVA ou exigência de placas oficiais.
          </div>
        </div>
        <div className="bg-neutral-50/90 border border-line/70 rounded-xl p-2.5 flex items-start gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-tight text-ink/85">
            <strong className="block font-bold text-ink mb-0.5">Liberada em Ciclovias</strong>
            Velocidade limitada a 32 km/h no pedal assistido (propulsão limpa).
          </div>
        </div>
      </div>

      {contranCat && (
        <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2 text-[11px] font-mono text-emerald-900">
          <FileCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span><strong>Enquadramento Técnico:</strong> {contranCat}</span>
        </div>
      )}

      {/* Lista Accordion de Perguntas e Respostas */}
      <div className="space-y-2 pt-1">
        {faqs.map((faq, index) => {
          const isOpen = openIndices.includes(index);
          return (
            <div
              key={index}
              className="bg-white border border-ink/70 rounded-xl overflow-hidden shadow-2xs transition-all"
            >
              <button
                type="button"
                onClick={() => toggleFAQ(index)}
                className="w-full p-3 sm:p-3.5 text-left flex items-center justify-between gap-3 font-bold text-ink hover:bg-neutral-50 cursor-pointer transition-colors text-xs sm:text-sm"
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-ink shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-3.5 pb-3.5 pt-1 text-xs text-ink/80 font-sans leading-relaxed border-t border-line bg-neutral-50/50">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
