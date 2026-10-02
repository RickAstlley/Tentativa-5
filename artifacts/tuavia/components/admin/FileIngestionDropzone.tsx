'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  FileText,
  FileCode,
  Archive,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  X,
  Eye,
  EyeOff,
  Zap,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Check,
  Clock,
  Timer,
  Download,
  Copy,
  Trash2,
  SlidersHorizontal,
  Layers,
  Code2,
  FileCheck2,
  Binary,
  Hash,
  ShieldCheck,
  FileSpreadsheet,
  Cpu,
  ArrowRight,
  Database,
  FileSearch,
  Tag,
  CheckCheck,
} from 'lucide-react';
import {
  parseUploadedFile,
  IngestedFilePayload,
  ExtractedImageFile,
  generateCanonicalEBikeYaml,
  parseEBikeDeterministic,
  auditIngestionQuality,
  IngestionQualityReport,
} from '@/lib/admin/fileIngestion';
import { fetchAdminJson, ApiResponseResult } from '@/lib/apiResponse';
import { CANONICAL_SPEC_SECTIONS } from '@/lib/specAllocations';
import {
  runDeterministicExtraction,
  findSpecGaps,
  UNCONFIRMED_LABEL,
  type SpecGap,
} from '@/lib/admin/ebikeIngestor';
import {
  ExtractionCacheData,
  TaggedExtractedSpec,
  saveExtractionCache,
  getActiveExtractionCache,
  getAllExtractionCaches,
  findExtractionCacheByHash,
  generateFileContentHash,
  deleteExtractionCache,
  clearAllExtractionCaches,
  getStorageUsageEstimate,
  triggerBrowserDownload,
  exportSpecsToCsv,
  exportSpecsToJson,
  exportSpecsToMarkdown,
} from '@/lib/admin/extractionCache';

/**
 * Desempacota com segurança a resposta do endpoint administrativo de ingestão LLM
 */
function extractApiData<T = any>(res: ApiResponseResult<any>): T | null {
  if (!res || !res.ok) return null;
  if (res.data && typeof res.data === 'object') {
    if (res.data.data !== undefined) {
      return res.data.data as T;
    }
    return res.data as T;
  }
  return null;
}

/**
 * O jobStore serializa o resultado em `result.text` quando `result.data` não
 * sobrevive ao transporte. O parse é tolerante: devolve `null` em vez de
 * estourar, para o chamador cair na mensagem de erro legível.
 */
