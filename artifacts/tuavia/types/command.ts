import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Contrato da paleta de comandos do admin (`components/admin/CommandPalette.tsx`).
 */

/** Agrupamento livre; o painel decide a ordem de exibição. */
export type CommandCategory = string;

export interface CommandItem {
  id: string;
  label: string;
  /** Atalho exibido à direita, ex.: "⌘K", "G then A". */
  shortcut?: string;
  /** Agrupamento visual. */
  group?: CommandCategory;
  /** Alias usado pelo hook para ordenar os grupos. */
  category?: CommandCategory;
  /** Destino quando a ação é navegação. */
  href?: string;
  /** Ação imperativa quando não é navegação. */
  action?: () => void | Promise<void>;
  /** Texto extra indexado na busca. */
  keywords?: string[];
  /** Descrição exibida abaixo do rótulo. */
  description?: string;
  /** Componente de ícone (LucideIcon). */
  icon?: LucideIcon;
  /** Selo curto exibido ao lado do rótulo, ex.: "NOVO". */
  badge?: string;
  disabled?: boolean;
}
