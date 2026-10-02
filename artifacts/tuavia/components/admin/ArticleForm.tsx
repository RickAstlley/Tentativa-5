'use client';

import BlockEditorWrapper from '@/components/admin/BlockEditorWrapper';
import { slugify } from '@/lib/slug';
import React, { useState, useEffect, useRef } from 'react';
import SafeImage, { cleanImageUrl } from '@/components/ui/SafeImage';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Article, ArticleCategory, ARTICLE_CATEGORIES } from '@/types/article';
import { cn } from '@/lib/utils';
import { EBikeCategory } from '@/types/ebike';
import { PUBLISHED_ARTICLES_STORAGE_KEY, fetchArticlesFromFirestore, extractFirstImageUrlFromMarkdown } from '@/lib/articles';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { GalleryImagesField } from '@/components/admin/GalleryImagesField';
import FileIngestionDropzone from '@/components/admin/FileIngestionDropzone';
import { ExtractedImageFile } from '@/lib/admin/fileIngestion';
import { fetchAdminJson } from '@/lib/apiResponse';
import { autoLinkEBikesInText } from '@/lib/ebikeAutoLinker';
import {
  sanitizeAndUploadArticleImages,
  uploadMediaOrKeep as uploadBase64ToCentralMedia,
} from '@/lib/media/upload';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatMarkdownForDisplay } from '@/lib/utils/markdownFormatter';
import { useAutoSave } from '@/hooks/useAutoSave';
import type { EditorBlock } from '@/types/blockEditor';
import SnippetsPanel from '@/components/admin/SnippetsPanel';

