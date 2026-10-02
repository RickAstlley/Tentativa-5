/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import SafeImage, { cleanImageUrl } from '@/components/ui/SafeImage';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Trash2,
  ExternalLink,
  Clipboard,
  Layers,
  FileImage,
  Search,
  ShieldCheck,
  Star,
  Check,
  Info,
  Plus,
} from 'lucide-react';
import { optimizeImageClientSide } from '@/lib/storage';
import { uploadMedia } from '@/lib/media/upload';
import { uploadMediaOrKeep as uploadBase64ToCentralMedia } from '@/lib/media/upload';
import { fetchAdminJson } from '@/lib/apiResponse';

export interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onAddToGallery?: (url: string) => void;
  folder?: 'bikes' | 'artigos' | 'articles' | 'rankings' | 'uploads';
  presetType?: 'bikes' | 'articles';
  required?: boolean;
  helpText?: string;
  aspectRatio?: 'video' | 'square' | 'wide';
  searchQueryHint?: string;
  contextHint?: string;
}

const BIKE_PRESETS = [
  {
    title: 'Urbana Moderna',
    url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'E-Bike City Commuter',
    url: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Mountain Bike E-MTB',
    url: 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Dobrável Compacta',
    url: 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Gravel & Estrada',
    url: 'https://images.unsplash.com/photo-1502744688674-c619d388440c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Lifestyle Ciclista',
    url: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80',
  },
];

const ARTICLE_PRESETS = [
  {
    title: 'Bateria e Tecnologia',
    url: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Mobilidade Urbana',
    url: 'https://images.unsplash.com/photo-1519505907962-0a6cb0167c73?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Ciclovia & Estrada',
    url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Oficina e Manutenção',
    url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Guia de Compra',
    url: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Natureza & Aventura',
    url: 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=1200&q=80',
  },
];


interface ImageAuditResult {
  isValid: boolean;
  confidenceScore: number;
  altText: string;
  caption: string;
  reasoning: string;
  recommendation: string;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  onAddToGallery,
  folder = 'uploads',
  presetType = 'bikes',
  required = false,
  helpText,
  aspectRatio = 'video',
  searchQueryHint,
  contextHint,
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    originalSize?: string;
    optimizedSize?: string;
    dimensions?: string;
    format?: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'presets'>('upload');
  const [customUrlInput, setCustomUrlInput] = useState('');

  // Estados de Busca e Validação por IA
  const [addedGalleryUrls, setAddedGalleryUrls] = useState<string[]>([]);
  const [gallerySuccessToast, setGallerySuccessToast] = useState<string | null>(null);

  // Estados de Auditoria de Imagem Existente por LLM
  const [auditResult, setAuditResult] = useState<ImageAuditResult | null>(null);

  // Sincroniza o hint com o input se mudar

