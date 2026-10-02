'use client';

import { slugify } from '@/lib/slug';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SafeImage, { cleanImageUrl } from '@/components/ui/SafeImage';
import { useCrudSave } from '@/hooks/useCrudSave';
import { TopRanking, RankingItem, RankingStoreOffer, RankingCategory, RANKING_STORAGE_KEY } from '@/types/ranking';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import FileIngestionDropzone from '@/components/admin/FileIngestionDropzone';
import RankingMatrixEditor from '@/components/admin/RankingMatrixEditor';
import { ExtractedImageFile } from '@/lib/admin/fileIngestion';
import { fetchAdminJson } from '@/lib/apiResponse';
import {
  Trophy,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Store,
  DollarSign,
  Link as LinkIcon,
  Tag,
  Check,
  ChevronDown,
  ChevronUp,
  MoveDown,
  MoveUp,
  Sliders,
  Award,
  Layers,
  Star,
  ExternalLink,
  PlusCircle,
  Search,
  X,
  FileText,
  CheckCircle,
  Table,
} from 'lucide-react';

interface RankingFormProps {
  initialData?: TopRanking | null;
  isEditing?: boolean;
}

const CATEGORIAS_RANKING: { label: string; value: RankingCategory }[] = [
  { label: 'E-Bikes Completas', value: 'ebikes' },
  { label: 'Baterias & Carregadores', value: 'baterias' },
  { label: 'Motores & Peças de Reposição', value: 'pecas' },
  { label: 'Acessórios & Bagageiros', value: 'acessorios' },
  { label: 'Segurança & Cadeados', value: 'seguranca' },
  { label: 'Melhor Custo-Benefício', value: 'custo-beneficio' },
];

function normalizeItemLojas(item: RankingItem, itemIndex: number): RankingStoreOffer[] {
  if (Array.isArray(item.lojas) && item.lojas.length > 0) {
    return item.lojas;
  }
  const defaultList: RankingStoreOffer[] = [];
  if (item.linkLoja1 && item.linkLoja1.nomeLoja) {
    defaultList.push({
      id: `store-${item.id || itemIndex}-1`,
      nomeLoja: item.linkLoja1.nomeLoja,
      preco: item.linkLoja1.preco || 0,
      url: item.linkLoja1.url || '',
      cupom: '',
      destaque: true,
    });
  }
  if (item.linkLoja2 && item.linkLoja2.nomeLoja) {
    defaultList.push({
      id: `store-${item.id || itemIndex}-2`,
      nomeLoja: item.linkLoja2.nomeLoja,
      preco: item.linkLoja2.preco || 0,
      url: item.linkLoja2.url || '',
      cupom: '',
      destaque: false,
    });
  }
  if (defaultList.length === 0) {
    defaultList.push({
      id: `store-${Date.now()}-1`,
      nomeLoja: 'Mercado Livre',
      preco: 0,
      url: '',
      cupom: '',
      destaque: true,
    });
  }
  return defaultList;
}

