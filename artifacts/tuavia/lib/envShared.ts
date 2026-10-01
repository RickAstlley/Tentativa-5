/**
 * Utilitários seguros e isentos de Node.js para normalizar valores de ambiente.
 * Este módulo pode ser importado pelo cliente e pelo servidor.
 */
export function cleanEnvValue(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  let cleaned = val.trim().replace(/\r/g, '');
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}