  // Processa o arquivo selecionado ou arrastado
  const processImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP, AVIF).');
        return;
      }

      setErrorMessage(null);
      setIsProcessing(true);
      setUploadStage('Enviando imagem para a nuvem...');
      setAuditResult(null);

      const originalSizeBytes = file.size;
      const originalSizeFormatted =
        originalSizeBytes > 1024 * 1024
          ? `${(originalSizeBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(originalSizeBytes / 1024)} KB`;

      try {
        // 1. Otimização instantânea no cliente para preview e métricas
        const opt = await optimizeImageClientSide(file, 1600, 1600, 0.85);

        const optSizeFormatted =
          opt.sizeBytes > 1024 * 1024
            ? `${(opt.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(opt.sizeBytes / 1024)} KB`;

        setSuccessInfo({
          originalSize: originalSizeFormatted,
          optimizedSize: optSizeFormatted,
          dimensions: `${opt.width} × ${opt.height}px`,
          format: opt.format.replace('image/', '').toUpperCase(),
        });

        // 2. Upload para a API centralizada de mídia do TuaVia (https://tuavia.com.br/api/upload)
        const finalUrl = await uploadMedia(file, { folder, onProgress: (msg) => setUploadStage(msg) });
        onChange(finalUrl);
      } catch (err: unknown) {
        console.error('[ImageUploadField] Erro no upload centralizado:', err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Falha de conexão com a API de mídia (tuavia.com.br). Verifique sua conexão e tente novamente.'
        );
      } finally {
        setIsProcessing(false);
        setUploadStage(null);
      }
    },
    [folder, onChange]
  );

  // Manipulação de Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processImageFile(file);
    }
  };

  // Suporte a colar da área de transferência (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          processImageFile(file);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processImageFile]);

  // Aplica URL customizada
  const handleApplyCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = customUrlInput.trim();
    if (!raw) return;
    setErrorMessage(null);
    setAuditResult(null);

    // Se o usuário colou uma string Data URL base64, faz upload para o servidor central antes de aplicar
    if (raw.startsWith('data:image/')) {
      setIsProcessing(true);
      setUploadStage('Enviando imagem Base64 para a nuvem (tuavia.com.br)...');
      try {
        const mediaUrl = await uploadBase64ToCentralMedia(raw, {
          folder: folder === 'artigos' ? 'articles' : folder,
          onProgress: (m) => setUploadStage(m),
        });
        onChange(mediaUrl);
        setCustomUrlInput('');
        setSuccessInfo({
          originalSize: 'Base64 Convertido',
          optimizedSize: 'Nuvem Central',
          dimensions: 'WebP',
          format: 'WEBP',
        });
      } catch (err: any) {
        setErrorMessage(`Falha ao enviar imagem para tuavia.com.br: ${err.message}`);
      } finally {
        setIsProcessing(false);
        setUploadStage(null);
      }
      return;
    }

    const sanitized = cleanImageUrl(raw);
    onChange(sanitized);
    setSuccessInfo({
      originalSize: 'URL Web',
      optimizedSize: 'CDN Externa',
      dimensions: 'Direta',
      format: 'HTTP',
    });
  };

  // Busca Inteligente de Imagens via LLM & WebImageSearchTool

  // Auditoria da imagem atual com LLM Vision


  const handleClear = () => {
    onChange('');
    setSuccessInfo(null);
    setErrorMessage(null);
    setAuditResult(null);
    setCustomUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const presets = presetType === 'bikes' ? BIKE_PRESETS : ARTICLE_PRESETS;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="space-y-3 focus:outline-none"
      id="image-upload-field-container"
    >
      {/* Header do Campo */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-black uppercase text-stone-800 flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          <span>{label}</span>
          {required && <span className="text-rose-600">*</span>}
        </label>

        <div className="flex items-center gap-3">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remover</span>
            </button>
          )}
        </div>
      </div>

      {/* Box Principal de Preview e Ações */}
      <div className="bg-stone-50 border-2 border-stone-900 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
        {/* Visualizador de Imagem / Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!value && activeTab === 'upload' && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          className={`relative w-full ${
            aspectRatio === 'video'
              ? 'h-52 sm:h-60'
              : aspectRatio === 'square'
              ? 'h-52'
              : 'h-40'
          } rounded-xl border-2 transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50 scale-[1.01] shadow-md'
              : value
              ? 'border-stone-900 bg-stone-900'
              : 'border-dashed border-stone-400 bg-white hover:border-stone-800 hover:bg-stone-100/60'
          }`}
        >
          {value ? (
            <>
              <SafeImage
                src={value}
                alt={auditResult?.altText || label}
                fill
                className="object-contain p-2"
                fallbackSrc="https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-stone-950/85 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Imagem Carregada</span>
              </div>
            </>
          ) : (
            <div className="p-6 text-center space-y-2.5 max-w-sm">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border-2 border-emerald-300 text-emerald-700 flex items-center justify-center shadow-xs">
                {isProcessing ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-stone-900">
                  {isDragging ? 'Solte a imagem aqui' : 'Arraste, cole ou use a busca por IA'}
                </p>
                <p className="text-[11px] text-stone-500 font-medium leading-tight">
                  Upload local, URL direta ou pesquisa com validação multimodal
                </p>
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[10px] font-mono">
                <Clipboard className="w-3 h-3 text-stone-400" />
                <span>Dica: Ctrl+V ou use a aba &quot;Busca IA&quot;</span>
              </div>
            </div>
          )}

          {/* Overlay de Processamento */}
          {isProcessing && (
            <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 space-y-2 z-10 rounded-xl text-center">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
              <p className="text-xs font-black tracking-wide text-emerald-300">
                {uploadStage || 'Enviando imagem para a nuvem...'}
              </p>
              <span className="text-[10px] text-stone-300 font-mono">
                API Central: tuavia.com.br/api/upload
              </span>
            </div>
          )}
        </div>

        {/* Card de Auditoria da Imagem por LLM (quando auditada) */}
        {auditResult && value && (
          <div className="p-3.5 bg-amber-50/80 border-2 border-amber-400 rounded-xl space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Validação da LLM Vision:</span>
                <span className="px-2 py-0.2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-black text-[10px]">
                  {auditResult.confidenceScore}% Correspondência
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-800 uppercase">
                {auditResult.isValid ? '✓ Aprovada' : 'Atenção'}
              </span>
            </div>

            <div className="text-[11px] text-stone-700 space-y-1">
              <div>
                <strong className="text-stone-900">Alt Text SEO:</strong>{' '}
                <span className="font-mono bg-white px-1.5 py-0.2 rounded border border-stone-200 text-stone-800">
                  {auditResult.altText}
                </span>
              </div>
              <div>
                <strong className="text-stone-900">Parecer Técnico:</strong>{' '}
                <span>{auditResult.reasoning}</span>
              </div>
            </div>
          </div>
        )}

        {/* Informações Técnicas de Otimização */}
        {successInfo && value && !auditResult && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 font-bold">
              <FileImage className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Imagem Pronta:</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-emerald-900">
              {successInfo.originalSize && (
                <span>
                  Origem: <strong>{successInfo.originalSize}</strong>
                </span>
              )}
              {successInfo.dimensions && <span>• {successInfo.dimensions}</span>}
              {successInfo.format && (
                <span className="bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                  {successInfo.format}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mensagem de Erro se houver */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border-2 border-rose-900 rounded-xl text-xs font-bold text-rose-950 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Alternador de Modos (Upload / URL / Presets) */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap border-2 border-stone-900 rounded-xl p-1 bg-white gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 min-w-[90px] py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Arquivo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 min-w-[80px] py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>URL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 min-w-[80px] py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'presets'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Galeria</span>
            </button>
          </div>

          {/* Conteúdo Aba 1: Busca IA & Validação Multimodal */}

          {/* Conteúdo Aba 2: Upload de Arquivo */}
          {activeTab === 'upload' && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const selectedFile = e.target.files[0];
                    e.target.value = '';
                    processImageFile(selectedFile);
                  }
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-black text-xs rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(16,185,129,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>{value ? 'Substituir por Arquivo do PC' : 'Selecionar Arquivo de Imagem'}</span>
              </button>
            </div>
          )}

          {/* Conteúdo Aba 3: URL Direta */}
          {activeTab === 'url' && (
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://exemplo.com/foto-bike.jpg"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyCustomUrl(e as any);
                  }
                }}
                className="flex-1 px-3 py-2 bg-white border-2 border-stone-900 rounded-xl text-xs font-mono font-medium text-stone-900 outline-none focus:ring-2 focus:ring-stone-900"
              />
              <button
                type="button"
                onClick={(e) => handleApplyCustomUrl(e as any)}
                disabled={!customUrlInput.trim()}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(245,158,11,1)] cursor-pointer disabled:opacity-50 transition-all shrink-0"
              >
                Aplicar URL
              </button>
            </div>
          )}

          {/* Conteúdo Aba 4: Galeria Curada com 1 Clique */}
          {activeTab === 'presets' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600">
                <Layers className="w-3.5 h-3.5 text-stone-500" />
                <span>Selecione uma foto profissional em alta resolução:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onChange(preset.url);
                      setAuditResult(null);
                      setSuccessInfo({
                        originalSize: 'Unsplash HD',
                        optimizedSize: 'CDN Rápida',
                        dimensions: '1200 × 800px',
                        format: 'JPEG',
                      });
                    }}
                    className={`p-2 border-2 rounded-xl text-left flex flex-col gap-1.5 transition-all cursor-pointer group ${
                      value === preset.url
                        ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500'
                        : 'border-stone-300 bg-white hover:border-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    <div className="relative w-full h-16 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                      <SafeImage
                        src={preset.url}
                        alt={preset.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        fallbackSrc="https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=600&q=80"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="text-[11px] font-black text-stone-900 truncate">
                      {preset.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {helpText && (
          <p className="text-[11px] text-stone-500 font-medium leading-relaxed">
            {helpText}
          </p>
        )}
      </div>
    </div>
  );
}