export default function RankingForm({ initialData, isEditing = false }: RankingFormProps) {
  const router = useRouter();

  // Campos Básicos
  const [titulo, setTitulo] = useState(initialData?.titulo || '');
  const [subtitulo, setSubtitulo] = useState(initialData?.subtitulo || '');
  const [categoria, setCategoria] = useState<RankingCategory>(initialData?.categoria || 'ebikes');
  const [quantidadeDesejada, setQuantidadeDesejada] = useState<number>(initialData?.quantidadeItens || 5);
  const [criterioAvaliacao, setCriterioAvaliacao] = useState(
    initialData?.criterioAvaliacao || 'Autonomia real, procedência dos componentes, assistência técnica e custo-benefício.'
  );
  const [conclusaoGeral, setConclusaoGeral] = useState(initialData?.conclusaoGeral || '');
  const [itens, setItens] = useState<RankingItem[]>(
    initialData?.itens
      ? initialData.itens.map((it, idx) => ({ ...it, lojas: normalizeItemLojas(it, idx) }))
      : [
          {
            id: 'item-1',
            posicao: 1,
            tituloItem: '',
            marca: '',
            categoriaItem: '',
            notaDestaque: 'Campeã Geral',
            pontosPositivos: ['Excelente autonomia', 'Construção robusta'],
            pontosNegativos: ['Preço elevado'],
            especificacoes: { 'Potência': '350W', 'Autonomia': '60km' },
            faixaPrecoEstimado: 'R$ 5.000 - R$ 6.000',
            imagemUrl: '',
            lojas: [
              {
                id: 'store-1-1',
                nomeLoja: 'Mercado Livre',
                preco: 0,
                url: '',
                cupom: '',
                destaque: true,
              },
              {
                id: 'store-1-2',
                nomeLoja: 'Amazon Brasil',
                preco: 0,
                url: '',
                cupom: '',
                destaque: false,
              },
            ],
            linkLoja1: { nomeLoja: 'Mercado Livre', preco: 0, url: '' },
            observacoes: '',
          },
        ]
  );

  // Mensagens e Status de Operação
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Salvar o ranking.
   *
   * A ordem é invertida de propósito: o SERVIDOR responde primeiro e o
   * localStorage vira espelho. Antes era o contrário — gravava local, tentava a
   * API, caía num `setDoc` que nunca funcionava (as `firestore.rules` exigem
   * `request.auth != null` e o painel não usa Firebase Auth) e navegava de
   * qualquer jeito. Se a API falhasse, o editor via o ranking salvo e só
   * descobria ao recarregar a listagem.
   */
  const [savedByServer, setSavedByServer] = useState<TopRanking | null>(null);

  const crud = useCrudSave<TopRanking>({
    endpoint: '/api/rankings',
    tags: ['rankings'],
    // A rota recebe `{ ranking }`, e não o documento solto.
    serialize: (entity) => ({ ranking: entity }),
    validate: (entity) => {
      if (!entity.titulo?.trim()) return 'Informe o título do ranking.';
      if (!entity.itens?.length) return 'Adicione pelo menos um modelo ao ranking.';
      return null;
    },
    onSaved: (response) => {
      // A rota responde `{ data: { ranking } }` e devolve os itens com os
      // slugs de e-bike já vinculados.
      const ranking = (response as { ranking?: TopRanking } | undefined)?.ranking;
      if (ranking?.itens?.length) setSavedByServer(ranking);
    },
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status de Publicação e Confirmação
  const [publicado, setPublicado] = useState<boolean>(initialData?.publicado ?? true);
  const [isConfirmPublishModalOpen, setIsConfirmPublishModalOpen] = useState(false);

  // Estados para Puxar E-Bike do Catálogo
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [catalogTargetItemIndex, setCatalogTargetItemIndex] = useState<number | null>(null);
  const [catalogBikes, setCatalogBikes] = useState<any[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Matrix Editor tab
  const [activeTab, setActiveTab] = useState<'editor' | 'matrix'>('editor');

  const openCatalogPicker = async (itemIndex: number) => {
    setCatalogTargetItemIndex(itemIndex);
    setIsCatalogPickerOpen(true);
    setCatalogSearch('');
    if (catalogBikes.length === 0) {
      setIsCatalogLoading(true);
      try {
        const res = await fetch('/api/bikes');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.bikes)) {
            setCatalogBikes(data.bikes);
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar e-bikes do catálogo:', err);
      } finally {
        setIsCatalogLoading(false);
      }
    }
  };

  const handleSelectBikeFromCatalog = (bike: any) => {
    if (catalogTargetItemIndex === null) return;
    const idx = catalogTargetItemIndex;

    const formattedSpecs: Record<string, string> = {};
    if (bike.motor?.potenciaW) formattedSpecs['Potência'] = `${bike.motor.potenciaW}W`;
    if (bike.bateria?.autonomiaKm) formattedSpecs['Autonomia'] = `${bike.bateria.autonomiaKm}km`;
    if (bike.bateria?.capacidadeWh) formattedSpecs['Bateria'] = `${bike.bateria.capacidadeWh}Wh`;
    if (bike.pesoKg) formattedSpecs['Peso'] = `${bike.pesoKg}kg`;

    const lowestPrice = bike.menorPreco || 0;
    const highestPrice = bike.maiorPreco || lowestPrice;
    const priceRange = lowestPrice > 0
      ? `R$ ${lowestPrice.toLocaleString('pt-BR')}${highestPrice > lowestPrice ? ` - R$ ${highestPrice.toLocaleString('pt-BR')}` : ''}`
      : '';

    const bikeStores: RankingStoreOffer[] = Array.isArray(bike.ofertas) && bike.ofertas.length > 0
      ? bike.ofertas.map((of: any, oIdx: number) => ({
          id: `store-cat-${Date.now()}-${oIdx}`,
          nomeLoja: of.loja || of.nomeLoja || 'Loja Parceira',
          preco: Number(of.preco) || 0,
          url: of.linkProduto || of.url || '',
          cupom: of.cupom || '',
          destaque: oIdx === 0,
        }))
      : itens[idx]?.lojas || [];

    setItens((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        tituloItem: bike.nome || copy[idx].tituloItem,
        marca: bike.marca || copy[idx].marca,
        categoriaItem: bike.categoria || copy[idx].categoriaItem || 'E-Bike Urbana',
        bikeSlug: bike.slug,
        imagemUrl: bike.imagemCard || bike.imagens?.[0] || copy[idx].imagemUrl,
        faixaPrecoEstimado: priceRange || copy[idx].faixaPrecoEstimado,
        menorPreco: lowestPrice || copy[idx].menorPreco,
        maiorPreco: highestPrice || copy[idx].maiorPreco,
        potenciaW: bike.motor?.potenciaW || copy[idx].potenciaW,
        autonomiaKm: bike.bateria?.autonomiaKm || copy[idx].autonomiaKm,
        pesoKg: bike.pesoKg || copy[idx].pesoKg,
        tempoCargaHoras: bike.bateria?.tempoCargaHoras || copy[idx].tempoCargaHoras,
        especificacoes: Object.keys(formattedSpecs).length > 0 ? formattedSpecs : copy[idx].especificacoes,
        pontosPositivos: Array.isArray(bike.pontosFortes) && bike.pontosFortes.length > 0 ? bike.pontosFortes : copy[idx].pontosPositivos,
        pontosNegativos: Array.isArray(bike.pontosFracos) && bike.pontosFracos.length > 0 ? bike.pontosFracos : copy[idx].pontosNegativos,
        priceHistory: bike.priceHistory || copy[idx].priceHistory,
        lojas: bikeStores.length > 0 ? bikeStores : copy[idx].lojas,
        observacoes: bike.descricaoCurta || copy[idx].observacoes,
      };
      return copy;
    });

    setIsCatalogPickerOpen(false);
    setAiSuccessMessage(`E-Bike "${bike.nome}" vinculada e importada com sucesso para a Posição #${idx + 1}!`);
  };

  // Carrega dados salvos localmente se disponíveis
  useEffect(() => {
    if (!initialData && typeof window !== 'undefined') {
      try {
        const storedSession = sessionStorage.getItem('tuavia_prefill_ranking');
        const storedLocal = localStorage.getItem('tuavia_prefill_ranking') || localStorage.getItem('tuavia_draft_ranking_audit');
        const storedStr = storedSession || storedLocal;

        if (storedStr) {
          const parsed = JSON.parse(storedStr);
          const categoriaCarregada = (parsed.categoria || parsed.category || 'ebikes') as RankingCategory;
          const quantidadeCarregada = parsed.quantidadeItens || parsed.quantidade || 5;

          if (parsed.titulo || parsed.title) setTitulo(parsed.titulo || parsed.title);
          if (parsed.subtitulo || parsed.summary) setSubtitulo(parsed.subtitulo || parsed.summary);
          if (parsed.categoria || parsed.category) setCategoria(categoriaCarregada);
          if (parsed.quantidadeItens || parsed.quantidade) setQuantidadeDesejada(quantidadeCarregada);
          if (parsed.criterioAvaliacao || parsed.criterio) setCriterioAvaliacao(parsed.criterioAvaliacao || parsed.criterio);
          if (parsed.conclusaoGeral || parsed.conclusion || parsed.veredito) setConclusaoGeral(parsed.conclusaoGeral || parsed.conclusion || parsed.veredito);

          const itemsArr = parsed.itens || parsed.items;
          if (Array.isArray(itemsArr) && itemsArr.length > 0) {
            const mapped = itemsArr.map((it: any, idx: number) => ({
              ...it,
              lojas: normalizeItemLojas(it, idx),
            }));
            setItens(mapped);
            setAiSuccessMessage('Ranking comparativo importado com sucesso!');
          }

          sessionStorage.removeItem('tuavia_prefill_ranking');
          localStorage.removeItem('tuavia_prefill_ranking');
          localStorage.removeItem('tuavia_draft_ranking_audit');
        }
      } catch (err) {
        console.error('Erro ao carregar pré-preenchimento do ranking:', err);
      }
    }
  }, [initialData]);

  // Funções de manipulação de itens do ranking
  const handleAddItem = () => {
    if (itens.length >= 10) {
      alert('O limite máximo por ranking comparativo é de 10 itens (Top 10).');
      return;
    }
    const newPos = itens.length + 1;
    setItens((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        posicao: newPos,
        tituloItem: '',
        marca: '',
        categoriaItem: '',
        notaDestaque: 'Excelente Opção',
        pontosPositivos: ['Boa durabilidade'],
        pontosNegativos: [],
        especificacoes: {},
        faixaPrecoEstimado: '',
        imagemUrl: '',
        lojas: [
          {
            id: `store-${Date.now()}-1`,
            nomeLoja: 'Mercado Livre',
            preco: 0,
            url: '',
            cupom: '',
            destaque: true,
          },
        ],
        linkLoja1: { nomeLoja: 'Mercado Livre', preco: 0, url: '' },
        observacoes: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (itens.length <= 3) {
      alert('O ranking deve possuir pelo menos 3 posições (Top 3).');
      return;
    }
    const filtered = itens.filter((_, i) => i !== index);
    const reindexed = filtered.map((item, idx) => ({ ...item, posicao: idx + 1 }));
    setItens(reindexed);
  };

  const handleItemChange = (index: number, field: keyof RankingItem, value: any) => {
    setItens((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === itens.length - 1)) {
      return;
    }
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...itens];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    const reindexed = updated.map((item, idx) => ({ ...item, posicao: idx + 1 }));
    setItens(reindexed);
  };

  // MANIPULAÇÃO DE MÚLTIPLAS LOJAS POR PRODUTO
  const handleAddStoreToItem = (itemIndex: number) => {
    setItens((prev) => {
      const updated = [...prev];
      const currentItem = updated[itemIndex];
      const currentLojas = currentItem.lojas || [];
      const newStore: RankingStoreOffer = {
        id: `store-${Date.now()}-${currentLojas.length + 1}`,
        nomeLoja: '',
        preco: 0,
        url: '',
        cupom: '',
        destaque: false,
      };
      const updatedLojas = [...currentLojas, newStore];
      updated[itemIndex] = {
        ...currentItem,
        lojas: updatedLojas,
        linkLoja1: {
          nomeLoja: updatedLojas[0]?.nomeLoja || '',
          preco: updatedLojas[0]?.preco || 0,
          url: updatedLojas[0]?.url || '',
        },
      };
      return updated;
    });
  };

  const handleRemoveStoreFromItem = (itemIndex: number, storeIndex: number) => {
    setItens((prev) => {
      const updated = [...prev];
      const currentItem = updated[itemIndex];
      const currentLojas = currentItem.lojas || [];
      if (currentLojas.length <= 1) {
        alert('Cada produto precisa ter pelo menos 1 loja cadastrada.');
        return prev;
      }
      const updatedLojas = currentLojas.filter((_, idx) => idx !== storeIndex);
      updated[itemIndex] = {
        ...currentItem,
        lojas: updatedLojas,
        linkLoja1: {
          nomeLoja: updatedLojas[0]?.nomeLoja || '',
          preco: updatedLojas[0]?.preco || 0,
          url: updatedLojas[0]?.url || '',
        },
      };
      return updated;
    });
  };

  const handleStoreFieldChange = (
    itemIndex: number,
    storeIndex: number,
    field: keyof RankingStoreOffer,
    value: any
  ) => {
    setItens((prev) => {
      const updated = [...prev];
      const currentItem = updated[itemIndex];
      const currentLojas = [...(currentItem.lojas || [])];
      currentLojas[storeIndex] = {
        ...currentLojas[storeIndex],
        [field]: value,
      };
      updated[itemIndex] = {
        ...currentItem,
        lojas: currentLojas,
        linkLoja1: {
          nomeLoja: currentLojas[0]?.nomeLoja || '',
          preco: currentLojas[0]?.preco || 0,
          url: currentLojas[0]?.url || '',
        },
      };
      return updated;
    });
  };

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!titulo.trim()) {
      setErrorMessage('Por favor, informe o título do ranking.');
      return;
    }

    if (itens.length < 3) {
      setErrorMessage('O ranking precisa conter no mínimo 3 itens.');
      return;
    }

    // Verificar se todos os itens têm nome
    const emptyTitle = itens.some((it) => !it.tituloItem.trim());
    if (emptyTitle) {
      setErrorMessage('Todos os itens do ranking precisam ter o nome/modelo preenchido.');
      return;
    }

    // Se a ação for publicar, abre confirmação
    setIsConfirmPublishModalOpen(true);
  };

  const handleSaveRanking = async (shouldPublish: boolean) => {
    if (!titulo.trim()) {
      setErrorMessage('O título do ranking é obrigatório.');
      return;
    }

    if (itens.length < 3) {
      setErrorMessage('O ranking precisa conter no mínimo 3 itens.');
      return;
    }

    const emptyTitle = itens.some((it) => !it.tituloItem.trim());
    if (emptyTitle) {
      setErrorMessage('Todos os itens do ranking precisam ter o nome/modelo preenchido.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setIsConfirmPublishModalOpen(false);

    try {
      const slug = initialData?.slug || slugify(titulo);
      
      // Normalizar lojas e sanitizar imagens em todos os itens antes de salvar
      const cleanItens: RankingItem[] = itens.map((it, idx) => {
        const lojasItem = (it.lojas && it.lojas.length > 0) ? it.lojas : normalizeItemLojas(it, idx);
        return {
          ...it,
          imagemUrl: it.imagemUrl ? cleanImageUrl(it.imagemUrl) : '',
          lojas: lojasItem,
          linkLoja1: {
            nomeLoja: lojasItem[0]?.nomeLoja || 'Loja Principal',
            preco: lojasItem[0]?.preco || 0,
            url: lojasItem[0]?.url || '',
          },
          linkLoja2: lojasItem[1]
            ? {
                nomeLoja: lojasItem[1].nomeLoja,
                preco: lojasItem[1].preco || 0,
                url: lojasItem[1].url || '',
              }
            : undefined,
        };
      });

      const rankingDoc: TopRanking = {
        id: initialData?.id || `rank-${Date.now()}`,
        slug,
        titulo: titulo.trim(),
        subtitulo: subtitulo.trim(),
        tipoRanking: cleanItens.length <= 3 ? 'top3' : cleanItens.length <= 5 ? 'top5' : cleanItens.length <= 10 ? 'top10' : 'custom',
        categoria,
        quantidadeItens: cleanItens.length,
        criterioAvaliacao: criterioAvaliacao.trim(),
        itens: cleanItens,
        conclusaoGeral: conclusaoGeral.trim(),
        dataAtualizacao: new Date().toISOString().split('T')[0],
        autor: 'Equipe TuaVia',
        publicado: shouldPublish,
      };

      setPublicado(shouldPublish);

      const saved = await crud.save(rankingDoc);
      if (!saved) {
        // Não navega: a falha precisa ficar visível, e o local intacto.
        setErrorMessage(crud.error || 'Não foi possível salvar o ranking.');
        return;
      }

      // O servidor devolve os itens com os slugs de e-bike vinculados.
      if (savedByServer?.itens?.length) setItens(savedByServer.itens);

      // Espelho local, agora como reflexo do que o servidor aceitou.
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(RANKING_STORAGE_KEY);
          const list: TopRanking[] = raw ? JSON.parse(raw) : [];
          const filtered = list.filter((r) => r.slug !== slug);
          localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify([rankingDoc, ...filtered]));
        } catch (lErr) {
          console.warn('Ranking salvo no servidor, mas o cache local não foi atualizado:', lErr);
        }
      }

      router.push('/admin/rankings');
    } catch (err: any) {
      console.error('Erro ao salvar ranking:', err);
      setErrorMessage(err.message || 'Falha ao salvar ranking.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileIngestionExtracted = (data: any, images?: ExtractedImageFile[]) => {
    if (!data || typeof data !== 'object') return;
    if (data.titulo) setTitulo(data.titulo);
    if (data.subtitulo) setSubtitulo(data.subtitulo);
    if (data.descricao && !data.subtitulo) setSubtitulo(data.descricao);
    if (data.conclusaoGeral) setConclusaoGeral(data.conclusaoGeral);
    if (data.categoria) setCategoria(data.categoria);
    if (Array.isArray(data.itens) && data.itens.length > 0) {
      const formattedItens: RankingItem[] = data.itens.map((it: any, idx: number) => {
        const itemLojas =
          Array.isArray(it.lojas) && it.lojas.length > 0
            ? it.lojas.map((l: any, lIdx: number) => ({
                id: `store-${Date.now()}-${idx}-${lIdx}`,
                nomeLoja: l.nomeLoja || 'Loja Parceira',
                preco: Number(l.preco) || 0,
                url: l.url || '',
                cupom: l.cupom || '',
                destaque: Boolean(l.destaque),
              }))
            : [
                {
                  id: `store-${Date.now()}-${idx}-1`,
                  nomeLoja: it.linkLoja1?.nomeLoja || 'Loja Principal',
                  preco: Number(it.linkLoja1?.preco || it.precoMedio) || 0,
                  url: it.linkLoja1?.url || '',
                  cupom: '',
                  destaque: true,
                },
              ];

        return {
          id: it.id || `item-${Date.now()}-${idx}`,
          posicao: it.posicao || idx + 1,
          tituloItem: it.tituloItem || it.nome || `Item ${idx + 1}`,
          marca: it.marca || '',
          modelo: it.modelo || '',
          seloDestaque: it.seloDestaque || '',
          resumo: it.resumo || '',
          notaGeral: Number(it.notaGeral) || 9.0,
          precoMedio: Number(it.precoMedio) || itemLojas[0]?.preco || 0,
          imagemUrl: it.imagemUrl || (images && images[idx] ? images[idx].dataUri : ''),
          pros: Array.isArray(it.pros) ? it.pros : [],
          cons: Array.isArray(it.cons) ? it.cons : [],
          especificacoes:
            typeof it.especificacoes === 'object' && it.especificacoes !== null
              ? it.especificacoes
              : {},
          lojas: itemLojas,
          linkLoja1: {
            nomeLoja: itemLojas[0]?.nomeLoja || 'Loja Principal',
            preco: itemLojas[0]?.preco || 0,
            url: itemLojas[0]?.url || '',
          },
        };
      });

      setItens(formattedItens);
      setQuantidadeDesejada(formattedItens.length);
    }
    setAiSuccessMessage('Ficha do Top Ranking importada com sucesso via arquivo!');
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex border-2 border-stone-900 rounded-xl p-1 bg-stone-100 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'editor'
              ? 'bg-white text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] border border-stone-900'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Editor</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-white text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] border border-stone-900'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Matrix Editor</span>
        </button>
      </div>

      {/* INGESTÃO VIA ARQUIVOS (.MD, .YAML, .TXT, .ZIP) — extração local, sem IA */}
      <FileIngestionDropzone
        mode="ranking"
        onDataExtracted={handleFileIngestionExtracted}
      />

      {aiSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-700 rounded-xl text-emerald-950 font-bold text-xs flex items-center gap-2.5 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{aiSuccessMessage}</span>
        </div>
      )}

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border-2 border-rose-900 rounded-xl flex items-center gap-3 text-rose-950 text-xs font-bold shadow-[3px_3px_0px_0px_rgba(159,18,57,1)] animate-shake">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* BLOCO 1: CABEÇALHO DO RANKING */}
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-5">
        <div className="border-b-2 border-stone-100 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-black text-stone-900">Dados do Guia Comparativo</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              publicado
                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                : 'bg-amber-100 border-amber-300 text-amber-900'
            }`}>
              {publicado ? 'Publicado' : 'Rascunho'}
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-stone-400 uppercase">
            {itens.length} Produtos no Pódio
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase text-stone-800 mb-1">
              Título do Ranking <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Top 5 Melhores Baterias de Lítio para E-Bike em 2026: Células, Vida Útil e Preço"
              className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-sm font-bold text-stone-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-stone-800 mb-1">
              Subtítulo / Lead Explicativo
            </label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Ex: Avaliamos densidade energética, procedência das células (Samsung vs LG) e facilidade de instalação."
              className="w-full px-4 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-stone-800 mb-1">
              Critério Técnico de Avaliação
            </label>
            <textarea
              rows={2}
              value={criterioAvaliacao}
              onChange={(e) => setCriterioAvaliacao(e.target.value)}
              placeholder="Como nossa equipe testou e ranqueou as posições..."
              className="w-full px-4 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* BLOCO 2: LISTA DE ITENS DO RANKING (1º AO ÚLTIMO) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-stone-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Posições do Ranking ({itens.length} Itens)
            </h3>
            <p className="text-xs text-stone-500 font-medium">
              Ajuste as posições, fotos e links com múltiplas lojas para cada produto.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(245,158,11,1)]"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Adicionar Posição #{itens.length + 1}</span>
          </button>
        </div>

        {itens.map((item, index) => (
          <div
            key={item.id || index}
            className="bg-white border-2 border-stone-900 rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(28,25,23,1)] space-y-5 relative"
          >
            {/* Cabeçalho do Card da Posição */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-stone-100 pb-3">
              <div className="flex items-center gap-3">
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] ${
                    index === 0
                      ? 'bg-amber-400 text-stone-950'
                      : index === 1
                      ? 'bg-stone-200 text-stone-900'
                      : index === 2
                      ? 'bg-amber-700 text-white'
                      : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  #{item.posicao}
                </span>
                <div>
                  <h4 className="font-black text-stone-900 text-sm sm:text-base">
                    {item.tituloItem || `Produto na Posição #${item.posicao}`}
                  </h4>
                  <span className="text-[11px] font-bold text-amber-600 uppercase">
                    {item.notaDestaque || 'Destaque'}
                  </span>
                </div>
              </div>

              {/* Botões de Reordenação e Remoção */}
              <div className="flex flex-wrap items-center gap-2">
                {item.bikeSlug ? (
                  <span className="px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-[10px] font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Vinculada ao Catálogo: /{item.bikeSlug}</span>
                  </span>
                ) : null}

                {/* Botão Puxar E-Bike do Catálogo */}
                <button
                  type="button"
                  onClick={() => openCatalogPicker(index)}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 border border-stone-900 rounded-lg text-[11px] font-black text-stone-900 flex items-center gap-1 shadow-[1px_1px_0px_0px_rgba(28,25,23,1)] transition-all cursor-pointer"
                  title="Puxar dados de uma E-Bike já cadastrada no catálogo"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-700" />
                  <span>Puxar E-Bike do Catálogo</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveItem(index, 'up')}
                    disabled={index === 0}
                    title="Subir posição"
                    className="p-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-900 rounded-lg disabled:opacity-30 cursor-pointer"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveItem(index, 'down')}
                    disabled={index === itens.length - 1}
                    title="Descer posição"
                    className="p-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-900 rounded-lg disabled:opacity-30 cursor-pointer"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  {itens.length > 3 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      title="Remover posição"
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-900 text-rose-600 rounded-lg cursor-pointer ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Grid com Campos Principais do Item */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Nome do Produto */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black uppercase text-stone-800 mb-1">
                  Nome do Modelo / Produto <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bateria Lítio 48V 15Ah Hailong com Células Samsung"
                  value={item.tituloItem}
                  onChange={(e) => handleItemChange(index, 'tituloItem', e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
                />
              </div>

              {/* Marca */}
              <div>
                <label className="block text-[11px] font-black uppercase text-stone-800 mb-1">
                  Marca / Fabricante
                </label>
                <input
                  type="text"
                  placeholder="Ex: Hailong, Caloi, Shimano"
                  value={item.marca}
                  onChange={(e) => handleItemChange(index, 'marca', e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
                />
              </div>

              {/* Selo / Nota de Destaque */}
              <div>
                <label className="block text-[11px] font-black uppercase text-stone-800 mb-1">
                  Selo de Destaque
                </label>
                <input
                  type="text"
                  placeholder="Ex: Campeã Geral, Melhor Custo-Benefício"
                  value={item.notaDestaque}
                  onChange={(e) => handleItemChange(index, 'notaDestaque', e.target.value)}
                  className="w-full px-3 py-2 bg-amber-50 border-2 border-stone-900 rounded-lg text-xs font-black text-amber-900"
                />
              </div>

              {/* Subcategoria */}
              <div>
                <label className="block text-[11px] font-black uppercase text-stone-800 mb-1">
                  Subcategoria
                </label>
                <input
                  type="text"
                  placeholder="Ex: Bateria Tipo Garrafa, E-Bike Urbana"
                  value={item.categoriaItem}
                  onChange={(e) => handleItemChange(index, 'categoriaItem', e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
                />
              </div>

              {/* Faixa de Preço */}
              <div>
                <label className="block text-[11px] font-black uppercase text-stone-800 mb-1">
                  Preço Médio Estimado
                </label>
                <input
                  type="text"
                  placeholder="Ex: R$ 2.100 - R$ 2.600"
                  value={item.faixaPrecoEstimado}
                  onChange={(e) => handleItemChange(index, 'faixaPrecoEstimado', e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-mono font-bold text-stone-900"
                />
              </div>
            </div>

            {/* Imagem do Item (Upload ou URL) */}
            <div className="pt-2">
              <ImageUploadField
                label={`Foto do Produto #${item.posicao}`}
                value={item.imagemUrl}
                onChange={(url) => handleItemChange(index, 'imagemUrl', url)}
                folder="rankings"
                presetType="bikes"
                aspectRatio="square"
                searchQueryHint={`${item.marca ? item.marca + ' ' : ''}${item.tituloItem}`.trim() || titulo}
                contextHint={`Item #${item.posicao} do Guia Comparativo "${titulo}": ${item.tituloItem} (${item.categoriaItem || 'Mobilidade Elétrica'})`}
                helpText="Envie foto oficial, busque na Web com validação por LLM ou selecione da galeria."
              />
            </div>

            {/* Pontos Positivos e Negativos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-black uppercase text-emerald-800 mb-1">
                  ✓ Pontos Positivos (1 por linha)
                </label>
                <textarea
                  rows={2}
                  value={item.pontosPositivos.join('\n')}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      'pontosPositivos',
                      e.target.value.split('\n').filter((l) => l.trim() !== '')
                    )
                  }
                  placeholder="Ex: Células originais Samsung&#10;BMS com proteção térmica"
                  className="w-full p-2.5 bg-emerald-50/50 border-2 border-emerald-800 rounded-lg text-xs font-medium text-emerald-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-rose-800 mb-1">
                  ✗ Pontos de Atenção / Negativos
                </label>
                <textarea
                  rows={2}
                  value={item.pontosNegativos.join('\n')}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      'pontosNegativos',
                      e.target.value.split('\n').filter((l) => l.trim() !== '')
                    )
                  }
                  placeholder="Ex: Não acompanha carregador rápido&#10;Peso ligeiramente superior"
                  className="w-full p-2.5 bg-rose-50/50 border-2 border-rose-800 rounded-lg text-xs font-medium text-rose-950"
                />
              </div>
            </div>

            {/* MÚLTIPLAS LOJAS E LINKS DE COMPRA (GRIDS EXPANSÍVEIS COM BOTÃO + ADICIONAR LOJA) */}
            <div className="p-4 sm:p-5 bg-stone-50 border-2 border-stone-900 rounded-xl space-y-4 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2.5">
                <div>
                  <span className="text-xs font-black uppercase text-stone-900 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-amber-600" />
                    Onde Comprar & Lojas Parceiras ({item.lojas?.length || 1})
                  </span>
                  <p className="text-[11px] text-stone-500 font-medium">
                    Adicione múltiplos grids de lojas com links de afiliados, preços e cupons.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddStoreToItem(index)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-black text-[11px] rounded-lg border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] flex items-center gap-1.5 cursor-pointer w-fit"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-stone-950" />
                  <span>+ Adicionar Outra Loja</span>
                </button>
              </div>

              {/* Lista de Grids de Lojas */}
              <div className="space-y-3">
                {(item.lojas || []).map((store, storeIdx) => (
                  <div
                    key={store.id || storeIdx}
                    className="p-3.5 bg-white border-2 border-stone-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] space-y-2 relative"
                  >
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase bg-stone-900 text-amber-300 px-2 py-0.5 rounded">
                          Loja #{storeIdx + 1}
                        </span>
                        {store.destaque && (
                          <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                            Loja Principal / Destaque
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] font-bold text-stone-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!store.destaque}
                            onChange={(e) =>
                              handleStoreFieldChange(index, storeIdx, 'destaque', e.target.checked)
                            }
                            className="rounded border-stone-400 text-amber-600 focus:ring-amber-500"
                          />
                          <span>Destaque</span>
                        </label>

                        {(item.lojas || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStoreFromItem(index, storeIdx)}
                            title="Remover esta loja"
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                      {/* Nome da Loja */}
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-black uppercase text-stone-700 mb-0.5">
                          Nome da Loja <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Mercado Livre, Amazon, Shopee..."
                          value={store.nomeLoja}
                          onChange={(e) =>
                            handleStoreFieldChange(index, storeIdx, 'nomeLoja', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-900 rounded-lg text-xs font-bold text-stone-900"
                        />
                      </div>

                      {/* Preço (R$) */}
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-black uppercase text-stone-700 mb-0.5">
                          Preço nesta Loja (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 1999.90"
                          value={store.preco || ''}
                          onChange={(e) =>
                            handleStoreFieldChange(
                              index,
                              storeIdx,
                              'preco',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-900 rounded-lg text-xs font-mono font-bold text-stone-900"
                        />
                      </div>

                      {/* Link de Afiliado / Produto */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black uppercase text-stone-700 mb-0.5">
                          Link da Loja / Afiliado
                        </label>
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="url"
                            placeholder="https://..."
                            value={store.url}
                            onChange={(e) =>
                              handleStoreFieldChange(index, storeIdx, 'url', e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-900 rounded-lg text-xs font-mono font-bold text-stone-900"
                          />
                          {store.url && (
                            <a
                              href={store.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-900 rounded-lg text-stone-700 shrink-0"
                              title="Testar Link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Linha extra para Cupom Opcional */}
                    <div className="pt-1 flex items-center gap-2">
                      <div className="w-full sm:w-1/2">
                        <label className="block text-[9px] font-bold uppercase text-stone-500 mb-0.5">
                          Cupom de Desconto (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: PROMO10, TUAVIA5"
                          value={store.cupom || ''}
                          onChange={(e) =>
                            handleStoreFieldChange(index, storeIdx, 'cupom', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-stone-50 border border-stone-300 rounded text-[11px] font-mono font-bold text-stone-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão Inferior de Adicionar Outra Loja */}
              <button
                type="button"
                onClick={() => handleAddStoreToItem(index)}
                className="w-full py-2 bg-stone-100 hover:bg-stone-200 border border-dashed border-stone-900 rounded-xl text-stone-900 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-stone-900" />
                <span>Adicionar Mais uma Opção de Loja para este Item</span>
              </button>
            </div>

            {/* ANÁLISE COMPARATIVA ESPECÍFICA DO RANKING (OBSERVAÇÕES) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-black uppercase text-amber-900 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Análise Crítica & Comparativo no Ranking (Exclusivo deste Ranking)
                </label>
                <span className="text-[10px] text-stone-400 font-medium">
                  Este texto detalhado aparece no Top Ranking e não contamina o catálogo individual.
                </span>
              </div>
              <textarea
                rows={3}
                value={item.observacoes || ''}
                onChange={(e) => handleItemChange(index, 'observacoes', e.target.value)}
                placeholder="Texto aprofundado detalhando por que esta e-bike conquistou esta posição, desempenho prático e comparativo direto com os outros modelos do pódio..."
                className="w-full p-3 bg-amber-50/40 border-2 border-amber-900/60 rounded-xl text-xs font-medium text-stone-900 leading-relaxed placeholder-stone-400"
              />
            </div>
          </div>
        ))}
      </div>

      {/* BLOCO 3: CONCLUSÃO DO GUIA */}
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Veredito & Conclusão do Especialista
          </h3>
        </div>
        <textarea
          rows={3}
          value={conclusaoGeral}
          onChange={(e) => setConclusaoGeral(e.target.value)}
          placeholder="Resumo final orientando qual produto escolher de acordo com a necessidade do ciclista..."
          className="w-full p-4 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 leading-relaxed"
        />
      </div>

      {/* Ações Inferiores de Envio */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-stone-100">
        <button
          type="button"
          onClick={() => router.push('/admin/rankings')}
          className="w-full sm:w-auto px-5 py-3 bg-white border-2 border-stone-900 text-stone-900 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-stone-50 cursor-pointer shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Rankings</span>
        </button>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
          {/* Botão Salvar como Rascunho */}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveRanking(false)}
            className="w-full sm:w-auto px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-900 font-black rounded-xl text-xs border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            title="Salva o ranking sem publicar nem cadastrar as e-bikes no catálogo público"
          >
            <FileText className="w-4 h-4 text-stone-700" />
            <span>Salvar como Rascunho</span>
          </button>

          {/* Botão Publicar Top Ranking */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-8 py-3.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl text-sm border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                <span>Processando e Sincronizando...</span>
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5 text-stone-950" />
                <span>{isEditing && initialData?.publicado ? 'Atualizar & Sincronizar' : 'Publicar Top Ranking'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'editor' && (
        <>
        {/* MODAL DE CONFIRMAÇÃO DE PUBLICAÇÃO DO RANKING */}
        {isConfirmPublishModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-stone-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] animate-fadeIn">
            <div className="flex items-center gap-3 border-b-2 border-stone-100 pb-4">
              <div className="p-3 bg-amber-400 border-2 border-stone-900 rounded-2xl shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
                <Trophy className="w-6 h-6 text-stone-950" />
              </div>
              <div>
                <h3 className="text-lg font-black text-stone-900">
                  Confirmar Publicação do Top Ranking
                </h3>
                <p className="text-xs text-stone-500 font-bold">
                  Sincronização com Catálogo & Comparador
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2 text-xs text-stone-800 leading-relaxed font-medium">
              <p className="font-black text-amber-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Regra de Publicação Ativa:
              </p>
              <p>
                Ao confirmar, este Top Ranking ficará visível publicamente no TuaVia e <strong>todas as e-bikes ranqueadas serão cadastradas e sincronizadas individualmente no catálogo de e-bikes</strong> (/ebikes).
              </p>
              <p className="text-[11px] text-stone-600">
                Isso permitirá que os usuários comparem qualquer um dos modelos com outras e-bikes do sistema e acessem suas páginas completas.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmPublishModalOpen(false)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs border border-stone-400 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveRanking(true)}
                className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-amber-300 font-black rounded-xl text-xs border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] cursor-pointer disabled:opacity-60 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Confirmar e Publicar Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* MODAL PARA PUXAR E-BIKE DO CATÁLOGO EXISTENTE */}
        {isCatalogPickerOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-stone-900 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] animate-fadeIn overflow-hidden">
            {/* Cabeçalho do Modal */}
            <div className="p-5 border-b-2 border-stone-100 flex items-center justify-between gap-3 bg-stone-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400 border border-stone-900 rounded-xl">
                  <Layers className="w-5 h-5 text-stone-950" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">
                    Puxar E-Bike do Catálogo para a Posição #{catalogTargetItemIndex !== null ? catalogTargetItemIndex + 1 : ''}
                  </h3>
                  <p className="text-[11px] text-stone-500 font-bold">
                    Selecione um modelo já cadastrado para importar especificações, fotos e ofertas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCatalogPickerOpen(false)}
                className="p-2 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campo de Busca */}
            <div className="p-4 border-b border-stone-200 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar por nome, marca ou categoria (ex: Caloi, Sense, Oggi, Urbana)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border-2 border-stone-300 focus:border-stone-900 rounded-xl text-xs font-bold text-stone-900 outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista de E-Bikes */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {isCatalogLoading ? (
                <div className="py-12 text-center text-xs font-bold text-stone-500 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
                  <p>Carregando catálogo de e-bikes...</p>
                </div>
              ) : (
                (() => {
                  const filtered = catalogBikes.filter((b) => {
                    const q = catalogSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      b.nome?.toLowerCase().includes(q) ||
                      b.marca?.toLowerCase().includes(q) ||
                      b.categoria?.toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center text-xs font-bold text-stone-500">
                        Nenhuma e-bike encontrada no catálogo com o termo &quot;{catalogSearch}&quot;.
                      </div>
                    );
                  }

                  return filtered.map((bike) => {
                    const bikeImg = bike.imagemCard || bike.imagens?.[0];
                    const lowest = bike.menorPreco || 0;

                    return (
                      <div
                        key={bike.slug || bike.id}
                        onClick={() => handleSelectBikeFromCatalog(bike)}
                        className="p-3.5 bg-stone-50 hover:bg-amber-50/70 border-2 border-stone-200 hover:border-stone-900 rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {bikeImg ? (
                            <div className="relative w-14 h-14 rounded-xl border border-stone-300 bg-white shrink-0 overflow-hidden">
                              <SafeImage
                                src={bikeImg}
                                alt={bike.nome || 'E-Bike'}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 bg-stone-200 rounded-xl flex items-center justify-center font-bold text-xs text-stone-500 shrink-0">
                              Sem foto
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.2 rounded">
                                {bike.marca || 'Marca'}
                              </span>
                              {bike.categoria && (
                                <span className="text-[10px] font-bold text-stone-500">
                                  • {bike.categoria}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs sm:text-sm font-black text-stone-900 truncate mt-0.5 group-hover:text-amber-950">
                              {bike.nome}
                            </h4>
                            <div className="flex items-center gap-3 text-[11px] text-stone-600 font-medium mt-0.5">
                              {lowest > 0 && (
                                <span className="font-bold text-emerald-700">
                                  R$ {lowest.toLocaleString('pt-BR')}
                                </span>
                              )}
                              {bike.motor?.potenciaW && (
                                <span>{bike.motor.potenciaW}W</span>
                              )}
                              {bike.bateria?.autonomiaKm && (
                                <span>{bike.bateria.autonomiaKm}km aut.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="px-3 py-1.5 bg-stone-900 group-hover:bg-amber-400 text-white group-hover:text-stone-950 font-black rounded-xl text-xs shrink-0 transition-colors"
                        >
                          Vincular
                        </button>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-[11px] font-bold text-stone-500 px-5">
              <span>{catalogBikes.length} e-bikes cadastradas no TuaVia</span>
              <button
                type="button"
                onClick={() => setIsCatalogPickerOpen(false)}
                className="hover:text-stone-900 underline cursor-pointer"
              >
                Fechar
              </button>
            </div>
</div>
        </div>
      )}

    </>

  )}

    </form>
  );
}
