'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CompareHeader from '@/components/comparar/CompareHeader';
import UnifiedCompareGrid from '@/components/comparar/UnifiedCompareGrid';
import CompareSelectorModal from '@/components/comparar/CompareSelectorModal';
import Footer from '@/components/Footer';
import { EBikeGrouped } from '@/types/ebike';
import { fetchEBikesFromFirestore } from '@/lib/ebikes';
import { BG_CICLOVIA_DATA_URI } from '@/lib/bgCicloviaDataUri';

interface CompararClientProps {
  initialBikes?: EBikeGrouped[];
}

// Extrai slugs de comparação a partir de múltiplos formatos de parâmetros de URL (slugs=a,b ou b1=a&b2=b ou bikes=a,b)
function parseSlugsFromParams(params: URLSearchParams | null): string[] {
  if (!params) return [];
  const found: string[] = [];

  // 1. Parâmetros de lista com delimitadores (vírgula, ponto-e-vírgula)
  const listKeys = ['slugs', 'bikes', 'bike', 'modelos', 'models'];
  for (const key of listKeys) {
    const raw = params.get(key);
    if (raw) {
      raw.split(/[,;]+/).forEach((s) => {
        const cleaned = decodeURIComponent(s).trim();
        if (cleaned) found.push(cleaned);
      });
    }
  }

  // 2. Parâmetros indexados/numerados (b1, b2, b3, bike1, bike2, bike3, slug1, slug2, etc.)
  const numberedKeys = ['b1', 'b2', 'b3', 'bike1', 'bike2', 'bike3', 'slug1', 'slug2', 'slug3', 'm1', 'm2', 'm3'];
  for (const key of numberedKeys) {
    const raw = params.get(key);
    if (raw) {
      const cleaned = decodeURIComponent(raw).trim();
      if (cleaned) found.push(cleaned);
    }
  }

  // 3. Parâmetros repetidos (?slug=a&slug=b ou ?b=a&b=b)
  ['slug', 'b', 'bike'].forEach((key) => {
    params.getAll(key).forEach((raw) => {
      if (raw) {
        const cleaned = decodeURIComponent(raw).trim();
        if (cleaned) found.push(cleaned);
      }
    });
  });

  return Array.from(new Set(found));
}

