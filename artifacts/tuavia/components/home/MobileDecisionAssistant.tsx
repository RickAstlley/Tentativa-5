'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  Compass, 
  ArrowRight, 
  Check, 
  RotateCcw, 
  X, 
  Bike, 
  Zap, 
  BatteryCharging, 
  Scale, 
  Layers 
} from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import { EBikeGrouped } from '@/types/ebike';

interface MobileDecisionAssistantProps {
  bikes: EBikeGrouped[];
  formatBrl: (val: number) => string;
  onCompareToggle: (slug: string) => void;
  comparedSlugs: string[];
}

type RouteType = 'asfalto' | 'subidas' | 'dobravel' | 'cargas' | null;
type DistanceType = 'curta' | 'media' | 'longa' | null;
type BudgetType = 'economico' | 'medio' | 'premium' | null;

export default function MobileDecisionAssistant({
  bikes,
  formatBrl,
  onCompareToggle,
  comparedSlugs
}: MobileDecisionAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Respostas do usuário
  const [selectedRoute, setSelectedRoute] = useState<RouteType>(null);
  const [selectedDistance, setSelectedDistance] = useState<DistanceType>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetType>(null);

  const resetQuiz = () => {
    setStep(1);
    setSelectedRoute(null);
    setSelectedDistance(null);
    setSelectedBudget(null);
  };

  // Cálculo das recomendações baseado nas respostas
  const recommendedBikes = useMemo(() => {
    if (!bikes || bikes.length === 0) return [];

    let filtered = [...bikes];

    // 1. Filtro de Rota / Uso
    if (selectedRoute === 'asfalto') {
      filtered = filtered.filter((b) => b.usoPrincipal === 'Urbana' || b.usoPrincipal === 'Speed');
    } else if (selectedRoute === 'subidas') {
      filtered = filtered.filter((b) => Boolean(b.usoPrincipal === 'Trilha/MTB' || (typeof b.potenciaW === 'number' && b.potenciaW >= 350)));
    } else if (selectedRoute === 'dobravel') {
      filtered = filtered.filter((b) => Boolean(b.usoPrincipal === 'Dobrável' || b.modelo.toLowerCase().includes('dobr') || (typeof b.pesoKg === 'number' && b.pesoKg <= 22)));
    } else if (selectedRoute === 'cargas') {
      filtered = filtered.filter((b) => Boolean(b.usoPrincipal === 'Cargo' || (typeof b.potenciaW === 'number' && b.potenciaW >= 350)));
    }

    // Se o filtro de rota for muito restrito, relaxa para toda a lista
    if (filtered.length === 0) filtered = [...bikes];

    // 2. Filtro de Distância / Autonomia
    if (selectedDistance === 'curta') {
      // Qualquer autonomia serve
    } else if (selectedDistance === 'media') {
      const withMediumRange = filtered.filter((b) => !b.autonomiaKm || b.autonomiaKm >= 35);
      if (withMediumRange.length > 0) filtered = withMediumRange;
    } else if (selectedDistance === 'longa') {
      const withHighRange = filtered.filter((b) => !b.autonomiaKm || b.autonomiaKm >= 50);
      if (withHighRange.length > 0) filtered = withHighRange;
    }

    // 3. Filtro de Orçamento
    if (selectedBudget === 'economico') {
      filtered.sort((a, b) => a.menorPreco - b.menorPreco);
    } else if (selectedBudget === 'medio') {
      filtered = filtered.filter((b) => b.menorPreco >= 4000 && b.menorPreco <= 8500);
      if (filtered.length === 0) filtered = [...bikes].sort((a, b) => a.menorPreco - b.menorPreco);
    } else if (selectedBudget === 'premium') {
      filtered.sort((a, b) => b.menorPreco - a.menorPreco);
    }

    return filtered.slice(0, 3);
  }, [bikes, selectedRoute, selectedDistance, selectedBudget]);

  return (
    <>
      {/* CARD BANNER COMPACTO NA HOME */}
      <div 
        id="mobile-decision-assistant-card"
        className="w-full bg-gradient-to-br from-amber-50 via-white to-amber-100/60 border-2 border-ink rounded-2xl p-3.5 sm:p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] relative overflow-hidden"
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent-gold border border-ink flex items-center justify-center shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
              <Compass className="w-4 h-4 text-ink" />
            </div>
            <div>
              <h3 className="font-display font-black text-xs sm:text-sm text-ink tracking-tight">
                Dúvida sobre qual e-bike comprar?
              </h3>
            </div>
          </div>
          <span className="text-[8px] font-mono font-bold bg-white text-ink border border-ink px-1.5 py-0.5 rounded shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
            30 seg
          </span>
        </div>

        <p className="text-[10px] sm:text-xs text-ink/80 font-sans font-medium mt-2 leading-relaxed">
          Responda a 3 perguntas rápidas sobre sua rotina e descubra a e-bike ideal para o seu trajeto.
        </p>

        <button
          type="button"
          onClick={() => {
            resetQuiz();
            setIsOpen(true);
          }}
          className="mt-3 w-full bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-xs py-2 px-3 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-ink shrink-0" />
          <span>Descobrir Minha E-Bike Ideal</span>
          <ArrowRight className="w-3.5 h-3.5 text-ink shrink-0" />
        </button>
      </div>

      {/* MODAL INTERATIVO / POP-UP CENTRALIZADO DO QUIZ */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/75 backdrop-blur-xs p-3.5 sm:p-5 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div 
            className="w-full max-w-lg bg-white border-2 border-ink rounded-2xl sm:rounded-3xl shadow-[4px_4px_0_0_rgba(46,43,39,1)] sm:shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col max-h-[88vh] sm:max-h-[82vh] overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
          >
            {/* Header do Modal */}
            <div className="p-3.5 sm:p-4 bg-amber-50/80 border-b-2 border-ink flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-accent-gold border border-ink flex items-center justify-center font-mono font-black text-xs text-ink">
                  {step < 4 ? step : '✓'}
                </span>
                <div>
                  <h4 className="font-display font-black text-xs sm:text-sm text-ink leading-none">
                    {step === 1 && 'Passo 1: Qual o seu trajeto principal?'}
                    {step === 2 && 'Passo 2: Distância diária aproximada?'}
                    {step === 3 && 'Passo 3: Faixa de investimento?'}
                    {step === 4 && '🎯 As Melhores E-Bikes Para Você'}
                  </h4>
                  <span className="text-[9px] font-mono text-ink/70">
                    {step < 4 ? `Pergunta ${step} de 3` : `${recommendedBikes.length} modelos recomendados`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-xl bg-white border border-ink flex items-center justify-center text-ink hover:bg-neutral-100 active:scale-90 transition-transform cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo das Etapas */}
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
              
              {/* ETAPA 1: TIPO DE ROTA */}
              {step === 1 && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs text-ink font-semibold">
                    Selecione onde você vai pedalar na maior parte do tempo:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoute('asfalto');
                        setStep(2);
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                        selectedRoute === 'asfalto'
                          ? 'bg-amber-100/70 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-bold'
                          : 'bg-neutral-50 border-ink/30 hover:border-ink hover:bg-neutral-100'
                      }`}
                    >
                      <span className="text-lg shrink-0">🏢</span>
                      <div>
                        <div className="font-display font-black text-xs text-ink">Asfalto & Ciclovias</div>
                        <div className="text-[10px] text-ink/70 font-sans mt-0.5">Urbano, plano e deslocamento diário</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoute('subidas');
                        setStep(2);
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                        selectedRoute === 'subidas'
                          ? 'bg-amber-100/70 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-bold'
                          : 'bg-neutral-50 border-ink/30 hover:border-ink hover:bg-neutral-100'
                      }`}
                    >
                      <span className="text-lg shrink-0">⛰️</span>
                      <div>
                        <div className="font-display font-black text-xs text-ink">Subidas & Ladeiras</div>
                        <div className="text-[10px] text-ink/70 font-sans mt-0.5">Torque forte e tração para morros</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoute('dobravel');
                        setStep(2);
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                        selectedRoute === 'dobravel'
                          ? 'bg-amber-100/70 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-bold'
                          : 'bg-neutral-50 border-ink/30 hover:border-ink hover:bg-neutral-100'
                      }`}
                    >
                      <span className="text-lg shrink-0">🎒</span>
                      <div>
                        <div className="font-display font-black text-xs text-ink">Metrô, Ônibus & Porta-Malas</div>
                        <div className="text-[10px] text-ink/70 font-sans mt-0.5">Compacta, dobrável e fácil de carregar</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoute('cargas');
                        setStep(2);
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                        selectedRoute === 'cargas'
                          ? 'bg-amber-100/70 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-bold'
                          : 'bg-neutral-50 border-ink/30 hover:border-ink hover:bg-neutral-100'
                      }`}
                    >
                      <span className="text-lg shrink-0">📦</span>
                      <div>
                        <div className="font-display font-black text-xs text-ink">Entregas & Trabalho de Carga</div>
                        <div className="text-[10px] text-ink/70 font-sans mt-0.5">Bateria gigante e alta capacidade de carga</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 2: DISTÂNCIA DIÁRIA */}
              {step === 2 && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs text-ink font-semibold">
                    Quantos quilômetros você pretende rodar por dia?
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDistance('curta');
                        setStep(3);
                      }}
                      className="p-3 rounded-xl border-2 bg-neutral-50 border-ink/30 hover:border-ink hover:bg-amber-50 text-left transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔋</span>
                        <div>
                          <div className="font-display font-black text-xs text-ink">Até 20 km por dia</div>
                          <div className="text-[10px] text-ink/70 font-sans">Baterias padrão (36V 8Ah a 10Ah) atendem perfeitamente</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink/60" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDistance('media');
                        setStep(3);
                      }}
                      className="p-3 rounded-xl border-2 bg-neutral-50 border-ink/30 hover:border-ink hover:bg-amber-50 text-left transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚡</span>
                        <div>
                          <div className="font-display font-black text-xs text-ink">20 a 45 km por dia</div>
                          <div className="text-[10px] text-ink/70 font-sans">Autonomia média para ir e voltar sem recarregar no meio</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink/60" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDistance('longa');
                        setStep(3);
                      }}
                      className="p-3 rounded-xl border-2 bg-neutral-50 border-ink/30 hover:border-ink hover:bg-amber-50 text-left transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚀</span>
                        <div>
                          <div className="font-display font-black text-xs text-ink">Mais de 50 km por dia</div>
                          <div className="text-[10px] text-ink/70 font-sans">Baterias de alta capacidade (48V 13Ah+) para longa jornada</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink/60" />
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 3: ORÇAMENTO */}
              {step === 3 && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs text-ink font-semibold">
                    Qual faixa de investimento você prefere?
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBudget('economico');
                        setStep(4);
                      }}
                      className="p-3 rounded-xl border-2 bg-neutral-50 border-ink/30 hover:border-ink hover:bg-amber-50 text-left transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🏷️</span>
                        <div>
                          <div className="font-display font-black text-xs text-ink">Até R$ 5.000 (Custo-Benefício)</div>
                          <div className="text-[10px] text-ink/70 font-sans">Modelos de entrada com ótimo retorno por real investido</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink/60" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBudget('medio');
                        setStep(4);
                      }}
                      className="p-3 rounded-xl border-2 bg-neutral-50 border-ink/30 hover:border-ink hover:bg-amber-50 text-left transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚖️</span>
                        <div>
                          <div className="font-display font-black text-xs text-ink">R$ 5.000 a R$ 8.500 (Equilíbrio)</div>
                          <div className="text-[10px] text-ink/70 font-sans">Componentes intermediários com maior durabilidade e conforto</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink/60" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBudget('premium');
                        setStep(4);
                      }}
                      className="p-3 rounded-xl border-2 bg-neutral-50 border-ink/30 hover:border-ink hover:bg-amber-50 text-left transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">👑</span>
                        <div>
                          <div className="font-display font-black text-xs text-ink">Acima de R$ 8.500 (Alta Performance)</div>
                          <div className="text-[10px] text-ink/70 font-sans">Motores centrais, sensores de torque e baterias de topo de linha</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink/60" />
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 4: RESULTADO DAS RECOMENDAÇÕES */}
              {step === 4 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-mono text-[11px] font-bold">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Análise concluída para seu perfil!</span>
                    </div>
                    <button
                      type="button"
                      onClick={resetQuiz}
                      className="text-[10px] font-mono text-ink/70 hover:text-ink underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Refazer</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {recommendedBikes.map((bike, idx) => {
                      const isCompared = comparedSlugs.includes(bike.slug);

                      return (
                        <div
                          key={bike.slug}
                          className="bg-white border-2 border-ink rounded-xl p-2.5 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center gap-3"
                        >
{/* Imagem */}
                           <div className="relative w-full aspect-video max-w-16 max-h-16 rounded-lg bg-neutral-100 border border-ink/20 relative overflow-hidden shrink-0">
                             <SafeImage
                               src={bike.imagemUrl || '/placeholder-bike.png'}
                               alt={bike.modelo}
                               fill
                               className="object-cover"
                               referrerPolicy="no-referrer"
                             />
                             <span className="absolute top-0.5 left-0.5 bg-accent-gold text-ink font-mono font-black text-[8px] px-1 rounded border border-ink">
                               #{idx + 1}
                             </span>
                           </div>

                          {/* Infos */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] font-mono font-bold text-primary bg-primary/10 px-1 py-0.2 rounded border border-primary/20">
                                  {bike.marca}
                                </span>
                                <span className="text-[8px] font-mono text-ink/70">
                                  {bike.usoPrincipal}
                                </span>
                              </div>
                              <h5 className="font-display font-black text-xs text-ink truncate mt-0.5">
                                {bike.modelo}
                              </h5>
                            </div>

                            <div className="flex items-baseline gap-2 mt-1">
                              <strong className="font-mono font-black text-xs text-primary">
                                {formatBrl(bike.menorPreco)}
                              </strong>
                              <span className="text-[8px] font-mono text-ink/60">
                                {bike.autonomiaKm ? `🔋 ${bike.autonomiaKm}km` : ''} {bike.potenciaW ? `• ⚡ ${bike.potenciaW}W` : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Link
                                href={`/bike/${bike.slug}`}
                                onClick={() => setIsOpen(false)}
                                className="bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-[9px] px-2 py-1 rounded-md border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] active:scale-95 transition-transform"
                              >
                                Ver Ofertas
                              </Link>
                              <button
                                type="button"
                                onClick={() => onCompareToggle(bike.slug)}
                                className={`font-mono font-bold text-[9px] px-2 py-1 rounded-md border border-ink transition-all cursor-pointer ${
                                  isCompared
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-neutral-100 hover:bg-neutral-200 text-ink'
                                }`}
                              >
                                {isCompared ? '✓ Comparando' : '+ Comparar'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Footer / Botão de Voltar se estiver no passo 2 ou 3 */}
            {step > 1 && step < 4 && (
              <div className="p-3 bg-neutral-50 border-t border-ink/20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as any) : 1))}
                  className="font-mono font-bold text-[10px] text-ink/70 hover:text-ink flex items-center gap-1 cursor-pointer"
                >
                  ← Voltar pergunta
                </button>
                <button
                  type="button"
                  onClick={resetQuiz}
                  className="font-mono text-[9px] text-red-600 hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="p-3 bg-neutral-50 border-t border-ink/20 flex items-center justify-between">
                <Link
                  href="/ebike"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-center font-mono font-bold text-xs text-primary hover:underline py-1"
                >
                  Ver todo o catálogo com filtros avançados ➔
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
