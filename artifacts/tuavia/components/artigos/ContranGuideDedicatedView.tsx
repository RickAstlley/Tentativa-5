'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Scale, 
  ArrowRight, 
  Info, 
  Share2, 
  Copy, 
  Check, 
  MessageSquare, 
  Bookmark, 
  Zap, 
  Bike, 
  ChevronRight, 
  AlertOctagon, 
  Award,
  BookOpen,
  ArrowLeft
} from 'lucide-react';

interface ContranGuideDedicatedViewProps {
  onCopyLink?: () => void;
  copied?: boolean;
}

export default function ContranGuideDedicatedView({
  onCopyLink,
  copied = false
}: ContranGuideDedicatedViewProps) {
  const [activeTab, setActiveTab] = useState<string>('pedal-assistido');
  const [localCopied, setLocalCopied] = useState<boolean>(copied);
  const [bookmarked, setBookmarked] = useState<boolean>(false);

  // Monitora a hash na URL para rolagem automática e iluminação da seção correspondente
  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setActiveTab(hash);
        const targetEl = document.getElementById(hash);
        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Limpa o fragmento da URL suavemente para que não permaneça preso ao recarregar ou ao voltar para a Home
            if (window.history && window.history.replaceState) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          }, 150);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabClick = (e: React.MouseEvent<HTMLAnchorElement>, tabId: string) => {
    e.preventDefault();
    setActiveTab(tabId);
    const targetEl = document.getElementById(tabId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopy = () => {
    if (onCopyLink) {
      onCopyLink();
    } else if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setLocalCopied(true);
      setTimeout(() => setLocalCopied(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    if (typeof window !== 'undefined') {
      const text = encodeURIComponent(`Guia Oficial Resolução CONTRAN 996/2023 no TuaVia: Entenda o que pode e o que é proibido rodar nas ciclovias!\n${window.location.href}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-28 sm:pb-32 md:pb-16">
      
      {/* 1. CABEÇALHO OFICIAL DE LEGISLAÇÃO (SEM FOTO / DESIGN LEGAL-TECH PREMIUM) */}
      <header className="bg-white border-2 border-ink rounded-3xl p-6 sm:p-10 shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col gap-6 relative overflow-hidden">
        {/* Tarja Superior com Referência do Diário Oficial */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/15 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-black bg-ink text-amber-300 border border-ink px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>DOU • Resolução nº 996/2023</span>
            </span>

            <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-600 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Em Vigor Nacionalmente</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-ink/70">
            <span>Última Auditoria Jurídica: <strong>Agosto / 2026</strong></span>
          </div>
        </div>

        {/* Título e Descrição Principal */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-mono font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
            <Award className="w-4 h-4 text-primary shrink-0" />
            <span>Dossiê Especial de Compliance e Trânsito Urbano</span>
          </span>

          <h1 className="font-display font-black text-2xl sm:text-4xl md:text-5xl text-ink leading-[1.12] tracking-tight">
            Guia Definitivo da Resolução CONTRAN 996/2023
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-ink/85 font-sans leading-relaxed border-l-4 border-primary pl-4 py-2 bg-neutral-50 rounded-r-2xl">
            Consulte as regras oficiais de trânsito para mobilidade elétrica no Brasil. Saiba exatamente os limites de velocidade, exigências de CNH/Placa e equipamentos obrigatórios para cada tipo de veículo.
          </p>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-dashed border-ink/20">
          <div className="flex items-center gap-2 text-xs font-mono text-ink">
            <span className="font-bold">Navegação Rápida por Cores:</span>
            <span className="text-emerald-700 font-bold">🟢 Verde (Livre)</span>
            <span className="text-amber-800 font-bold">🟡 Amarelo (20km/h)</span>
            <span className="text-red-700 font-bold">🔴 Vermelho (Proibido)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-ink bg-neutral-100 border border-ink px-3 py-1.5 rounded-xl hover:bg-neutral-200 transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] cursor-pointer"
            >
              {(onCopyLink ? copied : localCopied) ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700">Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Copiar Guia</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-white bg-[#25D366] border border-ink px-3 py-1.5 rounded-xl hover:brightness-105 transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 fill-current" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. NAVEGADOR DE QUADRADOS & ATALHOS RÁPIDOS */}
      <nav className="sticky top-4 z-40 bg-white border-2 border-ink rounded-2xl p-2.5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex items-center overflow-x-auto gap-2 scrollbar-none">
        <a
          href="#pedal-assistido"
          onClick={(e) => handleTabClick(e, 'pedal-assistido')}
          className={`px-3.5 py-2 rounded-xl border-2 font-mono text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'pedal-assistido'
              ? 'bg-emerald-600 text-white border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
              : 'bg-emerald-50 text-emerald-950 border-emerald-400 hover:bg-emerald-100'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-800" />
          <span>🟢 Pedal Assistido (E-Bike)</span>
        </a>

        <a
          href="#autopropelidos"
          onClick={(e) => handleTabClick(e, 'autopropelidos')}
          className={`px-3.5 py-2 rounded-xl border-2 font-mono text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'autopropelidos'
              ? 'bg-amber-500 text-ink border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
              : 'bg-amber-50 text-amber-950 border-amber-400 hover:bg-amber-100'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-800" />
          <span>🟡 Autopropelido (Patinete)</span>
        </a>

        <a
          href="#ciclomotores"
          onClick={(e) => handleTabClick(e, 'ciclomotores')}
          className={`px-3.5 py-2 rounded-xl border-2 font-mono text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'ciclomotores'
              ? 'bg-red-600 text-white border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
              : 'bg-red-50 text-red-950 border-red-400 hover:bg-red-100'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 border border-red-800" />
          <span>🔴 Ciclomotor (Scooter)</span>
        </a>

        <a
          href="#penalidades-e-multas"
          onClick={(e) => handleTabClick(e, 'penalidades-e-multas')}
          className={`px-3.5 py-2 rounded-xl border-2 font-mono text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'penalidades-e-multas'
              ? 'bg-ink text-amber-300 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
              : 'bg-neutral-100 text-ink border-ink/40 hover:bg-neutral-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>⚠️ Multas &amp; Penalidades CTB</span>
        </a>

        <a
          href="#tabela-comparativa"
          onClick={(e) => handleTabClick(e, 'tabela-comparativa')}
          className={`px-3.5 py-2 rounded-xl border-2 font-mono text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'tabela-comparativa'
              ? 'bg-primary text-white border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
              : 'bg-neutral-100 text-ink border-ink/40 hover:bg-neutral-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>📊 Tabela Geral</span>
        </a>
      </nav>

      {/* 3. QUADRADO VERDE DETALHADO: BICICLETA ELÉTRICA / PEDELEC */}
      <section
        id="pedal-assistido"
        className="scroll-mt-24 bg-emerald-50/90 border-2 border-emerald-800 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_rgba(6,78,59,1)] flex flex-col gap-6 relative"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-emerald-800/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl border-2 border-emerald-900 shadow-[2px_2px_0_0_rgba(6,78,59,1)]">
              ✓
            </div>
            <div>
              <span className="text-[10px] font-mono font-black bg-emerald-700 text-white px-2.5 py-0.5 rounded uppercase tracking-wider">
                🟢 QUADRADO VERDE • SINAL VERDE NA CICLOVIA
              </span>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-emerald-950 mt-0.5">
                Bicicleta Elétrica (Pedelec / Pedal Assistido)
              </h2>
            </div>
          </div>

          <span className="text-xs font-mono font-bold bg-white text-emerald-900 border-2 border-emerald-800 px-3 py-1.5 rounded-xl shadow-[2px_2px_0_0_rgba(6,78,59,1)] self-start sm:self-auto">
            100% Isento de CNH &amp; Placa
          </span>
        </div>

        {/* Resumo Direto de Regras */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="bg-white border-2 border-emerald-800 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(6,78,59,1)] flex flex-col gap-1">
            <span className="text-emerald-800 font-bold uppercase text-[10px]">Potência Máxima</span>
            <span className="font-display font-black text-lg text-emerald-950">Até 1.000 Watts (1 kW)</span>
            <span className="text-emerald-900/80 text-[11px]">Motor auxiliar proporcional de assistência</span>
          </div>

          <div className="bg-white border-2 border-emerald-800 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(6,78,59,1)] flex flex-col gap-1">
            <span className="text-emerald-800 font-bold uppercase text-[10px]">Corte de Velocidade</span>
            <span className="font-display font-black text-lg text-emerald-950">Até 32 km/h</span>
            <span className="text-emerald-900/80 text-[11px]">Motor desliga automaticamente acima desse limite</span>
          </div>

          <div className="bg-white border-2 border-emerald-800 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(6,78,59,1)] flex flex-col gap-1">
            <span className="text-emerald-800 font-bold uppercase text-[10px]">Acionamento do Motor</span>
            <span className="font-display font-black text-lg text-emerald-950">Sensor de Pedal (PAS)</span>
            <span className="text-emerald-900/80 text-[11px]">Motor só funciona se o ciclista pedalar</span>
          </div>
        </div>

        {/* Detalhamento Técnico Completo do Quadrado Verde */}
        <div className="bg-white border-2 border-emerald-800 rounded-2xl p-5 sm:p-6 shadow-[3px_3px_0_0_rgba(6,78,59,1)] flex flex-col gap-5 text-emerald-950 font-sans">
          <h3 className="font-display font-black text-lg text-emerald-950 border-b-2 border-emerald-200 pb-2">
            📋 Especificações Detalhadas &amp; Requisitos Legais da Bicicleta Elétrica
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
            <div className="flex flex-col gap-3">
              <h4 className="font-mono font-bold text-emerald-900 uppercase text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>O que a Lei Exige &amp; Permite:</span>
              </h4>
              <ul className="flex flex-col gap-2 list-none pl-0">
                <li className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-300">
                  <strong>Uso em Ciclovias:</strong> Permitida em ciclovias, ciclofaixas, ciclorrotas e bordo direito de vias públicas.
                </li>
                <li className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-300">
                  <strong>Pedal Assistido (PAS):</strong> O motor atua estritamente como auxílio, multiplicando a força do pedal.
                </li>
                <li className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-300">
                  <strong>Total Isenção Documental:</strong> Dispensada de registro no DETRAN, emplacamento, taxa de licenciamento e seguro obrigatório.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-mono font-bold text-red-900 uppercase text-xs flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>O que É Estritamente Proibido:</span>
              </h4>
              <ul className="flex flex-col gap-2 list-none pl-0">
                <li className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-300 text-rose-950">
                  <strong>Acelerador Exclusivo de Punho:</strong> Proibido dispositivo que movimente o veículo sem a necessidade de pedalar na ciclovia.
                </li>
                <li className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-300 text-rose-950">
                  <strong>Potência acima de 1.000 Watts:</strong> Motores de 1.500W, 2.000W ou mais desconfiguram o veículo para ciclomotor.
                </li>
                <li className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-300 text-rose-950">
                  <strong>Circulação em Calçadas:</strong> Proibido trafegar sobre passeios de pedestres (salvo se houver sinalização municipal específica).
                </li>
              </ul>
            </div>
          </div>

          {/* Equipamentos Obrigatórios para E-Bike */}
          <div className="bg-emerald-100/60 border-2 border-emerald-600 rounded-2xl p-4 flex flex-col gap-3 mt-2">
            <h4 className="font-mono font-black text-xs uppercase text-emerald-950 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Equipamentos de Segurança Obrigatórios por Lei (Resolução 996):</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono font-bold text-emerald-950">
              <div className="bg-white p-2 rounded-xl border border-emerald-400 text-center">
                🔔 Campainha Sonora
              </div>
              <div className="bg-white p-2 rounded-xl border border-emerald-400 text-center">
                🪞 Retrovisor Esquerdo
              </div>
              <div className="bg-white p-2 rounded-xl border border-emerald-400 text-center">
                💡 Luz Dianteira (Branca/Amarela)
              </div>
              <div className="bg-white p-2 rounded-xl border border-emerald-400 text-center">
                🚨 Sinalização Traseira (Vermelha)
              </div>
            </div>
          </div>
        </div>

        {/* CTA direto para buscar modelos de e-bikes conformes */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-xs font-mono text-emerald-950 font-bold">
            Procurando uma E-Bike 100% legalizada para ir ao trabalho sem dor de cabeça?
          </p>
          <Link
            href="/pesquisa?uso=Urbano"
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold text-xs rounded-xl border-2 border-emerald-950 shadow-[2px_2px_0_0_rgba(6,78,59,1)] transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>Ver E-Bikes Conformes no Catálogo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* 4. QUADRADO AMARELO DETALHADO: EQUIPAMENTO AUTOPROPELIDO */}
      <section
        id="autopropelidos"
        className="scroll-mt-24 bg-amber-50/90 border-2 border-amber-700 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_rgba(180,83,9,1)] flex flex-col gap-6 relative"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-amber-700/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-ink flex items-center justify-center font-black text-xl border-2 border-amber-800 shadow-[2px_2px_0_0_rgba(180,83,9,1)]">
              ⚠️
            </div>
            <div>
              <span className="text-[10px] font-mono font-black bg-amber-600 text-ink px-2.5 py-0.5 rounded uppercase tracking-wider">
                🟡 QUADRADO AMARELO • PERMITIDO NA CICLOVIA ATÉ 20 KM/H
              </span>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-amber-950 mt-0.5">
                Equipamentos de Mobilidade Autopropelidos
              </h2>
            </div>
          </div>

          <span className="text-xs font-mono font-bold bg-white text-amber-950 border-2 border-amber-700 px-3 py-1.5 rounded-xl shadow-[2px_2px_0_0_rgba(180,83,9,1)] self-start sm:self-auto">
            Sem CNH • Exige Velocímetro
          </span>
        </div>

        {/* Resumo Direto de Regras */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="bg-white border-2 border-amber-700 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(180,83,9,1)] flex flex-col gap-1">
            <span className="text-amber-800 font-bold uppercase text-[10px]">Acelerador Manual</span>
            <span className="font-display font-black text-lg text-amber-950">PERMITIDO</span>
            <span className="text-amber-900/80 text-[11px]">Acionamento por gatilho de polegar ou punho</span>
          </div>

          <div className="bg-white border-2 border-amber-700 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(180,83,9,1)] flex flex-col gap-1">
            <span className="text-amber-800 font-bold uppercase text-[10px]">Limite em Ciclovias</span>
            <span className="font-display font-black text-lg text-amber-950">Máximo 20 km/h</span>
            <span className="text-amber-900/80 text-[11px]">Velocidade restrita obrigatória na ciclovia</span>
          </div>

          <div className="bg-white border-2 border-amber-700 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(180,83,9,1)] flex flex-col gap-1">
            <span className="text-amber-800 font-bold uppercase text-[10px]">Exigência Técnica Crucial</span>
            <span className="font-display font-black text-lg text-amber-950">Velocímetro Obrigatório</span>
            <span className="text-amber-900/80 text-[11px]">Display digital ou analógico visível</span>
          </div>
        </div>

        {/* Detalhamento Técnico Completo do Quadrado Amarelo */}
        <div className="bg-white border-2 border-amber-700 rounded-2xl p-5 sm:p-6 shadow-[3px_3px_0_0_rgba(180,83,9,1)] flex flex-col gap-5 text-amber-950 font-sans">
          <h3 className="font-display font-black text-lg text-amber-950 border-b-2 border-amber-200 pb-2">
            🛴 O que São Autopropelidos? (Patinetes, Monociclos e Mini-Bikes com Gatilho)
          </h3>

          <p className="text-xs sm:text-sm leading-relaxed text-amber-950/90">
            Enquadram-se nesta categoria os veículos elétricos individuais de mobilidade dotados de acelerador (que não exigem o esforço físico do pedal para andar), com potência nominal de até <strong>1.000 Watts</strong> e velocidade máxima de fabricação de até <strong>32 km/h</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
            <div className="flex flex-col gap-3">
              <h4 className="font-mono font-bold text-amber-900 uppercase text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Limites de Velocidade por Tipo de Via:</span>
              </h4>
              <ul className="flex flex-col gap-2 list-none pl-0">
                <li className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-300">
                  <strong>Ciclovias e Ciclofaixas:</strong> Limite máximo estrito de <strong>20 km/h</strong>.
                </li>
                <li className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-300">
                  <strong>Áreas de Pedestres Compartilhadas:</strong> Máximo de <strong>6 km/h</strong>.
                </li>
                <li className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-300">
                  <strong>Vias Públicas Locais:</strong> Vias urbanas com velocidade regulamentada de até 40 km/h (bordo direito).
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-mono font-bold text-red-900 uppercase text-xs flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Dimensões e Proibições:</span>
              </h4>
              <ul className="flex flex-col gap-2 list-none pl-0">
                <li className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-300 text-rose-950">
                  <strong>Dimensões Máximas:</strong> Largura de até 70 cm e distância entre eixos de até 1,30 m.
                </li>
                <li className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-300 text-rose-950">
                  <strong>Proibido em Trânsito Rápido:</strong> Vedada a circulação em rodovias e vias expressas de alta velocidade.
                </li>
                <li className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-300 text-rose-950">
                  <strong>Excesso de Velocidade:</strong> Ultrapassar 20 km/h na ciclovia coloca em risco o enquadramento de isenção.
                </li>
              </ul>
            </div>
          </div>

          {/* Equipamentos Obrigatórios para Autopropelidos */}
          <div className="bg-amber-100/70 border-2 border-amber-500 rounded-2xl p-4 flex flex-col gap-3 mt-2">
            <h4 className="font-mono font-black text-xs uppercase text-amber-950 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>Equipamentos Técnicos Obrigatórios (Resolução CONTRAN 996):</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono font-bold text-amber-950">
              <div className="bg-white p-2 rounded-xl border border-amber-400 text-center">
                📟 Velocímetro Instalado
              </div>
              <div className="bg-white p-2 rounded-xl border border-amber-400 text-center">
                🔔 Campainha Sonora
              </div>
              <div className="bg-white p-2 rounded-xl border border-amber-400 text-center">
                💡 Iluminação Dianteira
              </div>
              <div className="bg-white p-2 rounded-xl border border-amber-400 text-center">
                🚨 Sinalização Traseira/Lateral
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. QUADRADO VERMELHO DETALHADO: CICLOMOTOR ELÉTRICO */}
      <section
        id="ciclomotores"
        className="scroll-mt-24 bg-rose-50/90 border-2 border-rose-800 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_rgba(159,18,57,1)] flex flex-col gap-6 relative"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-rose-800/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black text-xl border-2 border-rose-950 shadow-[2px_2px_0_0_rgba(159,18,57,1)]">
              ✕
            </div>
            <div>
              <span className="text-[10px] font-mono font-black bg-rose-700 text-white px-2.5 py-0.5 rounded uppercase tracking-wider">
                🔴 QUADRADO VERMELHO • ESTRITAMENTE PROIBIDO NA CICLOVIA
              </span>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-rose-950 mt-0.5">
                Ciclomotores Elétricos &amp; Scooters Rápidas
              </h2>
            </div>
          </div>

          <span className="text-xs font-mono font-bold bg-white text-rose-950 border-2 border-rose-800 px-3 py-1.5 rounded-xl shadow-[2px_2px_0_0_rgba(159,18,57,1)] self-start sm:self-auto">
            EXIGE CNH (A/ACC) + EMPLACAMENTO
          </span>
        </div>

        {/* Resumo Direto de Exigências */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="bg-white border-2 border-rose-800 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(159,18,57,1)] flex flex-col gap-1">
            <span className="text-rose-800 font-bold uppercase text-[10px]">Potência &amp; Velocidade</span>
            <span className="font-display font-black text-lg text-rose-950">&gt; 1000W ou &gt; 32 km/h</span>
            <span className="text-rose-900/80 text-[11px]">Potência nominal de até 4.000W e até 50 km/h</span>
          </div>

          <div className="bg-white border-2 border-rose-800 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(159,18,57,1)] flex flex-col gap-1">
            <span className="text-rose-800 font-bold uppercase text-[10px]">Habilitação Exigida</span>
            <span className="font-display font-black text-lg text-rose-950">CNH A ou ACC</span>
            <span className="text-rose-900/80 text-[11px]">Condutor deve possuir 18 anos completos</span>
          </div>

          <div className="bg-white border-2 border-rose-800 rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(159,18,57,1)] flex flex-col gap-1">
            <span className="text-rose-800 font-bold uppercase text-[10px]">Documentação &amp; Placa</span>
            <span className="font-display font-black text-lg text-rose-950">Emplacamento DETRAN</span>
            <span className="text-rose-900/80 text-[11px]">Exige registro no Senatran e emissão de CRLV</span>
          </div>
        </div>

        {/* Detalhamento Técnico Completo do Quadrado Vermelho */}
        <div className="bg-white border-2 border-rose-800 rounded-2xl p-5 sm:p-6 shadow-[3px_3px_0_0_rgba(159,18,57,1)] flex flex-col gap-5 text-rose-950 font-sans">
          <h3 className="font-display font-black text-lg text-rose-950 border-b-2 border-rose-200 pb-2">
            🛑 Por que Ciclomotores Não Podem Rodar em Ciclovias?
          </h3>

          <p className="text-xs sm:text-sm leading-relaxed text-rose-950/90">
            Veículos elétricos com acelerador manual que superam 32 km/h ou possuem motores acima de 1.000 Watts oferecem alto risco de colisão em vias destinadas a pedestres e ciclistas. Por isso, a legislação brasileira exige que circulem na pista de rolamento comum dos veículos automotores.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
            <div className="flex flex-col gap-3">
              <h4 className="font-mono font-bold text-rose-950 uppercase text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-rose-700 shrink-0" />
                <span>Onde Deve Circular Obrigatoriamente:</span>
              </h4>
              <ul className="flex flex-col gap-2 list-none pl-0">
                <li className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-300">
                  <strong>Rua / Pista de Rolamento:</strong> Deve andar na faixa da direita das ruas e avenidas, no mesmo fluxo dos carros.
                </li>
                <li className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-300">
                  <strong>Capacete Motociclístico INMETRO:</strong> Uso de capacete com viseira transparente ou óculos de proteção automotivo.
                </li>
                <li className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-300">
                  <strong>Idade Mínima:</strong> Condutor deve ser maior de idade (18 anos) habilitado na categoria A ou ACC.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-mono font-bold text-red-900 uppercase text-xs flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Locais Proibidos (Infração Gravíssima):</span>
              </h4>
              <ul className="flex flex-col gap-2 list-none pl-0">
                <li className="bg-rose-100 p-2.5 rounded-xl border border-rose-400 text-rose-950 font-bold">
                  ❌ ESTRIAMENTE PROIBIDO EM CICLOVIAS E CICLOFAIXAS.
                </li>
                <li className="bg-rose-100 p-2.5 rounded-xl border border-rose-400 text-rose-950 font-bold">
                  ❌ PROIBIDO EM CALÇADAS, PASSEIOS E PRAÇAS PÚBLICAS.
                </li>
                <li className="bg-rose-100 p-2.5 rounded-xl border border-rose-400 text-rose-950 font-bold">
                  ❌ PROIBIDO CIRCULAR SEM PLACA OU SEM DOCUMENTO CRLV REGULARIZADO.
                </li>
              </ul>
            </div>
          </div>

          {/* Equipamentos Obrigatórios de Padrão Automotivo para Ciclomotores */}
          <div className="bg-rose-100 border-2 border-rose-600 rounded-2xl p-4 flex flex-col gap-3 mt-2">
            <h4 className="font-mono font-black text-xs uppercase text-rose-950 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-800" />
              <span>Equipamentos Automotivos Obrigatórios para Ciclomotores:</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono font-bold text-rose-950">
              <div className="bg-white p-2 rounded-xl border border-rose-400 text-center">
                🪞 Retrovisores Ambos os Lados
              </div>
              <div className="bg-white p-2 rounded-xl border border-rose-400 text-center">
                💡 Farol Dianteiro (Alto/Baixo)
              </div>
              <div className="bg-white p-2 rounded-xl border border-rose-400 text-center">
                🚨 Setas Indicadoras de Direção
              </div>
              <div className="bg-white p-2 rounded-xl border border-rose-400 text-center">
                🛑 Lanterna Traseira de Freio
              </div>
              <div className="bg-white p-2 rounded-xl border border-rose-400 text-center">
                📢 Buzina Automotiva
              </div>
              <div className="bg-white p-2 rounded-xl border border-rose-400 text-center">
                🛞 Pneus com Selo INMETRO
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. INFRAÇÕES, MULTAS E PENALIDADES DO CTB */}
      <section
        id="penalidades-e-multas"
        className="scroll-mt-24 bg-white border-2 border-ink rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col gap-6"
      >
        <div className="flex items-center gap-3 border-b-2 border-ink pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 text-ink flex items-center justify-center font-black text-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
            ⚠️
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold bg-amber-100 border border-ink px-2 py-0.5 rounded text-ink uppercase">
              Tabela de Sanções do CTB
            </span>
            <h2 className="font-display font-black text-xl sm:text-2xl text-ink">
              Multas e Penalidades por Trafegar Irregularmente
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Infração 1 */}
          <div className="bg-rose-50 border-2 border-rose-800 rounded-2xl p-4 shadow-[3px_3px_0_0_rgba(159,18,57,1)] flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black bg-red-600 text-white px-2 py-0.5 rounded">
                  ART. 193 CTB
                </span>
                <span className="text-xs font-mono font-bold text-red-700">GRAVÍSSIMA</span>
              </div>
              <h4 className="font-display font-black text-sm text-rose-950 mt-1">
                Trafegar com Ciclomotor em Ciclovia ou Calçada
              </h4>
              <p className="text-xs font-mono text-rose-900/80">
                Transitar com veículo automotor/ciclomotor em ciclovia, ciclofaixa ou passeio público.
              </p>
            </div>
            <div className="bg-white border border-rose-300 p-2.5 rounded-xl font-mono text-xs flex flex-col gap-1">
              <span className="font-bold text-red-700">Multa (Fator 3x): R$ 880,41</span>
              <span className="text-ink/80">Pontos: 7 Pontos na CNH</span>
              <span className="text-red-800 font-bold">Medida: Remoção do veículo ao pátio</span>
            </div>
          </div>

          {/* Infração 2 */}
          <div className="bg-amber-50 border-2 border-amber-800 rounded-2xl p-4 shadow-[3px_3px_0_0_rgba(180,83,9,1)] flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black bg-amber-600 text-white px-2 py-0.5 rounded">
                  ART. 162 I CTB
                </span>
                <span className="text-xs font-mono font-bold text-amber-800">GRAVÍSSIMA</span>
              </div>
              <h4 className="font-display font-black text-sm text-amber-950 mt-1">
                Dirigir Ciclomotor Sem CNH ou ACC
              </h4>
              <p className="text-xs font-mono text-amber-900/80">
                Conduzir ciclomotor sem possuir carteira de habilitação categoria A ou autorização ACC.
              </p>
            </div>
            <div className="bg-white border border-amber-300 p-2.5 rounded-xl font-mono text-xs flex flex-col gap-1">
              <span className="font-bold text-amber-900">Multa (Fator 3x): R$ 880,41</span>
              <span className="text-amber-900 font-bold">Medida: Retenção até condutor habilitado</span>
            </div>
          </div>

          {/* Infração 3 */}
          <div className="bg-neutral-50 border-2 border-ink rounded-2xl p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black bg-ink text-amber-300 px-2 py-0.5 rounded">
                  ART. 230 V CTB
                </span>
                <span className="text-xs font-mono font-bold text-ink">GRAVÍSSIMA</span>
              </div>
              <h4 className="font-display font-black text-sm text-ink mt-1">
                Conduzir Ciclomotor Sem Emplacamento / Registro
              </h4>
              <p className="text-xs font-mono text-ink/80">
                Transitar com veículo que exija registro no órgão de trânsito sem placa visível.
              </p>
            </div>
            <div className="bg-white border border-ink/30 p-2.5 rounded-xl font-mono text-xs flex flex-col gap-1">
              <span className="font-bold text-ink">Multa: R$ 293,47</span>
              <span className="text-ink/80">Pontos: 7 Pontos na CNH</span>
              <span className="text-red-700 font-bold">Medida: Apreensão e guincho ao pátio</span>
            </div>
          </div>

        </div>
      </section>

      {/* 7. TABELA COMPARATIVA GERAL RESUMIDA CONTRAN 996 */}
      <section
        id="tabela-comparativa"
        className="scroll-mt-24 bg-white border-2 border-ink rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col gap-5"
      >
        <div className="flex items-center justify-between border-b-2 border-ink pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-display font-black text-xl text-ink">
              Tabela Matriz Resumo: Resolução CONTRAN 996/2023
            </h3>
          </div>
          <span className="text-xs font-mono font-bold bg-neutral-100 border border-ink px-2.5 py-1 rounded-xl text-ink hidden sm:inline-block">
            Quadro Oficial
          </span>
        </div>

        <div className="overflow-x-auto border-2 border-ink rounded-2xl shadow-[3px_3px_0_0_rgba(46,43,39,1)]">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-ink text-white">
                <th className="p-3 border-b border-ink">Critério de Avaliação</th>
                <th className="p-3 border-b border-ink bg-emerald-900 text-emerald-200">🟢 Bicicleta Elétrica (Pedelec)</th>
                <th className="p-3 border-b border-ink bg-amber-900 text-amber-200">🟡 Autopropelido (Patinete)</th>
                <th className="p-3 border-b border-ink bg-red-950 text-red-200">🔴 Ciclomotor Elétrico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              <tr className="bg-white hover:bg-neutral-50">
                <td className="p-3 font-bold text-ink">Potência Máxima do Motor</td>
                <td className="p-3 text-emerald-900 font-bold">Até 1.000 W</td>
                <td className="p-3 text-amber-900 font-bold">Até 1.000 W</td>
                <td className="p-3 text-red-900 font-bold">Até 4.000 W (4 kW)</td>
              </tr>
              <tr className="bg-neutral-50 hover:bg-neutral-100">
                <td className="p-3 font-bold text-ink">Velocidade Máxima Permite Assistência</td>
                <td className="p-3 text-emerald-900">32 km/h (Corta Motor)</td>
                <td className="p-3 text-amber-900">32 km/h (Fab.) / 20 km/h (Ciclovia)</td>
                <td className="p-3 text-red-900">Até 50 km/h</td>
              </tr>
              <tr className="bg-white hover:bg-neutral-50">
                <td className="p-3 font-bold text-ink">Acelerador Manual no Punho</td>
                <td className="p-3 text-emerald-900 font-bold">❌ Proibido (Somente PAS)</td>
                <td className="p-3 text-amber-900 font-bold">✅ Permitido</td>
                <td className="p-3 text-red-900 font-bold">✅ Permitido</td>
              </tr>
              <tr className="bg-neutral-50 hover:bg-neutral-100">
                <td className="p-3 font-bold text-ink">Uso em Ciclovias &amp; Ciclofaixas</td>
                <td className="p-3 text-emerald-900 font-bold bg-emerald-100/50">✅ Totalmente Liberado</td>
                <td className="p-3 text-amber-900 font-bold bg-amber-100/50">⚠️ Permitido (máx 20 km/h)</td>
                <td className="p-3 text-red-900 font-bold bg-rose-100/50">❌ ESTRITAMENTE PROIBIDO</td>
              </tr>
              <tr className="bg-white hover:bg-neutral-50">
                <td className="p-3 font-bold text-ink">Exige CNH ou ACC</td>
                <td className="p-3 text-emerald-900 font-bold">❌ Não exige</td>
                <td className="p-3 text-amber-900 font-bold">❌ Não exige</td>
                <td className="p-3 text-red-900 font-bold">✅ SIM (CNH A ou ACC)</td>
              </tr>
              <tr className="bg-neutral-50 hover:bg-neutral-100">
                <td className="p-3 font-bold text-ink">Exige Registro &amp; Placa DETRAN</td>
                <td className="p-3 text-emerald-900 font-bold">❌ Não exige</td>
                <td className="p-3 text-amber-900 font-bold">❌ Não exige</td>
                <td className="p-3 text-red-900 font-bold">✅ SIM (Placa + CRLV)</td>
              </tr>
              <tr className="bg-white hover:bg-neutral-50">
                <td className="p-3 font-bold text-ink">Capacete Exigido</td>
                <td className="p-3 text-emerald-900">Ciclista Recomendado</td>
                <td className="p-3 text-amber-900">Ciclista Recomendado</td>
                <td className="p-3 text-red-900 font-bold">Motociclístico (INMETRO)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. CHECKLIST DE AUDITORIA ANTES DE COMPRAR */}
      <section
        id="checklist-auditoria"
        className="scroll-mt-24 bg-surface border-2 border-ink rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col gap-4"
      >
        <div className="flex items-center gap-2 border-b-2 border-ink pb-3">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <h3 className="font-display font-black text-xl text-ink">
            Checklist do Comprador: Como Evitar Apreensões
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-white border-2 border-ink p-3.5 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-1.5">
            <span className="font-bold text-primary">1. Nota Fiscal com Specs</span>
            <p className="text-ink/80 text-[11px]">
              Confira se a NF declara motor ≤1000W e velocidade assistida de 32 km/h.
            </p>
          </div>

          <div className="bg-white border-2 border-ink p-3.5 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-1.5">
            <span className="font-bold text-primary">2. Sensor PAS Ativo</span>
            <p className="text-ink/80 text-[11px]">
              Certifique-se de que o motor corta quando você para de pedalar.
            </p>
          </div>

          <div className="bg-white border-2 border-ink p-3.5 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-1.5">
            <span className="font-bold text-primary">3. Retrovisor Esquerdo</span>
            <p className="text-ink/80 text-[11px]">
              Instale o espelho no lado esquerdo do guidão antes de rodar na rua.
            </p>
          </div>

          <div className="bg-white border-2 border-ink p-3.5 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-1.5">
            <span className="font-bold text-primary">4. Sinalização Noturna</span>
            <p className="text-ink/80 text-[11px]">
              Utilize farol dianteiro branco e lanterna traseira vermelha sempre visíveis.
            </p>
          </div>
        </div>
      </section>

      {/* BOTÃO DE RETORNO AO TOPO / HUB DE ARTIGOS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-ink">
        <Link
          href="/artigos"
          className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-ink font-mono font-bold text-xs rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-primary" />
          <span>Voltar ao Hub de Artigos &amp; Guias</span>
        </Link>

        <Link
          href="/pesquisa"
          className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white font-mono font-bold text-xs rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all flex items-center gap-1.5"
        >
          <span>Buscar E-Bikes Conformes no Catálogo</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

    </div>
  );
}
