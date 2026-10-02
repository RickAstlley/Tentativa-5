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
  Search,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import SafeImage from '@/components/ui/SafeImage';
import { uploadMedia } from '@/lib/media/upload';
import { uploadMediaOrKeep as uploadBase64ToCentralMedia } from '@/lib/media/upload';
import { fetchAdminJson } from '@/lib/apiResponse';

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
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);


  // Garantir que temos um array limpo
  const cleanImages = Array.isArray(images) ? images.filter((img) => typeof img === 'string') : [];




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
          </div>
      </div>
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