function safeJsonParse(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export interface ModularBlockStatus {
  index: number | 'editorial';
  title: string;
  shortName: string;
  description: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  summary?: string;
  itemCount?: number;
  highlight?: string;
  items?: { label: string; value: string }[];
}

export const INITIAL_MODULAR_BLOCKS: ModularBlockStatus[] = [
  { index: 1, title: '1. Resumo Rápido & Destaques', shortName: 'Resumo Rápido', description: 'Potência nominal, autonomia, velocidade e peso', status: 'idle' },
  { index: 2, title: '2. Desempenho & Propulsão', shortName: 'Motor & Propulsão', description: 'Tipo do motor, potência de pico, torque (Nm) e acelerador', status: 'idle' },
  { index: 3, title: '3. Bateria & Energia', shortName: 'Bateria & Energia', description: 'Tensão (V), amperagem (Ah), capacidade Wh e recarga', status: 'idle' },
  { index: 4, title: '4. Conforto & Ergonomia', shortName: 'Chassi & Suspensão', description: 'Material do quadro, garfo dianteiro e amortecedor', status: 'idle' },
  { index: 5, title: '5. Segurança & Frenagem', shortName: 'Freios & Luzes', description: 'Discos/V-brake, corte do motor e farol/lanterna LED', status: 'idle' },
  { index: 6, title: '6. Transmissão & Ciclística', shortName: 'Câmbio & Marchas', description: 'Câmbio mecânico, marchas, pedivela e passadores', status: 'idle' },
  { index: 7, title: '7. Dimensões, Rodas & Pneus', shortName: 'Rodas & Pneus', description: 'Medida dos pneus, aro, chassi dobrável e dimensões', status: 'idle' },
  { index: 8, title: '8. Equipamentos & Conectividade', shortName: 'Display & Conexões', description: 'Display digital, bagageiro, paralamas e USB', status: 'idle' },
  { index: 9, title: '9. Compatibilidade & Manutenção', shortName: 'Garantia & Reposição', description: 'Proteção IPX4, padrão de peças e assistência técnica', status: 'idle' },
  { index: 10, title: '10. Auditoria & CONTRAN 996', shortName: 'CONTRAN 996/2023', description: 'Enquadramento legal, fonte oficial e revisão técnica', status: 'idle' },
  { index: 'editorial', title: 'Veredito Editorial & Vantagens', shortName: 'Veredito Editorial', description: 'Resumo executivo, perfil de uso, prós e contras', status: 'idle' },
];

export interface FileIngestionDropzoneProps {
  mode: 'ebike' | 'article' | 'ranking';
  title?: string;
  description?: string;
  onDataExtracted: (data: any, images?: ExtractedImageFile[]) => void;
  className?: string;
}

export default function FileIngestionDropzone({
  mode,
  title,
  description,
  onDataExtracted,
  className = '',
}: FileIngestionDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Estados de Execução dos Processos de Alocação
  const [runningStep, setRunningStep] = useState<number | 'all' | 'deterministic' | 'article_direct' | 'ranking_direct' | null>(null);

  const [activeSubStep, setActiveSubStep] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Estados de Acompanhamento Modular dos 10 Blocos Canônicos em Tempo Real
  const [modularBlocks, setModularBlocks] = useState<ModularBlockStatus[]>(INITIAL_MODULAR_BLOCKS);
  const [currentActiveBlock, setCurrentActiveBlock] = useState<number | 'editorial' | null>(null);
  const [showModularMonitor, setShowModularMonitor] = useState<boolean>(false);

  // Dados do Arquivo e Cache Local
  const [ingestedPayload, setIngestedPayload] = useState<IngestedFilePayload | null>(null);
  const [currentCache, setCurrentCache] = useState<ExtractionCacheData | null>(null);
  const [allCaches, setAllCaches] = useState<ExtractionCacheData[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ count: number; totalBytes: number; formattedSize: string }>({
    count: 0,
    totalBytes: 0,
    formattedSize: '0 KB',
  });

  // Notificações e Visualizações
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showBinaryInspector, setShowBinaryInspector] = useState(false);
  const [showPreviewText, setShowPreviewText] = useState(false);
  const [showYamlModal, setShowYamlModal] = useState(false);
  const [editedYaml, setEditedYaml] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCacheModalOpen, setIsCacheModalOpen] = useState(false);
  const [showQualityDetails, setShowQualityDetails] = useState(false);
  const [activeSubDocIndex, setActiveSubDocIndex] = useState<number | null>(null);
  const [copiedSha256, setCopiedSha256] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [tagSearchTerm, setTagSearchTerm] = useState<string>('');
  const [showTaggedInspector, setShowTaggedInspector] = useState<boolean>(true);

  // Relatório de Auditoria de Qualidade
  const qualityReport: IngestionQualityReport | null = React.useMemo(() => {
    if (mode !== 'ebike') return null;
    const targetData = {
      ...((currentCache as any)?.consolidated || {}),
      ...(currentCache?.identity || {}),
      specSections: currentCache?.specSections || [],
    };
    const rawText = currentCache?.rawText || ingestedPayload?.rawText || '';
    if (!currentCache && !ingestedPayload) return null;
    return auditIngestionQuality(targetData, rawText);
  }, [mode, currentCache, ingestedPayload]);

  // Buracos da ficha do fabricante: campos do template que sobraram vazios.
  //
  // Sai de `findSpecGaps` sobre as seções já alocadas, e não do
  // `qualityReport`: o relatório diz se o bloco foi detectado, o gap diz o
  // campo. Recalculado a partir do cache, então sobrevive ao recarregar a tela.
  const specGaps: SpecGap[] = React.useMemo(() => {
    if (mode !== 'ebike') return [];
    const sections = currentCache?.specSections;
    if (!Array.isArray(sections) || sections.length === 0) return [];
    // Documento truncado não prova ausência: os gaps saem marcados como
    // "não lido" para a tela não afirmar que o fabricante não informou.
    const truncado = (currentCache?.extractionWarnings?.length ?? 0) > 0;
    return findSpecGaps(sections, truncado);
  }, [mode, currentCache]);

  // Inicialização e recarga do cache local
  const refreshCachesList = useCallback(() => {
    try {
      const localList = getAllExtractionCaches();
      const estimate = getStorageUsageEstimate();
      setStorageInfo(estimate);
      setAllCaches(localList);

      const active = getActiveExtractionCache(mode);
      if (active) {
        setCurrentCache(active);
      }
    } catch (err) {
      console.warn('[FileIngestionDropzone] Erro ao carregar caches locais:', err);
    }
  }, [mode]);

  useEffect(() => {
    refreshCachesList();
  }, [refreshCachesList]);

  // Controle de cronômetro durante execução
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Consolidação e disparo para o formulário
  const emitConsolidatedData = (cache: ExtractionCacheData) => {
    const editorialObj = cache.editorial || {};
    const identityObj = cache.identity || {};

    const consolidated: any = {
      ...identityObj,
      marca: identityObj.marca || identityObj.brand || 'Não informado',
      modelo: identityObj.modelo || identityObj.model || '',
      usoPrincipal: identityObj.usoPrincipal || identityObj.categoria || 'Urbana',
      potenciaW: identityObj.potenciaW,
      autonomiaKm: identityObj.autonomiaKm,
      pesoKg: identityObj.pesoKg,
      tempoCargaHoras: identityObj.tempoCargaHoras,
      preco: identityObj.menorPreco || identityObj.preco || identityObj.precoDe,
      menorPreco: identityObj.menorPreco || identityObj.preco || identityObj.precoDe,
      precoDe: identityObj.precoDe,
      /**
       * Sem fallback hardcoded de badge.
       *
       * O ingestor zera o badge quando a ficha não sustenta a identidade — é a
       * guarda anti-alucinação. Este `|| '🏆 Custo-Benefício 2026'` a desfaía
       * na camada seguinte: toda ficha voltava com selo de custo-benefício,
       * inclusive as que nada confirmaram. Vazio é a resposta honesta; quem
       * quiser um selo escreve um, com fonte.
       */
      badge: editorialObj.badge || editorialObj.notaDestaque || identityObj.badge || '',
      notaDestaque: editorialObj.notaDestaque || editorialObj.badge || identityObj.badge || '',
      resumoExecutivo: editorialObj.resumoExecutivo || editorialObj.verdict || editorialObj.editorialVerdict || '',
      verdict: editorialObj.resumoExecutivo || editorialObj.verdict || editorialObj.editorialVerdict || '',
      idealFor: editorialObj.idealFor || editorialObj.idealPara || '',
      pros: Array.isArray(editorialObj.pros) ? editorialObj.pros : (Array.isArray(editorialObj.pontosPositivos) ? editorialObj.pontosPositivos : []),
      cons: Array.isArray(editorialObj.cons) ? editorialObj.cons : (Array.isArray(editorialObj.pontosNegativos) ? editorialObj.pontosNegativos : []),
      structuredYaml: cache.structuredYaml || '',
      specSections: cache.specSections || [],
      historicoPrecos: cache.priceHistoryData?.historicoPrecos || [],
      ofertas: cache.priceHistoryData?.ofertas || [],
      hasPriceHistory: cache.priceHistoryData?.hasPriceHistory || false,
      showPriceChart: cache.priceHistoryData?.hasPriceHistory !== false,
      seoReport: cache.seoAndMarket?.seoReport || cache.seoAndMarket || {},
    };

    console.log('[Dropzone emitConsolidatedData] Disparando dados consolidados para o formulário:', {
      marca: consolidated.marca,
      modelo: consolidated.modelo,
      temResumo: Boolean(consolidated.resumoExecutivo),
      temIdealFor: Boolean(consolidated.idealFor),
      prosCount: consolidated.pros.length,
      consCount: consolidated.cons.length,
      specsSectionsCount: consolidated.specSections.length,
    });

    if (cache.images && cache.images.length > 0) {
      onDataExtracted(consolidated, cache.images);
    } else {
      onDataExtracted(consolidated);
    }
  };

  const handleFileProcess = async (file: File) => {

    try {
      const payload = await parseUploadedFile(file);
      setIngestedPayload(payload);

      // Gera estrutura YAML canônica e identidade base em memória
      const canonical = generateCanonicalEBikeYaml(
        payload.rawText,
        payload.parsedYamlOrJson,
        payload.fileName
      );

      const fileHash = generateFileContentHash(payload.fileName, payload.rawText, payload.fileSizeBytes || file.size || 0);
      const existing = findExtractionCacheByHash(fileHash);

      let targetCacheToProcess: ExtractionCacheData;

      if (existing) {
        const enriched: ExtractionCacheData = {
          ...existing,
          fileSizeBytes: existing.fileSizeBytes || payload.fileSizeBytes || file.size || payload.rawText.length,
          wordCount: existing.wordCount || payload.wordCount,
          detectedKind: existing.detectedKind || payload.detectedKind,
          structuredYaml: existing.structuredYaml || canonical.structuredYaml,
          identity: Object.keys(existing.identity || {}).length > 0 ? existing.identity : canonical.identity,
          binaryInfo: payload.binaryInfo || existing.binaryInfo,
          images: payload.images && payload.images.length > 0 ? payload.images : existing.images,
          isAllocatedToForm: false,
        };
        saveExtractionCache(enriched);
        setCurrentCache(enriched);
        targetCacheToProcess = enriched;
      } else {
        const initialCache: ExtractionCacheData = {
          cacheId: `cache_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fileHash,
          fileName: payload.fileName,
          fileType: payload.fileType,
          fileSizeBytes: payload.fileSizeBytes || file.size || payload.rawText.length,
          wordCount: payload.wordCount,
          detectedKind: payload.detectedKind,
          extractedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          mode,
          status: 'ready',
          rawText: payload.rawText,
          structuredYaml: canonical.structuredYaml,
          identity: canonical.identity,
          completedSteps: [],
          images: payload.images,
          binaryInfo: payload.binaryInfo,
          isAllocatedToForm: false,
        };
        saveExtractionCache(initialCache);
        setCurrentCache(initialCache);
        refreshCachesList();
        targetCacheToProcess = initialCache;
      }

      setIsReadingFile(false);

      // A alocação é toda local: o texto bruto já está em cache e o formulário é
      // preenchido sem passar por modelo. Antes, este bloco disparava um job de
      // LLM para fechar buraco; agora só article e ranking pré-preenchem direto.
      if (mode === 'article') {
        setSuccessMessage(`Arquivo "${payload.fileName}" carregado. Alocando direto no formulário...`);
        handleRunArticleDirect();
      } else if (mode === 'ranking') {
        setSuccessMessage(`Arquivo "${payload.fileName}" carregado. Alocando direto no formulário...`);
        handleRunRankingDirect();
      } else {
        setSuccessMessage(
          `Arquivo "${payload.fileName}" carregado e estruturado nas seções canônicas. ` +
            'Clique em "Iniciar Alocação Direta (Sem IA)" para distribuir nos 10 blocos.'
        );
      }
    } catch (err: any) {
      console.error('[FileIngestionDropzone] Falha na leitura do arquivo:', err);
      setErrorMessage(err.message || 'Falha ao processar o arquivo. Tente outro formato (.pdf, .docx, .xlsx, .md, .txt).');
      setIsReadingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // Trocar/Remover arquivo ativo
  const handleResetActiveFile = () => {
    setCurrentCache(null);
    setIngestedPayload(null);
    setShowPreviewText(false);
    setShowBinaryInspector(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // =========================================================================
  // BOTÃO A: EXTRAIR INFORMAÇÕES COM LLM (COM TAGS DE ESPECIFICAÇÕES)
  // =========================================================================
  /**
   * Extração de e-bike: pipeline determinístico primeiro, IA só para fechar
   * buraco.
   *
   * Substitui as 4 etapas em cascata (tags -> identidade -> 10 blocos em
   * paralelo -> veredito -> SEO), que faziam 10 chamadas de IA por arquivo e
   * distribuíam mal o resultado entre as seções.
   *
   * O progresso dos 10 blocos canônicos vem do resultado real do pipeline,
   * não de animação.
   */

  // Handlers para os modos Artigo e Ranking
  // =========================================================================
  // ALOCAÇÃO DETERMINÍSTICA DE E-BIKE (O QUE SUBSTITUI A ETAPA DE IA)
  // =========================================================================
  /**
   * Extrai a ficha, aloca nos 10 blocos canônicos, audita e aponta o que o
   * fabricante não informou.
   *
   * Tudo local: o texto bruto já está em memória e a alocação é trabalho de
   * string. Antes esta etapa rodava no servidor, em `/api/admin/llm/ingest`
   * com `llmPolicy 'never'`, e morreu junto com o subsistema de LLM — o upload
   * voltava a exigir preenchimento manual. Sem a etapa de IA não há
   * `maxDuration`, nem fila, nem upload, nem custo de servidor: a alocação
   * acontece no navegador.
   */
  const handleRunEBikeDeterministic = (cacheData?: ExtractionCacheData) => {
    const targetCache = cacheData || currentCache;
    const rawText = targetCache?.rawText || ingestedPayload?.rawText || '';
    const fileName = targetCache?.fileName || ingestedPayload?.fileName || 'documento.txt';

    if (!rawText || rawText.trim().length === 0) {
      setErrorMessage('Nenhum arquivo anexado. Arraste ou selecione um arquivo antes de extrair as informações.');
      return null;
    }

    setErrorMessage(null);

    try {
      const result = runDeterministicExtraction({
        rawText,
        fileName,
        parsedData: ingestedPayload?.parsedYamlOrJson,
        truncated: (targetCache?.extractionWarnings?.length ?? 0) > 0,
      });

      if (!result.specSections?.length) {
        throw new Error('A varredura determinística não retornou seções canônicas.');
      }

      const editorial = result.editorial ?? {};

      /**
       * As 10 seções canônicas + a entrada editorial.
       *
       * `INITIAL_MODULAR_BLOCKS` tem 11 itens e o progresso divide por 11, mas
       * este `map` reconstruía a lista só com as 10 seções: o card editorial
       * sumia e o contador nunca passava de 10/11 (91%). Aqui as duas partes
       * são montadas juntas, num único `setState`.
       */
      const sectionBlocks: ModularBlockStatus[] = CANONICAL_SPEC_SECTIONS.map((section, index) => {
        const found = result.specSections[index];
        const items = found?.items ?? [];
        const filled = items.filter(
          (item: any) => item.value && item.value !== UNCONFIRMED_LABEL
        );
        return {
          index: index + 1,
          title: section.title,
          shortName: section.title.replace(/^\d+\.\s*/, ''),
          description: `${items.length} campo(s) canônico(s)`,
          status: filled.length > 0 ? ('completed' as const) : ('idle' as const),
          summary: `${filled.length}/${items.length} campo(s)`,
          itemCount: items.length,
          highlight: filled[0]
            ? `${filled[0].label}: ${filled[0].value}`
            : 'Sem dado verificável',
          items,
        };
      });

      const editorialHasContent = Boolean(
        editorial.resumoExecutivo || editorial.idealFor ||
        (Array.isArray(editorial.pros) && editorial.pros.length > 0)
      );

      setModularBlocks([
        ...sectionBlocks,
        {
          index: 'editorial',
          title: 'Veredito Editorial & Vantagens',
          shortName: 'Veredito Editorial',
          description: 'Resumo executivo, perfil de uso, prós e contras',
          status: editorialHasContent ? ('completed' as const) : ('idle' as const),
          summary: editorialHasContent
            ? `${(Array.isArray(editorial.pros) ? editorial.pros.length : 0)} pró(s) / ${(Array.isArray(editorial.cons) ? editorial.cons.length : 0)} contra(s)`
            : 'Sem veredito no documento',
          highlight: (editorial.badge as string) || (editorialHasContent ? 'Veredito extraído do documento' : 'Sem base verificável'),
        },
      ]);

      setCurrentActiveBlock(null);
      setShowModularMonitor(true);

      const mergedCache: ExtractionCacheData = {
        ...(targetCache as ExtractionCacheData),
        updatedAt: new Date().toISOString(),
        structuredYaml: result.structuredYaml || targetCache?.structuredYaml || '',
        identity: { ...(targetCache?.identity ?? {}), ...(result.identity as any) },
        specSections: result.specSections,
        editorial: { ...(targetCache?.editorial ?? {}), ...editorial },
        priceHistoryData: result.priceHistoryData ?? targetCache?.priceHistoryData,
        extractionWarnings: targetCache?.extractionWarnings ?? [],
        completedSteps: Array.from(new Set([...(targetCache?.completedSteps || []), 1, 2, 3])),
        isAllocatedToForm: true,
      };

      /**
       * Persiste ANTES de recarregar a lista.
       *
       * Na ordem antiga, `setCurrentCache(mergedCache)` era seguido de
       * `refreshCachesList()`, que relê o `localStorage` e chama
       * `setCurrentCache` com o registro antigo. O React agrupa os dois
       * `setState` e o último ganhava — o cache voltava sem `specSections`, o
       * painel mostrava 0/10 e restaurar do Cache reemitia lista vazia, então
       * o formulário nunca recebia as especificações.
       */
      saveExtractionCache(mergedCache);
      setCurrentCache(mergedCache);
      emitConsolidatedData(mergedCache);
      refreshCachesList();

      const { filledItems, totalCanonicalItems, gapCount, integrityScore } = result.stats;
      setSuccessMessage(
        `\u2713 ${filledItems}/${totalCanonicalItems} campos preenchidos. ` +
          (gapCount > 0
            ? `${gapCount} campo(s) sem valor do fabricante \u2014 listados abaixo. `
            : 'Ficha completa. ') +
          `Integridade ${integrityScore}/100. Nenhum token de IA foi gasto.`
      );
      return result;
    } catch (err: any) {
      console.error('[Dropzone] Falha na alocação determinística:', err);
      setErrorMessage(err.message || 'Erro durante a extração.');
      return null;
    }
  };

  const handleRunArticleDirect = () => {
    const rawText = currentCache?.rawText || ingestedPayload?.rawText || '';
    if (!rawText) return;
    const fileName = currentCache?.fileName || 'artigo';
    const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const articleData = {
      titulo: cleanTitle,
      slug: cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      resumo: rawText.slice(0, 200) + '...',
      conteudo: rawText,
      tags: ['Mobilidade Elétrica', 'E-Bikes'],
    };
    onDataExtracted(articleData);
    setSuccessMessage('✓ Artigo alocado diretamente a partir do arquivo.');
  };


  const handleRunRankingDirect = () => {
    const rawText = currentCache?.rawText || ingestedPayload?.rawText || '';
    if (!rawText) return;
    const fileName = currentCache?.fileName || 'ranking';
    const rankingData = {
      titulo: `Top Melhores E-Bikes (${fileName})`,
      slug: fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      descricao: 'Ranking comparativo extraído diretamente do documento.',
      criterios: ['Potência', 'Autonomia', 'Custo-Benefício'],
      conteudo: rawText,
    };
    onDataExtracted(rankingData);
    setSuccessMessage('✓ Ranking alocado diretamente a partir do arquivo.');
  };


  // Funções de limpeza
  const handleClearAllStorage = () => {
    if (typeof window !== 'undefined' && window.confirm('Deseja apagar todos os caches de arquivos salvos localmente?')) {
      clearAllExtractionCaches();
      setCurrentCache(null);
      setIngestedPayload(null);
      refreshCachesList();
      setSuccessMessage('Todos os caches locais foram limpos.');
    }
  };

  const defaultTitle =
    mode === 'ebike'
      ? 'Ingestão de Ficha Técnica por Arquivo'
      : mode === 'article'
      ? 'Ingestão de Artigo por Arquivo'
      : 'Ingestão de Ranking por Arquivo';

  const defaultDesc =
    mode === 'ebike'
      ? 'Carregue PDFs, manuais técnicos, tabelas ou Markdown e escolha entre alocação determinística direta instantânea ou alocação semântica com IA.'
      : 'Carregue documentos para estruturar artigos ou rankings completos.';

  const activeFileName = currentCache?.fileName || ingestedPayload?.fileName || '';
  const activeFileSize = currentCache?.fileSizeBytes || ingestedPayload?.fileSizeBytes || currentCache?.rawText?.length || 0;
  const activeWordCount = currentCache?.wordCount || ingestedPayload?.wordCount || (currentCache?.rawText ? currentCache.rawText.split(/\s+/).length : 0);
  const detectedKind = currentCache?.detectedKind || ingestedPayload?.detectedKind;
  const binaryInfo = currentCache?.binaryInfo || ingestedPayload?.binaryInfo;

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6 shadow-xl transition-all ${className}`}>
      {/* CABEÇALHO DA CENTRAL DE ARQUIVOS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400 shrink-0">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
              {title || defaultTitle}
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-300 border border-lime-500/25">
                Parser Server-Side • PDF/DOCX/XLSX/OCR
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400">{description || defaultDesc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setIsCacheModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700 cursor-pointer"
            title="Ver arquivos no cache local do navegador"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
            <span>Cache ({allCaches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expandir' : 'Recolher'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-5">
          {/* ============================================================ */}
          {/* ESTADO 1: NENHUM ARQUIVO CARREGADO (ÁREA DE DROPZONE LIMPA)     */}
          {/* ============================================================ */}
          {!currentCache && !ingestedPayload && (
            <details className="bg-neutral-950/60 border border-neutral-800 rounded-2xl">
              <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 text-neutral-300 hover:text-neutral-100 transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-xs font-semibold">
                  Ou use o leitor local simplificado (sem servidor)
                </span>
                <ChevronDown className="w-4 h-4 ml-auto" />
              </summary>
              <div className="p-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative overflow-hidden border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? 'border-lime-400 bg-lime-500/10 scale-[0.99]'
                    : 'border-neutral-700 hover:border-lime-500/60 bg-neutral-950/60 hover:bg-neutral-850'
                }`}
              >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.csv,.json,.yaml,.yml,.txt,.md,.markdown,.zip,.html,.htm"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="p-4 rounded-2xl bg-neutral-800 text-lime-400 border border-neutral-700 shadow-inner group-hover:scale-105 transition-transform">
                  {isReadingFile ? (
                    <RefreshCw className="w-8 h-8 animate-spin text-lime-400" />
                  ) : (
                    <Upload className="w-8 h-8 text-lime-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-bold text-neutral-100 flex items-center justify-center gap-2">
                    {isReadingFile ? (
                      'Lendo documento e extraindo texto...'
                    ) : (
                      'Arraste o arquivo aqui ou clique para selecionar'
                    )}
                  </h4>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                    O arquivo será carregado em memória. Você escolherá se deseja alocar as informações com ou sem IA.
                  </p>
                </div>

                {/* BADGES DOS FORMATOS ACEITOS */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  <span className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-[11px] font-mono text-lime-300 font-semibold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-lime-400" /> .PDF
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-[11px] font-mono text-emerald-300 font-semibold flex items-center gap-1">
                    <FileSpreadsheet className="w-3 h-3 text-emerald-400" /> .XLSX / .CSV
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-[11px] font-mono text-sky-300 font-semibold flex items-center gap-1">
                    <FileCode className="w-3 h-3 text-sky-400" /> .DOCX
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-[11px] font-mono text-amber-300 font-semibold flex items-center gap-1">
                    <Code2 className="w-3 h-3 text-amber-400" /> .YAML / .JSON
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-[11px] font-mono text-purple-300 font-semibold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-purple-400" /> .MD / .TXT
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-[11px] font-mono text-cyan-300 font-semibold">
                    .ZIP
                  </span>
                </div>
              </div>
            </div>
              </div>
              </details>
          )}

          {/* ================================================================= */}
          {/* ESTADO 2: ARQUIVO CARREGADO (RAIO-X FIEL & OPÇÕES DE ALOCAÇÃO)  */}
          {/* ================================================================= */}
          {(currentCache || ingestedPayload) && (
            <div className="space-y-4">
              {/* CARD DE DETALHES FIÉIS DO ARQUIVO */}
              <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400 shrink-0">
                      <FileCheck2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-bold text-neutral-100 truncate max-w-[240px] sm:max-w-md">
                          {activeFileName}
                        </span>
                        {detectedKind && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                            detectedKind === 'ebike'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : detectedKind === 'article'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {detectedKind === 'ebike' ? '⚡ E-Bike' : detectedKind === 'article' ? '📰 Artigo' : '🏆 Ranking'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-neutral-400">
                        <span className="font-mono text-neutral-300">
                          {(activeFileSize / 1024).toFixed(1)} KB
                        </span>
                        <span>•</span>
                        <span>{activeWordCount.toLocaleString('pt-BR')} palavras extraídas</span>
                        {binaryInfo?.detectedFormatName && (
                          <>
                            <span>•</span>
                            <span className="text-lime-300 font-medium">Formato: {binaryInfo.detectedFormatName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AÇÕES RÁPIDAS SOBRE O ARQUIVO */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setShowPreviewText(!showPreviewText)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700 cursor-pointer"
                      title="Ver conteúdo de texto lido"
                    >
                      {showPreviewText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPreviewText ? 'Ocultar Texto' : 'Ver Texto'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBinaryInspector(!showBinaryInspector)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700 cursor-pointer"
                      title="Inspecionar bytes e metadados binários"
                    >
                      <Binary className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Bytes</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetActiveFile}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-rose-500/30 cursor-pointer"
                      title="Remover este arquivo e carregar outro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Trocar Arquivo</span>
                    </button>
                  </div>
                </div>

                {/* VISUALIZADOR DE TEXTO BRUTO (QUANDO EXPANDIDO) */}
                {showPreviewText && (
                  <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-neutral-400 font-semibold pb-1 border-b border-neutral-800">
                      <span>Texto Extraído do Documento ({activeWordCount} palavras):</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(currentCache?.rawText || ingestedPayload?.rawText || '');
                          setSuccessMessage('Texto copiado para a área de transferência!');
                        }}
                        className="text-lime-400 hover:text-lime-300 flex items-center gap-1 text-[11px]"
                      >
                        <Copy className="w-3 h-3" /> Copiar
                      </button>
                    </div>
                    <pre className="max-h-48 overflow-y-auto font-mono text-[11px] text-neutral-300 whitespace-pre-wrap leading-relaxed">
                      {currentCache?.rawText || ingestedPayload?.rawText || 'Sem conteúdo.'}
                    </pre>
                  </div>
                )}

                {/* INSPECTOR DE MAGIC BYTES & SHA-256 */}
                {showBinaryInspector && binaryInfo && (
                  <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 space-y-2 text-xs">
                    <div className="font-bold text-neutral-200 flex items-center gap-2">
                      <Binary className="w-4 h-4 text-lime-400" />
                      Inspeção Forense Binária
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                        <span className="text-neutral-500">MIME Real:</span> <span className="text-lime-300">{binaryInfo.detectedMime}</span>
                      </div>
                      <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                        <span className="text-neutral-500">Magic Bytes:</span> <span className="text-amber-300">{binaryInfo.magicBytesHex}</span>
                      </div>
                      <div className="p-2 rounded bg-neutral-950 border border-neutral-800 sm:col-span-2 truncate">
                        <span className="text-neutral-500">SHA-256:</span> <span className="text-neutral-300">{binaryInfo.sha256}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ================================================================= */}
              {/* PAINEL DE ACOMPANHAMENTO MODULAR EM TEMPO REAL: 10 BLOCOS CANÔNICOS */}
              {/* ================================================================= */}
              {mode === 'ebike' && (showModularMonitor || runningStep === 'all' || runningStep === 'deterministic' || currentActiveBlock !== null) && (
                <div className="bg-neutral-950 border-2 border-lime-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl border ${
                          currentActiveBlock !== null
                            ? 'bg-lime-500/20 text-lime-400 border-lime-500/40 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        }`}
                      >
                        {currentActiveBlock !== null ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-2">
                            Ingestão Modular por Pings da IA
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                currentActiveBlock !== null
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}
                            >
                              {currentActiveBlock !== null
                                ? `Processando Bloco ${currentActiveBlock === 'editorial' ? 'Editorial' : `${currentActiveBlock}/10`}`
                                : 'Concluído'}
                            </span>
                          </h4>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {currentActiveBlock !== null
                            ? `Executando prompt exclusivo para o bloco "${modularBlocks.find((b) => b.index === currentActiveBlock)?.title || '...'}" (${elapsedSeconds}s)`
                            : 'Todos os 10 blocos canônicos e o veredito editorial foram processados e alocados.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-400">
                        Progresso: <strong className="text-lime-400">{modularBlocks.filter((b) => b.status === 'completed').length}/11</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowModularMonitor(!showModularMonitor)}
                        className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                        title={showModularMonitor ? 'Ocultar detalhes dos blocos' : 'Expandir detalhes dos blocos'}
                      >
                        {showModularMonitor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* BARRA DE PROGRESSO DINÂMICA */}
                  <div className="space-y-1.5">
                    {/* O denominador vem da lista, não de um literal: `11` fixo
                        quebrava assim que um bloco fosse acrescentado ou removido. */}
                    {(() => {
                      const total = modularBlocks.length || 1;
                      const done = modularBlocks.filter((b) => b.status === 'completed').length;
                      const pct = Math.round((done / total) * 100);
                      return (
                        <>
                          <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 via-lime-400 to-indigo-500 transition-all duration-300 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                            <span>Taxa de Alocação: {pct}%</span>
                            <span>{currentActiveBlock !== null ? '⚡ Ping Ativo na LLM' : '✓ Alocação Pronta'}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* GRID DOS 10 BLOCOS CANÔNICOS + EDITORIAL */}
                  {showModularMonitor && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-1">
                      {modularBlocks.map((block) => {
                        const isRunning = block.status === 'running' || currentActiveBlock === block.index;
                        const isCompleted = block.status === 'completed';
                        const isFailed = block.status === 'failed';

                        return (
                          <div
                            key={String(block.index)}
                            className={`p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                              isRunning
                                ? 'bg-neutral-900 border-lime-400/80 shadow-lg shadow-lime-500/10 ring-1 ring-lime-400'
                                : isCompleted
                                ? 'bg-neutral-900/90 border-emerald-500/30'
                                : isFailed
                                ? 'bg-rose-950/20 border-rose-500/30'
                                : 'bg-neutral-950/40 border-neutral-800 opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                                  {block.index === 'editorial' ? 'ED' : `B${block.index}`}
                                </span>
                                <span className="text-xs font-bold text-neutral-200 truncate">
                                  {block.shortName}
                                </span>
                              </div>

                              <div>
                                {isRunning ? (
                                  <RefreshCw className="w-4 h-4 animate-spin text-lime-400" />
                                ) : isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : isFailed ? (
                                  <AlertCircle className="w-4 h-4 text-rose-400" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                                )}
                              </div>
                            </div>

                            <p className="text-[11px] text-neutral-400 mt-1 line-clamp-1">
                              {block.description}
                            </p>

                            <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                              {isRunning ? (
                                <span className="text-lime-300 font-semibold text-[10px] animate-pulse flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-ping" />
                                  Ping em execução...
                                </span>
                              ) : isCompleted ? (
                                <div className="flex flex-col w-full">
                                  <span className="text-lime-300 font-mono text-[11px] truncate font-medium" title={block.highlight}>
                                    {block.highlight || 'Concluído'}
                                  </span>
                                  {block.summary && (
                                    <span className="text-[10px] text-neutral-400">
                                      {block.summary}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-500 text-[10px]">
                                  Aguardando...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

              {/* ================================================================= */}
              {/* PAINEL DE ESPECIFICAÇÕES ETIQUETADAS EXTRAÍDAS PELA IA (QUANDO DISPONÍVEL) */}
              {/* ================================================================= */}
              {mode === 'ebike' && currentCache?.taggedSpecs && currentCache.taggedSpecs.length > 0 && (
                <div className="bg-neutral-950 border-2 border-indigo-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
                        <Tag className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-2">
                            Informações Extraídas com Tags de Especificação
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                              {currentCache.taggedSpecs.length} itens etiquetados
                            </span>
                          </h4>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {currentCache.isAllocatedToForm
                            ? '✓ Todas as informações foram extraídas e alocadas deterministicamente nos 10 Blocos Canônicos.'
                            : '⚡ As informações foram extraídas e identificadas com suas respectivas tags. Clique em "Alocar Determinístico" para transferi-las ao formulário.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTaggedInspector(!showTaggedInspector)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer"
                      >
                        {showTaggedInspector ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Ocultar Lista</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-lime-400" />
                            <span>Ver {currentCache.taggedSpecs.length} Itens</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* BARRA DE FILTROS POR TAG/BLOCOS */}
                  {showTaggedInspector && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                        <button
                          type="button"
                          onClick={() => setSelectedTagFilter('all')}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            selectedTagFilter === 'all'
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                              : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                          }`}
                        >
                          🎯 Todas ({currentCache.taggedSpecs.length})
                        </button>
                        {[
                          { id: 'bloco_1_resumo', name: '1. Resumo', icon: '📋' },
                          { id: 'bloco_2_motor', name: '2. Motor', icon: '⚡' },
                          { id: 'bloco_3_bateria', name: '3. Bateria', icon: '🔋' },
                          { id: 'bloco_4_ergonomia', name: '4. Quadro & Ergonomia', icon: '🚲' },
                          { id: 'bloco_5_seguranca', name: '5. Freios & Segurança', icon: '🛑' },
                          { id: 'bloco_6_transmissao', name: '6. Transmissão', icon: '⚙️' },
                          { id: 'bloco_7_rodas_dimensoes', name: '7. Rodas & Dimensões', icon: '📏' },
                          { id: 'bloco_8_conectividade', name: '8. Conectividade', icon: '📱' },
                          { id: 'bloco_9_garantias', name: '9. Garantias', icon: '🛡️' },
                          { id: 'bloco_10_contran', name: '10. CONTRAN', icon: '⚖️' },
                        ].map((t) => {
                          const count = currentCache.taggedSpecs?.filter(
                            (it) => it.tag === t.id || it.blocoIndex === Number(t.id.split('_')[1])
                          ).length || 0;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTagFilter(t.id)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                selectedTagFilter === t.id
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                              }`}
                            >
                              <span>{t.icon}</span>
                              <span>{t.name}</span>
                              <span className="text-[10px] font-bold opacity-75 font-mono">({count})</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* GRADE DE ESPECIFICAÇÕES ETIQUETADAS */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                        {currentCache.taggedSpecs
                          .filter((it) => {
                            if (selectedTagFilter === 'all') return true;
                            const tagIdx = Number(selectedTagFilter.split('_')[1]);
                            return it.tag === selectedTagFilter || it.blocoIndex === tagIdx;
                          })
                          .map((item, idx) => (
                            <div
                              key={`${item.blocoIndex}_${item.campo}_${idx}`}
                              className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between space-y-2"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="space-y-0.5 truncate">
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/60 inline-block">
                                    🏷️ B{item.blocoIndex}: {item.blocoNome || `Bloco ${item.blocoIndex}`}
                                  </span>
                                  <h6 className="text-xs font-bold text-neutral-200 truncate mt-1">
                                    {item.campo}
                                  </h6>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                  item.status === 'CONFIRMADO' || item.confidence === 'ALTA'
                                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                                    : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                                }`}>
                                  {item.confidence === 'ALTA' ? 'Alta (Auditado)' : item.confidence || 'Confirmado'}
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800/80">
                                <span className="text-xs font-bold text-lime-300 font-mono block break-words">
                                  {item.valor}
                                </span>
                                {item.evidencia && (
                                  <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2 italic font-sans" title={item.evidencia}>
                                    Fonte: &quot;{item.evidencia}&quot;
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* BOTÃO DE ALOCAÇÃO DETERMINÍSTICA A PARTIR DAS TAGS */}
                      <div className="pt-2 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-neutral-400">
                          {currentCache.isAllocatedToForm ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              Especificações já alocadas aos 10 Blocos Canônicos e formulário.
                            </span>
                          ) : (
                            <span className="text-indigo-300 font-medium">
                              Pronto para alocar {currentCache.taggedSpecs.length} especificações nos 10 Blocos Canônicos.
                            </span>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* PAINEL DE ESCOLHA DIRETA: EXTRAÇÃO COM IA OU ALOCAÇÃO DETERMINÍSTICA DIRETA */}
              {/* ================================================================= */}
              {mode === 'ebike' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* CARD 1: EXTRAIR INFORMAÇÕES COM IA (ROTULAR TAGS DE ESPECIFICAÇÃO) */}
                  <div className={`bg-neutral-950/90 border-2 rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all space-y-4 ${
                    runningStep === 'deterministic' || runningStep === 'all'
                      ? 'border-indigo-500 shadow-indigo-500/25 ring-1 ring-indigo-500/50'
                      : 'border-indigo-500/40 hover:border-indigo-500/70'
                  }`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm sm:text-base">
                          <Cpu className="w-5 h-5 text-indigo-400" />
                          <span>1. Extrair com IA (Rotular Tags)</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          runningStep === 'deterministic'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            : currentCache?.taggedSpecs && currentCache.taggedSpecs.length > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}>
                          {runningStep === 'deterministic'
                            ? `⚡ Extraindo (${elapsedSeconds}s)`
                            : currentCache?.taggedSpecs && currentCache.taggedSpecs.length > 0
                            ? `✓ ${currentCache.taggedSpecs.length} Tags Extraídas`
                            : 'Extração Factual + Tags'}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Analisa o documento com IA, extrai todos os parâmetros técnicos e <strong>associa a cada informação sua respectiva TAG de especificação</strong> (Motor, Bateria, Freios, etc.), sem forçar a alocação imediata.
                      </p>

                      {!currentCache && !ingestedPayload && (
                        <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-indigo-200">
                          💡 <strong>Pronto:</strong> Arraste ou selecione um arquivo acima para extrair e rotular as especificações com IA.
                        </div>
                      )}

                      {runningStep === 'deterministic' && (
                        <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/50 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-indigo-200 flex items-center gap-1.5">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-lime-400" />
                              Extraindo e rotulando especificações com IA...
                            </span>
                            <span className="font-mono text-lime-400 font-bold text-[11px]">⏱️ {elapsedSeconds}s</span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-lime-400 animate-pulse w-full rounded-full" />
                          </div>
                        </div>
                      )}

                      <ul className="text-[11px] text-neutral-400 space-y-1 pt-1">
                        <li className="flex items-center gap-1.5 text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Identifica componentes, unidades e valores reais</span>
                        </li>
                        <li className="flex items-center gap-1.5 text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Atribui tags de destino para cada um dos 10 blocos</span>
                        </li>
                        <li className="flex items-center gap-1.5 text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Permite conferir as tags antes de executar a alocação</span>
                        </li>
                      </ul>
                    </div>

                  </div>

                  {/* CARD 2: ALOCAÇÃO SEM LLM (DETERMINÍSTICA DIRETA) */}
                  <div className="bg-neutral-950/90 border-2 border-emerald-500/40 hover:border-emerald-500/70 rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base">
                          <Database className="w-5 h-5 text-emerald-400" />
                          <span>Alocação Direta Sem IA</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          100% Factual • Instantâneo
                        </span>
                      </div>

                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Lê tabelas, normaliza grandezas (V, Ah, W, Wh) e aloca diretamente os <strong>10 Blocos Canônicos</strong> no formulário sem realizar chamadas de IA.
                      </p>

                      {!currentCache && !ingestedPayload && (
                        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200">
                          💡 <strong>Instantâneo:</strong> Arraste ou selecione um arquivo acima para alocar os 10 blocos canônicos diretamente.
                        </div>
                      )}

                      {runningStep === 'deterministic' && (
                        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-200 flex items-center gap-1.5">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              Alocando 10 Blocos Canônicos no formulário...
                            </span>
                            <span className="font-mono text-emerald-400 font-bold text-[11px]">&lt; 100ms</span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 animate-pulse w-full rounded-full" />
                          </div>
                        </div>
                      )}

                      <ul className="text-[11px] text-neutral-400 space-y-1 pt-1">
                        <li className="flex items-center gap-1.5 text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Tempo de execução: <strong>&lt; 100 milissegundos</strong></span>
                        </li>
                        <li className="flex items-center gap-1.5 text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Custo zero de tokens e sem dependência de rede</span>
                        </li>
                        <li className="flex items-center gap-1.5 text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Ideal para Markdown, CSV e fichas técnicas oficiais</span>
                        </li>
                        <li className="flex items-center gap-1.5 text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Marca o que o fabricante <strong>não informou</strong> como {UNCONFIRMED_LABEL}</span>
                        </li>
                      </ul>
                    </div>


                    <button
                      type="button"
                      disabled={(!currentCache && !ingestedPayload) || runningStep !== null}
                      onClick={() => handleRunEBikeDeterministic()}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 text-neutral-950 disabled:text-neutral-500 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Iniciar Alocação Direta (Sem IA)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* A extração é determinística e termina no navegador: a etapa de
                  IA que fechava buraco não existe mais, então a caixa de
                  "permitir 1 chamada de IA" saiu junto com ela. O que sobrou
                  sem dado está na lista de buracos, abaixo do relatório. */}


              {/* OPÇÕES PARA MODO ARTIGO */}
              {mode === 'article' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="bg-neutral-950 p-4 rounded-2xl border border-cyan-500/30 flex flex-col justify-between space-y-3">
                    <div>
                      <h5 className="font-bold text-cyan-400 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Alocar Artigo Sem LLM
                      </h5>
                      <p className="text-xs text-neutral-300 mt-1">
                        Copia o texto diretamente para os campos de título, resumo e conteúdo sem usar IA.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunArticleDirect}
                      className="py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Iniciar Alocação Direta
                    </button>
                  </div>

                  <div className="bg-neutral-950 p-4 rounded-2xl border border-indigo-500/30 flex flex-col justify-between space-y-3">
                    <div>
                      <h5 className="font-bold text-indigo-400 text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Alocar Artigo Com LLM
                      </h5>
                      <p className="text-xs text-neutral-300 mt-1">
                        Gera título chamativo, slug, resumo otimizado e tags com base no documento.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* OPÇÕES PARA MODO RANKING */}
              {mode === 'ranking' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="bg-neutral-950 p-4 rounded-2xl border border-amber-500/30 flex flex-col justify-between space-y-3">
                    <div>
                      <h5 className="font-bold text-amber-400 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Alocar Ranking Sem LLM
                      </h5>
                      <p className="text-xs text-neutral-300 mt-1">
                        Mapeia tabelas e textos do documento diretamente para os campos do ranking.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunRankingDirect}
                      className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs cursor-pointer"
                    >
                      Iniciar Alocação Direta
                    </button>
                  </div>

                  <div className="bg-neutral-950 p-4 rounded-2xl border border-indigo-500/30 flex flex-col justify-between space-y-3">
                    <div>
                      <h5 className="font-bold text-indigo-400 text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Alocar Ranking Com LLM
                      </h5>
                      <p className="text-xs text-neutral-300 mt-1">
                        Estrutura posições, prós, contras e vereditos comparativos via IA.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* AUDITORIA DOS 10 BLOCOS CANÔNICOS */}
              {qualityReport && mode === 'ebike' && (
                <div className="p-4 bg-neutral-950/90 rounded-2xl border border-neutral-800 space-y-3 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg border ${
                        qualityReport.level === 'excellent'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : qualityReport.level === 'good'
                          ? 'bg-lime-500/20 text-lime-300 border-lime-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                          Auditoria dos 10 Blocos Canônicos da Ficha
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            qualityReport.score >= 90
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : qualityReport.score >= 70
                              ? 'bg-lime-500/20 text-lime-300 border-lime-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}>
                            {qualityReport.score}% Preenchido ({qualityReport.detectedBlocksCount}/10 Blocos)
                          </span>
                        </h5>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {qualityReport.summary}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowQualityDetails(!showQualityDetails)}
                      className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showQualityDetails ? 'Ocultar Detalhes' : 'Ver Todos os 10 Blocos'}</span>
                      {showQualityDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* GRID DOS 10 BLOCOS CANÔNICOS */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                    {qualityReport.checks.map((check) => (
                      <div
                        key={check.blockNumber}
                        className={`p-2 rounded-xl border transition-all flex flex-col justify-between ${
                          check.detected
                            ? 'bg-neutral-900/90 border-emerald-500/30 text-neutral-200'
                            : 'bg-neutral-900/40 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-semibold">
                          <span className="text-neutral-400 font-mono">B{check.blockNumber}</span>
                          {check.detected ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <span className="text-amber-400 text-[10px] font-bold">Pendente</span>
                          )}
                        </div>
                        <div className="font-semibold text-xs text-neutral-200 mt-1 truncate" title={check.label}>
                          {check.label}
                        </div>
                        <div className="text-[11px] font-mono text-lime-400 truncate mt-0.5">
                          {check.value || '—'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* DICAS PARA BLOCOS PENDENTES */}
                  {showQualityDetails && qualityReport.checks.some((c) => !c.detected) && (
                    <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1.5 text-xs">
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        Blocos pendentes no documento:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px]">
                        {qualityReport.checks
                          .filter((c) => !c.detected)
                          .map((c) => (
                            <li key={c.blockNumber}>
                              <strong className="text-neutral-200">{c.label}:</strong> {c.hint}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}


                  {/* LISTA COMPLETA DE BURACOS: O QUE O FABRICANTE NÃO INFORMOU */}
                  {specGaps.length > 0 && (
                    <div className="p-3 bg-neutral-900 rounded-xl border border-amber-500/30 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                          <FileSearch className="w-3.5 h-3.5 text-amber-400" />
                          Campos que o fabricante não informou
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {specGaps.length} buraco(s)
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {specGaps.some((g) => g.truncated) ? (
                          <>
                            <span className="font-semibold text-amber-400">
                              Parte do documento não foi lida.
                            </span>{' '}
                            Estes campos podem estar na parte não extraída —{' '}
                            <strong>ausência aqui não é o fabricante não ter informado</strong>. Abra o
                            documento e confira antes de marcar como não declarado.
                          </>
                        ) : (
                          <>
                            Cada linha abaixo está marcada como{' '}
                            <span className="text-neutral-300 font-semibold">{UNCONFIRMED_LABEL}</span>{' '}
                            na ficha. Preencha à mão com fonte verificável.
                          </>
                        )}
                      </p>

                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {CANONICAL_SPEC_SECTIONS.map((section, sectionIndex) => {
                          const gaps = specGaps.filter((gap) => gap.sectionIndex === sectionIndex);
                          if (gaps.length === 0) return null;

                          return (
                            <div
                              key={section.title}
                              className="p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800 space-y-1"
                            >
                              <div className="text-[11px] font-bold text-neutral-200">
                                {section.title}
                                <span className="ml-1.5 text-[10px] font-mono font-normal text-amber-400/80">
                                  ({gaps.length} de {section.items.length} sem valor)
                                </span>
                              </div>
                              <ul className="space-y-0.5">
                                {gaps.map((gap) => (
                                  <li
                                    key={`${gap.sectionIndex}_${gap.label}`}
                                    className="flex items-start gap-1.5 text-[11px] text-neutral-300"
                                  >
                                    <AlertCircle className="w-3 h-3 text-amber-400/80 shrink-0 mt-0.5" />
                                    <span className="min-w-0">
                                      <span className="text-neutral-200">{gap.label}</span>
                                      <span className="text-neutral-500"> — {UNCONFIRMED_LABEL}</span>
                                      {gap.synonyms.length > 0 && (
                                        <span className="block text-[10px] text-neutral-500 font-mono">
                                          sinônimos: {gap.synonyms.slice(0, 6).join(', ')}
                                        </span>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

          {/* ================================================================= */}
          {/* MENSAGENS DE NOTIFICAÇÃO                                          */}
          {/* ================================================================= */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3.5 rounded-xl bg-lime-950/50 border border-lime-500/40 text-lime-300 text-xs flex items-start gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
                <span className="flex-1 font-medium leading-relaxed">{successMessage}</span>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="text-lime-400/80 hover:text-lime-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 shadow-lg"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="flex-1 font-medium leading-relaxed">{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400/80 hover:text-rose-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL DE GERENCIAMENTO DE CACHE LOCAL                             */}
      {/* ================================================================= */}
      <AnimatePresence>
        {isCacheModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-lime-400" />
                  <h3 className="font-bold text-neutral-100 text-base">Caches Locais no Navegador</h3>
                  <span className="text-xs text-neutral-400">({storageInfo.formattedSize} usado)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCacheModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-3">
                {allCaches.length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-8">Nenhum cache salvo no navegador.</p>
                ) : (
                  allCaches.map((cache) => (
                    <div
                      key={cache.cacheId}
                      className="p-3 bg-neutral-800/80 border border-neutral-700 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <h5 className="text-sm font-semibold text-neutral-200">{cache.fileName}</h5>
                        <p className="text-xs text-neutral-400">
                          {cache.identity?.marca ? `${cache.identity.marca} ${cache.identity.modelo || ''}` : 'Sem identificação'} • {new Date(cache.updatedAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentCache(cache);
                            emitConsolidatedData(cache);
                            setIsCacheModalOpen(false);
                            setSuccessMessage(`Ficha de "${cache.fileName}" restaurada do cache local.`);
                          }}
                          className="px-2.5 py-1 rounded bg-lime-500/20 text-lime-400 hover:bg-lime-500/30 text-xs font-semibold cursor-pointer"
                        >
                          Carregar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteExtractionCache(cache.cacheId);
                            refreshCachesList();
                            if (currentCache?.cacheId === cache.cacheId) setCurrentCache(null);
                          }}
                          className="p-1.5 rounded hover:bg-rose-900/40 text-neutral-400 hover:text-rose-400 cursor-pointer"
                          title="Excluir do cache"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {allCaches.length > 0 && (
                <div className="p-3 border-t border-neutral-800 flex justify-between items-center bg-neutral-950">
                  <button
                    type="button"
                    onClick={handleClearAllStorage}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium flex items-center gap-1.5 border border-rose-500/30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Todo o Cache</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCacheModalOpen(false)}
                    className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
