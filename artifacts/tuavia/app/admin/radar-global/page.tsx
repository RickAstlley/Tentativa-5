'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import AdminHeader from '@/components/admin/AdminHeader';
import GlobalRadarPanel from '@/components/admin/GlobalRadarPanel';
import AIRadarPanel from '@/components/admin/AIRadarPanel';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import {
  Globe2,
  Sparkles,
  Shield,
  Clock,
  Search,
  FileText,
  Bike,
  Zap,
  Tag,
  Flame,
  CheckCircle2,
  AlertCircle,
  Copy,
  ArrowRight,
} from 'lucide-react';

interface ClassifyResult {
  category: 'e-bike' | 'e-bike promoção' | 'artigo' | 'artigo notícias';
  reason: string;
  title: string;
  excerpt: string;
  keywords: string[];
  highImpact: boolean;
  prefillData: {
    marca: string;
    modelo: string;
    motorPowerW: string;
    batteryDetails: string;
    priceEstimated: string;
    usoPrincipal: 'Urbana' | 'Trilha/MTB' | 'Dobrável' | 'Cargo' | 'Speed';
    resumoExecutivo: string;
    destaques: string[];
    badge?: string;
    ofertaLoja?: string;
  };
}

export default function AdminRadarGlobalMasterPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Controle de Abas Unificadas
  const [activeTab, setActiveTab] = useState<'international' | 'national_ai' | 'classifier'>('international');

  // Estado do Classificador Semântico de Texto
  const [textInput, setTextInput] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [classifyStage, setClassifyStage] = useState('');
  const [classifyProgress, setClassifyProgress] = useState(0);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setCheckingAuth(false);
  }, []);

  // Executa a classificação semântica com NVIDIA NIM
  const handleClassify = async () => {
    if (!textInput.trim() || classifying) return;

    setClassifying(true);
    setError(null);
    setResult(null);
    setSuccessMsg(null);
    setClassifyStage('Iniciando análise de texto...');
    setClassifyProgress(15);

    const stages = [
      { pct: 30, label: 'Enviando pauta para a LLM (NVIDIA NIM)...' },
      { pct: 60, label: 'Analisando semântica e SEO no Google Brasil...' },
      { pct: 85, label: 'Extraindo ficha técnica de e-bike e metadados...' },
      { pct: 95, label: 'Mapeando categoria ótima de publicação...' },
    ];

    let stageIdx = 0;
    const interval = setInterval(() => {
      if (stageIdx < stages.length) {
        setClassifyStage(stages[stageIdx].label);
        setClassifyProgress(stages[stageIdx].pct);
        stageIdx++;
      }
    }, 800);

    try {
      const res = await fetchAdminJson<{
        success: boolean;
        classification: ClassifyResult;
        error?: string;
      }>('/api/admin/llm/radar/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 120000,
        body: JSON.stringify({ text: textInput }),
      });

      clearInterval(interval);

      if (res.ok && res.data?.success) {
        setClassifyProgress(100);
        setClassifyStage('Processado com sucesso!');
        setResult(res.data.classification);
        setSuccessMsg('Pauta classificada e parâmetros de SEO estruturados com sucesso pela LLM!');
      } else {
        setError(res.error || 'Não foi possível classificar o texto fornecido.');
      }
    } catch (err: any) {
      clearInterval(interval);
      setError(err?.message || 'Falha de rede ou timeout ao processar classificação.');
    } finally {
      setClassifying(false);
    }
  };

  // Redireciona e pré-preenche formulários
  const handleRedirectAndDraft = () => {
    if (!result) return;

    if (typeof window !== 'undefined') {
      const isEbikeType = result.category === 'e-bike' || result.category === 'e-bike promoção';

      if (isEbikeType) {
        const prefillBike = {
          nome: result.prefillData.modelo,
          modelo: result.prefillData.modelo,
          marca: result.prefillData.marca,
          motorPowerW: result.prefillData.motorPowerW,
          motor: `${result.prefillData.motorPowerW}W`.trim(),
          batteryDetails: result.prefillData.batteryDetails,
          bateria: result.prefillData.batteryDetails,
          priceEstimated: result.prefillData.priceEstimated,
          preco: result.prefillData.priceEstimated,
          usoPrincipal: result.prefillData.usoPrincipal,
          uso: result.prefillData.usoPrincipal,
          resumoExecutivo: result.prefillData.resumoExecutivo,
          destaques: result.prefillData.destaques,
          badge: result.prefillData.badge || (result.category === 'e-bike promoção' ? '⚡ Oferta Ativa' : 'Destaque Técnico'),
          ofertasSugestoes:
            result.category === 'e-bike promoção'
              ? [
                  {
                    loja: result.prefillData.ofertaLoja || 'TuaVia Ofertas',
                    preco: Number(result.prefillData.priceEstimated) || 0,
                    url: '',
                  },
                ]
              : [],
          aiPromptInput: `Especificações técnicas completas para ${result.prefillData.marca} ${result.prefillData.modelo}. Preço aproximado R$ ${result.prefillData.priceEstimated}.`,
          prompt: `Analise detalhadamente a E-Bike "${result.prefillData.modelo}" da marca "${result.prefillData.marca}".`,
          autoGenerate: true,
        };

        sessionStorage.setItem('tuavia_prefill_bike', JSON.stringify(prefillBike));
        localStorage.setItem('tuavia_prefill_bike', JSON.stringify(prefillBike));
        router.push('/admin/bikes/novo?radar=1');
      } else {
        const isRanking = result.title.toLowerCase().includes('top') || result.title.toLowerCase().includes('melhores') || result.title.toLowerCase().includes('ranking');
        
        if (isRanking) {
          const prefillRanking = {
            title: result.title,
            prompt: result.title,
            excerpt: result.excerpt,
            category: 'ebikes',
            quantidade: 5,
            sourceName: 'Radar Global',
            sourceUrl: '',
          };
          sessionStorage.setItem('tuavia_prefill_ranking', JSON.stringify(prefillRanking));
          localStorage.setItem('tuavia_prefill_ranking', JSON.stringify(prefillRanking));
          router.push('/admin/rankings/novo?radar=1');
          return;
        }

        const mappedCategory = result.category === 'artigo notícias' ? 'Notícias' : 'Guia de Compra';
        const prefillArticle = {
          title: result.title,
          excerpt: result.excerpt,
          category: mappedCategory,
          keywords: result.keywords.join(', '),
          targetAudience: 'Leitores do TuaVia e compradores de bicicletas elétricas no Brasil',
          aiPromptInput: `Escreva um artigo completo e aprofundado com SEO sobre: "${result.title}". Contexto: ${result.reason}. Palavras-chave: ${result.keywords.join(', ')}.`,
          prompt: `Escreva um artigo completo, otimizado para SEO e altamente engajante sobre: "${result.title}".`,
          autoGenerateOnLoad: true,
          autoGenerate: true,
        };

        sessionStorage.setItem('tuavia_prefill_article', JSON.stringify(prefillArticle));
        localStorage.setItem('tuavia_prefill_article', JSON.stringify(prefillArticle));
        router.push('/admin/artigos/novo?radar=1');
      }
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border-2 border-stone-900 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-base font-black text-stone-900">Verificando Credenciais Admin</h2>
          <p className="text-xs text-stone-500 font-mono">Conectando ao Radar Global TuaVia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 pb-20">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Banner Superior de Identidade do Radar Global Unificado */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-stone-900 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
            <Globe2 className="w-72 h-72 text-stone-900" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400 border border-stone-900 rounded-full text-xs font-black uppercase tracking-wider text-stone-950 font-mono shadow-xs">
                <Sparkles className="w-3.5 h-3.5 fill-stone-950" />
                Inteligência Global 24/7 & Tradução Multilíngue
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-950 tracking-tight">
                Radar Global: Inovação, Pautas & Promoções de E-Bikes
              </h1>
              <p className="text-sm text-stone-600 leading-relaxed font-medium">
                Monitoramento contínuo dos maiores polos de tecnologia (China 🇨🇳, Japão 🇯🇵, Coreia 🇰🇷, EUA 🇺🇸, Europa 🇪🇺 e Brasil 🇧🇷) integrado com radar nacional de promoções e classificador semântico via LLM.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <div className="p-3.5 bg-stone-50 border-2 border-stone-900 rounded-2xl flex items-center gap-3 shadow-xs">
                <div className="p-2 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-800">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-mono font-bold text-stone-400 uppercase">Ciclo de Varredura</div>
                  <div className="text-xs font-black text-stone-900 flex items-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Automático a cada 1h
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS UNIFICADAS */}
        <div className="flex items-center gap-2 border-b-2 border-stone-300 pb-2 flex-wrap">
          <button
            onClick={() => setActiveTab('international')}
            className={`px-4 py-2.5 font-bold text-sm flex items-center gap-2 rounded-xl border-2 transition-all cursor-pointer ${
              activeTab === 'international'
                ? 'bg-stone-900 text-white border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500 hover:bg-stone-50'
            }`}
          >
            <Globe2 className={`w-4 h-4 ${activeTab === 'international' ? 'text-amber-400 animate-pulse' : 'text-stone-500'}`} />
            <span>Varredura Internacional (🇨🇳 🇯🇵 🇰🇷 🇺🇸 🇪🇺 🇧🇷)</span>
          </button>

          <button
            onClick={() => setActiveTab('national_ai')}
            className={`px-4 py-2.5 font-bold text-sm flex items-center gap-2 rounded-xl border-2 transition-all cursor-pointer ${
              activeTab === 'national_ai'
                ? 'bg-amber-400 text-stone-950 border-stone-900 font-black shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500 hover:bg-stone-50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-stone-900" />
            <span>Radar IA: Pautas & Promoções Nacionais</span>
          </button>

          <button
            onClick={() => setActiveTab('classifier')}
            className={`px-4 py-2.5 font-bold text-sm flex items-center gap-2 rounded-xl border-2 transition-all cursor-pointer ${
              activeTab === 'classifier'
                ? 'bg-indigo-600 text-white border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500 hover:bg-stone-50'
            }`}
          >
            <Search className={`w-4 h-4 ${activeTab === 'classifier' ? 'text-amber-300' : 'text-stone-500'}`} />
            <span>Classificador Semântico & Extração</span>
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        {activeTab === 'international' && (
          <div className="space-y-6">
            <GlobalRadarPanel />
          </div>
        )}

        {activeTab === 'national_ai' && (
          <div className="space-y-6">
            <AIRadarPanel />
          </div>
        )}

        {activeTab === 'classifier' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Esquerda: Input */}
            <div className="lg:col-span-6 space-y-5">
              <div className="bg-white border-2 border-stone-900 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-stone-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <FileText className="w-4 h-4 text-amber-500" />
                    Inserir Conteúdo ou Pauta Bruta
                  </label>
                  <span className="text-xs font-mono text-stone-400">Até 8.000 caracteres</span>
                </div>

                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Cole aqui: uma notícia de portal, especificações de bike em inglês ou português, lista de preços, postagem de fórum sobre e-bikes ou ideias de pauta..."
                  rows={8}
                  className="w-full p-4 border-2 border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-stone-900 font-sans text-sm resize-y leading-relaxed"
                />

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={() => {
                      setTextInput(
                        'Nova E-Bike Caloi E-Vibe Elite 2025 lançada com motor Shimano EP801 de 85Nm de torque, bateria integrada de 630Wh prometendo até 120km de autonomia. Quadro em alumínio com cabeamento 100% interno, suspensão RockShox de 140mm e freios Shimano Deore de 4 pistões. Preço sugerido de lançamento: R$ 24.990.'
                      );
                    }}
                    type="button"
                    className="text-xs text-stone-500 hover:text-stone-900 underline font-mono cursor-pointer"
                  >
                    Carregar Exemplo de Pauta
                  </button>

                  <button
                    onClick={handleClassify}
                    disabled={classifying || !textInput.trim()}
                    className="px-6 py-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-black text-sm rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {classifying ? (
                      <>
                        <Zap className="w-4 h-4 text-amber-400 animate-spin" />
                        <span>Processando IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span>Classificar & Estruturar</span>
                      </>
                    )}
                  </button>
                </div>

                {classifying && (
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-stone-700">{classifyStage}</span>
                      <span className="text-stone-400">{classifyProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                        style={{ width: `${classifyProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-3 text-rose-900">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Falha no processamento</h4>
                    <p className="text-xs mt-0.5">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Direita: Resultado */}
            <div className="lg:col-span-6 space-y-5">
              {result ? (
                <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full font-black text-xs uppercase font-mono">
                        {result.category}
                      </span>
                      {result.highImpact && (
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-600" />
                          Alto Impacto
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleRedirectAndDraft}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>
                        {result.category.includes('bike')
                          ? 'Criar Ficha de E-Bike'
                          : result.title.toLowerCase().includes('top') || result.title.toLowerCase().includes('melhores') || result.title.toLowerCase().includes('ranking')
                          ? 'Criar Top Ranking'
                          : 'Criar Artigo SEO'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-stone-900 leading-snug">{result.title}</h3>
                    <p className="text-xs text-stone-600 mt-1 font-mono">{result.reason}</p>
                  </div>

                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1 text-xs">
                    <span className="font-bold text-stone-700 uppercase text-[10px] font-mono">Resumo Executivo</span>
                    <p className="text-stone-800 leading-relaxed">{result.excerpt}</p>
                  </div>

                  {result.keywords && result.keywords.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-stone-500 uppercase font-mono">Palavras-chave SEO</span>
                      <div className="flex flex-wrap gap-1.5">
                        {result.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-stone-100 border border-stone-200 rounded-md text-[11px] font-mono text-stone-700"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ficha Pré-extraída */}
                  {result.prefillData && (
                    <div className="pt-3 border-t border-stone-200 space-y-2">
                      <span className="text-[10px] font-bold text-stone-500 uppercase font-mono">Metadados Extraídos</span>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
                          <span className="text-stone-400 block text-[10px]">Marca / Modelo</span>
                          <span className="font-bold text-stone-800">
                            {result.prefillData.marca} {result.prefillData.modelo}
                          </span>
                        </div>
                        <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
                          <span className="text-stone-400 block text-[10px]">Motor / Bateria</span>
                          <span className="font-bold text-stone-800 truncate block">
                            {result.prefillData.motorPowerW}W | {result.prefillData.batteryDetails}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-stone-300 rounded-2xl p-12 text-center space-y-3 bg-stone-50/50">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 flex items-center justify-center mx-auto text-stone-400 shadow-xs">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-stone-700 text-sm">Aguardando pauta para classificação</h4>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Cole um texto à esquerda e clique em &quot;Classificar & Estruturar&quot; para acionar a extração automática com SEO.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
