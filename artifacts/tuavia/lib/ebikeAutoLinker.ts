/**
 * Auto-vinculação de e-bikes do catálogo em texto Markdown.
 *
 * Extraído de `lib/ai/ebikeAutoLinker.ts` na remoção do subsistema de LLM. Mantido
 * apenas o trecho determinístico: `autoLinkEBikesInText` casa o texto contra o
 * catálogo por nome/marca, sem nenhuma chamada de modelo, e é o que o editor de
 * artigo usa ao publicar.
 *
 * A variante `autoLinkEBikesWithLLM` foi descartada junto com o pipeline de jobs.
 */
import { getGroupedEBikes, getLocalPublishedBikes, PUBLISHED_BIKES_STORAGE_KEY } from '@/lib/ebikes';

export interface EBikeLinkItem {
  marca: string;
  modelo: string;
  slug: string;
  fullLabel: string;
}

/**
 * Obtém todas as e-bikes publicadas no catálogo (estáticas + local + Firestore)
 */
export function getCatalogEBikesForAutoLink(): EBikeLinkItem[] {
  const map = new Map<string, EBikeLinkItem>();

  // 1. Catálogo estático
  try {
    const staticGrouped = getGroupedEBikes(false);
    staticGrouped.forEach((b) => {
      if (b && b.slug && b.marca && b.modelo) {
        map.set(b.slug, {
          marca: b.marca.trim(),
          modelo: b.modelo.trim(),
          slug: b.slug.trim(),
          fullLabel: `${b.marca.trim()} ${b.modelo.trim()}`,
        });
      }
    });
  } catch (err) {
    console.warn('[ebikeAutoLinker] Erro ao carregar bikes estáticas:', err);
  }

  // 2. Bikes publicadas no localStorage
  if (typeof window !== 'undefined') {
    try {
      const localGrouped = getLocalPublishedBikes();
      localGrouped.forEach((b) => {
        if (b && b.slug && b.marca && b.modelo) {
          map.set(b.slug, {
            marca: b.marca.trim(),
            modelo: b.modelo.trim(),
            slug: b.slug.trim(),
            fullLabel: `${b.marca.trim()} ${b.modelo.trim()}`,
          });
        }
      });
    } catch (err) {
      console.warn('[ebikeAutoLinker] Erro ao carregar bikes locais:', err);
    }
  }

  return Array.from(map.values());
}

/**
 * Escaneia o texto Markdown do artigo e substitui de forma inteligente
 * nomes de e-bikes publicadas por links internos Markdown: [Nome](/bike/slug)
 * preservando links existentes, imagens, blocos de código e títulos.
 */
export function autoLinkEBikesInText(
  markdownText: string,
  customCatalog?: EBikeLinkItem[]
): { updatedText: string; linkedCount: number; linkedBikes: string[] } {
  if (!markdownText || typeof markdownText !== 'string' || !markdownText.trim()) {
    return { updatedText: markdownText || '', linkedCount: 0, linkedBikes: [] };
  }

  const catalog = customCatalog && customCatalog.length > 0 ? customCatalog : getCatalogEBikesForAutoLink();
  if (catalog.length === 0) {
    return { updatedText: markdownText, linkedCount: 0, linkedBikes: [] };
  }

  // Ordena por tamanho do termo (decrescente) para evitar que "Caloi" engula "Caloi E-Vibe Easy Rider"
  const sortedCatalog = [...catalog].sort((a, b) => b.fullLabel.length - a.fullLabel.length);

  let text = markdownText;
  let totalLinked = 0;
  const linkedBikesSet = new Set<string>();

  // Regex para proteger regiões que NÃO devem receber links:
  // - Links existentes: [texto](url)
  // - Imagens: ![alt](url)
  // - Blocos de código: ```...```
  // - Código inline: `...`
  // - Links HTML: <a href="...">...</a>
  const protectedBlocks: string[] = [];
  const placeholderPrefix = '___PROTECTED_BLOCK_';

  // Substitui blocos protegidos por placeholders temporários
  text = text.replace(
    /```[\s\S]*?```|`[^`]+`|!\[.*?\]\(.*?\)|\[.*?\]\(.*?\)|<a\b[^>]*>[\s\S]*?<\/a>/g,
    (match) => {
      const id = protectedBlocks.length;
      protectedBlocks.push(match);
      return `${placeholderPrefix}${id}___`;
    }
  );

  // Escaneia cada e-bike do catálogo
  sortedCatalog.forEach((bike) => {
    // Cria variações de busca para o modelo
    const patternsToTry = [
      bike.fullLabel, // ex: "Sense Easy One"
      bike.modelo,    // ex: "Easy One" (se tiver pelo menos 4 caracteres)
    ].filter((p) => p && p.trim().length >= 4);

    patternsToTry.forEach((pattern) => {
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Regex com boundary de palavra, ignorando case
      const regex = new RegExp(`(?<![\\w/\\-])(${escapedPattern})(?![\\w\\-])`, 'gi');

      let matchFound = false;
      text = text.replace(regex, (match) => {
        // Se este modelo já foi vinculado neste trecho, ou para evitar sobre-estpoluição, vincula a 1ª ocorrência
        matchFound = true;
        linkedBikesSet.add(bike.fullLabel);
        return `[${match}](/bike/${bike.slug})`;
      });

      if (matchFound) {
        totalLinked++;
      }
    });
  });

  // Restaura os blocos protegidos originais
  protectedBlocks.forEach((block, id) => {
    const placeholder = `${placeholderPrefix}${id}___`;
    text = text.replace(placeholder, block);
  });

  return {
    updatedText: text,
    linkedCount: totalLinked,
    linkedBikes: Array.from(linkedBikesSet),
  };
}
