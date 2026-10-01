/**
 * types/blockEditor.ts
 *
 * Contrato do editor em blocos usado por `ArticleForm` e `BlockEditorClient`.
 * O corpo do artigo é markdown plano; os blocos são só uma forma de editá-lo.
 */

/**
 * Blocos que o projeto realmente produz.
 *
 * A lista original ('heading', 'quote', 'list') era genérica e não cobria o
 * formato que `ArticleForm` converte do markdown nem o que o `BlockEditor`
 * cria na biblioteca de snippets. Os dois lados declaravam os mesmos nomes em
 * formatos diferentes, e nenhum batia com este tipo.
 */
export type BlockType =
  // markdown -> blocos (ArticleForm)
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bulletList'
  | 'numberedList'
  | 'blockquote'
  | 'code'
  | 'table'
  // snippets do editor de blocos
  | 'image'
  | 'hr'
  | 'callout'
  | 'faq'
  | 'bikeCard'
  | 'rankingCard';

export interface EditorBlock {
  id: string;
  type: BlockType;
  /** Conteúdo bruto do bloco. Para `table`, linhas markdown separadas por `\n`. */
  content: string;
  /** Nível de heading quando `type === 'heading'`. */
  level?: 1 | 2 | 3 | 4;
  /** Texto alternativo quando `type === 'image'`. */
  alt?: string;
  /** Legenda quando `type === 'image'`. */
  caption?: string;
  /** Rótulo/título do callout quando `type === 'callout'`. */
  title?: string;
  /** Tom do callout. */
  tone?: 'info' | 'warning' | 'danger' | 'success';
  /** Estado transitório e sugestão da IA por bloco. */
  metadata?: {
    aiLoading?: boolean;
    aiSuggestion?: string;
  };
}

export interface BlockTypeMeta {
  type: BlockType;
  label: string;
  description: string;
  /** Placeholder exibido no editor. */
  placeholder: string;
}
