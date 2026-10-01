/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Images, 
  Plus, 
  Trash2, 
  Link as LinkIcon, 
  Upload, 
  Eye, 
  Check, 
  AlertCircle, 
  Sparkles,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  ExternalLink,
  Bot,
  Search,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import SafeImage from '@/components/ui/SafeImage';
import { uploadMedia } from '@/lib/media/upload';
import { uploadMediaOrKeep as uploadBase64ToCentralMedia } from '@/lib/media/upload';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import { createAndPollLLMJob } from '@/lib/ai/llmJobClient';

export interface GalleryImagesFieldProps {
  label?: string;
  description?: string;
  images: string[];
  onChange: (images: string[]) => void;
  folder?: 'bikes' | 'artigos' | 'articles' | 'uploads';
  maxImages?: number;
  presets?: { title: string; url: string }[];
  searchHint?: string;
}

export function GalleryImagesField({
  label = 'Galeria de Imagens Complementares',
  description = 'Adicione links de fotos ou faça upload para exibir na galeria de 4 fotos do produto/artigo em todo o site.',
  images = [],
  onChange,
  folder = 'uploads',
  maxImages = 8,
  presets = [],
  searchHint = '',
}: GalleryImagesFieldProps) {
  const [newUrl, setNewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados da Busca de Galeria com IA (LLM)
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [aiQuery, setAiQuery] = useState(searchHint);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiCandidates, setAiCandidates] = useState<any[]>([]);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (searchHint && !aiQuery) {
      setAiQuery(searchHint);
    }
  }, [searchHint, aiQuery]);

  // Garantir que temos um array limpo
  const cleanImages = Array.isArray(images) ? images.filter((img) => typeof img === 'string') : [];

  const handleRunAiGallerySearch = async () => {
    const q = aiQuery.trim() || searchHint.trim();
    if (!q) {
      setUploadError('Informe um termo para buscar imagens com IA.');
      return;
    }

    setIsAiSearching(true);
    setUploadError(null);
    setAiFeedback(null);

    try {
      const job = await createAndPollLLMJob({
        type: 'image_search_validate',
        input: {
          action: 'search',
          query: q,
          count: 6,
          contextHint: `Galeria complementar de fotos para: ${q}`,
        },
      });

      const results = job.result?.data?.results || job.result?.article_images || [];
      if (job.status === 'completed' && Array.isArray(results)) {
        setAiCandidates(results);
        if (results.length === 0) {
          setAiFeedback('Nenhuma imagem complementar encontrada para o termo.');
          setTimeout(() => setAiFeedback(null), 3500);
        }
      } else {
        throw new Error(job.error || 'Falha ao buscar imagens.');
      }
    } catch (err: any) {
      console.error('[GalleryImagesField] Erro na busca IA:', err);
      setUploadError(err.message || 'Erro ao pesquisar fotos.');
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleAddAiImageToGallery = async (url: string) => {
    if (cleanImages.includes(url)) {
      setAiFeedback('Esta imagem já está na sua galeria.');
      setTimeout(() => setAiFeedback(null), 3000);
      return;
    }
    if (cleanImages.length >= maxImages) {
      setUploadError(`Limite máximo de ${maxImages} imagens atingido.`);
      return;
    }

    let finalUrl = url;
    if (finalUrl.startsWith('data:image/')) {
      setIsUploading(true);
      setUploadProgressText('Enviando foto da galeria para a nuvem (tuavia.com.br)...');
      try {
        finalUrl = await uploadBase64ToCentralMedia(finalUrl, {
          folder: folder === 'artigos' ? 'articles' : folder,
          onProgress: (m) => setUploadProgressText(m),
        });
      } catch (err: any) {
        setUploadError(`Falha ao enviar imagem da galeria: ${err.message}`);
        setIsUploading(false);
        setUploadProgressText(null);
        return;
      } finally {
        setIsUploading(false);
        setUploadProgressText(null);
      }
    }

    onChange([...cleanImages, finalUrl]);
    setAiFeedback('Foto adicionada à galeria com sucesso!');
    setTimeout(() => setAiFeedback(null), 3000);
  };

  const handleAddAllAiImages = () => {
    const toAdd: string[] = [];
    for (const cand of aiCandidates) {
      if (!cleanImages.includes(cand.imageUrl) && !toAdd.includes(cand.imageUrl)) {
        if (cleanImages.length + toAdd.length >= maxImages) break;
        toAdd.push(cand.imageUrl);
      }
    }
    if (toAdd.length > 0) {
      onChange([...cleanImages, ...toAdd]);
      setAiFeedback(`${toAdd.length} fotos adicionadas à galeria!`);
      setTimeout(() => setAiFeedback(null), 3500);
    }
  };

  const handleAddUrl = async () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    if (cleanImages.length >= maxImages) {
      setUploadError(`Limite máximo de ${maxImages} imagens atingido.`);
      return;
    }

    if (trimmed.startsWith('data:image/')) {
      setIsUploading(true);
      setUploadProgressText('Enviando imagem Base64 para a nuvem (tuavia.com.br)...');
      setUploadError(null);
      try {
        const mediaUrl = await uploadBase64ToCentralMedia(trimmed, {
          folder: folder === 'artigos' ? 'articles' : folder,
          onProgress: (m) => setUploadProgressText(m),
        });
        onChange([...cleanImages, mediaUrl]);
        setNewUrl('');
      } catch (err: any) {
        setUploadError(`Falha ao enviar imagem para a nuvem: ${err.message}`);
      } finally {
        setIsUploading(false);
        setUploadProgressText(null);
      }
      return;
    }

    onChange([...cleanImages, trimmed]);
    setNewUrl('');
    setUploadError(null);
  };

  const handleRemove = (index: number) => {
    const updated = cleanImages.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleUpdate = (index: number, val: string) => {
    const updated = [...cleanImages];
    updated[index] = val;
    onChange(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === cleanImages.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...cleanImages];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    onChange(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const newUploadedUrls: string[] = [];
      const normFolder = folder === 'artigos' ? 'articles' : folder;
      for (let i = 0; i < files.length; i++) {
        if (cleanImages.length + newUploadedUrls.length >= maxImages) break;
        const file = files[i];
        setUploadProgressText(`Enviando foto ${i + 1}/${files.length} para a nuvem (tuavia.com.br)...`);
        const res = await uploadMedia(file, { folder: normFolder, onProgress: (m) => setUploadProgressText(m) });
        if (res && typeof res === 'string') {
          newUploadedUrls.push(res);
        }
      }
      onChange([...cleanImages, ...newUploadedUrls]);
    } catch (err: unknown) {
      console.error('[GalleryImagesField] Erro no upload:', err);
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Falha de conexão com a API de mídia (tuavia.com.br). Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgressText(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddPreset = (url: string) => {
    if (cleanImages.includes(url)) return;
    if (cleanImages.length >= maxImages) {
      setUploadError(`Limite de ${maxImages} imagens atingido.`);
      return;
    }
    onChange([...cleanImages, url]);
  };

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-5">
      {/* Cabeçalho do Bloco */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-stone-100 pb-3">
        <div>
          <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
            <Images className="w-5 h-5 text-emerald-600" />
            {label}
          </h3>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            {description}
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 bg-stone-100 border border-stone-300 rounded-lg text-stone-700 self-start sm:self-center">
          {cleanImages.length} / {maxImages} fotos
        </span>
      </div>

      {isUploading && (
        <div className="p-3 bg-emerald-50 border-2 border-emerald-600 rounded-xl text-emerald-900 text-xs font-black flex items-center gap-2 animate-pulse">
          <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
          <span>{uploadProgressText || 'Enviando imagem para a nuvem (tuavia.com.br)...'}</span>
        </div>
      )}

      {uploadError && (
        <div className="p-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Ações de Entrada: Link, Upload e Busca IA */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8 flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                placeholder="Cole o link da imagem (https://...)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-mono font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={!newUrl.trim()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold font-mono rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Inserir Link</span>
            </button>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              multiple
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-900 border-2 border-stone-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>{isUploading ? 'Enviando...' : 'Upload'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAiSearch(!showAiSearch)}
              className={`py-2.5 px-3 rounded-xl border-2 border-stone-900 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all ${
                showAiSearch
                  ? 'bg-amber-400 text-stone-900'
                  : 'bg-stone-900 hover:bg-stone-800 text-amber-300'
              }`}
            >
              <Bot className="w-4 h-4 text-amber-400" />
              <span>Buscar com IA</span>
            </button>
          </div>
        </div>

        {/* Painel Expansível de Busca com IA para Galeria */}
        {showAiSearch && (
          <div className="p-4 bg-amber-50/70 border-2 border-amber-400 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-stone-900">
                  Pesquisa e Curadoria Automática de Fotos Complementares
                </span>
              </div>
              <span className="text-[11px] font-mono text-stone-500">
                NVIDIA NIM • Validação de Fotos Reais
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nome do produto ou tema da foto..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRunAiGallerySearch();
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="button"
                onClick={handleRunAiGallerySearch}
                disabled={isAiSearching}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-amber-300 font-black text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {isAiSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Buscando Fotos...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-amber-400" />
                    <span>Pesquisar</span>
                  </>
                )}
              </button>
            </div>

            {aiFeedback && (
              <div className="p-2 bg-emerald-100 border border-emerald-500 rounded-lg text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-700" />
                <span>{aiFeedback}</span>
              </div>
            )}

            {/* Resultados da Pesquisa IA */}
            {aiCandidates.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Fotos Encontradas ({aiCandidates.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddAllAiImages}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg border border-stone-900 transition-all cursor-pointer shadow-xs"
                  >
                    + Adicionar Todas ({aiCandidates.length}) à Galeria
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {aiCandidates.map((cand) => {
                    const isInGallery = cleanImages.includes(cand.imageUrl);
                    return (
                      <div
                        key={cand.id}
                        className={`p-2 bg-white border-2 rounded-xl flex flex-col justify-between gap-1.5 transition-all ${
                          isInGallery ? 'border-emerald-600 bg-emerald-50/50' : 'border-stone-900 hover:border-amber-500'
                        }`}
                      >
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                          <img
                            src={cand.thumbnailUrl || cand.imageUrl}
                            alt={cand.altText}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {isInGallery && (
                            <div className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow">
                              ✓ Galeria
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-stone-900 truncate" title={cand.title}>
                          {cand.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleAddAiImageToGallery(cand.imageUrl)}
                          className={`w-full py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            isInGallery
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-stone-900 shadow-xs'
                          }`}
                        >
                          {isInGallery ? <Check className="w-3 h-3 text-emerald-700" /> : <Plus className="w-3 h-3 text-white" />}
                          <span>{isInGallery ? 'Na Galeria' : '+ Galeria'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sugestões Rápidas / Presets (se fornecidos) */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-mono font-bold text-stone-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Sugestões Rápidas:
          </span>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAddPreset(preset.url)}
              className="text-[11px] font-mono px-2.5 py-1 bg-stone-50 hover:bg-stone-200 border border-stone-300 rounded-lg text-stone-700 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>+</span>
              <span>{preset.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Grid de Imagens Atuais da Galeria */}
      {cleanImages.length === 0 ? (
        <div className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center bg-stone-50/50 flex flex-col items-center justify-center gap-2">
          <ImageIcon className="w-8 h-8 text-stone-400" />
          <p className="text-xs font-mono font-bold text-stone-600">
            Nenhuma foto complementar cadastrada ainda.
          </p>
          <p className="text-[11px] text-stone-400 max-w-md">
            Você pode adicionar até {maxImages} fotos por link ou upload. No site, o sistema completa automaticamente com fotos oficiais padrão se houver menos de 4 fotos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {cleanImages.map((url, index) => (
            <div
              key={index}
              className="relative group border-2 border-stone-900 rounded-xl overflow-hidden bg-stone-100 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex flex-col"
            >
              {/* Thumbnail com SafeImage */}
              <div className="relative w-full aspect-video bg-neutral-200 overflow-hidden">
                <SafeImage
                  src={url}
                  alt={`Imagem ${index + 1} da galeria`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
                
                {/* Badge de Posição */}
                <div className="absolute top-2 left-2 bg-stone-900/90 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow">
                  Foto {index + 1}
                </div>

                {/* Ações Rápidas em Hover */}
                <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(url)}
                    className="p-2 bg-white text-stone-900 rounded-lg hover:bg-stone-100 shadow cursor-pointer"
                    title="Visualizar Imagem"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow cursor-pointer"
                    title="Remover Imagem"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Controles de Ordem e Input Editável */}
              <div className="p-2.5 bg-white border-t-2 border-stone-900 flex flex-col gap-1.5">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUpdate(index, e.target.value)}
                  placeholder="URL da imagem..."
                  className="w-full px-2 py-1 bg-stone-50 border border-stone-300 rounded text-[10px] font-mono text-stone-700 truncate focus:outline-none focus:border-emerald-500"
                />

                <div className="flex items-center justify-between text-[11px] font-mono text-stone-500">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-stone-100 rounded disabled:opacity-30 cursor-pointer"
                      title="Mover para esquerda"
                    >
                      <ArrowUp className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === cleanImages.length - 1}
                      className="p-1 hover:bg-stone-100 rounded disabled:opacity-30 cursor-pointer"
                      title="Mover para direita"
                    >
                      <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer text-[10px] uppercase"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Zoom */}
      {previewZoom && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewZoom(null)}
        >
          <div className="relative max-w-4xl w-full aspect-video bg-stone-900 rounded-2xl overflow-hidden border-2 border-white">
            <SafeImage
              src={previewZoom}
              alt="Pré-visualização da imagem"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