export default function CompararClient({ initialBikes = [] }: CompararClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Estado das bikes publicadas
  const [allBikes, setAllBikes] = useState<EBikeGrouped[]>(initialBikes);
  const [loading, setLoading] = useState(false);

  // Ref para garantir que a inicialização padrão ocorra de forma consistente
  const hasInitializedRef = useRef(false);

  // Slugs selecionados para comparação (máximo 3)
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [showSelectorForIndex, setShowSelectorForIndex] = useState<number | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');

  // 1. Carrega ou atualiza bikes do Firestore/API no cliente em segundo plano
  useEffect(() => {
    let isMounted = true;
    async function updateBikesClient() {
      try {
        const liveBikes = await fetchEBikesFromFirestore();
        if (isMounted && Array.isArray(liveBikes) && liveBikes.length > 0) {
          setAllBikes(liveBikes);
        }
      } catch (err) {
        console.warn('[CompararClient] Erro ao sincronizar catálogo no cliente:', err);
      }
    }
    updateBikesClient();
    return () => { isMounted = false; };
  }, []);

  // 2. Sincroniza estado com a URL (?slugs=a,b ou ?b1=a&b2=b) ou inicializa seleção
  useEffect(() => {
    const parsedSlugs = parseSlugsFromParams(searchParams);

    if (parsedSlugs.length > 0) {
      let finalSlugs = parsedSlugs;
      if (allBikes.length > 0) {
        // Mapeia para o slug canônico do modelo cadastrado
        const mapped = parsedSlugs.map((s) => {
          const foundBike = allBikes.find(
            (b) => b.slug.toLowerCase() === s.toLowerCase() || b.slug === s || (b as any).id === s
          );
          return foundBike ? foundBike.slug : s;
        });
        finalSlugs = Array.from(new Set(mapped));
      }

      // Limita a no máximo 3 modelos comparados simultaneamente
      setSelectedSlugs(finalSlugs.slice(0, 3));
      hasInitializedRef.current = true;
      return;
    }

    // Se a URL não tiver nenhum parâmetro de bike, seleciona automaticamente os 2 primeiros modelos em destaque
    if (!hasInitializedRef.current) {
      if (allBikes && allBikes.length >= 2) {
        const defaultSlugs = allBikes.slice(0, 2).map((b) => b.slug);
        setSelectedSlugs(defaultSlugs);
        hasInitializedRef.current = true;
      } else if (allBikes && allBikes.length === 1) {
        setSelectedSlugs([allBikes[0].slug]);
        hasInitializedRef.current = true;
      }
    }
  }, [searchParams, allBikes]);

  // Atualiza a URL ao alterar a seleção
  const updateUrlWithSlugs = (slugs: string[]) => {
    setSelectedSlugs(slugs);
    if (slugs.length > 0) {
      const newUrl = `/comparar?slugs=${encodeURIComponent(slugs.join(','))}`;
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.replaceState(null, '', '/comparar');
    }
  };

  const addBike = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      setShowSelectorForIndex(null);
      return;
    }
    if (selectedSlugs.length < 3) {
      const updated = [...selectedSlugs, slug];
      updateUrlWithSlugs(updated);
    }
    setShowSelectorForIndex(null);
    setSelectorSearch('');
  };

  const replaceBike = (index: number, newSlug: string) => {
    const updated = [...selectedSlugs];
    updated[index] = newSlug;
    updateUrlWithSlugs(updated);
    setShowSelectorForIndex(null);
    setSelectorSearch('');
  };

  const removeBike = (slug: string) => {
    const updated = selectedSlugs.filter((s) => s !== slug);
    updateUrlWithSlugs(updated);
  };

  // Objetos completos das e-bikes comparadas
  const comparedBikes = useMemo(() => {
    return selectedSlugs
      .map((slug) =>
        allBikes.find(
          (b) => b.slug === slug || b.slug.toLowerCase() === slug.toLowerCase() || (b as any).id === slug
        )
      )
      .filter((b): b is EBikeGrouped => Boolean(b));
  }, [selectedSlugs, allBikes]);

  // Candidatas para a modal de seleção
  const candidateBikes = useMemo(() => {
    return allBikes.filter((b) => {
      const isAlreadySelected = selectedSlugs.includes(b.slug);
      if (isAlreadySelected) return false;

      if (!selectorSearch.trim()) return true;

      const query = selectorSearch.toLowerCase().trim();
      const matchMarca = b.marca.toLowerCase().includes(query);
      const matchModelo = b.modelo.toLowerCase().includes(query);
      return matchMarca || matchModelo;
    });
  }, [allBikes, selectedSlugs, selectorSearch]);

  // Cálculos de vencedores em métricas chave
  const winners = useMemo(() => {
    if (comparedBikes.length < 2) return {};

    let bestPrice = comparedBikes[0];
    let bestAutonomy = comparedBikes[0];
    let bestPower = comparedBikes[0];
    let bestWeight = comparedBikes[0];
    let bestCharge = comparedBikes[0];

    comparedBikes.forEach((b) => {
      if (b.menorPreco > 0 && (bestPrice.menorPreco === 0 || b.menorPreco < bestPrice.menorPreco)) {
        bestPrice = b;
      }
      if (b.autonomiaKm > bestAutonomy.autonomiaKm) {
        bestAutonomy = b;
      }
      if (b.potenciaW > bestPower.potenciaW) {
        bestPower = b;
      }
      if (b.pesoKg && b.pesoKg > 0 && (!bestWeight.pesoKg || b.pesoKg < bestWeight.pesoKg)) {
        bestWeight = b;
      }
      if (
        b.tempoCargaHoras &&
        b.tempoCargaHoras > 0 &&
        (!bestCharge.tempoCargaHoras || b.tempoCargaHoras < bestCharge.tempoCargaHoras)
      ) {
        bestCharge = b;
      }
    });

    return {
      price: bestPrice?.slug,
      autonomy: bestAutonomy?.slug,
      power: bestPower?.slug,
      weight: bestWeight?.slug,
      charge: bestCharge?.slug,
    };
  }, [comparedBikes]);

  return (
    <div 
      className="min-h-screen flex flex-col justify-between text-ink bg-transparent relative" 
      id="comparar-page-client"
      style={{
        backgroundImage: `url("${BG_CICLOVIA_DATA_URI}")`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top center',
        backgroundSize: '100% auto',
      }}
    >
      <main className="flex-grow py-6 sm:py-10 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Header Superior da Página com Ações */}
        <CompareHeader
          comparedCount={comparedBikes.length}
          totalCatalogCount={allBikes.length}
          onOpenSelector={() => setShowSelectorForIndex(selectedSlugs.length)}
          onClearAll={() => updateUrlWithSlugs([])}
        />

        {/* Grade de Comparação Unificada */}
        <UnifiedCompareGrid
          comparedBikes={comparedBikes}
          allBikes={allBikes}
          removeBike={removeBike}
          setShowSelectorForIndex={setShowSelectorForIndex}
          winners={winners}
          onClearAll={() => updateUrlWithSlugs([])}
        />

        {/* Modal Seletora de E-Bike */}
        <CompareSelectorModal
          showSelectorForIndex={showSelectorForIndex}
          setShowSelectorForIndex={setShowSelectorForIndex}
          selectorSearch={selectorSearch}
          setSelectorSearch={setSelectorSearch}
          candidateBikes={candidateBikes}
          selectedSlugs={selectedSlugs}
          addBike={addBike}
          replaceBike={replaceBike}
        />
      </main>

      <Footer />
    </div>
  );
}

function Router() {
  return useRouter();
}
