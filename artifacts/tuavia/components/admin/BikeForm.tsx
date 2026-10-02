'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { generateSlug, PUBLISHED_BIKES_STORAGE_KEY } from '@/lib/ebikes';
import { EBikeGrouped, EBikeStoreOffer, EBikeCategory, EBikeSpecSection, EBikeSEOReport, EBikePriceHistoryPoint } from '@/types/ebike';
import { generateRealisticPriceHistory, sanitizePriceHistory, getLastNMonths } from '@/lib/priceHistory';
import PriceHistoryChart from '@/components/detail/PriceHistoryChart';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { GalleryImagesField } from '@/components/admin/GalleryImagesField';
import BikeReviewsManager from '@/components/admin/BikeReviewsManager';
import FileIngestionDropzone from '@/components/admin/FileIngestionDropzone';
import { ExtractedImageFile } from '@/lib/admin/fileIngestion';
import { compressDataUrlForFirestore } from '@/lib/storage';
import { uploadMediaOrKeep as uploadBase64ToCentralMedia } from '@/lib/media/upload';
import { fetchAdminJson } from '@/lib/apiResponse';
import { sanitizeInputString } from '@/lib/security';
import { allocateAndNormalizeSpecSections } from '@/lib/specAllocations';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  Bike,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Store,
  DollarSign,
  Link as LinkIcon,
  ArrowLeft,
  Sparkles,
  Zap,
  Check,
  Info,
  Search,
  Globe,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  Layers,
  Eye,
  EyeOff,
  Tag,
  HelpCircle,
  Smartphone,
  Monitor,
  Copy,
  Edit3,
  ShieldCheck,
  Zap as ZapIcon,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const CATEGORIES: EBikeCategory[] = ['Urbana', 'Trilha/MTB', 'Dobrável', 'Cargo', 'Speed'];

interface BikeFormProps {
  initialData?: EBikeGrouped | null;
  isEditing?: boolean;
}

