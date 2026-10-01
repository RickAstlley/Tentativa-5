'use client';

import React from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { Clock, Calendar, ArrowRight } from 'lucide-react';
import { Article } from '@/types/article';
import { formatArticleDate } from '@/lib/articles';
import CategorySignBadge from './traffic/CategorySignBadge';

interface ArticleCardProps {
  article: Article;
  compact?: boolean;
}

export default function ArticleCard({ article, compact = false }: ArticleCardProps) {
  // Formatar data com UTC para evitar divergências de fuso entre servidor e cliente
  const formattedDate = formatArticleDate(article.publishedAt, 'short');

  return (
    <article className="group bg-surface border-2 border-ink rounded-2xl sm:rounded-3xl overflow-hidden shadow-[3px_3px_0_0_rgba(46,43,39,1)] sm:shadow-[4px_4px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between h-full max-w-[420px] w-full mx-auto">
      <Link href={`/artigos/${article.slug}`} className="flex flex-col flex-1 cursor-pointer">
        
        {/* Imagem de Capa com Badge de Categoria (16:9) */}
        <div className="relative w-full aspect-video overflow-hidden border-b-2 border-ink bg-neutral-200 shrink-0">
          <SafeImage
            src={article.coverImage}
            alt={article.title}
            fill
            fallbackSrc="/images/articles/resolucao-contran-996-2023-bicicleta-eletrica-regras.webp"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10">
            <CategorySignBadge category={article.category} size="xs" />
          </div>
        </div>

        {/* Conteúdo do Card */}
        <div className={`flex flex-col flex-1 justify-between ${compact ? 'p-3 sm:p-4 gap-2.5' : 'p-3.5 sm:p-4 md:p-5 gap-3 sm:gap-4'}`}>
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <h3 className={`font-display font-bold text-ink group-hover:text-primary transition-colors leading-snug ${compact ? 'text-xs sm:text-sm line-clamp-2' : 'text-sm sm:text-base md:text-lg'}`}>
              {article.title}
            </h3>

            <p className={`text-[11px] sm:text-xs text-ink/75 font-sans leading-relaxed ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
              {article.excerpt}
            </p>

            {/* Tags e Etiquetas do Artigo - Somente exibidas em modo normal completo */}
            {!compact && Array.isArray(article.tags) && article.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-1">
                {article.tags.slice(0, 3).map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[8.5px] sm:text-[9px] font-mono font-bold bg-neutral-100 border border-ink/20 text-ink/80 px-1.5 py-0.5 rounded-md"
                  >
                    #{t}
                  </span>
                ))}
                {article.tags.length > 3 && (
                  <span className="text-[8px] font-mono text-ink/50">
                    +{article.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Divisor Tracejado e Rodapé com Ícones Protegidos */}
          <div className="flex flex-col gap-2 sm:gap-2.5 mt-auto pt-2.5 sm:pt-3">
            <div className="w-full border-t border-dashed border-ink/20" />

            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-ink/70 gap-1.5">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                <span className="flex items-center gap-1 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{formattedDate}</span>
                </span>
                <span className="shrink-0">•</span>
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-accent-gold shrink-0" />
                  <span>{article.readingTimeMinutes} min</span>
                </span>
              </div>

              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-neutral-100 border border-ink flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              </div>
            </div>
          </div>

        </div>

      </Link>
    </article>
  );
}
