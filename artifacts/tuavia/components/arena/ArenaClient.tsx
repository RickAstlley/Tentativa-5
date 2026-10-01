'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import SafeImage from '@/components/ui/SafeImage';
import { EBikeGrouped } from '@/types/ebike';
import { formatBrl, getEBikePricingDetails } from '@/lib/ebikeUtils';
import { BG_CICLOVIA_DATA_URI } from '@/lib/bgCicloviaDataUri';
import { 
  Swords, 
  Scale, 
  ArrowRight, 
  Trophy, 
  Zap, 
  BatteryCharging, 
  Feather, 
  ShieldCheck, 
  DollarSign, 
  RotateCw, 
  Shuffle, 
  Share2, 
  Search, 
  X, 
  Check, 
  ChevronRight, 
  Flame, 
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';

interface ArenaClientProps {
  initialBikes: EBikeGrouped[];
}

interface RoundResult {
  roundNumber: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  winner: 'A' | 'B' | 'TIE';
  metricA: string;
  metricB: string;
  diffSummary: string;
  verdictComment: string;
}

export default function ArenaClient({ initialBikes }: ArenaClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bike selector modal state
  const [selectingFor, setSelectingFor] = useState<'A' | 'B' | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('TODAS');

  // Available brands for quick filter
  const brands = useMemo(() => {
    const list = Array.from(new Set(initialBikes.map(b => b.marca).filter(Boolean)));
    return ['TODAS', ...list.sort()];
  }, [initialBikes]);

  // Read initial slugs from search params or default to prominent top bikes
  const initialSlugA = searchParams?.get('bike1') || searchParams?.get('slug1') || searchParams?.get('a') || '';
  const initialSlugB = searchParams?.get('bike2') || searchParams?.get('slug2') || searchParams?.get('b') || '';

  const [bikeASlug, setBikeASlug] = useState<string>(() => {
    if (initialSlugA && initialBikes.some(b => b.slug === initialSlugA)) {
      return initialSlugA;
    }
    return initialBikes[0]?.slug || '';
  });

  const [bikeBSlug, setBikeBSlug] = useState<string>(() => {
    if (initialSlugB && initialBikes.some(b => b.slug === initialSlugB) && initialSlugB !== initialSlugA) {
      return initialSlugB;
    }
    const other = initialBikes.find(b => b.slug !== (initialSlugA || initialBikes[0]?.slug));
    return other?.slug || initialBikes[1]?.slug || initialBikes[0]?.slug || '';
  });

  // Sync state if search params change externally
  useEffect(() => {
    const urlA = searchParams?.get('bike1') || searchParams?.get('slug1') || searchParams?.get('a');
    const urlB = searchParams?.get('bike2') || searchParams?.get('slug2') || searchParams?.get('b');
    if (urlA && initialBikes.some(b => b.slug === urlA)) {
      setBikeASlug(urlA);
    }
    if (urlB && initialBikes.some(b => b.slug === urlB)) {
      setBikeBSlug(urlB);
    }
  }, [searchParams, initialBikes]);

  // Update URL query string without reloading
  const updateUrlParams = useCallback((slugA: string, slugB: string) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('bike1', slugA);
      url.searchParams.set('bike2', slugB);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const selectBike = (corner: 'A' | 'B', slug: string) => {
    if (corner === 'A') {
      let newB = bikeBSlug;
      if (slug === bikeBSlug) {
        // If same as B, pick another bike for B
        const alternative = initialBikes.find(b => b.slug !== slug);
        newB = alternative?.slug || bikeBSlug;
      }
      setBikeASlug(slug);
      setBikeBSlug(newB);
      updateUrlParams(slug, newB);
    } else {
      let newA = bikeASlug;
      if (slug === bikeASlug) {
        const alternative = initialBikes.find(b => b.slug !== slug);
        newA = alternative?.slug || bikeASlug;
      }
      setBikeBSlug(slug);
      setBikeASlug(newA);
      updateUrlParams(newA, slug);
    }
    setSelectingFor(null);
    setSearchFilter('');
    setBrandFilter('TODAS');
  };

  const swapBikes = () => {
    const temp = bikeASlug;
    setBikeASlug(bikeBSlug);
    setBikeBSlug(temp);
    updateUrlParams(bikeBSlug, temp);
    showToast('Lados da Arena invertidos!');
  };

  const pickRandomDuel = () => {
    if (initialBikes.length < 2) return;
    const shuffled = [...initialBikes].sort(() => 0.5 - Math.random());
    const newA = shuffled[0].slug;
    const newB = shuffled[1].slug;
    setBikeASlug(newA);
    setBikeBSlug(newB);
    updateUrlParams(newA, newB);
    showToast('Novo duelo aleatório convocado!');
  };

  const copyDuelLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link do Duelo copiado com sucesso!');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Resolve bikes
  const bikeA = useMemo(() => {
    return initialBikes.find(b => b.slug === bikeASlug) || initialBikes[0];
  }, [initialBikes, bikeASlug]);

  const bikeB = useMemo(() => {
    return initialBikes.find(b => b.slug === bikeBSlug) || initialBikes[1] || initialBikes[0];
  }, [initialBikes, bikeBSlug]);

  // Pricing details
  const pricingA = useMemo(() => getEBikePricingDetails(bikeA), [bikeA]);
  const pricingB = useMemo(() => getEBikePricingDetails(bikeB), [bikeB]);

  // Pre-curated famous duels
  const classicDuels = useMemo(() => {
    const candidates: Array<{ label: string; badge: string; slugA: string; slugB: string }> = [
      {
        label: 'Honeywhale B20 vs Two Dogs Pliage',
        badge: 'Mais Populares',
        slugA: 'honeywhale-b20',
        slugB: 'two-dogs-pliage-48v',
      },
      {
        label: 'Sense Impulse vs Caloi E-Vibe',
        badge: 'Alta Performance',
        slugA: 'sense-impulse-e-trail',
        slugB: 'caloi-e-vibe-city',
      },
      {
        label: 'Yoo Mobility Y-200 vs Mymax Myway',
        badge: 'Dobráveis Urbanas',
        slugA: 'yoo-mobility-y-200',
        slugB: 'mymax-myway-4-0',
      },
      {
        label: 'Panda PD100 vs Two Dogs Pliage',
        badge: 'Custo-Benefício',
        slugA: 'panda-pd100-36v',
        slugB: 'two-dogs-pliage-48v',
      }
    ];

    // Filter to only duels where both bikes actually exist in catalog
    return candidates.filter(c => 
      initialBikes.some(b => b.slug.includes(c.slugA) || c.slugA.includes(b.slug)) &&
      initialBikes.some(b => b.slug.includes(c.slugB) || c.slugB.includes(b.slug))
    );
  }, [initialBikes]);

  // Compute 5 Rounds Combat Scorecard
  const roundResults: RoundResult[] = useMemo(() => {
    if (!bikeA || !bikeB) return [];

    // Helper to extract numbers
    const potA = Number(bikeA.potenciaW) || 250;
    const potB = Number(bikeB.potenciaW) || 250;

    const autoA = Number(bikeA.autonomiaKm) || 35;
    const autoB = Number(bikeB.autonomiaKm) || 35;

    const pesoA = Number((bikeA as any).pesoKg) || 22;
    const pesoB = Number((bikeB as any).pesoKg) || 22;

    const precoA = pricingA.menorPreco || 3000;
    const precoB = pricingB.menorPreco || 3000;

    // ROUND 1: Potência e Força do Motor
    let r1Winner: 'A' | 'B' | 'TIE' = 'TIE';
    let r1Diff = 'Potência idêntica';
    let r1Comment = 'Ambas entregam a mesma força nominal para deslocamentos urbanos.';
    if (potA > potB) {
      r1Winner = 'A';
      r1Diff = `+${potA - potB}W mais forte`;
      r1Comment = `${bikeA.modelo} entrega maior arrancada e sobe ladeiras íngremes com muito mais facilidade.`;
    } else if (potB > potA) {
      r1Winner = 'B';
      r1Diff = `+${potB - potA}W mais forte`;
      r1Comment = `${bikeB.modelo} tem maior torque para encarar aclives pesados sem perda de ritmo.`;
    }

    // ROUND 2: Autonomia e Bateria
    let r2Winner: 'A' | 'B' | 'TIE' = 'TIE';
    let r2Diff = 'Autonomia idêntica';
    let r2Comment = 'Ambas possuem alcance similar para trajetos médios do dia a dia.';
    if (autoA > autoB) {
      r2Winner = 'A';
      r2Diff = `+${autoA - autoB} km de alcance extra`;
      r2Comment = `${bikeA.modelo} permite viagens mais longas e menos recargas semanais.`;
    } else if (autoB > autoA) {
      r2Winner = 'B';
      r2Diff = `+${autoB - autoA} km de alcance extra`;
      r2Comment = `${bikeB.modelo} proporciona maior liberdade de rodagem sem ansiedade de bateria.`;
    }

    // ROUND 3: Peso e Portabilidade (Menor peso vence)
    let r3Winner: 'A' | 'B' | 'TIE' = 'TIE';
    let r3Diff = 'Peso equivalente';
    let r3Comment = 'Ambas possuem peso estrutural semelhante.';
    if (pesoA < pesoB) {
      r3Winner = 'A';
      r3Diff = `${(pesoB - pesoA).toFixed(1)} kg mais leve`;
      r3Comment = `${bikeA.modelo} é significativamente mais ágil para subir escadas e acomodar em elevadores.`;
    } else if (pesoB < pesoA) {
      r3Winner = 'B';
      r3Diff = `${(pesoA - pesoB).toFixed(1)} kg mais leve`;
      r3Comment = `${bikeB.modelo} facilita o transporte multimodal em metrô, ônibus ou porta-malas.`;
    }

    // ROUND 4: Segurança e Conjunto Mecânico
    const freioA = ((bikeA as any).freios || (bikeA as any).sistemaFreios || 'Disco').toLowerCase();
    const freioB = ((bikeB as any).freios || (bikeB as any).sistemaFreios || 'Disco').toLowerCase();
    const hasHydraulicA = freioA.includes('hidrául') || freioA.includes('hidraul');
    const hasHydraulicB = freioB.includes('hidrául') || freioB.includes('hidraul');
    
    let r4Winner: 'A' | 'B' | 'TIE' = 'TIE';
    let r4Diff = 'Conjuntos equilibrados';
    let r4Comment = 'Ambos os modelos trazem freios adequados para segurança no tráfego urbano.';
    if (hasHydraulicA && !hasHydraulicB) {
      r4Winner = 'A';
      r4Diff = 'Freios Hidráulicos Superiores';
      r4Comment = `${bikeA.modelo} leva vantagem em frenagem progressiva e segura sob chuva.`;
    } else if (hasHydraulicB && !hasHydraulicA) {
      r4Winner = 'B';
      r4Diff = 'Freios Hidráulicos Superiores';
      r4Comment = `${bikeB.modelo} oferece modulação de frenagem hidráulica mais precisa.`;
    } else {
      // Compare suspension or gears
      const suspA = !!(bikeA as any).suspensao;
      const suspB = !!(bikeB as any).suspensao;
      if (suspA && !suspB) {
        r4Winner = 'A';
        r4Diff = 'Suspensão Integrada';
        r4Comment = `${bikeA.modelo} absorve melhor os impactos de buracos e paralelepípedos.`;
      } else if (suspB && !suspA) {
        r4Winner = 'B';
        r4Diff = 'Suspensão Integrada';
        r4Comment = `${bikeB.modelo} oferece maior conforto contra desníveis do asfalto.`;
      }
    }

    // ROUND 5: Preço e Custo por Quilômetro (Menor preço vence)
    let r5Winner: 'A' | 'B' | 'TIE' = 'TIE';
    let r5Diff = 'Preço equivalente';
    let r5Comment = 'Valores de mercado muito próximos na faixa de preço.';
    if (precoA < precoB) {
      r5Winner = 'A';
      const econ = precoB - precoA;
      r5Diff = `Economia de ${formatBrl(econ)}`;
      r5Comment = `${bikeA.modelo} exige menor investimento inicial com excelente entrega técnica.`;
    } else if (precoB < precoA) {
      r5Winner = 'B';
      const econ = precoA - precoB;
      r5Diff = `Economia de ${formatBrl(econ)}`;
      r5Comment = `${bikeB.modelo} é a opção mais econômica e acessível para o seu bolso.`;
    }

    return [
      {
        roundNumber: 1,
        title: 'Força & Ladeiras (Potência do Motor)',
        icon: Zap,
        description: 'Capacidade de encarar subidas íngremes e arrancadas com vigor.',
        winner: r1Winner,
        metricA: `${potA} Watts`,
        metricB: `${potB} Watts`,
        diffSummary: r1Diff,
        verdictComment: r1Comment,
      },
      {
        roundNumber: 2,
        title: 'Alcance & Autonomia (Bateria)',
        icon: BatteryCharging,
        description: 'Distância percorrida com uma única carga completa de bateria.',
        winner: r2Winner,
        metricA: `${autoA} km`,
        metricB: `${autoB} km`,
        diffSummary: r2Diff,
        verdictComment: r2Comment,
      },
      {
        roundNumber: 3,
        title: 'Portabilidade & Agilidade (Peso)',
        icon: Feather,
        description: 'Facilidade de dobrar, transportar em escadas e colocar no porta-malas.',
        winner: r3Winner,
        metricA: `${pesoA} kg`,
        metricB: `${pesoB} kg`,
        diffSummary: r3Diff,
        verdictComment: r3Comment,
      },
      {
        roundNumber: 4,
        title: 'Segurança & Equipamentos',
        icon: ShieldCheck,
        description: 'Tecnologia de frenagem, suspensão e robustez mecânica.',
        winner: r4Winner,
        metricA: (bikeA as any).freios || 'Freio a Disco',
        metricB: (bikeB as any).freios || 'Freio a Disco',
        diffSummary: r4Diff,
        verdictComment: r4Comment,
      },
      {
        roundNumber: 5,
        title: 'Investimento & Custo-Benefício',
        icon: DollarSign,
        description: 'Menor preço à vista verificado e retorno por real investido.',
        winner: r5Winner,
        metricA: formatBrl(precoA),
        metricB: formatBrl(precoB),
        diffSummary: r5Diff,
        verdictComment: r5Comment,
      },
    ];
  }, [bikeA, bikeB, pricingA, pricingB]);

  // Calculate Final Score
  const scoreA = useMemo(() => roundResults.filter(r => r.winner === 'A').length, [roundResults]);
  const scoreB = useMemo(() => roundResults.filter(r => r.winner === 'B').length, [roundResults]);

  const overallWinner = useMemo(() => {
    if (scoreA > scoreB) return 'A';
    if (scoreB > scoreA) return 'B';
    return 'TIE';
  }, [scoreA, scoreB]);

  // Filtered candidate list for bike selector modal
  const candidateBikes = useMemo(() => {
    return initialBikes.filter(b => {
      const matchBrand = brandFilter === 'TODAS' || b.marca.toLowerCase() === brandFilter.toLowerCase();
      const matchSearch = searchFilter.trim() === '' || 
        b.modelo.toLowerCase().includes(searchFilter.toLowerCase()) || 
        b.marca.toLowerCase().includes(searchFilter.toLowerCase());
      return matchBrand && matchSearch;
    });
  }, [initialBikes, brandFilter, searchFilter]);

  return (
    <div 
      className="min-h-screen text-ink pb-36 sm:pb-44 pt-4 sm:pt-6 relative" 
      id="arena-de-duelo-root"
      style={{
        backgroundImage: `url("${BG_CICLOVIA_DATA_URI}")`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top center',
        backgroundSize: '100% auto',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-[75] bg-ink text-white font-mono text-xs px-4 py-3 rounded-2xl border-2 border-accent-gold shadow-[4px_4px_0_0_rgba(46,43,39,1)] animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-accent-gold shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-ink/60">
            <Link href="/" className="hover:text-ink transition-colors font-bold">Início</Link>
            <span>/</span>
            <Link href="/comparar" className="hover:text-ink transition-colors font-bold">Comparador</Link>
            <span>/</span>
            <span className="text-ink font-black">Arena de Duelo 1v1</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={pickRandomDuel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-ink/30 text-ink font-mono font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
              title="Sortear novo duelo aleatório"
            >
              <Shuffle className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Duelo Aleatório</span>
            </button>

            <button
              type="button"
              onClick={swapBikes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-ink/30 text-ink font-mono font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
              title="Inverter lados (A vs B)"
            >
              <RotateCw className="w-3.5 h-3.5 text-ink" />
              <span className="hidden sm:inline">Inverter Lados</span>
            </button>

            <button
              type="button"
              onClick={copyDuelLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink hover:bg-neutral-800 text-white font-mono font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
              title="Copiar link para compartilhar"
            >
              <Share2 className="w-3.5 h-3.5 text-accent-gold" />
              <span>Compartilhar</span>
            </button>
          </div>
        </div>

        {/* Arena Master Header */}
        <div className="bg-white border-2 border-ink rounded-3xl p-5 sm:p-7 md:p-8 shadow-[4px_4px_0_0_rgba(46,43,39,1)] md:shadow-[6px_6px_0_0_rgba(46,43,39,1)] mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-ink/10 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent-gold border-2 border-ink flex items-center justify-center shadow-[2px_2px_0_0_rgba(46,43,39,1)] shrink-0">
                <Swords className="w-6 h-6 text-ink" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-ink text-accent-gold border border-ink">
                    Arena de Combate 1v1
                  </span>
                  <span className="text-[10px] font-mono font-bold text-ink/60">
                    Confronto Round a Round
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black text-ink tracking-tight mt-1">
                  Arena de E-Bikes TuaVia
                </h1>
              </div>
            </div>

            <Link
              href={`/comparar?slugs=${encodeURIComponent(bikeA.slug)},${encodeURIComponent(bikeB.slug)}`}
              className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-accent-gold border-2 border-ink font-mono text-xs font-black text-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all"
            >
              <Scale className="w-4 h-4" />
              <span>Abrir Matriz Técnica Completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Quick Preset Classic Clashes */}
          {classicDuels.length > 0 && (
            <div className="pt-4 flex flex-col gap-2">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-ink/60 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Duelos Clássicos em Alta no Brasil:
              </span>
              <div className="flex flex-wrap gap-2">
                {classicDuels.map(cd => {
                  const isActive = (bikeASlug.includes(cd.slugA) && bikeBSlug.includes(cd.slugB)) ||
                                   (bikeASlug.includes(cd.slugB) && bikeBSlug.includes(cd.slugA));
                  return (
                    <button
                      key={cd.label}
                      type="button"
                      onClick={() => {
                        const foundA = initialBikes.find(b => b.slug.includes(cd.slugA) || cd.slugA.includes(b.slug));
                        const foundB = initialBikes.find(b => b.slug.includes(cd.slugB) || cd.slugB.includes(b.slug));
                        if (foundA && foundB) {
                          setBikeASlug(foundA.slug);
                          setBikeBSlug(foundB.slug);
                          updateUrlParams(foundA.slug, foundB.slug);
                          showToast(`Carregado: ${cd.label}`);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-ink text-white border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                          : 'bg-neutral-50 hover:bg-neutral-100 text-ink border-ink/20'
                      }`}
                    >
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent-gold text-ink font-black">
                        {cd.badge}
                      </span>
                      <span>{cd.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* THE OCTAGON / FIGHTER RINGS */}
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 lg:gap-6 items-stretch mb-8 relative">
          
          {/* FIGHTER A (CORNER VERMELHO / ESQUERDA) */}
          <div className="lg:col-span-5 bg-white border-2 border-ink rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col justify-between relative overflow-hidden group">
            {/* Corner Tag */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 border border-ink" />
                <span className="text-[10px] font-mono font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                  Canto A • Desafiante
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectingFor('A')}
                className="text-[11px] font-mono font-bold text-ink hover:text-primary underline flex items-center gap-1 cursor-pointer"
              >
                <span>Mudar E-Bike</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Cover Image & Identity */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
              <Link
                href={`/bike/${bikeA.slug}`}
                className="relative w-36 h-36 sm:w-40 sm:h-40 bg-neutral-50 rounded-2xl border-2 border-ink/15 overflow-hidden p-2 shrink-0 group-hover:border-ink transition-colors"
                title={`Ver detalhes de ${bikeA.modelo}`}
              >
                <SafeImage
                  src={bikeA.imagemUrl || '/placeholder-bike.png'}
                  fallbackSrc="/placeholder-bike.png"
                  alt={`${bikeA.marca} ${bikeA.modelo}`}
                  fill
                  sizes="160px"
                  className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                />
              </Link>

              <div className="flex flex-col text-center sm:text-left min-w-0 flex-1">
                <span className="text-[11px] font-mono font-black uppercase tracking-wider text-accent-gold bg-ink px-2.5 py-0.5 rounded-md w-fit mx-auto sm:mx-0">
                  {bikeA.marca}
                </span>
                <Link
                  href={`/bike/${bikeA.slug}`}
                  className="text-lg sm:text-xl font-display font-black text-ink hover:text-primary transition-colors line-clamp-2 mt-1.5"
                >
                  {bikeA.modelo}
                </Link>

                <div className="mt-2 flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono text-ink/60 uppercase">Menor Oferta Verificada</span>
                  <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                    <strong className="text-xl sm:text-2xl font-mono font-black text-primary">
                      {formatBrl(pricingA.menorPreco)}
                    </strong>
                    {pricingA.hasDiscount && (
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded">
                        -{pricingA.percentualDesconto}%
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-ink/60">
                    Monitorada em {pricingA.lojasCount || bikeA.ofertas?.length || 1} lojas parceiras
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Vital Stats Bar */}
            <div className="grid grid-cols-4 gap-2 bg-neutral-50 border-2 border-ink rounded-2xl p-2.5 mb-4 text-center font-mono">
              <div className="p-1">
                <span className="text-[9px] text-ink/60 uppercase block">Motor</span>
                <strong className="text-xs font-black text-ink">{bikeA.potenciaW || 250}W</strong>
              </div>
              <div className="border-l border-ink/15 p-1">
                <span className="text-[9px] text-ink/60 uppercase block">Alcance</span>
                <strong className="text-xs font-black text-ink">{bikeA.autonomiaKm || 35}km</strong>
              </div>
              <div className="border-l border-ink/15 p-1">
                <span className="text-[9px] text-ink/60 uppercase block">Peso</span>
                <strong className="text-xs font-black text-ink">{(bikeA as any).pesoKg || 22}kg</strong>
              </div>
              <div className="border-l border-ink/15 p-1">
                <span className="text-[9px] text-ink/60 uppercase block">Quadro</span>
                <strong className="text-xs font-black text-ink truncate block">{(bikeA as any).quadro || 'Alumínio'}</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-dashed border-ink/15">
              <Link
                href={`/bike/${bikeA.slug}`}
                className="flex-1 py-2.5 px-3 rounded-xl bg-ink hover:bg-neutral-800 text-white font-mono text-xs font-bold text-center transition-all shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center justify-center gap-1.5"
              >
                <span>Ver Análise e Lojas</span>
                <ExternalLink className="w-3.5 h-3.5 text-accent-gold" />
              </Link>
            </div>
          </div>

          {/* CENTER ARENA BADGE & ROUND COUNTER */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center py-2 lg:py-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-ink text-white border-4 border-white shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col items-center justify-center z-10 my-auto">
              <span className="font-mono font-black text-sm text-accent-gold leading-none">VS</span>
              <span className="text-[9px] font-mono text-white/70 uppercase mt-0.5">Duelo</span>
            </div>

            {/* Live Round Score */}
            <div className="mt-3 bg-white border-2 border-ink px-3 py-1.5 rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] text-center font-mono">
              <span className="text-[9px] text-ink/60 font-bold uppercase block">Placar</span>
              <strong className="text-sm font-black text-ink">
                <span className="text-rose-600">{scoreA}</span> : <span className="text-blue-600">{scoreB}</span>
              </strong>
            </div>
          </div>

          {/* FIGHTER B (CORNER AZUL / DIREITA) */}
          <div className="lg:col-span-5 bg-white border-2 border-ink rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col justify-between relative overflow-hidden group">
            {/* Corner Tag */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 border border-ink" />
                <span className="text-[10px] font-mono font-black uppercase text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  Canto B • Desafiante
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectingFor('B')}
                className="text-[11px] font-mono font-bold text-ink hover:text-primary underline flex items-center gap-1 cursor-pointer"
              >
                <span>Mudar E-Bike</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Cover Image & Identity */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
              <Link
                href={`/bike/${bikeB.slug}`}
                className="relative w-36 h-36 sm:w-40 sm:h-40 bg-neutral-50 rounded-2xl border-2 border-ink/15 overflow-hidden p-2 shrink-0 group-hover:border-ink transition-colors"
                title={`Ver detalhes de ${bikeB.modelo}`}
              >
                <SafeImage
                  src={bikeB.imagemUrl || '/placeholder-bike.png'}
                  fallbackSrc="/placeholder-bike.png"
                  alt={`${bikeB.marca} ${bikeB.modelo}`}
                  fill
                  sizes="160px"
                  className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                />
              </Link>

              <div className="flex flex-col text-center sm:text-left min-w-0 flex-1">
                <span className="text-[11px] font-mono font-black uppercase tracking-wider text-accent-gold bg-ink px-2.5 py-0.5 rounded-md w-fit mx-auto sm:mx-0">
                  {bikeB.marca}
                </span>
                <Link
                  href={`/bike/${bikeB.slug}`}
                  className="text-lg sm:text-xl font-display font-black text-ink hover:text-primary transition-colors line-clamp-2 mt-1.5"
                >
                  {bikeB.modelo}
                </Link>

                <div className="mt-2 flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono text-ink/60 uppercase">Menor Oferta Verificada</span>
                  <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                    <strong className="text-xl sm:text-2xl font-mono font-black text-primary">
                      {formatBrl(pricingB.menorPreco)}
                    </strong>
                    {pricingB.hasDiscount && (
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded">
                        -{pricingB.percentualDesconto}%
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-ink/60">
                    Monitorada em {pricingB.lojasCount || bikeB.ofertas?.length || 1} lojas parceiras
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Vital Stats Bar */}
            <div className="grid grid-cols-4 gap-2 bg-neutral-50 border-2 border-ink rounded-2xl p-2.5 mb-4 text-center font-mono">
              <div className="p-1">
                <span className="text-[9px] text-ink/60 uppercase block">Motor</span>
                <strong className="text-xs font-black text-ink">{bikeB.potenciaW || 250}W</strong>
              </div>
              <div className="border-l border-ink/15 p-1">
                <span className="text-[9px] text-ink/60 uppercase block">Alcance</span>
                <strong className="text-xs font-black text-ink">{bikeB.autonomiaKm || 35}km</strong>
              </div>
              <div className="border-l border-ink/15 p-1">
                <span className="text-[9px] text-ink/60 uppercase block">Peso</span>
                <strong className="text-xs font-black text-ink">{(bikeB as any).pesoKg || 22}kg</strong>
              </div>
              <div className="border-l border-ink/15 p-1">
                <span className="text-[9px] text-ink/60 uppercase block">Quadro</span>
                <strong className="text-xs font-black text-ink truncate block">{(bikeB as any).quadro || 'Alumínio'}</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-dashed border-ink/15">
              <Link
                href={`/bike/${bikeB.slug}`}
                className="flex-1 py-2.5 px-3 rounded-xl bg-ink hover:bg-neutral-800 text-white font-mono text-xs font-bold text-center transition-all shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center justify-center gap-1.5"
              >
                <span>Ver Análise e Lojas</span>
                <ExternalLink className="w-3.5 h-3.5 text-accent-gold" />
              </Link>
            </div>
          </div>

        </div>

        {/* 5 ROUNDS COMBAT SCORECARD */}
        <div className="bg-white border-2 border-ink rounded-3xl p-5 sm:p-7 md:p-8 shadow-[4px_4px_0_0_rgba(46,43,39,1)] md:shadow-[6px_6px_0_0_rgba(46,43,39,1)] mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-ink/10 pb-4 mb-6">
            <div>
              <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider">
                Scorecard Oficial
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-black text-ink">
                Confronto Técnico Round a Round
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-ink/60 bg-neutral-100 px-3 py-1 rounded-xl border border-ink/15 self-start sm:self-auto">
              5 Rounds Analisados
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {roundResults.map((round) => {
              const IconComp = round.icon;
              const isWinnerA = round.winner === 'A';
              const isWinnerB = round.winner === 'B';
              const isTie = round.winner === 'TIE';

              return (
                <div
                  key={round.roundNumber}
                  className="bg-neutral-50/80 border-2 border-ink rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-neutral-50 hover:shadow-xs"
                >
                  {/* Round ID & Title */}
                  <div className="flex items-start gap-3 md:w-1/3">
                    <div className="w-10 h-10 rounded-xl bg-ink text-white font-mono font-black text-xs flex items-center justify-center shrink-0 border border-ink shadow-xs">
                      R{round.roundNumber}
                    </div>
                    <div>
                      <h4 className="font-display font-black text-sm sm:text-base text-ink flex items-center gap-1.5">
                        <IconComp className="w-4 h-4 text-primary shrink-0" />
                        <span>{round.title}</span>
                      </h4>
                      <p className="text-xs font-sans text-ink/70 leading-snug mt-0.5">
                        {round.description}
                      </p>
                    </div>
                  </div>

                  {/* Direct Metrics Comparison (A vs B) */}
                  <div className="flex items-center justify-between md:justify-center gap-4 py-2 px-3 bg-white rounded-xl border border-ink/15 md:w-1/3">
                    {/* Metric A */}
                    <div className={`flex flex-col text-center flex-1 ${isWinnerA ? 'font-black text-rose-700' : 'text-ink/70'}`}>
                      <span className="text-[9px] font-mono text-ink/50 uppercase truncate">{bikeA.modelo}</span>
                      <span className="text-sm font-mono">{round.metricA}</span>
                    </div>

                    <span className="text-[10px] font-mono font-bold text-ink/30 px-1">vs</span>

                    {/* Metric B */}
                    <div className={`flex flex-col text-center flex-1 ${isWinnerB ? 'font-black text-blue-700' : 'text-ink/70'}`}>
                      <span className="text-[9px] font-mono text-ink/50 uppercase truncate">{bikeB.modelo}</span>
                      <span className="text-sm font-mono">{round.metricB}</span>
                    </div>
                  </div>

                  {/* Winner Badge & Commentary */}
                  <div className="flex flex-col md:items-end text-left md:text-right md:w-1/3">
                    <div className="flex items-center gap-1.5 mb-1">
                      {isWinnerA && (
                        <span className="text-[11px] font-mono font-black px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
                          🏆 Venceu {bikeA.marca} ({round.diffSummary})
                        </span>
                      )}
                      {isWinnerB && (
                        <span className="text-[11px] font-mono font-black px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-800 border border-blue-300">
                          🏆 Venceu {bikeB.marca} ({round.diffSummary})
                        </span>
                      )}
                      {isTie && (
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-neutral-200 text-ink/75 border border-ink/20">
                          Empate Técnico
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-ink/70 font-sans leading-snug">
                      {round.verdictComment}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* VEREDITO FINAL DA ARENA (JUIZ TÉCNICO TUAVIA) */}
        <div className="bg-ink text-white border-2 border-ink rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_rgba(46,43,39,1)] mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-6 h-6 text-accent-gold" />
            <span className="text-xs font-mono font-black text-accent-gold uppercase tracking-widest">
              Veredito Final dos Juízes Especialistas
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-display font-black text-white mb-2">
            {overallWinner === 'A' && `Vitória de ${bikeA.marca} ${bikeA.modelo} por ${scoreA} a ${scoreB} Rounds`}
            {overallWinner === 'B' && `Vitória de ${bikeB.marca} ${bikeB.modelo} por ${scoreB} a ${scoreA} Rounds`}
            {overallWinner === 'TIE' && `Empate Técnico Extraordinário (${scoreA} a ${scoreB})`}
          </h3>

          <p className="text-sm font-sans text-white/80 max-w-3xl leading-relaxed mb-6">
            Nosso algoritmo de confronto ponderou dados auditados de motor, bateria, peso transportável, frenagem e menores preços verificados em lojas confiáveis no Brasil.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/20">
            {/* Recommendation A */}
            <div className="bg-white/10 border border-white/15 p-4 rounded-2xl">
              <span className="text-xs font-mono font-black text-accent-gold uppercase tracking-wider block mb-1">
                Escolha a {bikeA.modelo} se você prioriza:
              </span>
              <ul className="text-xs font-sans text-white/90 space-y-1.5 list-disc list-inside">
                {scoreA > 0 ? (
                  roundResults.filter(r => r.winner === 'A').map(r => (
                    <li key={r.roundNumber}><strong>{r.title.split('(')[0]}:</strong> {r.diffSummary}</li>
                  ))
                ) : (
                  <li>Design consagrado e rede de assistência compatível.</li>
                )}
                <li>Proposta equilibrada para quem busca confiabilidade.</li>
              </ul>
            </div>

            {/* Recommendation B */}
            <div className="bg-white/10 border border-white/15 p-4 rounded-2xl">
              <span className="text-xs font-mono font-black text-accent-gold uppercase tracking-wider block mb-1">
                Escolha a {bikeB.modelo} se você prioriza:
              </span>
              <ul className="text-xs font-sans text-white/90 space-y-1.5 list-disc list-inside">
                {scoreB > 0 ? (
                  roundResults.filter(r => r.winner === 'B').map(r => (
                    <li key={r.roundNumber}><strong>{r.title.split('(')[0]}:</strong> {r.diffSummary}</li>
                  ))
                ) : (
                  <li>Excelente presença de mercado e histórico consolidado.</li>
                )}
                <li>Alternativa robusta para seu trajeto diário.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/20">
            <span className="text-xs font-mono text-white/60">
              *Dados verificados manualmente e atualizados diariamente pelo time editorial TuaVia.
            </span>

            <Link
              href={`/comparar?slugs=${encodeURIComponent(bikeA.slug)},${encodeURIComponent(bikeB.slug)}`}
              className="px-4 py-2 rounded-xl bg-accent-gold hover:bg-amber-400 text-ink font-mono font-black text-xs flex items-center gap-2 transition-all shadow-sm"
            >
              <Scale className="w-4 h-4" />
              <span>Ver Tabela Completa de 50+ Especificações</span>
            </Link>
          </div>
        </div>

      </div>

      {/* BIKE SELECTION MODAL */}
      {selectingFor !== null && (
        <div 
          className="fixed inset-0 bg-ink/75 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectingFor(null);
            }
          }}
        >
          <div 
            className="bg-white border-2 border-ink rounded-3xl w-full max-w-2xl shadow-[6px_6px_0_0_rgba(46,43,39,1)] overflow-hidden flex flex-col max-h-[85vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-ink flex items-center justify-between bg-neutral-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent-gold border-2 border-ink flex items-center justify-center text-ink font-bold shadow-xs">
                  <Swords className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base sm:text-lg text-ink leading-tight">
                    Selecionar E-Bike para o Canto {selectingFor}
                  </h3>
                  <p className="text-[11px] font-mono text-ink/60">
                    Escolha entre as {initialBikes.length} e-bikes catalogadas e auditadas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectingFor(null)}
                className="p-2 rounded-xl border-2 border-ink/20 hover:border-ink hover:bg-neutral-200 text-ink transition-colors cursor-pointer"
                title="Fechar modal"
                aria-label="Fechar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input & Brand Filters */}
            <div className="p-4 border-b border-ink/10 flex flex-col gap-3 bg-neutral-50/50 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
                <input
                  type="text"
                  placeholder="Pesquisar por modelo ou marca (ex: B20, Two Dogs, Sense)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white text-xs font-mono rounded-xl border-2 border-ink text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs placeholder:text-ink/40"
                  autoFocus
                />
              </div>

              {/* Brand Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
                {brands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrandFilter(b)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                      brandFilter === b
                        ? 'bg-ink text-white border-ink shadow-xs'
                        : 'bg-white hover:bg-neutral-100 text-ink/70 border-ink/20'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Bike Candidates List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-12 sm:pb-6 space-y-2">
              {candidateBikes.length > 0 ? (
                candidateBikes.map((bike) => {
                  const isCurrent = selectingFor === 'A' ? bike.slug === bikeASlug : bike.slug === bikeBSlug;
                  const isOther = selectingFor === 'A' ? bike.slug === bikeBSlug : bike.slug === bikeASlug;

                  return (
                    <button
                      key={bike.slug}
                      type="button"
                      onClick={() => selectBike(selectingFor, bike.slug)}
                      disabled={isCurrent}
                      className={`w-full p-3 sm:p-3.5 rounded-2xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer border-2 ${
                        isCurrent
                          ? 'bg-neutral-100 border-ink/20 opacity-60 cursor-not-allowed'
                          : 'bg-white hover:bg-amber-50/60 border-ink/20 hover:border-ink hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:scale-[0.99]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-50 border border-ink/20 overflow-hidden shrink-0 p-1 flex items-center justify-center">
                          <SafeImage
                            src={bike.imagemUrl || '/placeholder-bike.png'}
                            fallbackSrc="/placeholder-bike.png"
                            alt={bike.modelo}
                            fill
                            sizes="64px"
                            className="object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className="text-[10px] font-mono font-bold uppercase text-ink/60">
                              {bike.marca}
                            </span>
                            {isOther && (
                              <span className="text-[9px] font-mono font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                Oponente Atual ({selectingFor === 'A' ? 'Canto B' : 'Canto A'})
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[9px] font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                Já Selecionada no Canto {selectingFor}
                              </span>
                            )}
                          </div>
                          <strong className="text-xs sm:text-sm font-mono font-black text-ink line-clamp-1 block">
                            {bike.modelo}
                          </strong>
                          <span className="text-[11px] font-mono text-ink/60 block mt-0.5">
                            {bike.potenciaW || 250}W • {bike.autonomiaKm || 35}km {(bike as any).pesoKg ? `• ${(bike as any).pesoKg}kg` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <span className="text-[9px] font-mono text-ink/50 uppercase block">A partir de</span>
                        <strong className="text-xs sm:text-sm font-mono font-black text-primary block">
                          {formatBrl(bike.menorPreco)}
                        </strong>
                        <span className="text-[10px] font-mono font-medium text-ink/60 block">
                          {bike.ofertas?.length || 1} {bike.ofertas?.length === 1 ? 'oferta' : 'ofertas'}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs font-mono text-ink/60">
                  Nenhuma e-bike encontrada com os filtros selecionados.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