export default function BikeForm({ initialData, isEditing = false }: BikeFormProps) {
  const router = useRouter();

  // Flag para rastrear se os dados já foram carregados via Ingestão de Arquivos / Cache para não ser sobrescrito pelo useEffect
  const hasExtractedFromFilesRef = useRef<boolean>(false);

  // Campos básicos do modelo
  const [modelo, setModelo] = useState(initialData?.modelo || '');
  const [marca, setMarca] = useState(initialData?.marca || '');
  const [usoPrincipal, setUsoPrincipal] = useState<EBikeCategory>(
    (initialData?.usoPrincipal as EBikeCategory) || 'Urbana'
  );
  const [autonomiaKm, setAutonomiaKm] = useState<string>(
    initialData?.autonomiaKm !== undefined && initialData?.autonomiaKm !== null
      ? String(initialData.autonomiaKm)
      : ''
  );
  const [potenciaW, setPotenciaW] = useState<string>(
    initialData?.potenciaW !== undefined && initialData?.potenciaW !== null
      ? String(initialData.potenciaW)
      : ''
  );
  const [pesoKg, setPesoKg] = useState<string>(
    initialData?.pesoKg !== undefined && initialData?.pesoKg !== null
      ? String(initialData.pesoKg)
      : ''
  );
  const [tempoCargaHoras, setTempoCargaHoras] = useState<string>(
    initialData?.tempoCargaHoras !== undefined && initialData?.tempoCargaHoras !== null
      ? String(initialData.tempoCargaHoras)
      : ''
  );

  // Imagem
  const [imagemUrl, setImagemUrl] = useState<string>(initialData?.imagemUrl || '');
  const [galleryImages, setGalleryImages] = useState<string[]>(initialData?.galleryImages || []);

  // Especificações Detalhadas (Ficha Técnica / Veredito)
  const [resumoExecutivo, setResumoExecutivo] = useState(
    initialData?.resumoExecutivo || initialData?.verdict || ''
  );
  const [idealFor, setIdealFor] = useState(initialData?.idealFor || '');
  const [badge, setBadge] = useState(initialData?.badge || '');
  const [pros, setPros] = useState<string[]>(
    initialData?.pros || []
  );
  const [cons, setCons] = useState<string[]>(
    initialData?.cons || []
  );
  const [specSections, setSpecSections] = useState<EBikeSpecSection[]>(
    initialData?.specSections || [
      {
        title: '1. Resumo Rápido & Destaques',
        items: [
          { label: 'Uso Indicado', value: '' },
          { label: 'Potência Nominal', value: '' },
          { label: 'Autonomia Estimada', value: '' },
          { label: 'Velocidade Máxima', value: '' },
          { label: 'Peso Total', value: '' },
          { label: 'Capacidade Máxima', value: '' },
        ],
      },
      {
        title: '2. Desempenho & Propulsão',
        items: [
          { label: 'Tipo de Motor', value: '' },
          { label: 'Potência de Pico', value: '' },
          { label: 'Torque Máximo', value: '' },
          { label: 'Níveis de Assistência', value: '' },
          { label: 'Sensor de Pedalada', value: '' },
          { label: 'Acelerador', value: '' },
        ],
      },
      {
        title: '3. Bateria & Energia',
        items: [
          { label: 'Capacidade Total', value: '' },
          { label: 'Tensão & Amperagem', value: '' },
          { label: 'Química da Bateria', value: '' },
          { label: 'Removível', value: '' },
          { label: 'Tempo de Recarga', value: '' },
          { label: 'Carregador', value: '' },
        ],
      },
      {
        title: '4. Conforto & Ergonomia',
        items: [
          { label: 'Material do Quadro', value: '' },
          { label: 'Tamanho do Quadro', value: '' },
          { label: 'Suspensão Dianteira', value: '' },
          { label: 'Suspensão Traseira', value: '' },
          { label: 'Ajuste de Guidão', value: '' },
          { label: 'Selim & Canote', value: '' },
        ],
      },
      {
        title: '5. Segurança & Frenagem',
        items: [
          { label: 'Freio Dianteiro', value: '' },
          { label: 'Freio Traseiro', value: '' },
          { label: 'Corte de Motor nos Freios', value: '' },
          { label: 'Iluminação Dianteira', value: '' },
          { label: 'Iluminação Traseira', value: '' },
          { label: 'Refletores & Buzina', value: '' },
        ],
      },
      {
        title: '6. Transmissão & Ciclística',
        items: [
          { label: 'Câmbio Traseiro', value: '' },
          { label: 'Número de Marchas', value: '' },
          { label: 'Passadores / Trocadores', value: '' },
          { label: 'Corrente & Pedivela', value: '' },
          { label: 'Pedais', value: '' },
        ],
      },
      {
        title: '7. Dimensões, Rodas & Pneus',
        items: [
          { label: 'Aro / Rodas', value: '' },
          { label: 'Medida dos Pneus', value: '' },
          { label: 'Tipo de Pneu', value: '' },
          { label: 'Dobrável', value: '' },
          { label: 'Dimensões (CxLxA)', value: '' },
          { label: 'Dimensões Dobrada', value: '' },
        ],
      },
      {
        title: '8. Equipamentos & Conectividade',
        items: [
          { label: 'Painel / Display', value: '' },
          { label: 'Entrada USB', value: '' },
          { label: 'Aplicativo / Bluetooth', value: '' },
          { label: 'Bagageiro / Rack', value: '' },
          { label: 'Paralamas & Cavalete', value: '' },
        ],
      },
      {
        title: '9. Compatibilidade & Manutenção',
        items: [
          { label: 'Bateria Reposição / Padrão', value: '' },
          { label: 'Padrão de Peças Ciclísticas', value: '' },
          { label: 'Resistência à Água', value: '' },
          { label: 'Garantia de Fábrica', value: '' },
          { label: 'Manual & Suporte Nacional', value: '' },
        ],
      },
      {
        title: '10. Auditoria de Fontes & Dados',
        items: [
          { label: 'Enquadramento CONTRAN', value: '' },
          { label: 'Fonte Oficial dos Dados', value: '' },
          { label: 'Status da Ficha Técnica', value: '' },
          { label: 'Última Revisão Técnica', value: '' },
        ],
      },
    ]
  );

  // Ofertas das lojas
  const [emOfertaEspecial, setEmOfertaEspecial] = useState<boolean>(
    initialData?.emOfertaEspecial || false
  );
  const [precoDe, setPrecoDe] = useState<string>(
    initialData?.precoDe ? String(initialData.precoDe) : ''
  );
  const [tagOferta, setTagOferta] = useState<string>(
    initialData?.tagOferta || '⚡ Oferta Especial 2026'
  );

  const [ofertas, setOfertas] = useState<EBikeStoreOffer[]>(
    initialData?.ofertas && initialData.ofertas.length > 0
      ? initialData.ofertas
      : [
          {
            id: 1,
            loja: '',
            preco: 0,
            precoDe: undefined,
            cupomDesconto: '',
            destaqueOferta: '',
            linkProduto: '',
            disponibilidade: 'Em estoque',
            dataAtualizacao: new Date().toISOString().split('T')[0],
            observacoes: '',
          },
        ]
  );

  // Histórico de Preços dos Últimos 6 Meses (Gráfico Interativo)
  const [priceHistory, setPriceHistory] = useState<EBikePriceHistoryPoint[]>(() => {
    if (initialData?.priceHistory && initialData.priceHistory.length > 0) {
      return sanitizePriceHistory(initialData.priceHistory, initialData.menorPreco);
    }
    if (initialData?.menorPreco && initialData.menorPreco > 0) {
      return generateRealisticPriceHistory(initialData.menorPreco);
    }
    return generateRealisticPriceHistory(4500);
  });

  // Visibilidade do Gráfico de Histórico de Preços na Página do Produto
  const [showPriceChart, setShowPriceChart] = useState<boolean>(() => {
    if (initialData?.showPriceChart !== undefined) {
      return initialData.showPriceChart;
    }
    return true;
  });

  const handlePriceHistoryChange = (index: number, newPrice: number) => {
    setPriceHistory((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], price: Math.max(0, Math.round(newPrice * 100) / 100) };
      }
      return next;
    });
  };

  const handleRecalculatePriceHistory = () => {
    const validPrices = ofertas
      .map((o) => {
        const p = Number(o.preco);
        return !isNaN(p) && p > 0 ? p : null;
      })
      .filter((p): p is number => p !== null);
    const base = validPrices.length > 0 ? Math.min(...validPrices) : (Number(initialData?.menorPreco) || 4500);
    setPriceHistory(generateRealisticPriceHistory(base));
  };

  // Estado do formulário
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado do Painel de SEO de E-Bike (Google Brasil 2026)
  const [seoReport, setSeoReport] = useState<EBikeSEOReport | null>(initialData?.seoReport || null);
  const [showSeoPreview, setShowSeoPreview] = useState(true);
  const [serpDeviceMode, setSerpDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // Helper para atualizar o seoReport com sincronização imediata
  const handleUpdateSeoReport = (fields: Partial<EBikeSEOReport>) => {
    setSeoReport((prev) => {
      const baseTitle = `${marca} ${modelo}: Ficha Técnica, Autonomia e Melhores Preços 2026`.trim();
      const baseDesc = resumoExecutivo || `Confira a avaliação completa da ${marca} ${modelo} com especificações de motor ${potenciaW || '350'}W, bateria, autonomia de ${autonomiaKm || '40'}km e menores preços no TuaVia.`;
      const current: EBikeSEOReport = prev || {
        focusKeyword: `${marca} ${modelo} vale a pena 2026`.toLowerCase().trim(),
        searchIntent: 'Transacional / Comparativa',
        serpTitlePreview: baseTitle,
        serpDescriptionPreview: baseDesc,
        contranCategory: 'Bicicleta Elétrica Autopropelida (Dispensa CNH e Emplacamento - CONTRAN 996/2023)',
        secondaryKeywords: [`${marca} ${modelo} preco`, `ficha tecnica ${modelo}`, `autonomia ${modelo}`].filter(Boolean),
        optimizationTips: [
          'Mantenha os preços e ofertas de lojas atualizados para manter o Rich Snippet ativo.',
          'Verifique a exatidão das especificações de potência e autonomia.',
        ],
        targetBuyerPersona: 'Ciclistas urbanos e entusiastas de mobilidade sustentável buscando o melhor custo-benefício.',
        seoScore: 94,
        faqSchema: [
          {
            question: `Qual a autonomia da ${marca || 'bike'} ${modelo || ''}?`,
            answer: `A ${marca || 'bike'} ${modelo || ''} oferece até ${autonomiaKm || '40'} km de autonomia por recarga em condições normais de uso urbano.`,
          },
          {
            question: `A ${marca || 'bike'} ${modelo || ''} precisa de CNH ou emplacamento?`,
            answer: `De acordo com a Resolução CONTRAN 996/2023, bicicletas elétricas com pedal assistido e potência de até 1000W dispensam habilitação (CNH), emplacamento e IPVA.`,
          },
        ],
        llmGeoSummary: `A ${marca} ${modelo} é uma e-bike recomendada para mobilidade urbana, equipada com motor de ${potenciaW || '350'}W e autonomia média de ${autonomiaKm || '40'} km.`,
      };
      return { ...current, ...fields };
    });
  };

  // Buscador manual de preços reais
  const isAiLoading = isSaving;


  const handleAddSecondaryKeyword = (kw: string) => {
    const clean = kw.trim();
    if (!clean) return;
    const currentKws = seoReport?.secondaryKeywords || [];
    if (!currentKws.includes(clean)) {
      handleUpdateSeoReport({ secondaryKeywords: [...currentKws, clean] });
    }
    setNewKeywordInput('');
  };

  const handleRemoveSecondaryKeyword = (idx: number) => {
    const currentKws = seoReport?.secondaryKeywords || [];
    handleUpdateSeoReport({ secondaryKeywords: currentKws.filter((_, i) => i !== idx) });
  };

  const handleAddFaqItem = () => {
    const currentFaqs = seoReport?.faqSchema || [];
    handleUpdateSeoReport({
      faqSchema: [
        ...currentFaqs,
        {
          question: `Qual a velocidade máxima da ${marca || 'bike'} ${modelo || ''}?`,
          answer: `Atinge até 25 km/h a 32 km/h com assistência do motor elétrico, conforme a legislação brasileira.`,
        },
      ],
    });
  };

  const handleUpdateFaqItem = (index: number, question: string, answer: string) => {
    const currentFaqs = [...(seoReport?.faqSchema || [])];
    if (currentFaqs[index]) {
      currentFaqs[index] = { question, answer };
      handleUpdateSeoReport({ faqSchema: currentFaqs });
    }
  };

  const handleRemoveFaqItem = (index: number) => {
    const currentFaqs = seoReport?.faqSchema || [];
    handleUpdateSeoReport({ faqSchema: currentFaqs.filter((_, i) => i !== index) });
  };

  // Carrega rascunho de e-bike se disponível (somente se não foi preenchido por arquivo/cache)
  useEffect(() => {
    if (!initialData && !hasExtractedFromFilesRef.current && typeof window !== 'undefined') {
      try {
        const storedSession = sessionStorage.getItem('tuavia_prefill_bike');
        const storedLocal = localStorage.getItem('tuavia_prefill_bike') || localStorage.getItem('tuavia_draft_bike_audit');
        const storedStr = storedSession || storedLocal;

        if (storedStr) {
          if (hasExtractedFromFilesRef.current) return;

          const parsed = JSON.parse(storedStr);

          const brand = parsed.marca || parsed.brand || parsed.marcaFabricante || 'Não informado';
          setMarca(brand);

          const modelName = parsed.modelo || parsed.name || parsed.model || parsed.nome || '';
          if (modelName) setModelo(modelName);

          const usage = parsed.usoPrincipal || parsed.category || parsed.categoria || parsed.uso;
          if (usage && CATEGORIES.includes(usage)) {
            setUsoPrincipal(usage);
          }

          const autonomy = parsed.autonomiaKm ?? parsed.declaredAutonomyKm ?? parsed.performance?.declaredAutonomyKm ?? parsed.autonomia;
          setAutonomiaKm(autonomy !== undefined && autonomy !== null && String(autonomy).trim() !== '' ? String(autonomy) : 'Não informado');

          const power = parsed.potenciaW ?? parsed.powerW ?? parsed.motor?.powerW ?? parsed.potencia;
          setPotenciaW(power !== undefined && power !== null && String(power).trim() !== '' ? String(power) : 'Não informado');

          const weight = parsed.pesoKg ?? parsed.weightKg ?? parsed.frameAndComponents?.weightKg ?? parsed.peso;
          setPesoKg(weight !== undefined && weight !== null && String(weight).trim() !== '' ? String(weight) : 'Não informado');

          const chargeTime = parsed.tempoCargaHoras ?? parsed.chargeTimeHours ?? parsed.battery?.chargeTimeHours ?? parsed.tempoCarga;
          setTempoCargaHoras(chargeTime !== undefined && chargeTime !== null && String(chargeTime).trim() !== '' ? String(chargeTime) : 'Não informado');

          const bdg = parsed.badge || parsed.notaDestaque || 'Destaque Técnico';
          setBadge(bdg);

          const verdictText = parsed.resumoExecutivo || parsed.verdict || parsed.summary || parsed.extractionNotes || parsed.veredicto || 'Informação de veredito editorial não disponível para este modelo.';
          setResumoExecutivo(verdictText);

          const ideal = parsed.idealFor || parsed.idealPara || 'Informação não disponível para este perfil.';
          setIdealFor(ideal);

          const positives = parsed.pros || parsed.pontosPositivos;
          setPros(Array.isArray(positives) && positives.length > 0 ? positives : ['Informação de pontos fortes não disponível para este modelo']);

          const negatives = parsed.cons || parsed.pontosNegativos;
          setCons(Array.isArray(negatives) && negatives.length > 0 ? negatives : ['Informação de pontos de atenção não disponível para este modelo']);

          if (Array.isArray(parsed.specSections) && parsed.specSections.length > 0) {
            const canonicalSpecs = allocateAndNormalizeSpecSections(undefined, parsed.specSections, {
              potenciaW: power,
              autonomiaKm: autonomy,
              pesoKg: weight,
              tempoCargaHoras: chargeTime,
              usoPrincipal: usage,
              marca: brand,
              modelo: modelName,
            });
            setSpecSections(canonicalSpecs);
          }

          const coverImg = parsed.fotoCapaUrl || parsed.imagemUrl || parsed.coverImage || parsed.mainImage || parsed.imagemCapa;
          if (coverImg) setImagemUrl(coverImg);

          const gallery = parsed.galeriaFotos || parsed.galleryImages;
          if (Array.isArray(gallery) && gallery.length > 0) setGalleryImages(gallery);

          if (parsed.seoReport) {
            setSeoReport(parsed.seoReport);
            setShowSeoPreview(true);
          }

          if (Array.isArray(parsed.ofertas) && parsed.ofertas.length > 0) {
            setOfertas(parsed.ofertas);
          } else if (Array.isArray(parsed.ofertasSugestoes) && parsed.ofertasSugestoes.length > 0) {
            setOfertas(
              parsed.ofertasSugestoes.map((sug: any, idx: number) => ({
                id: idx + 1,
                loja: sug.loja || sug.nomeLoja || '',
                preco: typeof sug.preco === 'number' ? sug.preco : 0,
                linkProduto: sug.linkProduto || sug.url || '',
                disponibilidade: 'Em estoque',
                dataAtualizacao: new Date().toISOString().split('T')[0],
                observacoes: sug.observacoes || '',
              }))
            );
          }

          setSuccessMessage('Ficha técnica carregada do rascunho com sucesso!');
          sessionStorage.removeItem('tuavia_prefill_bike');
          localStorage.removeItem('tuavia_prefill_bike');
          localStorage.removeItem('tuavia_draft_bike_audit');
        }
      } catch (err) {
        console.error('Erro ao carregar pré-preenchimento da e-bike:', err);
      }
    }
  }, [initialData]);

  // Funções de manipulação das Especificações Detalhadas (Ficha Técnica)
  const handleSpecItemChange = (
    secIdx: number, 
    itemIdx: number, 
    field: 'label' | 'value' | 'confidence' | 'source', 
    val: any
  ) => {
    setSpecSections(prev => {
      const updated = [...prev];
      const sec = { ...updated[secIdx] };
      const items = [...sec.items];
      items[itemIdx] = { ...items[itemIdx], [field]: val };
      sec.items = items;
      updated[secIdx] = sec;
      return updated;
    });
  };

  const handleAddSpecItem = (secIdx: number) => {
    setSpecSections(prev => {
      const updated = [...prev];
      const sec = { ...updated[secIdx] };
      sec.items = [
        ...sec.items, 
        { 
          label: 'Nova Especificação', 
          value: '', 
          confidence: 'MEDIA', 
          source: 'Manual do Usuário' 
        }
      ];
      updated[secIdx] = sec;
      return updated;
    });
  };

  const handleRemoveSpecItem = (secIdx: number, itemIdx: number) => {
    setSpecSections(prev => {
      const updated = [...prev];
      const sec = { ...updated[secIdx] };
      sec.items = sec.items.filter((_, i) => i !== itemIdx);
      updated[secIdx] = sec;
      return updated;
    });
  };

  const handleAddSpecSection = () => {
    setSpecSections(prev => [
      ...prev,
      {
        title: 'Recursos Adicionais & Destaques',
        items: [{ label: 'Item Especial', value: '' }]
      }
    ]);
  };

  const handleRemoveSpecSection = (secIdx: number) => {
    setSpecSections(prev => prev.filter((_, i) => i !== secIdx));
  };

  const handleReauditAndSyncSpecs = () => {
    const updated = allocateAndNormalizeSpecSections(
      specSections,
      undefined,
      {
        potenciaW,
        autonomiaKm,
        pesoKg,
        tempoCargaHoras,
        usoPrincipal,
        marca,
        modelo,
      }
    );
    setSpecSections(updated);
  };

  // Funções do repeater de Ofertas
  const handleAddOferta = () => {
    setOfertas((prev) => [
      ...prev,
      {
        id: Date.now(),
        loja: '',
        preco: 0,
        linkProduto: '',
        disponibilidade: 'Em estoque',
        dataAtualizacao: new Date().toISOString().split('T')[0],
        observacoes: '',
      },
    ]);
  };

  const handleRemoveOferta = (index: number) => {
    if (ofertas.length === 1) {
      alert('A e-bike precisa ter pelo menos uma oferta cadastrada.');
      return;
    }
    setOfertas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOfertaChange = (
    index: number,
    field: keyof EBikeStoreOffer,
    value: any
  ) => {
    setOfertas((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validar campos obrigatórios
    if (!modelo.trim() || !marca.trim()) {
      setErrorMessage('Por favor, preencha a Marca e o Modelo da e-bike.');
      return;
    }

    if (!usoPrincipal) {
      setErrorMessage('Por favor, selecione a categoria/uso principal.');
      return;
    }

    // Validar ofertas
    const validOffers = ofertas.filter(
      (o) => o.loja.trim() !== '' && Number(o.preco) > 0 && o.linkProduto.trim() !== ''
    );

    if (validOffers.length === 0) {
      setErrorMessage(
        'Cadastre pelo menos uma oferta válida com Nome da Loja, Preço (> 0) e Link do Produto.'
      );
      return;
    }

    setIsSaving(true);

    try {
      // Slug gerado a partir da marca e modelo
      const slug = generateSlug(marca, modelo);

      // Imagem final segura com upload para API de mídia central
      let finalImageUrl = imagemUrl.trim();
      if (finalImageUrl.startsWith('data:image/')) {
        try {
          finalImageUrl = await uploadBase64ToCentralMedia(finalImageUrl, {
            folder: 'bikes',
            slug,
          });
        } catch (uploadErr) {
          console.warn('[BikeForm] Falha no upload central, aplicando compressão local de fallback:', uploadErr);
          finalImageUrl = await compressDataUrlForFirestore(finalImageUrl, 950, 0.72);
        }
      }

      // Galeria de imagens com upload para API de mídia central
      const safeGalleryImages = await Promise.all(
        galleryImages
          .filter((img) => typeof img === 'string' && img.trim().length > 0)
          .map(async (img) => {
            const trimmed = img.trim();
            if (trimmed.startsWith('data:image/')) {
              try {
                return await uploadBase64ToCentralMedia(trimmed, {
                  folder: 'bikes',
                  slug,
                });
              } catch (galErr) {
                console.warn('[BikeForm] Falha no upload central da galeria, aplicando fallback:', galErr);
                return await compressDataUrlForFirestore(trimmed, 800, 0.68);
              }
            }
            return trimmed;
          })
      );

      // 2. Calcular Menor e Maior Preço
      const precos = validOffers.map((o) => Number(o.preco));
      const menorPreco = Math.min(...precos);
      const maiorPreco = Math.max(...precos);

      // 3. Formatar objeto para salvar no Firestore
      const bikeDocument: EBikeGrouped = {
        slug,
        modelo: modelo.trim(),
        marca: marca.trim(),
        usoPrincipal,
        autonomiaKm: autonomiaKm ? Number(autonomiaKm) : 0,
        potenciaW: potenciaW ? Number(potenciaW) : 0,
        pesoKg: pesoKg ? Number(pesoKg) : (null as unknown as number),
        tempoCargaHoras: tempoCargaHoras ? Number(tempoCargaHoras) : (null as unknown as number),
        imagemUrl: finalImageUrl,
        galleryImages: safeGalleryImages,
        menorPreco,
        maiorPreco,
        precoDe: precoDe ? Number(precoDe) : undefined,
        emOfertaEspecial: emOfertaEspecial,
        tagOferta: tagOferta.trim(),
        // Especificações Técnicas e Resumo da Montagem no Admin
        specSections: specSections.filter(s => s.items && s.items.some(i => i.value.trim() !== '')),
        pros: pros.filter(p => p.trim() !== ''),
        cons: cons.filter(c => c.trim() !== ''),
        idealFor: idealFor.trim(),
        resumoExecutivo: resumoExecutivo.trim(),
        verdict: resumoExecutivo.trim(),
        badge: badge.trim(),
        seoReport: seoReport || undefined,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        ofertas: validOffers.map((o, idx) => ({
          id: typeof o.id === 'number' ? o.id : idx + 1,
          loja: o.loja.trim(),
          preco: Number(o.preco),
          precoDe: o.precoDe && Number(o.precoDe) > 0 ? Number(o.precoDe) : undefined,
          emOferta: o.emOferta,
          cupomDesconto: o.cupomDesconto?.trim() || undefined,
          destaqueOferta: o.destaqueOferta?.trim() || undefined,
          linkProduto: o.linkProduto.trim(),
          disponibilidade: o.disponibilidade || 'Em estoque',
          dataAtualizacao: o.dataAtualizacao || new Date().toISOString().split('T')[0],
          observacoes: o.observacoes?.trim() || '',
        })),
        priceHistory: priceHistory && priceHistory.length > 0 ? priceHistory : undefined,
        showPriceChart,
      };

      // Limpar campos undefined usando JSON
      const cleanDoc: EBikeGrouped = JSON.parse(JSON.stringify(bikeDocument));

      // 1. Gravação local imediata para nunca perder a bike e refletir no site instantaneamente
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem(PUBLISHED_BIKES_STORAGE_KEY);
          const existingList: EBikeGrouped[] = rawLocal ? JSON.parse(rawLocal) : [];
          const filteredList = existingList.filter((b) => b.slug !== slug && (!initialData?.slug || b.slug !== initialData.slug));
          localStorage.setItem(PUBLISHED_BIKES_STORAGE_KEY, JSON.stringify([cleanDoc, ...filteredList]));
        } catch (localErr) {
          console.warn('[BikeForm] Erro ao salvar cache local:', localErr);
        }
      }

      // 2. Tenta salvar via API Backend (/api/bikes com Firestore Admin)
      let apiSuccess = false;
      try {
        const apiRes = await fetchAdminJson('/api/bikes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bike: cleanDoc }),
        });
        if (apiRes.ok) {
          apiSuccess = true;
        }
      } catch (apiErr) {
        console.warn('[BikeForm] Falha ao enviar para API backend:', apiErr);
      }

      // 3. Tenta salvar diretamente via Firestore Web Client com timeout de 3 segundos
      if (!apiSuccess) {
        try {
          const firestorePromise = setDoc(doc(db, 'bikes', slug), cleanDoc, { merge: true });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 3000)
          );
          await Promise.race([firestorePromise, timeoutPromise]);
        } catch (fErr) {
          console.warn('[BikeForm] Firestore client offline ou demorou. E-bike salva localmente com sucesso:', fErr);
        }
      }

      // Sucesso -> Redireciona para listagem de bikes
      router.push('/admin/bikes');
    } catch (err: unknown) {
      console.error('Erro ao salvar bike:', err);
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao salvar e-bike';
      setErrorMessage(`Falha ao salvar e-bike: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileIngestionExtracted = (data: any, images?: ExtractedImageFile[]) => {
    if (!data || typeof data !== 'object') return;

    // Sinaliza que dados oficiais foram alocados por arquivos/cache para desarmar o useEffect residual
    hasExtractedFromFilesRef.current = true;

    // Modelo
    const extractedModel = data.modelo || data.model || data.nome || data.name || data.titulo || data.title;
    if (extractedModel) {
      setModelo(String(extractedModel).trim());
    }

    // Marca
    const extractedBrand = data.marca || data.brand || data.fabricante || data.marcaFabricante;
    if (extractedBrand) {
      setMarca(String(extractedBrand).trim());
    }

    // Categoria / Uso Principal com normalização flexível
    const rawUsage = data.usoPrincipal || data.categoria || data.category || data.uso || data.proposta;
    if (rawUsage) {
      const lower = String(rawUsage).toLowerCase();
      if (lower.includes('dobr') || lower.includes('fold')) {
        setUsoPrincipal('Dobrável');
      } else if (lower.includes('trilha') || lower.includes('mtb') || lower.includes('mountain')) {
        setUsoPrincipal('Trilha/MTB');
      } else if (lower.includes('cargo') || lower.includes('cargueira')) {
        setUsoPrincipal('Cargo');
      } else if (lower.includes('speed') || lower.includes('road') || lower.includes('estrada')) {
        setUsoPrincipal('Speed');
      } else if (lower.includes('urbana') || lower.includes('city') || lower.includes('passeio')) {
        setUsoPrincipal('Urbana');
      } else if (CATEGORIES.includes(rawUsage as EBikeCategory)) {
        setUsoPrincipal(rawUsage as EBikeCategory);
      }
    }

    // Autonomia (km)
    const autonomy = data.autonomiaKm ?? data.autonomia ?? data.alcanceKm ?? data.declaredAutonomyKm;
    if (autonomy !== undefined && autonomy !== null && String(autonomy).trim() !== '') {
      setAutonomiaKm(String(autonomy));
    }

    // Potência Nominal (W)
    const power = data.potenciaW ?? data.potencia ?? data.powerW ?? data.watts;
    if (power !== undefined && power !== null && String(power).trim() !== '') {
      setPotenciaW(String(power));
    }

    // Peso Total (kg)
    const weight = data.pesoKg ?? data.peso ?? data.weightKg ?? data.massa;
    if (weight !== undefined && weight !== null && String(weight).trim() !== '') {
      setPesoKg(String(weight));
    }

    // Tempo de Carga (horas)
    const chargeTime = data.tempoCargaHoras ?? data.tempoCarga ?? data.chargeTimeHours ?? data.recargaHoras;
    if (chargeTime !== undefined && chargeTime !== null && String(chargeTime).trim() !== '') {
      setTempoCargaHoras(String(chargeTime));
    }

    // Badge / Selo de Destaque
    const badgeVal = data.badge || data.seloDestaque || data.destaque || data.notaDestaque;
    if (badgeVal) {
      setBadge(String(badgeVal).trim());
    }

    // Tag de Oferta / Promoção
    const tagVal = data.tagOferta || data.seloOferta || data.tagPromocional;
    if (tagVal) {
      setTagOferta(String(tagVal).trim());
    }

    // Preço "De" (tabela/original)
    const originalPrice = data.precoDe ?? data.precoOriginal ?? data.precoTabela;
    if (originalPrice !== undefined && originalPrice !== null && String(originalPrice).trim() !== '') {
      setPrecoDe(String(originalPrice));
      setEmOfertaEspecial(true);
    }

    // Veredito Editorial / Resumo Executivo
    const verdict = data.resumoExecutivo || data.verdict || data.editorialVerdict || data.summary || data.resumo;
    if (verdict) {
      setResumoExecutivo(String(verdict).trim());
    }

    // Indicado Para (Ideal For)
    const ideal = data.idealFor || data.idealPara || data.publicoAlvo || data.buyerPersona;
    if (ideal) {
      setIdealFor(String(ideal).trim());
    }

    // Prós (Pontos Positivos)
    const posList = data.pros || data.pontosPositivos || data.pontosFortes;
    if (Array.isArray(posList) && posList.length > 0) {
      setPros(posList.map((p: any) => String(p).trim()).filter(Boolean));
    }

    // Contras (Pontos de Atenção)
    const negList = data.cons || data.pontosNegativos || data.pontosAtencao;
    if (Array.isArray(negList) && negList.length > 0) {
      setCons(negList.map((c: any) => String(c).trim()).filter(Boolean));
    }

    // 10 Blocos Canônicos de Especificações Técnicas (Alocação & Auditoria Determinística)
    const incomingSections = data.specSections || data.secoesEspecificacoes || data.especificacoes || data.specs;
    if (incomingSections && Array.isArray(incomingSections) && incomingSections.length > 0) {
      const normalized = allocateAndNormalizeSpecSections(
        specSections,
        incomingSections,
        {
          potenciaW: data.potenciaW !== undefined ? data.potenciaW : potenciaW,
          autonomiaKm: data.autonomiaKm !== undefined ? data.autonomiaKm : autonomiaKm,
          pesoKg: data.pesoKg !== undefined ? data.pesoKg : pesoKg,
          tempoCargaHoras: data.tempoCargaHoras !== undefined ? data.tempoCargaHoras : tempoCargaHoras,
          usoPrincipal: data.usoPrincipal || usoPrincipal,
          marca: data.marca || marca,
          modelo: data.modelo || modelo,
        }
      );
      setSpecSections(normalized);
    }

    // Lojas e Ofertas Comerciais
    const incomingOffers = data.ofertas || data.offers || data.lojas || data.ofertasSugestoes;
    if (Array.isArray(incomingOffers) && incomingOffers.length > 0) {
      setOfertas(
        incomingOffers.map((o: any, idx: number) => ({
          id: Date.now() + idx,
          loja: o.loja || o.nomeLoja || o.store || 'Loja Parceira',
          preco: Number(o.preco || o.price || o.valor) || 0,
          precoDe: o.precoDe ? Number(o.precoDe) : undefined,
          linkProduto: o.linkProduto || o.link || o.url || '',
          disponibilidade: o.disponibilidade || 'Em estoque',
          dataAtualizacao: o.dataAtualizacao || new Date().toISOString().split('T')[0],
          observacoes: o.observacoes || o.obs || '',
          emOferta: Boolean(o.emOferta || o.precoDe),
          cupomDesconto: o.cupomDesconto || o.cupom || '',
          destaqueOferta: o.destaqueOferta || o.destaque || '',
        }))
      );
    }

    // Histórico de Preços (6 Meses)
    const incomingHistory = data.historicoPrecos || data.priceHistory;
    if (Array.isArray(incomingHistory) && incomingHistory.length > 0) {
      setPriceHistory(incomingHistory);
    }
    if (data.showPriceChart !== undefined) {
      setShowPriceChart(Boolean(data.showPriceChart));
    }

    // Relatório de SEO Google Brasil
    const seoData = data.seoReport || data.seo;
    if (seoData && typeof seoData === 'object') {
      setSeoReport(seoData);
      setShowSeoPreview(true);
    }

    // Fotos do Pacote / Upload
    const photoList = images || data.images || data.galeriaFotos;
    if (Array.isArray(photoList) && photoList.length > 0) {
      const firstPhoto = photoList[0];
      const firstUri = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.dataUri;
      if (firstUri) {
        setImagemUrl(firstUri);
      }
      const galleryUris: string[] = photoList
        .slice(1)
        .map((img: any) => (typeof img === 'string' ? img : img?.dataUri))
        .filter(Boolean);
      if (galleryUris.length > 0) {
        setGalleryImages((prev) => Array.from(new Set([...prev, ...galleryUris])));
      }
    } else if (data.fotoCapaUrl || data.imagemUrl) {
      setImagemUrl(data.fotoCapaUrl || data.imagemUrl);
    }

    const finalModel = extractedModel || data.modelo || '';
    const finalBrand = extractedBrand || data.marca || '';
    setSuccessMessage(
      `Dados alocados com sucesso no formulário! Fabricante "${finalBrand}", Modelo "${finalModel}", ${incomingSections?.length || 10} blocos técnicos, veredito editorial e ofertas mapeadas.`
    );
  };

  // Auto-save para rascunho de e-bike
  const bikeState = {
    modelo, marca, usoPrincipal, autonomiaKm, potenciaW, pesoKg, tempoCargaHoras,
    imagemUrl, galleryImages, resumoExecutivo, idealFor, badge, pros, cons,
    specSections, emOfertaEspecial, precoDe, tagOferta, ofertas, priceHistory, showPriceChart, seoReport,
  };
  const { forceSave: forceBikeSave, clear: clearBikeAutoSave, lastRestored: bikeLastRestored } = useAutoSave({
    key: `ebike_${isEditing ? initialData?.slug : 'new'}`,
    data: bikeState,
    debounceMs: 1500,
    onRestore: (restored) => {
      if (restored.modelo) setModelo(restored.modelo);
      if (restored.marca) setMarca(restored.marca);
      if (restored.usoPrincipal) setUsoPrincipal(restored.usoPrincipal);
      if (restored.autonomiaKm) setAutonomiaKm(String(restored.autonomiaKm));
      if (restored.potenciaW) setPotenciaW(String(restored.potenciaW));
      if (restored.pesoKg) setPesoKg(String(restored.pesoKg));
      if (restored.tempoCargaHoras) setTempoCargaHoras(String(restored.tempoCargaHoras));
      if (restored.imagemUrl) setImagemUrl(restored.imagemUrl);
      if (restored.galleryImages) setGalleryImages(restored.galleryImages);
      if (restored.resumoExecutivo) setResumoExecutivo(restored.resumoExecutivo);
      if (restored.idealFor) setIdealFor(restored.idealFor);
      if (restored.badge) setBadge(restored.badge);
      if (restored.pros) setPros(restored.pros);
      if (restored.cons) setCons(restored.cons);
      if (restored.specSections) setSpecSections(restored.specSections);
      if (restored.emOfertaEspecial !== undefined) setEmOfertaEspecial(restored.emOfertaEspecial);
      if (restored.precoDe) setPrecoDe(String(restored.precoDe));
      if (restored.tagOferta) setTagOferta(restored.tagOferta);
      if (restored.ofertas) setOfertas(restored.ofertas);
      if (restored.priceHistory) setPriceHistory(restored.priceHistory);
      if (restored.showPriceChart !== undefined) setShowPriceChart(restored.showPriceChart);
      if (restored.seoReport) setSeoReport(restored.seoReport);
    },
    enabled: true,
  });

  // Quick Spec - gera ficha técnica completa via pipeline IA
  const [showAiIngestionTools, setShowAiIngestionTools] = useState<boolean>(!isEditing && !modelo);


  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* SEÇÃO EXPANSÍVEL DE ASSISTENTE IA & INGESTÃO DE ARQUIVOS */}
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAiIngestionTools(!showAiIngestionTools)}
            className="flex items-center gap-2.5 text-left font-black text-sm sm:text-base text-stone-900 hover:text-amber-600 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="block">Assistente IA & Ingestão de Ficha Técnica</span>
              <span className="block text-[11px] font-normal text-stone-500">
                {showAiIngestionTools ? 'Clique para recolher as ferramentas' : 'Clique para expandir a importação por arquivo (PDF/DOCX/OCR)'}
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setShowAiIngestionTools(!showAiIngestionTools)}
            className="p-2 text-stone-500 hover:text-stone-900 bg-stone-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Alternar ferramentas de ingestão"
          >
            {showAiIngestionTools ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {showAiIngestionTools && (
          <div className="space-y-6 pt-3 border-t-2 border-stone-100 animate-fadeIn">
            {/* INGESTÃO VIA ARQUIVOS (.MD, .YAML, .TXT, .ZIP) — extração local, sem IA */}
            <FileIngestionDropzone
              mode="ebike"
              onDataExtracted={handleFileIngestionExtracted}
            />
          </div>
        )}
      </div>

      {/* Quick Spec & Auto-save indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-stone-50 border-2 border-stone-200 rounded-xl">
        <div className="flex items-center gap-3">
          {bikeLastRestored && (
            <span className="text-[10px] text-stone-500 font-mono flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
              Rascunho restaurado: {bikeLastRestored.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearBikeAutoSave}
            className="px-2.5 py-1.5 text-stone-500 hover:text-rose-600 font-bold text-[10px] flex items-center gap-1 transition-colors"
            title="Limpar rascunho automático salvo localmente"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpar rascunho</span>
          </button>
        </div>
      </div>


      {successMessage && (
        <div className="p-3 bg-emerald-50 border-2 border-emerald-700 rounded-xl text-emerald-950 font-bold text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* PAINEL DE SEO & RICH SNIPPETS PREVIEW (GOOGLE BRASIL 2026) */}
      <div id="seo-preview-section" className="scroll-mt-6 bg-gradient-to-br from-indigo-950 via-slate-950 to-stone-950 border-2 border-stone-900 rounded-2xl p-4 sm:p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] text-white space-y-6 animate-fadeIn">
        {/* Header do Card com Status, Score e Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl border border-indigo-400 shadow-md flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  Prévia de SEO & Rich Snippets Google Brasil 2026
                </h3>
                {(() => {
                  const score = seoReport?.seoScore || Math.min(98, 50 + (marca ? 10 : 0) + (modelo ? 10 : 0) + (autonomiaKm ? 10 : 0) + (potenciaW ? 10 : 0) + (resumoExecutivo ? 10 : 0) + (ofertas.some(o => Number(o.preco) > 0) ? 8 : 0));
                  return (
                    <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border shadow-sm ${
                      score >= 85
                        ? 'bg-emerald-400/90 text-stone-950 border-emerald-300'
                        : score >= 65
                        ? 'bg-amber-400/90 text-stone-950 border-amber-300'
                        : 'bg-rose-400/90 text-stone-950 border-rose-300'
                    }`}>
                      Score SEO {score}/100
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-indigo-200/90 mt-0.5">
                Simulação em tempo real da aparência nos resultados de busca do Google e motores de IA
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Seletor Desktop vs Mobile da SERP */}
            <div className="flex items-center bg-stone-900/90 p-1 rounded-xl border border-stone-800">
              <button
                type="button"
                onClick={() => setSerpDeviceMode('desktop')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  serpDeviceMode === 'desktop'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Visualização da SERP no Desktop"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setSerpDeviceMode('mobile')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  serpDeviceMode === 'mobile'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Visualização da SERP no Celular (Mobile)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSeoPreview(!showSeoPreview)}
              className="px-3 py-1.5 bg-stone-800/90 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl border border-stone-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {showSeoPreview ? <EyeOff className="w-3.5 h-3.5 text-stone-400" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
              <span>{showSeoPreview ? 'Ocultar Edição' : 'Editar Metadados'}</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK VISUAL: SIMULADOR DE SERP DO GOOGLE BRASIL */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-300 font-medium px-1">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Simulação de Resultado no Google ({serpDeviceMode === 'desktop' ? 'Computador' : 'Celular'})
            </span>
            <span className="text-[11px] text-stone-400 font-mono">
              Slug: /bikes/{generateSlug(marca, modelo) || 'nome-da-ebike'}
            </span>
          </div>

          <div
            className={`transition-all duration-300 ${
              serpDeviceMode === 'mobile'
                ? 'max-w-md mx-auto bg-white rounded-2xl p-4 border-2 border-stone-900 shadow-xl'
                : 'w-full bg-white rounded-xl p-4 sm:p-5 border-2 border-stone-900 shadow-inner'
            } text-stone-900 space-y-2 font-sans`}
          >
            {/* Header da SERP (Favicon + Site Name + URL) */}
            <div className="flex items-center gap-2 text-[12px] text-stone-700">
              <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] text-white font-black shrink-0 shadow-xs">
                T
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1 leading-tight">
                  <span className="font-semibold text-stone-900 text-xs">TuaVia</span>
                  <span className="text-stone-400 text-[10px]">•</span>
                  <span className="text-stone-500 text-[10px]">Guia de E-Bikes</span>
                </div>
                <span className="text-[11px] text-stone-500 truncate font-mono">
                  https://tuavia.com.br/bikes/{generateSlug(marca, modelo) || 'modelo-da-ebike'}
                </span>
              </div>
            </div>

            {/* Título Clicável da SERP */}
            <h4 className="text-[17px] sm:text-[19px] font-medium text-[#1a0dab] hover:underline cursor-pointer leading-snug">
              {seoReport?.serpTitlePreview ||
                (marca || modelo
                  ? `${marca} ${modelo}: Ficha Técnica, Autonomia e Melhores Preços 2026`.trim()
                  : 'Bicicleta Elétrica: Ficha Técnica Completa, Autonomia e Melhores Preços')}
            </h4>

            {/* Meta Descrição / Snippet */}
            <p className="text-[13px] text-stone-700 leading-relaxed">
              {seoReport?.serpDescriptionPreview ||
                resumoExecutivo ||
                (marca || modelo
                  ? `Confira a avaliação completa da ${marca} ${modelo}: motor ${potenciaW || '350'}W, autonomia de ${autonomiaKm || '40'}km, especificações de bateria e comparativo de preços no TuaVia.`
                  : 'Análise técnica completa com especificações de potência, bateria, autonomia real de fábrica e comparativo de preços atualizado.')}
            </p>

            {/* Rich Snippets Dinâmicos (Estrelas, Menor Preço, Autonomia, Potência, Carga, Selo) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-stone-100 text-[11px] font-medium text-stone-700">
              {/* Review Stars */}
              {(() => {
                const reviews = initialData?.reviews || [];
                const avg =
                  reviews.length > 0
                    ? Math.round((reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / reviews.length) * 10) / 10
                    : 4.8;
                const count = reviews.length > 0 ? reviews.length : 12;
                return (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-950 border border-amber-300 rounded font-bold shadow-xs">
                    ⭐ {avg}/5 ({count} {count === 1 ? 'avaliação' : 'avaliações'})
                  </span>
                );
              })()}

              {/* Menor Preço em Loja */}
              {(() => {
                const validPrices = ofertas
                  .map((o) => Number(o.preco))
                  .filter((p) => !isNaN(p) && p > 0);
                const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : (Number(initialData?.menorPreco) || null);
                if (minPrice) {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-950 border border-emerald-300 rounded font-bold shadow-xs">
                      💰 A partir de R$ {minPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  );
                }
                return null;
              })()}

              {/* Autonomia */}
              {autonomiaKm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded">
                  🔋 {autonomiaKm} km autonomia
                </span>
              )}

              {/* Potência */}
              {potenciaW && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded">
                  ⚡ Motor {potenciaW}W
                </span>
              )}

              {/* Tempo de Carga */}
              {tempoCargaHoras && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-800 border border-stone-200 rounded">
                  ⏱️ Carga: {tempoCargaHoras}h
                </span>
              )}

              {/* Selo / Badge */}
              {badge && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-950 border border-purple-300 rounded font-bold">
                  🏷️ {badge}
                </span>
              )}

              {/* Enquadramento CONTRAN */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-950 border border-teal-200 rounded font-medium">
                ⚖️ CONTRAN 996
              </span>
            </div>
          </div>
        </div>

        {/* CONTROLES EDITÁVEIS E DETALHES DE OTIMIZAÇÃO SEO */}
        {showSeoPreview && (
          <div className="space-y-5 pt-2 border-t border-indigo-900/60 animate-fadeIn">
            {/* Linha 1: Título SERP e Meta Description com Contadores em Tempo Real */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Título SERP */}
              <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" />
                    Título da Página no Google (Meta Title)
                  </label>
                  {(() => {
                    const currentTitle =
                      seoReport?.serpTitlePreview ||
                      (marca || modelo ? `${marca} ${modelo}: Ficha Técnica, Autonomia e Melhores Preços 2026`.trim() : '');
                    const len = currentTitle.length;
                    return (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          len >= 45 && len <= 65
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : len > 65
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {len}/60 chars ({len >= 45 && len <= 65 ? 'Ideal' : len > 65 ? 'Pode truncar' : 'Curto'})
                      </span>
                    );
                  })()}
                </div>
                <input
                  type="text"
                  value={
                    seoReport?.serpTitlePreview ??
                    (marca || modelo ? `${marca} ${modelo}: Ficha Técnica, Autonomia e Melhores Preços 2026`.trim() : '')
                  }
                  onChange={(e) => handleUpdateSeoReport({ serpTitlePreview: e.target.value })}
                  placeholder="ex: Caloi E-Vibe City Tour: Ficha Técnica, Autonomia e Melhores Preços 2026"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
                  <span>Recomendado: 50 a 60 caracteres com a marca e o modelo.</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSeoReport({
                        serpTitlePreview: `${marca} ${modelo}: Ficha Técnica, Autonomia e Melhores Preços 2026`.trim(),
                      })
                    }
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
                  >
                    Auto-gerar
                  </button>
                </div>
              </div>

              {/* Meta Description */}
              <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" />
                    Meta Descrição do Google (SERP Snippet)
                  </label>
                  {(() => {
                    const currentDesc =
                      seoReport?.serpDescriptionPreview ||
                      resumoExecutivo ||
                      (marca || modelo
                        ? `Confira a avaliação completa da ${marca} ${modelo}: motor ${potenciaW || '350'}W, autonomia de ${autonomiaKm || '40'}km e menores preços no TuaVia.`
                        : '');
                    const len = currentDesc.length;
                    return (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          len >= 120 && len <= 160
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : len > 160
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {len}/155 chars ({len >= 120 && len <= 160 ? 'Ideal' : len > 160 ? 'Pode truncar' : 'Curto'})
                      </span>
                    );
                  })()}
                </div>
                <textarea
                  rows={2}
                  value={
                    seoReport?.serpDescriptionPreview ??
                    resumoExecutivo ??
                    (marca || modelo
                      ? `Confira a avaliação completa da ${marca} ${modelo}: motor ${potenciaW || '350'}W, autonomia de ${autonomiaKm || '40'}km e menores preços no TuaVia.`
                      : '')
                  }
                  onChange={(e) => handleUpdateSeoReport({ serpDescriptionPreview: e.target.value })}
                  placeholder="Resumo atraente e conciso que aparece logo abaixo do título no Google..."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
                <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
                  <span>Recomendado: 120 a 155 caracteres com chamada para ação.</span>
                  {resumoExecutivo && (
                    <button
                      type="button"
                      onClick={() => handleUpdateSeoReport({ serpDescriptionPreview: resumoExecutivo })}
                      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
                    >
                      Puxar do Resumo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Linha 2: Palavra-Chave Foco, Intenção de Busca e Enquadramento CONTRAN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Palavra-Chave Foco */}
              <div className="p-3.5 bg-stone-900/80 border border-stone-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase">
                  <Target className="w-3.5 h-3.5" />
                  <span>Palavra-Chave Foco</span>
                </div>
                <input
                  type="text"
                  value={
                    seoReport?.focusKeyword ??
                    (marca || modelo ? `${marca} ${modelo} vale a pena 2026`.toLowerCase().trim() : '')
                  }
                  onChange={(e) => handleUpdateSeoReport({ focusKeyword: e.target.value })}
                  placeholder="ex: caloi e-vibe city tour vale a pena"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-stone-400">Termo exato mais buscado pelos ciclistas no Google.</p>
              </div>

              {/* Intenção de Busca */}
              <div className="p-3.5 bg-stone-900/80 border border-stone-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Intenção de Busca</span>
                </div>
                <select
                  value={seoReport?.searchIntent || 'Transacional / Comparativa'}
                  onChange={(e) => handleUpdateSeoReport({ searchIntent: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="Transacional / Comparativa">Transacional / Comparativa (Comprar e Comparar)</option>
                  <option value="Transacional / Compra">Transacional / Compra Direta (Melhores Lojas)</option>
                  <option value="Informativa / Ficha Técnica">Informativa / Ficha Técnica (Especificações)</option>
                  <option value="Comparativa / Avaliação">Comparativa / Análise Crítica (Vale a Pena?)</option>
                </select>
                <p className="text-[11px] text-stone-400">Orienta a redação para maximizar cliques qualificados.</p>
              </div>

              {/* Classificação CONTRAN 996/2023 */}
              <div className="p-3.5 bg-stone-900/80 border border-stone-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-300 uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>CONTRAN 996/2023</span>
                </div>
                <input
                  type="text"
                  value={
                    seoReport?.contranCategory ??
                    'Bicicleta Elétrica Autopropelida (Dispensa CNH e Emplacamento)'
                  }
                  onChange={(e) => handleUpdateSeoReport({ contranCategory: e.target.value })}
                  placeholder="Enquadramento legal CONTRAN 996..."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-teal-400"
                />
                <p className="text-[11px] text-stone-400">Classificação jurídica para segurança do comprador.</p>
              </div>
            </div>

            {/* Linha 3: Palavras-chave Secundárias (LSI) com Adição Rápida */}
            <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Palavras-Chave Secundárias & Termos LSI (Latent Semantic Indexing)
                </span>
                <span className="text-[11px] text-stone-400">
                  {seoReport?.secondaryKeywords?.length || 0} termos cadastrados
                </span>
              </div>

              {/* Chips de Palavras-Chave */}
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const kws =
                    seoReport?.secondaryKeywords && seoReport.secondaryKeywords.length > 0
                      ? seoReport.secondaryKeywords
                      : [`${marca || 'ebike'} ${modelo || ''} preco`, `ficha tecnica ${modelo || 'bike'}`, `autonomia ${modelo || 'ebike'}`].filter(Boolean);
                  return kws.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 text-xs bg-indigo-950/70 border border-indigo-700/60 text-indigo-200 px-2.5 py-1 rounded-lg"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSecondaryKeyword(i)}
                        className="text-indigo-400 hover:text-rose-400 font-bold ml-0.5 cursor-pointer"
                        title="Remover palavra-chave"
                      >
                        ×
                      </button>
                    </span>
                  ));
                })()}
              </div>

              {/* Input para Adicionar Nova Palavra-Chave */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSecondaryKeyword(newKeywordInput);
                    }
                  }}
                  placeholder="Adicionar nova palavra-chave e teclar Enter..."
                  className="flex-1 px-3 py-1.5 bg-stone-950 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddSecondaryKeyword(newKeywordInput)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* Linha 4: GEO (Generative Engine Optimization para Google AI Overviews & Perplexity) */}
            <div className="p-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-stone-900/60 border border-blue-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>GEO (Generative Engine Optimization para Google AI Overviews, Perplexity & Gemini)</span>
                </div>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30 font-mono">
                  AI Ready
                </span>
              </div>
              <p className="text-[11px] text-stone-300">
                Texto estruturado em formato factual de alta autoridade que os motores de IA leem para gerar resumos instantâneos:
              </p>
              <textarea
                rows={2}
                value={
                  seoReport?.llmGeoSummary ??
                  (marca || modelo
                    ? `A ${marca} ${modelo} é uma bicicleta elétrica ${usoPrincipal ? `do segmento ${usoPrincipal}` : ''} com motor de ${potenciaW || '350'}W e autonomia de até ${autonomiaKm || '40'} km. Destaca-se pelo custo por km reduzido e conformidade com o CONTRAN 996/2023.`
                    : '')
                }
                onChange={(e) => handleUpdateSeoReport({ llmGeoSummary: e.target.value })}
                placeholder="Síntese factual para mecanismos de busca por IA..."
                className="w-full px-3 py-2 bg-stone-950/90 border border-blue-500/30 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>

            {/* Linha 5: Schema.org FAQPage (Perguntas & Respostas Frequentes com Edição) */}
            <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Schema.org FAQPage (Rich Snippets de Dúvidas no Google)</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddFaqItem}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar Pergunta</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {(() => {
                  const faqs =
                    seoReport?.faqSchema && seoReport.faqSchema.length > 0
                      ? seoReport.faqSchema
                      : [
                          {
                            question: `Qual a autonomia da ${marca || 'bike'} ${modelo || ''}?`,
                            answer: `A ${marca || 'bike'} ${modelo || ''} oferece até ${autonomiaKm || '40'} km de autonomia por recarga em condições normais de uso urbano.`,
                          },
                          {
                            question: `A ${marca || 'bike'} ${modelo || ''} precisa de CNH ou emplacamento?`,
                            answer: `De acordo com a Resolução CONTRAN 996/2023, bicicletas elétricas com pedal assistido e potência de até 1000W dispensam habilitação (CNH), emplacamento e IPVA.`,
                          },
                        ];
                  return faqs.map((faq, idx) => (
                    <div key={idx} className="bg-stone-950 border border-stone-800 rounded-lg p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => handleUpdateFaqItem(idx, e.target.value, faq.answer)}
                          placeholder="Pergunta frequente..."
                          className="flex-1 px-2.5 py-1 bg-stone-900 border border-stone-700 rounded text-amber-200 font-bold focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveFaqItem(idx)}
                          className="p-1 text-stone-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remover pergunta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={faq.answer}
                        onChange={(e) => handleUpdateFaqItem(idx, faq.question, e.target.value)}
                        placeholder="Resposta clara e direta..."
                        className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded text-stone-200 focus:outline-none focus:border-amber-400 resize-none"
                      />
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Linha 6: Recomendações E-E-A-T & Perfil do Comprador */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-stone-900/80 border border-stone-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Checklist E-E-A-T de Ranqueamento</span>
                </div>
                <ul className="space-y-1.5 text-xs text-stone-300">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${marca && modelo ? 'text-emerald-400' : 'text-stone-500'} shrink-0 mt-0.5`} />
                    <span className={marca && modelo ? 'text-stone-200' : 'text-stone-500'}>
                      Marca e modelo claramente definidos no título e slug.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${autonomiaKm && potenciaW ? 'text-emerald-400' : 'text-stone-500'} shrink-0 mt-0.5`} />
                    <span className={autonomiaKm && potenciaW ? 'text-stone-200' : 'text-stone-500'}>
                      Potência (W) e Autonomia (km) preenchidos para Rich Snippets.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${ofertas.some(o => Number(o.preco) > 0) ? 'text-emerald-400' : 'text-stone-500'} shrink-0 mt-0.5`} />
                    <span className={ofertas.some(o => Number(o.preco) > 0) ? 'text-stone-200' : 'text-stone-500'}>
                      Preços de lojas parceiras vinculados para marcação de oferta.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${pros.length > 0 && cons.length > 0 ? 'text-emerald-400' : 'text-stone-500'} shrink-0 mt-0.5`} />
                    <span className={pros.length > 0 && cons.length > 0 ? 'text-stone-200' : 'text-stone-500'}>
                      Prós e contras editoriais para veredito com autoridade.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="p-3.5 bg-stone-900/80 border border-stone-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-300 uppercase">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>Perfil do Ciclista Comprador (Persona)</span>
                </div>
                <textarea
                  rows={3}
                  value={
                    seoReport?.targetBuyerPersona ??
                    (idealFor || 'Ciclistas urbanos e entusiastas de mobilidade sustentável buscando alto custo-benefício e economia nos deslocamentos diários.')
                  }
                  onChange={(e) => handleUpdateSeoReport({ targetBuyerPersona: e.target.value })}
                  placeholder="Descreva quem é o comprador ideal desta e-bike..."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-stone-200 italic placeholder-stone-500 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mensagem de Erro */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border-2 border-rose-600 rounded-xl text-rose-900 font-bold text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-shake">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="px-3 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-black hover:bg-rose-800 transition-colors shadow-sm self-start sm:self-auto shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Fechar</span>
          </button>
        </div>
      )}

      {/* Bloco 1: Informações do Modelo & Oferta Especial */}
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
        <div className="border-b-2 border-stone-100 pb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
            <Bike className="w-5 h-5 text-emerald-600" />
            Informações do Modelo
          </h2>
          <span className="text-xs font-mono font-bold text-stone-400 uppercase">* Obrigatórios</span>
        </div>

        {/* Caixa de Configuração de Oferta Especial em Destaque ("De R$ X por R$ Y") */}
        <div className="p-4 bg-gradient-to-r from-amber-50 to-rose-50 border-2 border-amber-900 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-black uppercase text-amber-950 cursor-pointer">
              <input
                type="checkbox"
                checked={emOfertaEspecial}
                onChange={(e) => setEmOfertaEspecial(e.target.checked)}
                className="w-4 h-4 rounded border-stone-900 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 fill-amber-300" />
                Ativar E-Bike em Oferta Especial / Promoção de Preço (&quot;De X por Y&quot;)
              </span>
            </label>
            {emOfertaEspecial && (
              <span className="px-2 py-0.5 bg-rose-600 text-white font-mono font-black text-[10px] uppercase rounded">
                Destaque Ativo
              </span>
            )}
          </div>

          {emOfertaEspecial && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-black uppercase text-amber-900 mb-1">
                  Preço Original / De (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 3499.00"
                    value={precoDe}
                    onChange={(e) => setPrecoDe(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border-2 border-amber-900 rounded-lg text-xs font-mono font-bold text-stone-900 focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <p className="text-[10px] text-amber-800 font-medium mt-1">
                  Exibirá &apos;De R$ {precoDe || '3.499'}&apos; cortado com a porcentagem de desconto calculada.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-amber-900 mb-1">
                  Selo da Oferta / Tag Promocional
                </label>
                <input
                  type="text"
                  placeholder="Ex: ⚡ Oferta Relâmpago, 🔥 Baixou R$ 1.000, Melhor Preço 2026"
                  value={tagOferta}
                  onChange={(e) => setTagOferta(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-amber-900 rounded-lg text-xs font-bold text-stone-900 focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Marca */}
          <div>
            <label className="block text-xs font-black uppercase text-stone-800 mb-1.5">
              Marca <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={60}
              placeholder="Ex: Caloi, Sense, Lev, Oggi"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-xs font-black uppercase text-stone-800 mb-1.5">
              Modelo <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="Ex: E-Vibe City Tour, Easy, Breeze"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Categoria / Uso Principal */}
          <div>
            <label className="block text-xs font-black uppercase text-stone-800 mb-1.5">
              Uso Principal / Categoria <span className="text-rose-600">*</span>
            </label>
            <select
              value={usoPrincipal}
              onChange={(e) => setUsoPrincipal(e.target.value as EBikeCategory)}
              className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Slug Gerado */}
          <div>
            <label className="block text-xs font-black uppercase text-stone-500 mb-1.5">
              Slug da URL (Automático)
            </label>
            <input
              type="text"
              disabled
              value={marca && modelo ? generateSlug(marca, modelo) : 'marca-modelo'}
              className="w-full px-4 py-2.5 bg-stone-100 border-2 border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Ficha Técnica / Especificações Opcionais */}
        <div className="pt-4 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase text-stone-700 mb-1">
              Autonomia (km)
            </label>
            <input
              type="text"
              maxLength={20}
              placeholder="Ex: 60 ou Não informado"
              value={autonomiaKm}
              onChange={(e) => setAutonomiaKm(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-stone-700 mb-1">
              Potência (W)
            </label>
            <input
              type="text"
              maxLength={20}
              placeholder="Ex: 350 ou Não informado"
              value={potenciaW}
              onChange={(e) => setPotenciaW(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-stone-700 mb-1">
              Peso (kg) <span className="text-[10px] text-stone-400">(opcional)</span>
            </label>
            <input
              type="text"
              maxLength={20}
              placeholder="Ex: 22.5 ou Não informado"
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-stone-700 mb-1">
              Tempo Carga (h) <span className="text-[10px] text-stone-400">(opcional)</span>
            </label>
            <input
              type="text"
              maxLength={20}
              placeholder="Ex: 4.5 ou Não informado"
              value={tempoCargaHoras}
              onChange={(e) => setTempoCargaHoras(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
            />
          </div>
        </div>
      </div>

      {/* Bloco 2: Imagem Principal do Produto */}
      <ImageUploadField
        label="Imagem Principal da E-Bike (Capa)"
        value={imagemUrl}
        onChange={(url) => setImagemUrl(url)}
        onAddToGallery={(url) => {
          setGalleryImages((prev) => {
            if (prev.includes(url)) return prev;
            return [...prev, url];
          });
          setSuccessMessage('Foto adicionada à galeria de fotos complementares com sucesso!');
        }}
        folder="bikes"
        presetType="bikes"
        required
        aspectRatio="video"
        searchQueryHint={`${marca} ${modelo}`.trim()}
        contextHint={`Bicicleta Elétrica ${marca} ${modelo} categoria ${usoPrincipal}`}
        helpText="Faça upload da foto oficial, busque na Web com validação por LLM ou selecione da galeria."
      />

      {/* Bloco 2.5: Galeria de Fotos Complementares (Ofertas e Páginas Técnicas) */}
      <GalleryImagesField
        label="Galeria de Fotos Complementares (Até 4+ fotos via Links/Upload)"
        description="Estas imagens aparecerão na galeria de 4 fotos da página da bike e no modal de ofertas para enriquecer a visualização técnica do ciclista."
        images={galleryImages}
        onChange={(imgs) => setGalleryImages(imgs)}
        folder="bikes"
        maxImages={8}
        searchHint={`${marca} ${modelo}`.trim() || 'Bicicleta Elétrica'}
        presets={[
          { title: 'Quadro & Geometria', url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80' },
          { title: 'Motor & Ciclística', url: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=80' },
          { title: 'Guidão & Display', url: 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=1200&q=80' },
          { title: 'Bateria & Freios', url: 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=1200&q=80' },
        ]}
      />


      {/* Bloco 2.8: Especificações Técnicas e Resumo Técnico (Ficha do Admin) */}
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
        <div className="border-b-2 border-stone-100 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Ficha Técnica & Veredito Editorial
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Defina as especificações detalhadas por seção (Motor, Bateria, Quadro, Transmissão) e o veredito editorial. Preenchido via LLM ou manualmente.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddSpecSection}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] border border-stone-900 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Seção</span>
          </button>
        </div>

        {/* Resumo Executivo e Ideal For */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-black uppercase text-stone-700">
                Resumo Executivo / Veredito Profissional
              </label>
            </div>
            <textarea
              rows={3}
              maxLength={1500}
              placeholder="Ex: A Caloi E-Vibe City Tour destaca-se pela entrega suave de potência em ambiente urbano..."
              value={resumoExecutivo}
              onChange={(e) => setResumoExecutivo(e.target.value)}
              className="w-full p-3 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-black uppercase text-stone-700 mb-1">
                Indicado Para (Ideal For)
              </label>
              <input
                type="text"
                maxLength={200}
                placeholder="Ex: Ciclistas urbanos que enfrentam ladeiras moderadas e ciclovias"
                value={idealFor}
                onChange={(e) => setIdealFor(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-stone-700 mb-1">
                Selo de Destaque / Badge (Opcional)
              </label>
              <input
                type="text"
                maxLength={60}
                placeholder="Ex: Melhor Custo-Benefício, Escolha Especializada, Top Vendas 2026"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
              />
            </div>
          </div>
        </div>

        {/* Pontos Fortes e Pontos de Atenção */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Prós */}
          <div className="p-4 bg-emerald-50/60 border-2 border-emerald-900/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Pontos Fortes (Prós)
              </label>
              <button
                type="button"
                onClick={() => setPros(prev => [...prev, ''])}
                className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Pró
              </button>
            </div>
            {pros.map((proItem, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: Motor silencioso e potente de 350W"
                  value={proItem}
                  onChange={(e) => {
                    const updated = [...pros];
                    updated[idx] = e.target.value;
                    setPros(updated);
                  }}
                  className="flex-1 px-3 py-1.5 bg-white border border-emerald-900/20 rounded-lg text-xs font-medium text-stone-900"
                />
                <button
                  type="button"
                  onClick={() => setPros(prev => prev.filter((_, i) => i !== idx))}
                  className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Contras */}
          <div className="p-4 bg-rose-50/60 border-2 border-rose-900/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-rose-900 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" />
                Pontos de Atenção (Contras)
              </label>
              <button
                type="button"
                onClick={() => setCons(prev => [...prev, ''])}
                className="text-[11px] font-bold text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Contra
              </button>
            </div>
            {cons.map((conItem, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: Freios mecânicos exigem regulagem periódica"
                  value={conItem}
                  onChange={(e) => {
                    const updated = [...cons];
                    updated[idx] = e.target.value;
                    setCons(updated);
                  }}
                  className="flex-1 px-3 py-1.5 bg-white border border-rose-900/20 rounded-lg text-xs font-medium text-stone-900"
                />
                <button
                  type="button"
                  onClick={() => setCons(prev => prev.filter((_, i) => i !== idx))}
                  className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Ficha Técnica Detalhada por Seções */}
        <div className="space-y-4 pt-4 border-t border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-wide">
                Especificações da Ficha Técnica (Tabela Técnica)
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                Padrão TuaVia: Motor sem torque inventado, baterias com Wh matematicamente verificados e medidas exatas de pneus.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReauditAndSyncSpecs}
              className="self-start sm:self-auto px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
              title="Sincroniza os 10 blocos canônicos com a potência, autonomia, peso e regras CONTRAN"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar Métricas & Reauditar</span>
            </button>
          </div>

          <div className="space-y-4">
            {specSections.map((section, secIdx) => {
              return (
                <div
                  key={secIdx}
                  className="p-4 bg-stone-50 border-2 border-stone-900 rounded-xl space-y-3 relative overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between border-b border-stone-200 pb-2 gap-2">
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => {
                        const updated = [...specSections];
                        updated[secIdx] = { ...updated[secIdx], title: e.target.value };
                        setSpecSections(updated);
                      }}
                      className="font-black text-xs text-stone-900 uppercase bg-transparent border-b border-dashed border-stone-400 focus:border-stone-900 focus:outline-none px-1"
                    />
                    <div className="flex flex-wrap items-center gap-2 max-w-full">
                      <button
                        type="button"
                        onClick={() => handleAddSpecItem(secIdx)}
                        className="text-[11px] font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3 text-amber-500" /> Add Item
                      </button>
                      {specSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecSection(secIdx)}
                          className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                          title="Remover Seção"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {section.auditReport && (
                    <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-lg text-xs font-mono text-emerald-950 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          Auditoria Técnica da Seção
                        </span>
                        <span className="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded-full font-bold">
                          {(section.auditReport.confirmados || 0) + (section.auditReport.calculados || 0)} confirmados • {section.auditReport.naoInformados || 0} pendentes
                        </span>
                      </div>
                      {section.auditReport.corrigidos && section.auditReport.corrigidos.length > 0 && (
                        <div className="text-[11px] bg-white/90 p-2 rounded border border-emerald-200 space-y-1">
                          <span className="font-semibold text-emerald-900">Correções de conformidade:</span>
                          {section.auditReport.corrigidos.map((corr, cIdx) => (
                            <div key={cIdx} className="text-[10px] text-stone-700">
                              • <strong>{corr.campo}:</strong> de <em>&ldquo;{corr.de}&rdquo;</em> para <strong>&ldquo;{corr.para}&rdquo;</strong> {corr.motivo ? `(${corr.motivo})` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {section.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex flex-col gap-2 bg-white p-2.5 border border-stone-200 rounded-lg shadow-2xs overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            placeholder="Nome do Parâmetro"
                            value={item.label}
                            onChange={(e) => handleSpecItemChange(secIdx, itemIdx, 'label', e.target.value)}
                            className="w-full sm:w-1/3 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-[11px] font-bold text-stone-700"
                          />
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              placeholder="Valor / Especificação"
                              value={item.value}
                              onChange={(e) => handleSpecItemChange(secIdx, itemIdx, 'value', e.target.value)}
                              className="flex-1 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-[11px] font-medium text-stone-900 min-w-0"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveSpecItem(secIdx, itemIdx)}
                              className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                              title="Remover especificação"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[10px]">
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-semibold text-stone-500">Confiança:</span>
                            <select
                              value={item.confidence || 'MEDIA'}
                              onChange={(e) => handleSpecItemChange(secIdx, itemIdx, 'confidence', e.target.value as any)}
                              className={`px-1.5 py-1 rounded font-mono text-[10px] font-bold border ${
                                item.confidence === 'ALTA'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : item.confidence === 'MEDIA'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : item.confidence === 'BAIXA'
                                  ? 'bg-orange-50 text-orange-900 border-orange-300'
                                  : 'bg-stone-100 text-stone-600 border-stone-300'
                              }`}
                            >
                              <option value="ALTA">Alta (Auditado)</option>
                              <option value="MEDIA">Média (Comercial)</option>
                              <option value="BAIXA">Baixa (Estimativa)</option>
                              <option value="NAO_CONFIRMADA">Não Confirmada</option>
                            </select>
                          </div>
                          <div className="flex-1 flex items-center gap-1 min-w-0">
                            <span className="font-semibold text-stone-500 shrink-0">Fonte:</span>
                            <input
                              type="text"
                              placeholder="Manual / Catálogo Oficial"
                              value={item.source || ''}
                              onChange={(e) => handleSpecItemChange(secIdx, itemIdx, 'source', e.target.value)}
                              className="flex-1 px-1.5 py-1 bg-stone-50 border border-stone-200 rounded text-[10px] text-stone-600 min-w-0"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bloco 3: Lojas e Ofertas (Repeater) */}
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
        <div className="border-b-2 border-stone-100 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-500" />
              Lojas e Ofertas
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Cadastre pelo menos uma loja parceira onde o usuário pode comprar esta bike.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddOferta}
            className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(245,158,11,1)] transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Adicionar Loja</span>
          </button>
        </div>

        <div className="space-y-4">
          {ofertas.map((oferta, index) => (
            <div
              key={oferta.id || index}
              className="p-4 bg-stone-50 border-2 border-stone-900 rounded-xl space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <span className="text-xs font-black uppercase text-stone-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-stone-900 text-white rounded-full flex items-center justify-center text-[10px]">
                    {index + 1}
                  </span>
                  Oferta {index + 1}
                </span>

                {ofertas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOferta(index)}
                    className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Nome da Loja */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">
                    Nome da Loja <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="Ex: Mercado Livre, Amazon, Loja Oficial"
                    value={oferta.loja}
                    onChange={(e) => handleOfertaChange(index, 'loja', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900 focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* Preço Original (De R$) */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">
                    Preço De (R$) <span className="text-stone-400 font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                      R$
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      step="0.01"
                      placeholder="3499.00"
                      value={oferta.precoDe || ''}
                      onChange={(e) =>
                        handleOfertaChange(index, 'precoDe', parseFloat(e.target.value) || undefined)
                      }
                      className="w-full pl-9 pr-3 py-2 bg-white border-2 border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-600 focus:border-stone-900 focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {/* Preço Promocional (Por R$) */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">
                    Preço Por (R$) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                      R$
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100000"
                      step="0.01"
                      placeholder="2490.00"
                      value={oferta.preco || ''}
                      onChange={(e) =>
                        handleOfertaChange(index, 'preco', parseFloat(e.target.value) || 0)
                      }
                      className="w-full pl-9 pr-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-mono font-bold text-stone-900 focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {/* Disponibilidade */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">
                    Disponibilidade
                  </label>
                  <select
                    value={oferta.disponibilidade}
                    onChange={(e) =>
                      handleOfertaChange(index, 'disponibilidade', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900 cursor-pointer"
                  >
                    <option value="Em estoque">Em estoque</option>
                    <option value="Sob encomenda">Sob encomenda</option>
                    <option value="Últimas unidades">Últimas unidades</option>
                    <option value="Esgotado">Esgotado</option>
                  </select>
                </div>
              </div>

              {/* Cupom & Destaque da Oferta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">
                    Cupom de Desconto <span className="text-stone-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="Ex: TUAVIA100, B20OFERTA"
                    value={oferta.cupomDesconto || ''}
                    onChange={(e) => handleOfertaChange(index, 'cupomDesconto', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-mono font-bold text-amber-900 uppercase focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">
                    Selo / Destaque da Oferta <span className="text-stone-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="Ex: 🔥 25% OFF, ⚡ Preço Histórico Baixo, Frete Grátis"
                    value={oferta.destaqueOferta || ''}
                    onChange={(e) => handleOfertaChange(index, 'destaqueOferta', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900 focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Banner de Prévia do Desconto em Tempo Real */}
              {oferta.precoDe && oferta.preco && oferta.precoDe > oferta.preco && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between text-xs font-mono font-bold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    Economia Calculada: De R$ {oferta.precoDe.toLocaleString('pt-BR')} Por R$ {oferta.preco.toLocaleString('pt-BR')}
                  </span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">
                    -{Math.round(((oferta.precoDe - oferta.preco) / oferta.precoDe) * 100)}% OFF (Economize R$ {(oferta.precoDe - oferta.preco).toLocaleString('pt-BR')})
                  </span>
                </div>
              )}

              {/* Link do Produto */}
              <div>
                <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">
                  Link de Afiliado / Produto <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <LinkIcon className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    required
                    maxLength={500}
                    placeholder="https://mercadolivre.com.br/sec/..."
                    value={oferta.linkProduto}
                    onChange={(e) => handleOfertaChange(index, 'linkProduto', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-mono font-bold text-stone-900 focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico de Preços (Últimos 6 Meses - IA / Curadoria) */}
      <div id="price-history-section" className="scroll-mt-6 bg-white border-3 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-400 border border-stone-900 rounded-lg text-stone-900 shadow-[1px_1px_0px_0px_rgba(28,25,23,1)]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-black text-stone-900">Histórico de Preços (Últimos 6 Meses)</h2>
              <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-black uppercase rounded-md tracking-wider">
                Preços Reais da Web
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Curva histórica gerada com base em cotações e ofertas reais pesquisadas na internet pela IA. Você também pode acionar o buscador manual ou editar os valores mensais livremente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRecalculatePriceHistory}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 border-2 border-stone-900 text-stone-900 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-stone-700" />
              <span>Recalcular via Menor Oferta</span>
            </button>
          </div>
        </div>

        {/* Chave de Ativação / Visibilidade do Gráfico no Site */}
        <div className="p-4 bg-stone-50 border-2 border-stone-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
          <label className="flex items-center gap-3 text-xs font-black uppercase text-stone-900 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPriceChart}
              onChange={(e) => setShowPriceChart(e.target.checked)}
              className="w-4 h-4 rounded border-stone-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
            />
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Exibir Gráfico de Histórico de Preços na Página Pública do Produto
            </span>
          </label>
          <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md font-mono border self-start sm:self-auto ${
            showPriceChart 
              ? 'bg-emerald-100 text-emerald-900 border-emerald-400' 
              : 'bg-stone-200 text-stone-700 border-stone-400'
          }`}>
            {showPriceChart ? '✓ Gráfico Visível' : '✕ Gráfico Oculto'}
          </span>
        </div>

        {/* Live Preview do Gráfico */}
        <div className="bg-stone-50 border-2 border-stone-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase text-stone-700 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-500" />
              Pré-visualização do Gráfico do Produto
            </span>
            <span className="text-[11px] font-mono font-bold text-stone-500">
              {priceHistory.length} pontos temporais
            </span>
          </div>
          <PriceHistoryChart data={priceHistory} />
        </div>

        {/* Inputs de Edição Manual dos Meses */}
        <div>
          <label className="block text-[11px] font-black uppercase text-stone-700 mb-2">
            Valores Mensais (R$) — Edite se desejar refinar valores específicos:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {priceHistory.map((point, pIdx) => (
              <div
                key={point.month || pIdx}
                className="p-2.5 bg-white border-2 border-stone-900 rounded-xl space-y-1 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                  {point.month}
                </span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">
                    R$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={point.price !== undefined && point.price !== null ? point.price : ''}
                    onChange={(e) => handlePriceHistoryChange(pIdx, parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-2 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono font-black text-stone-900 focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seção de Avaliações e Comentários da Comunidade (Apenas ao Editar) */}
      {isEditing && (initialData?.slug || modelo) && (
        <div className="pt-6 border-t-2 border-dashed border-stone-300">
          <BikeReviewsManager
            bikeSlug={initialData?.slug || generateSlug(marca, modelo)}
            bikeName={`${marca} ${modelo}`.trim()}
            autonomiaKm={autonomiaKm ? parseFloat(autonomiaKm) : undefined}
            potenciaW={potenciaW ? parseFloat(potenciaW) : undefined}
          />
        </div>
      )}

      {/* Ações de Envio */}
      <div className="flex items-center justify-between pt-4 pb-28 sm:pb-32">
        <button
          type="button"
          onClick={() => router.push('/admin/bikes')}
          className="px-5 py-3 bg-white border-2 border-stone-900 text-stone-900 font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-stone-50 cursor-pointer shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancelar</span>
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="px-8 py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-black rounded-xl text-sm border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Salvando E-Bike...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{isEditing ? 'Atualizar E-Bike' : 'Publicar E-Bike'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