import {
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Image as ImageIcon,
  Eye,
  Edit3,
  Calendar,
  Clock,
  Sparkles,
  Zap,
  Info,
  ShieldCheck,
  Tag,
  Check,
  Link as LinkIcon,
  ExternalLink,
  Plus,
  Bike,
  RotateCcw,
  Trash2,
  GripVertical,
  Maximize2,
  Minimize2,
  Columns2,
  Layout,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  Quote,
  Image,
  Table,
  Code,
  Minus,
  Plus as PlusIcon,
  Copy,
  Sparkles as SparklesIcon,
  ArrowUpDown,
  Trophy,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const BIKE_CATEGORIES: EBikeCategory[] = [
  'Urbana',
  'Trilha/MTB',
  'Dobrável',
  'Cargo',
  'Speed',
];

interface ArticleFormProps {
  initialData?: Article | null;
  isEditing?: boolean;
}

export default function ArticleForm({ initialData, isEditing = false }: ArticleFormProps) {
  const router = useRouter();

  // Campos do Artigo
  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [autoSlug, setAutoSlug] = useState(!isEditing);
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || '');
  const [category, setCategory] = useState<ArticleCategory>(
    initialData?.category || 'Guia de Compra'
  );
  const [publishedAt, setPublishedAt] = useState<string>(
    initialData?.publishedAt || new Date().toISOString().split('T')[0]
  );
  const [readingTimeMinutes, setReadingTimeMinutes] = useState<number>(
    initialData?.readingTimeMinutes || 5
  );
  const [coverImage, setCoverImage] = useState(initialData?.coverImage || '');
  const [galleryImages, setGalleryImages] = useState<string[]>(initialData?.galleryImages || []);
  const [body, setBody] = useState(initialData?.body || '');
  const [relatedBikeCategories, setRelatedBikeCategories] = useState<string[]>(
    initialData?.relatedBikeCategories || []
  );
  const [showAiIngestionTools, setShowAiIngestionTools] = useState<boolean>(!isEditing && !title);

  // Estados para Ferramenta de Links Internos
  const [siteArticlesList, setSiteArticlesList] = useState<{ title: string; slug: string }[]>([]);
  const [siteBikesList, setSiteBikesList] = useState<{ label: string; slug: string }[]>([]);
  const [selectedLinkType, setSelectedLinkType] = useState<'article' | 'bike' | 'custom'>('article');
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string>('');
  const [selectedBikeSlug, setSelectedBikeSlug] = useState<string>('');
  const [customLinkUrl, setCustomLinkUrl] = useState<string>('');
  const [customLinkText, setCustomLinkText] = useState<string>('');
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAutoLinkingBikes, setIsAutoLinkingBikes] = useState(false);

  // Inline AI Editor state

  // Snippets Panel state
  const [showSnippets, setShowSnippets] = useState(false);

  // Auto-save para rascunho
  const articleState = { title, slug, excerpt, category, publishedAt, readingTimeMinutes, coverImage, galleryImages, body, relatedBikeCategories };
  const { forceSave, clear: clearAutoSave, lastRestored } = useAutoSave({
    key: `article_${isEditing ? initialData?.slug : 'new'}`,
    data: articleState,
    debounceMs: 1500,
    onRestore: (restored) => {
      if (restored.title) setTitle(restored.title);
      if (restored.slug) setSlug(restored.slug);
      if (restored.excerpt) setExcerpt(restored.excerpt);
      if (restored.category) setCategory(restored.category);
      if (restored.publishedAt) setPublishedAt(restored.publishedAt);
      if (restored.readingTimeMinutes) setReadingTimeMinutes(restored.readingTimeMinutes);
      if (restored.coverImage) setCoverImage(restored.coverImage);
      if (restored.galleryImages) setGalleryImages(restored.galleryImages);
      if (restored.body) setBody(restored.body);
      if (restored.relatedBikeCategories) setRelatedBikeCategories(restored.relatedBikeCategories);
    },
    enabled: true,
  });

  // Carrega publicações e e-bikes salvas para popular caixa de links internos
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Artigos
      fetchArticlesFromFirestore()
        .then((articles) => {
          if (Array.isArray(articles) && articles.length > 0) {
            setSiteArticlesList(articles.map((a: any) => ({ title: a.title || a.titulo, slug: a.slug })));
          }
        })
        .catch(() => {
          try {
            const rawArt = localStorage.getItem(PUBLISHED_ARTICLES_STORAGE_KEY);
            const parsedArt = rawArt ? JSON.parse(rawArt) : [];
            if (Array.isArray(parsedArt) && parsedArt.length > 0) {
              setSiteArticlesList(parsedArt.map((a: any) => ({ title: a.title || a.titulo, slug: a.slug })));
            }
          } catch (_) {}
        });

      // 2. E-Bikes
      try {
        const rawBike = localStorage.getItem('tuavia_published_bikes_v1');
        const parsedBike = rawBike ? JSON.parse(rawBike) : [];
        if (Array.isArray(parsedBike) && parsedBike.length > 0) {
          setSiteBikesList(parsedBike.map((b: any) => ({ label: `${b.marca} ${b.modelo}`, slug: b.slug })));
        } else {
          fetch('/api/ebikes')
            .then((r) => r.json())
            .then((list) => {
              if (Array.isArray(list)) {
                setSiteBikesList(list.map((b: any) => ({ label: `${b.marca} ${b.modelo}`, slug: b.slug })));
              }
            })
            .catch(() => {});
        }
      } catch {
        fetch('/api/ebikes')
          .then((r) => r.json())
          .then((list) => {
            if (Array.isArray(list)) {
              setSiteBikesList(list.map((b: any) => ({ label: `${b.marca} ${b.modelo}`, slug: b.slug })));
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  const handleInsertLinkToBody = () => {
    let targetUrl = '';
    let defaultLabel = '';
    if (selectedLinkType === 'article') {
      const art = siteArticlesList.find((a) => a.slug === selectedArticleSlug);
      if (!art) return;
      targetUrl = `/artigos/${art.slug}`;
      defaultLabel = art.title;
    } else if (selectedLinkType === 'bike') {
      const bike = siteBikesList.find((b) => b.slug === selectedBikeSlug);
      if (!bike) return;
      targetUrl = `/bike/${bike.slug}`;
      defaultLabel = bike.label;
    } else {
      if (!customLinkUrl.trim()) return;
      targetUrl = customLinkUrl.trim();
      defaultLabel = customLinkUrl.trim();
    }

    const textarea = bodyTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = body.substring(start, end).trim();
      const label = customLinkText.trim() || selectedText || defaultLabel;
      const markdownLink = ` [${label}](${targetUrl}) `;
      
      const newBody = body.substring(0, start) + markdownLink + body.substring(end);
      setBody(newBody);
      
      setTimeout(() => {
        textarea.focus();
        const newPos = start + markdownLink.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 50);
    } else {
      const label = customLinkText.trim() || defaultLabel;
      const markdownLink = ` [${label}](${targetUrl}) `;
      setBody((prev) => prev + markdownLink);
    }

    setCustomLinkText('');
    setCustomLinkUrl('');
    setAiSuccessMessage(`Link inserido com sucesso no artigo: ${targetUrl}`);
  };

  const handleAutoLinkEBikes = () => {
    if (!body.trim()) {
      setError('O corpo do artigo está vazio. Digite ou importe o conteúdo do artigo antes de auto-vincular e-bikes.');
      return;
    }
    setError(null);
    setAiSuccessMessage(null);

    try {
      const result = autoLinkEBikesInText(body);
      setBody(result.updatedText);
      if (result.linkedCount > 0) {
        setAiSuccessMessage(
          `⚡ ${result.linkedCount} e-bike(s) publicadas no site foram identificadas e vinculadas automaticamente no texto! (${result.linkedBikes.join(', ')})`
        );
      } else {
        setAiSuccessMessage('Nenhuma e-bike não-vinculada do catálogo foi encontrada no texto (ou todas já possuem link).');
      }
    } catch (err: any) {
      console.error('Erro ao auto-vincular e-bikes:', err);
      setError('Falha ao auto-vincular e-bikes do catálogo.');
    }
  };

  const [saving, setSaving] = useState(false);
  const [savingStage, setSavingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState<boolean>(false);
  const [lastFailedAction, setLastFailedAction] = useState<(() => void) | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Carrega rascunho salvo localmente se disponível
  useEffect(() => {
    if (!initialData && typeof window !== 'undefined') {
      try {
        const storedSession = sessionStorage.getItem('tuavia_prefill_article');
        const storedLocal = localStorage.getItem('tuavia_prefill_article') || localStorage.getItem('tuavia_draft_article_audit');
        const storedStr = storedSession || storedLocal;

        if (storedStr) {
          const parsed = JSON.parse(storedStr);
          if (parsed.title || parsed.titulo || parsed.metaTitle) {
            setTitle(parsed.title || parsed.titulo || parsed.metaTitle);
          }
          if (parsed.slug) {
            setSlug(parsed.slug);
          } else if (parsed.title || parsed.titulo) {
            setSlug(slugify(parsed.title || parsed.titulo));
          }

          if (parsed.excerpt || parsed.resumo || parsed.seo?.metaDescription || parsed.metaDescription) {
            setExcerpt(parsed.excerpt || parsed.resumo || parsed.seo?.metaDescription || parsed.metaDescription);
          }
          if (parsed.category || parsed.categoria) {
            const cat = parsed.category || parsed.categoria;
            if (ARTICLE_CATEGORIES.includes(cat)) {
              setCategory(cat as ArticleCategory);
            }
          }
          if (parsed.readingTimeMinutes || parsed.readTimeMinutes || parsed.readTime) {
            setReadingTimeMinutes(parsed.readingTimeMinutes || parsed.readTimeMinutes || parsed.readTime);
          }
          if (parsed.body || parsed.markdownContent || parsed.artigo_completo_markdown || parsed.content) {
            setBody(parsed.body || parsed.markdownContent || parsed.artigo_completo_markdown || parsed.content);
          }
          if (Array.isArray(parsed.relatedBikeCategories)) {
            setRelatedBikeCategories(parsed.relatedBikeCategories);
          } else if (Array.isArray(parsed.referencedBikes)) {
            setRelatedBikeCategories(parsed.referencedBikes);
          }

          if (parsed.coverImage || parsed.capaUrl || parsed.imagemCapa) {
            setCoverImage(parsed.coverImage || parsed.capaUrl || parsed.imagemCapa);
          }
          if (Array.isArray(parsed.galleryImages) && parsed.galleryImages.length > 0) {
            setGalleryImages(parsed.galleryImages);
          }

          setAiSuccessMessage('Artigo e metadados importados com sucesso!');
          sessionStorage.removeItem('tuavia_prefill_article');
          localStorage.removeItem('tuavia_prefill_article');
          localStorage.removeItem('tuavia_draft_article_audit');
        }
      } catch (err) {
        console.error('Erro ao carregar pré-preenchimento do artigo:', err);
      }
    }
  }, [initialData]);

  // Modo de visualização (Editor x Pré-visualização x Split x Blocos)
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'split' | 'blocks'>('editor');

  // Blocks state for drag-drop editor
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);

  // Initialize blocks from body content
  useEffect(() => {
    if (body && blocks.length === 0) {
      const initialBlocks: EditorBlock[] = body.split('\n\n').filter(Boolean).map((content, i) => ({
        id: `block-${i}-${Date.now()}`,
        type: content.startsWith('# ') ? 'h1' : content.startsWith('## ') ? 'h2' : content.startsWith('### ') ? 'h3' : content.startsWith('- ') ? 'bulletList' : content.startsWith('> ') ? 'blockquote' : content.startsWith('| ') ? 'table' : content.startsWith('```') ? 'code' : 'paragraph',
        content: content.trim(),
      }));
      if (initialBlocks.length > 0) {
        setBlocks(initialBlocks);
      }
    }
  }, [body, blocks.length]);

  // Sync blocks back to body
  const handleBlocksChange = (newBlocks: EditorBlock[]) => {
    setBlocks(newBlocks);
    const markdown = newBlocks.map(b => b.content).join('\n\n');
    if (markdown !== body) {
      setBody(markdown);
    }
  };

  // Split view state
  const [splitRatio, setSplitRatio] = useState(50);
  const [isResizing, setIsResizing] = useState(false);

  const handleSplitResize = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isResizing) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const containerWidth = e.currentTarget.parentElement?.offsetWidth || 800;
    const newRatio = Math.max(20, Math.min(80, (clientX / containerWidth) * 100));
    setSplitRatio(newRatio);
  };

  const handleResizeStart = () => setIsResizing(true);
  const handleResizeEnd = () => setIsResizing(false);

  /**
   * Handlers globais do split view.
   *
   * Este efeito vivia dentro do callback da prop `a` do renderizador markdown.
   * Ali é uma função comum, não um componente React: o hook era chamado a cada
   * render e os listeners nunca ficavam registrados. Precisa ficar no corpo
   * do componente.
   */

  // Global resize handlers for split view
  useEffect(() => {
    if (!isResizing) return;
    
    // `handleSplitResize` é tipado com eventos sintéticos do React; aqui os
    // eventos vêm de `window` e são nativos. Só o par { clientX, clientY } é
    // lido, então a conversão é segura.
    const toPoint = (e: MouseEvent | TouchEvent) =>
      'touches' in e
        ? { clientX: e.touches[0]?.clientX ?? 0, clientY: e.touches[0]?.clientY ?? 0 }
        : e;

    const handleMouseMove = (e: MouseEvent) =>
      handleSplitResize(toPoint(e) as unknown as React.MouseEvent);
    const handleTouchMove = (e: TouchEvent) =>
      handleSplitResize(toPoint(e) as unknown as React.TouchEvent);
    const handleMouseUp = () => handleResizeEnd();
    const handleTouchEnd = () => handleResizeEnd();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isResizing]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (autoSlug) {
      setSlug(slugify(newTitle));
    }
  };

  const handleAutoSlugToggle = (enabled: boolean) => {
    setAutoSlug(enabled);
    if (enabled && title) {
      setSlug(slugify(title));
    }
  };

  const handleBodyChange = (newBody: string) => {
    setBody(newBody);
    if (newBody) {
      const words = newBody.trim().split(/\s+/).filter(Boolean).length;
      const calculatedMin = Math.max(1, Math.ceil(words / 200));
      setReadingTimeMinutes(calculatedMin);
    }
  };

  // Alternar categoria de bike relacionada
  const handleCategoryToggle = (cat: string) => {
    setRelatedBikeCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!title.trim()) {
      setError('O título do artigo é obrigatório.');
      return;
    }

    const cleanSlug = slug.trim() || slugify(title);
    if (!cleanSlug) {
      setError('O slug do artigo é obrigatório.');
      return;
    }

    if (!excerpt.trim()) {
      setError('O resumo/excerpt do artigo é obrigatório.');
      return;
    }

    const extractedCoverFromMarkdown = extractFirstImageUrlFromMarkdown(body);
    const finalCover = coverImage.trim() || extractedCoverFromMarkdown || '';

    if (!finalCover) {
      setError('A imagem de capa é obrigatória (faça upload, insira uma URL ou inclua uma imagem no corpo do artigo).');
      return;
    }

    if (!body.trim()) {
      setError('O corpo do artigo em Markdown não pode estar vazio.');
      return;
    }

    setSaving(true);
    setSavingStage('Verificando imagens...');

    try {
      // Faz o upload centralizado para tuavia.com.br/api/upload de qualquer imagem do artigo (capa, galeria, markdown)
      const processedImages = await sanitizeAndUploadArticleImages(
        {
          slug: cleanSlug,
          coverImage: finalCover,
          galleryImages,
          body,
        },
        (msg) => setSavingStage(msg)
      );

      const sanitizedCover = cleanImageUrl(processedImages.coverImage);
      const sanitizedGallery = processedImages.galleryImages
        .map((img) => cleanImageUrl(img))
        .filter((img) => typeof img === 'string' && img.trim().length > 0);
      const sanitizedBody = processedImages.body.trim();

      // Mantém os estados da UI sincronizados com as novas URLs
      if (processedImages.coverImage !== coverImage) {
        setCoverImage(sanitizedCover);
      }
      if (processedImages.body !== body) {
        setBody(sanitizedBody);
      }
      setGalleryImages(sanitizedGallery);

      // Constrói o publishedAt garantindo precisão com data e horário para cronologia absoluta
      let finalPublishedAt = new Date().toISOString();
      if (publishedAt && publishedAt.trim().length > 0) {
        const rawDate = publishedAt.trim();
        if (rawDate.includes('T')) {
          finalPublishedAt = rawDate;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          const todayYmd = new Date().toISOString().split('T')[0];
          if (rawDate === todayYmd) {
            finalPublishedAt = new Date().toISOString();
          } else {
            finalPublishedAt = `${rawDate}T12:00:00.000Z`;
          }
        } else {
          finalPublishedAt = rawDate;
        }
      }

      const articleData: Article = {
        slug: cleanSlug,
        title: title.trim(),
        excerpt: excerpt.trim(),
        category,
        publishedAt: finalPublishedAt,
        readingTimeMinutes: Number(readingTimeMinutes) || 5,
        coverImage: sanitizedCover,
        galleryImages: sanitizedGallery,
        body: sanitizedBody,
        relatedBikeCategories,
      };

      setSavingStage('Gravando publicação no banco de dados...');

      // 1. Gravação local imediata para nunca perder o artigo e refletir no site instantaneamente
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem(PUBLISHED_ARTICLES_STORAGE_KEY);
          const existingList: Article[] = rawLocal ? JSON.parse(rawLocal) : [];
          const filteredList = existingList.filter((a) => a.slug !== cleanSlug && (!initialData?.slug || a.slug !== initialData.slug));
          localStorage.setItem(PUBLISHED_ARTICLES_STORAGE_KEY, JSON.stringify([articleData, ...filteredList]));
        } catch (localErr) {
          console.warn('[ArticleForm] Erro ao salvar cache local:', localErr);
        }
      }

      // 2. Tenta salvar via API Backend (/api/articles com Firestore Admin)
      let apiSuccess = false;
      try {
        const res = await fetchAdminJson('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article: articleData }),
        });
        if (res.ok) {
          apiSuccess = true;
        }
      } catch (apiErr) {
        console.warn('[ArticleForm] Falha ao enviar para API backend:', apiErr);
      }

      // 3. Tenta salvar diretamente via Firestore Web Client com timeout de 3 segundos
      if (!apiSuccess) {
        try {
          const firestorePromise = (async () => {
            if (isEditing && initialData?.slug && initialData.slug !== cleanSlug) {
              await deleteDoc(doc(db, 'artigos', initialData.slug));
            }
            await setDoc(doc(db, 'artigos', cleanSlug), articleData);
          })();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 3000)
          );

          await Promise.race([firestorePromise, timeoutPromise]);
        } catch (fErr) {
          console.warn('[ArticleForm] Firestore client offline ou demorou. Artigo salvo localmente com sucesso:', fErr);
        }
      }

      // Redireciona para a lista com mensagem de sucesso
      router.push('/admin/artigos');
    } catch (err: any) {
      console.error('Erro ao salvar artigo:', err);
      setError(err?.message || 'Ocorreu um erro ao salvar o artigo. Tente novamente.');
    } finally {
      setSaving(false);
      setSavingStage(null);
    }
  };

  const handleFileIngestionExtracted = (data: any, images?: ExtractedImageFile[]) => {
    if (!data || typeof data !== 'object') return;
    if (data.title) setTitle(data.title);
    if (data.slug) setSlug(slugify(data.slug));
    else if (data.title && !slug) setSlug(slugify(data.title));
    if (data.excerpt) setExcerpt(data.excerpt);
    if (data.category && ARTICLE_CATEGORIES.includes(data.category)) {
      setCategory(data.category);
    }
    if (data.readingTimeMinutes) {
      setReadingTimeMinutes(Number(data.readingTimeMinutes));
    }
    if (data.body) {
      const autoLinked = autoLinkEBikesInText(data.body);
      setBody(autoLinked.updatedText);
      const imgInBody = extractFirstImageUrlFromMarkdown(autoLinked.updatedText);
      if (imgInBody) {
        setCoverImage(imgInBody);
      }
    }
    if (Array.isArray(data.relatedBikeCategories)) {
      setRelatedBikeCategories(data.relatedBikeCategories);
    }
    if (images && images.length > 0) {
      if (!coverImage && images[0]) {
        uploadBase64ToCentralMedia(images[0].dataUri, {
          slug: data.slug || slug || 'artigo-extraido',
          folder: 'articles',
        })
          .then((mediaUrl) => {
            if (mediaUrl) setCoverImage(mediaUrl);
          })
          .catch((err) => {
            console.warn('[ArticleForm] Falha no upload central da imagem extraída:', err);
          });
      }
    }
    setAiSuccessMessage('Artigo e metadados de SEO importados do arquivo com sucesso!');
  };

  const handleAiArticleGenerated = (data: {
    title: string;
    slug?: string;
    excerpt?: string;
    category?: ArticleCategory;
    body: string;
    readingTimeMinutes?: number;
    relatedBikeCategories?: string[];
    seoKeywords?: string[];
  }) => {
    if (data.title) setTitle(data.title);
    if (data.slug) setSlug(data.slug);
    else if (data.title) setSlug(slugify(data.title));
    if (data.excerpt) setExcerpt(data.excerpt);
    if (data.category && ARTICLE_CATEGORIES.includes(data.category)) {
      setCategory(data.category);
    }
    if (data.readingTimeMinutes) {
      setReadingTimeMinutes(data.readingTimeMinutes);
    }
    if (data.body) {
      const autoLinked = autoLinkEBikesInText(data.body);
      setBody(autoLinked.updatedText);
      const imgInBody = extractFirstImageUrlFromMarkdown(autoLinked.updatedText);
      if (imgInBody) {
        setCoverImage(imgInBody);
      }
    }
    if (Array.isArray(data.relatedBikeCategories) && data.relatedBikeCategories.length > 0) {
      setRelatedBikeCategories(data.relatedBikeCategories);
    }
    setAiSuccessMessage('Artigo completo, formatação em Markdown e SEO gerados com sucesso pelo GLM 5.3!');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Banner Superior com Ações e Troca de Aba (Editor vs Preview) */}
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/admin/artigos')}
              className="text-stone-500 hover:text-stone-900 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Artigos
            </button>
            <span className="text-stone-300">/</span>
            <span className="text-indigo-800 font-bold text-xs bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
              {isEditing ? 'Editar Artigo' : 'Novo Artigo'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-indigo-600" />
            {isEditing ? `Editar: ${initialData?.title}` : 'Cadastrar Novo Artigo'}
          </h1>
        </div>

{/* Seleção de Abas (Editor / Preview / Split / Blocos) */}
        <div className="flex items-center gap-2">
          <div className="flex border-2 border-stone-900 rounded-xl p-1 bg-stone-100">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-white text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] border border-stone-900'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blocks')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'blocks'
                  ? 'bg-white text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] border border-stone-900'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Blocos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('split')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'split'
                  ? 'bg-white text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] border border-stone-900'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Dividido</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] border border-stone-900'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Pré-visualização</span>
            </button>
          </div>
        </div>
        </div>
      
      {/* Auto-save indicator */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {lastRestored && (
            <span className="text-[10px] text-stone-500 font-mono flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
              Rascunho restaurado: {lastRestored.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={clearAutoSave}
          className="px-2.5 py-1.5 text-stone-500 hover:text-rose-600 font-bold text-[10px] flex items-center gap-1 transition-colors"
          title="Limpar rascunho automático salvo localmente"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Limpar rascunho</span>
        </button>
      </div>

      {/* SEÇÃO EXPANSÍVEL DE REDATOR IA & INGESTÃO DE ARTIGOS */}
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAiIngestionTools(!showAiIngestionTools)}
            className="flex items-center gap-2.5 text-left font-black text-sm sm:text-base text-stone-900 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="block">Ingestão de Artigo</span>
              <span className="block text-[11px] font-normal text-stone-500">
                {showAiIngestionTools ? 'Clique para recolher as ferramentas' : 'Clique para expandir a importação por arquivo (PDF/DOCX/MD)'}
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
              mode="article"
              onDataExtracted={handleFileIngestionExtracted}
            />
          </div>
        )}
      </div>

      {aiSuccessMessage && (
        <div className="p-3 bg-emerald-50 border-2 border-emerald-700 rounded-xl text-emerald-950 font-bold text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{aiSuccessMessage}</span>
        </div>
      )}

      {/* Alerta de Erro */}
      {error && (
        <div className="p-4 bg-rose-50 border-2 border-rose-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-950 text-xs font-bold shadow-[3px_3px_0px_0px_rgba(159,18,57,1)] animate-shake">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          {canRetry && lastFailedAction && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                lastFailedAction();
              }}
              className="px-3 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-black hover:bg-rose-800 transition-colors shadow-sm self-start sm:self-auto shrink-0 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          )}
        </div>
      )}

      {/* ABA: EDITOR */}
      {activeTab === 'editor' && (
        <div className="space-y-8">
          {/* Card 1: Metadados Principais */}
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
            <div className="border-b-2 border-stone-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-600" />
                Metadados & Título Otimizado
              </h2>
            </div>

            <div className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-black uppercase text-stone-800 mb-1.5 flex items-center justify-between">
                  <span>Título do Artigo <span className="text-rose-600">*</span></span>
                  <span className="text-[10px] text-stone-500 lowercase font-mono">
                    {title.length} caracteres (Ideal: 50 a 65)
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Como Escolher a Melhor E-Bike para Subidas Íngremes em 2026"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-sm font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Slug da URL */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase text-stone-800">
                    Slug da URL <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (title.trim()) {
                          setSlug(slugify(title));
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      title="Regerar slug limpo em kebab-case a partir do título atual"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Sincronizar Slug</span>
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSlug}
                        onChange={(e) => handleAutoSlugToggle(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] font-bold">Auto-sincronizar</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-stone-100 border-2 border-r-0 border-stone-900 rounded-l-xl text-xs font-mono text-stone-500 select-none">
                    /artigos/
                  </span>
                  <input
                    type="text"
                    required
                    disabled={autoSlug}
                    placeholder="como-escolher-melhor-ebike-subidas"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    onBlur={(e) => {
                      if (e.target.value) {
                        setSlug(slugify(e.target.value));
                      }
                    }}
                    className={`w-full px-3 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-r-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 ${
                      autoSlug ? 'bg-stone-100 text-stone-600 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Resumo / Excerpt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase text-stone-800">
                    Resumo / Lead Editorial <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-stone-500 lowercase font-mono">
                      {excerpt.length} caracteres (Ideal: 120 a 160)
                    </span>
                  </div>
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="Resumo chamativo com palavras-chave que aparecerá no Google e nos cards do blog..."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="w-full px-4 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Grid: Categoria, Data e Tempo de Leitura */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {/* Categoria */}
                <div>
                  <label className="block text-xs font-black uppercase text-stone-800 mb-1.5">
                    Categoria Editorial
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ArticleCategory)}
                    className="w-full px-3 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {ARTICLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data de Publicação */}
                <div>
                  <label className="block text-xs font-black uppercase text-stone-800 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    Data de Publicação
                  </label>
                  <input
                    type="date"
                    required
                    value={publishedAt ? publishedAt.split('T')[0] : ''}
                    onChange={(e) => setPublishedAt(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Tempo de Leitura */}
                <div>
                  <label className="block text-xs font-black uppercase text-stone-800 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-500" />
                    Tempo Estimado (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={readingTimeMinutes}
                    onChange={(e) => setReadingTimeMinutes(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Categorias de E-Bikes Relacionadas */}
              <div>
                <label className="block text-xs font-black uppercase text-stone-800 mb-1.5">
                  Tipos de E-Bike Relacionados neste Artigo
                </label>
                <div className="flex flex-wrap gap-2">
                  {BIKE_CATEGORIES.map((cat) => {
                    const isSelected = relatedBikeCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryToggle(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-stone-900 text-white border-stone-900 shadow-[2px_2px_0px_0px_rgba(245,158,11,1)]'
                            : 'bg-stone-100 text-stone-600 border-stone-300 hover:border-stone-900'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Imagem de Capa */}
          <ImageUploadField
            label="Imagem de Capa do Artigo"
            value={coverImage}
            onChange={(url) => setCoverImage(url)}
            onAddToGallery={(url) => {
              setGalleryImages((prev) => {
                if (prev.includes(url)) return prev;
                return [...prev, url];
              });
              setAiSuccessMessage('Foto adicionada à galeria complementar do artigo com sucesso!');
            }}
            folder="articles"
            presetType="articles"
            required
            aspectRatio="video"
            searchQueryHint={title}
            contextHint={`Artigo categoria ${category}: ${excerpt || title}`}
            helpText="Recomendado: Formato 16:9 em alta resolução. Faça upload ou selecione fotos contextuais."
          />


          {/* Card 2.8: Galeria de Fotos Complementares do Artigo */}
          <GalleryImagesField
            label="Galeria de Imagens Complementares do Artigo"
            description="Adicione imagens técnicas adicionais, gráficos ou detalhes que serão exibidos na galeria de fotos do artigo e ampliáveis pelos leitores."
            images={galleryImages}
            onChange={(imgs) => setGalleryImages(imgs)}
            folder="articles"
            maxImages={8}
            searchHint={title}
            presets={[
              { title: 'Bateria & Autonomia', url: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80' },
              { title: 'Mobilidade & Cidade', url: 'https://images.unsplash.com/photo-1519505907962-0a6cb0167c73?auto=format&fit=crop&w=1200&q=80' },
              { title: 'Ciclovia & Trajeto', url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80' },
              { title: 'Manutenção & Oficina', url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80' },
            ]}
          />

          {/* Card 3: Editor de Texto em Markdown */}
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-stone-100 pb-3 gap-2">
              <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Corpo do Artigo (Markdown)
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleAutoLinkEBikes}
                  disabled={!body.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-stone-900 font-black rounded-lg text-xs cursor-pointer disabled:opacity-40 transition-all shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] border border-stone-900"
                  title="Identifica modelos de e-bikes do catálogo citados no artigo e cria links automáticos para suas respectivas páginas"
                >
                  <Zap className="w-3.5 h-3.5 text-stone-900" />
                  <span>⚡ Auto-Vincular E-Bikes (Catálogo)</span>
                </button>

                <span className="text-xs font-mono text-stone-500 font-bold hidden sm:inline">
                  {body.trim().split(/\s+/).filter(Boolean).length} palavras
                </span>
              </div>
            </div>

            {/* CAIXA / FERRAMENTA DE INSERÇÃO DE LINKS DIRECIÓNÁVEIS DE PUBLICAÇÕES DO SITE */}
            <div className="p-4 bg-stone-50 border-2 border-stone-900 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-stone-900 flex items-center gap-1.5">
                  <LinkIcon className="w-4 h-4 text-indigo-600" />
                  Inserir Link Direcionável de Publicação ou E-Bike do Site
                </span>
                <div className="flex items-center gap-1 bg-white p-1 border border-stone-300 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedLinkType('article')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      selectedLinkType === 'article'
                        ? 'bg-stone-900 text-white font-black'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Artigo do Site
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLinkType('bike')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      selectedLinkType === 'bike'
                        ? 'bg-stone-900 text-white font-black'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    E-Bike do Catalogo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLinkType('custom')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      selectedLinkType === 'custom'
                        ? 'bg-stone-900 text-white font-black'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    URL Direta
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {selectedLinkType === 'article' && (
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-black uppercase text-stone-700 mb-1">
                      Selecionar Publicação / Artigo
                    </label>
                    <select
                      value={selectedArticleSlug}
                      onChange={(e) => setSelectedArticleSlug(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900 cursor-pointer"
                    >
                      <option value="">-- Escolha um artigo publicado --</option>
                      {siteArticlesList.map((art) => (
                        <option key={art.slug} value={art.slug}>
                          {art.title} (/artigos/{art.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedLinkType === 'bike' && (
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-black uppercase text-stone-700 mb-1">
                      Selecionar E-Bike do Catalogo
                    </label>
                    <select
                      value={selectedBikeSlug}
                      onChange={(e) => setSelectedBikeSlug(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900 cursor-pointer"
                    >
                      <option value="">-- Escolha uma e-bike --</option>
                      {siteBikesList.map((bike) => (
                        <option key={bike.slug} value={bike.slug}>
                          {bike.label} (/bike/{bike.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedLinkType === 'custom' && (
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-black uppercase text-stone-700 mb-1">
                      URL de Destino
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: https://... ou /comparar"
                      value={customLinkUrl}
                      onChange={(e) => setCustomLinkUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-mono font-bold text-stone-900"
                    />
                  </div>
                )}

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase text-stone-700 mb-1">
                    Texto do Link (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Confira nossa análise completa"
                    value={customLinkText}
                    onChange={(e) => setCustomLinkText(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleInsertLinkToBody}
                    disabled={
                      (selectedLinkType === 'article' && !selectedArticleSlug) ||
                      (selectedLinkType === 'bike' && !selectedBikeSlug) ||
                      (selectedLinkType === 'custom' && !customLinkUrl)
                    }
                    className="w-full py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 transition-all shadow-[2px_2px_0px_0px_rgba(99,102,241,1)]"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Inserir</span>
                  </button>
                </div>
              </div>
            </div>

            <textarea
              ref={bodyTextareaRef}
              rows={16}
              required
              placeholder="# Introdução&#10;&#10;Escreva o conteúdo do artigo em Markdown... Use ## para títulos e listas com - ou *"
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              className="w-full p-4 bg-stone-50 border-2 border-stone-900 rounded-xl font-mono text-xs text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* ABA: EDITOR DE BLOCOS (DRAG-DROP) */}
      {activeTab === 'blocks' && (
        <div className="bg-white border-2 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
          {/*
            Editor de blocos com arrastar-e-soltar (dnd-kit).

            Substitui o `SimpleBlockEditor` inline que estava aqui: dois editores
            de blocos convivendo, e so o simples em uso. Este tem reordenacao por
            teclado e por ponteiro, alem da biblioteca de snippets.
          */}
          <BlockEditorWrapper
            blocks={blocks}
            onBlocksChange={handleBlocksChange}
          />
        </div>
      )}

      {/* ABA: VISÃO DIVIDIDA (SPLIT VIEW) */}
      {activeTab === 'split' && (
        <div className="h-[calc(100vh-400px)] min-h-[500px] bg-white border-2 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] overflow-hidden flex">
          {/* Painel Esquerdo - Editor */}
          <div className="w-full flex flex-col border-r-2 border-stone-200" style={{ width: `${splitRatio}%` }}>
            <div className="px-4 py-3 bg-stone-50 border-b-2 border-stone-200 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Editor</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-stone-500">{body.trim().split(/\s+/).filter(Boolean).length} palavras</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <div className="p-4 bg-stone-50 border-2 border-stone-900 rounded-xl space-y-4">
                {(function() {
                  const gt = '>';
                  return (
                    <p className="text-stone-600 text-xs font-medium">
                      Revise formatações, títulos de seções (<code className="bg-stone-100 px-1 py-0.5 rounded font-mono">##</code>) e citações (<code className="bg-stone-100 px-1 py-0.5 rounded font-mono">{gt}</code>).
                    </p>
                  );
                })()}
                <textarea
                  ref={bodyTextareaRef}
                  rows={16}
                  required
                  placeholder="# Introdução&#10;&#10;Escreva o conteúdo do artigo em Markdown... Use ## para títulos e listas com - ou *"
                  value={body}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  className="w-full h-full min-h-[300px] p-4 bg-stone-50 border-2 border-stone-900 rounded-xl font-mono text-xs text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

          {/* Divisor Redimensionável */}
          <div
            className={cn(
              'w-1.5 cursor-col-resize flex items-center justify-center select-none transition-colors',
              isResizing ? 'bg-emerald-500' : 'bg-stone-200 hover:bg-emerald-300'
            )}
            style={{ width: '1.5rem' }}
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            role="separator"
            aria-label="Redimensionar painéis"
            aria-valuenow={splitRatio}
            aria-valuemin={20}
            aria-valuemax={80}
          >
            <div className="w-full h-8 bg-stone-100 rounded flex items-center justify-center">
              <GripVertical className="w-5 h-5 text-stone-400" />
            </div>
          </div>

          {/* Painel Direito - Preview */}
          <div className="w-full flex flex-col" style={{ width: `${100 - splitRatio}%` }}>
            <div className="px-4 py-3 bg-stone-50 border-b-2 border-stone-200 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Pré-visualização</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-stone-500">{body.trim().split(/\s+/).filter(Boolean).length} palavras</span>
                <span className="text-[10px] font-mono text-stone-500">{readingTimeMinutes} min</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="bg-white border-2 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
                <div className="space-y-3 border-b-2 border-stone-100 pb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 bg-amber-400 text-stone-900 border border-stone-900 font-black text-xs uppercase rounded-full">
                      {category}
                    </span>
                    <span className="text-xs text-stone-500 font-medium">
                      {publishedAt} • {readingTimeMinutes} min de leitura
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-black text-stone-900 leading-tight">
                    {title || 'Título do Artigo em Destaque'}
                  </h1>

                  <p className="text-base text-stone-600 font-medium leading-relaxed">
                    {excerpt || 'Resumo introdutório do artigo...'}
                  </p>
                </div>

                {coverImage && (
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
                    <SafeImage
                      src={coverImage}
                      alt={title || 'Capa do Artigo'}
                      fill
                      className="object-cover"
                      fallbackSrc="https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80"
                    />
                  </div>
                )}

                <div className="prose prose-stone max-w-none text-stone-800 leading-relaxed text-sm pt-4">
                  {body ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h2: ({ children }) => (
                          <h2 className="text-xl font-extrabold text-stone-900 border-b-2 border-indigo-600 pb-2 mt-8 mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-indigo-600 shrink-0" />
                            <span>{children}</span>
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-base font-bold text-indigo-900 mt-6 mb-2 flex items-center gap-2 border-l-2 border-indigo-500 pl-2">
                            <span>{children}</span>
                          </h3>
                        ),
                        hr: () => (
                          <div className="my-8 flex items-center gap-4">
                            <div className="h-[2px] bg-stone-300 flex-1" />
                            <span className="p-1.5 bg-stone-100 border border-stone-300 rounded-full text-stone-600 text-[10px] font-bold uppercase tracking-widest px-3">
                              TuaVia • Seção
                            </span>
                            <div className="h-[2px] bg-stone-300 flex-1" />
                          </div>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="bg-amber-50/80 border-l-4 border-amber-500 border-y border-r border-amber-200 p-4 rounded-r-2xl my-6 not-italic text-stone-800 text-xs sm:text-sm">
                            <div className="flex items-center gap-2 font-mono font-bold uppercase text-[10px] text-amber-900 mb-1">
                              <Info className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Destaque TuaVia</span>
                            </div>
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-6 border-2 border-stone-900 rounded-xl shadow-[2px_2px_0_0_rgba(28,25,23,1)]">
                            <table className="w-full text-left text-xs text-stone-800 border-collapse">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-stone-900 text-amber-300 font-bold uppercase text-[11px]">{children}</thead>,
                        th: ({ children }) => <th className="p-3 border-b border-stone-700">{children}</th>,
                        td: ({ children }) => <td className="p-3 border-b border-stone-200 bg-stone-50/50">{children}</td>,
                        a: ({ href, children }) => {
                          const isInternal = href && (href.startsWith('/') || href.startsWith('#') || href.includes('tuavia.com.br'));
                          const cleanHref = href?.replace(/^https?:\/\/(www\.)?tuavia\.com\.br/, '') || '#';
  return (
                            <a
                              href={isInternal ? cleanHref : href}
                              target={isInternal ? '_self' : '_blank'}
                              rel={isInternal ? undefined : 'noopener noreferrer'}
                              className="text-indigo-600 font-bold underline hover:text-indigo-800 transition-colors inline-flex items-center gap-0.5 cursor-pointer bg-indigo-50 px-1 py-0.5 rounded border border-indigo-200"
                            >
                              <span>{children}</span>
                              {!isInternal && <ExternalLink className="w-3 h-3 inline shrink-0 text-indigo-500" />}
                            </a>
                          );
                        },
                      }}
                    >
                      {formatMarkdownForDisplay(body)}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-stone-400 italic">Nenhum conteúdo digitado no editor ainda.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA: PRÉ-VISUALIZAÇÃO EM TEMPO REAL */}
      {activeTab === 'preview' && (
        <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 sm:p-10 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
          <div className="space-y-3 border-b-2 border-stone-100 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-amber-400 text-stone-900 border border-stone-900 font-black text-xs uppercase rounded-full">
                {category}
              </span>
              <span className="text-xs text-stone-500 font-medium">
                {publishedAt} • {readingTimeMinutes} min de leitura
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-stone-900 leading-tight">
              {title || 'Título do Artigo em Destaque'}
            </h1>

            <p className="text-base text-stone-600 font-medium leading-relaxed">
              {excerpt || 'Resumo introdutório do artigo...'}
            </p>
          </div>

          {coverImage && (
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
              <SafeImage
                src={coverImage}
                alt={title || 'Capa do Artigo'}
                fill
                className="object-cover"
                fallbackSrc="https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80"
              />
            </div>
          )}

          <div className="prose prose-stone max-w-none text-stone-800 leading-relaxed text-sm pt-4">
            {body ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => (
                    <h2 className="text-xl font-extrabold text-stone-900 border-b-2 border-indigo-600 pb-2 mt-8 mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-indigo-600 shrink-0" />
                      <span>{children}</span>
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-bold text-indigo-900 mt-6 mb-2 flex items-center gap-2 border-l-2 border-indigo-500 pl-2">
                      <span>{children}</span>
                    </h3>
                  ),
                  hr: () => (
                    <div className="my-8 flex items-center gap-4">
                      <div className="h-[2px] bg-stone-300 flex-1" />
                      <span className="p-1.5 bg-stone-100 border border-stone-300 rounded-full text-stone-600 text-[10px] font-bold uppercase tracking-widest px-3">
                        TuaVia • Seção
                      </span>
                      <div className="h-[2px] bg-stone-300 flex-1" />
                    </div>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="bg-amber-50/80 border-l-4 border-amber-500 border-y border-r border-amber-200 p-4 rounded-r-2xl my-6 not-italic text-stone-800 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 font-mono font-bold uppercase text-[10px] text-amber-900 mb-1">
                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Destaque TuaVia</span>
                      </div>
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6 border-2 border-stone-900 rounded-xl shadow-[2px_2px_0_0_rgba(28,25,23,1)]">
                      <table className="w-full text-left text-xs text-stone-800 border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-stone-900 text-amber-300 font-bold uppercase text-[11px]">{children}</thead>,
                  th: ({ children }) => <th className="p-3 border-b border-stone-700">{children}</th>,
                  td: ({ children }) => <td className="p-3 border-b border-stone-200 bg-stone-50/50">{children}</td>,
                  a: ({ href, children }) => {
                    const isInternal = href && (href.startsWith('/') || href.startsWith('#') || href.includes('tuavia.com.br'));
                    const cleanHref = href?.replace(/^https?:\/\/(www\.)?tuavia\.com\.br/, '') || '#';
                    return (
                      <a
                        href={isInternal ? cleanHref : href}
                        target={isInternal ? '_self' : '_blank'}
                        rel={isInternal ? undefined : 'noopener noreferrer'}
                        className="text-indigo-600 font-bold underline hover:text-indigo-800 transition-colors inline-flex items-center gap-0.5 cursor-pointer bg-indigo-50 px-1 py-0.5 rounded border border-indigo-200"
                      >
                        <span>{children}</span>
                        {!isInternal && <ExternalLink className="w-3 h-3 inline shrink-0 text-indigo-500" />}
                      </a>
                    );
                  },
                }}
              >
                {formatMarkdownForDisplay(body)}
              </ReactMarkdown>
            ) : (
              <p className="text-stone-400 italic">Nenhum conteúdo digitado no editor ainda.</p>
            )}
          </div>
        </div>
      )}

      {/* Ações Inferiores de Salvamento */}
      <div className="flex items-center justify-between pt-4 pb-28 sm:pb-32">
        <button
          type="button"
          onClick={() => router.push('/admin/artigos')}
          className="px-5 py-3 bg-white border-2 border-stone-900 text-stone-900 font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-stone-50 cursor-pointer shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancelar</span>
        </button>

        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-black rounded-xl text-sm border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>{savingStage || 'Salvando Artigo...'}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{isEditing ? 'Atualizar Artigo' : 'Publicar Artigo'}</span>
            </>
          )}
        </button>
      </div>
    
    {/* Snippets Panel */}
    <SnippetsPanel
      isOpen={showSnippets}
      onClose={() => setShowSnippets(false)}
      onInsert={(snippet) => {
        const start = bodyTextareaRef.current?.selectionStart || 0;
        const end = bodyTextareaRef.current?.selectionEnd || 0;
        const newBody = body.slice(0, start) + snippet + body.slice(end);
        setBody(newBody);
        // Move cursor to end of inserted snippet
        setTimeout(() => {
          if (bodyTextareaRef.current) {
            bodyTextareaRef.current.selectionStart = bodyTextareaRef.current.selectionEnd = start + snippet.length;
            bodyTextareaRef.current.focus();
          }
        }, 0);
      }}
    />
    
    </form>
  );
}
