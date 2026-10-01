/**
 * Formata e higieniza strings Markdown antes da renderização pelo ReactMarkdown,
 * garantindo que tabelas (GFM), títulos e blocos não fiquem colados ou desformatados.
 */
export function formatMarkdownForDisplay(content: string | undefined | null): string {
  if (!content || typeof content !== 'string') return '';

  let text = content;

  // 1. Unify CRLF to LF
  text = text.replace(/\r\n/g, '\n');

  // 1.1 Limpeza de (FAQ): transforma "## Perguntas Frequentes (FAQ)" em apenas "## Perguntas Frequentes"
  text = text.replace(/^(#{2,4}\s*Perguntas\s+Frequentes)\s*\((?:FAQ|F\.A\.Q\.)\)/gim, '$1');
  text = text.replace(/^(#{2,4}\s*)FAQ(?:\s*-\s*|\s*:\s*|\s+)(Perguntas\s+Frequentes)/gim, '$1$2');
  text = text.replace(/^(#{2,4}\s*)FAQ\s*$/gim, '$1Perguntas Frequentes');

  // 1.2 Limpeza de (CTA): remove rótulos como "> **Chamada para Ação (CTA TuaVia):**" ou "**CTA:**", mantendo a frase
  text = text.replace(/(?:^|\n)(>?\s*)\*\*(?:Chamada\s+para\s+A[çc][ãa]o|CTA|Call\s+to\s+Action)(?:\s*\([^)]*\))?(?:\s*TuaVia)?\s*:\*\*\s*(?:\r?\n)?>?\s*/gi, '$1');
  text = text.replace(/\((?:CTA|Call to Action)\)/gi, '');

  // 1.3 Limpeza de redundâncias em notas/citações (>):
  // Remove prefixos repetitivos como "> **Nota do Especialista TuaVia:**", "> **Alerta TuaVia:**", "> **Análise TuaVia:**", mantendo o texto limpo
  text = text.replace(/(?:^|\n)>\s*\*\*(?:Nota(?:\s+do\s+Especialista)?|Alerta|An[aá]lise|Dica)(?:\s+TuaVia)?\s*:\*\*\s*/gim, '\n> ');

  // 1.4 Formatação e respiro de Perguntas Frequentes / Questões em negrito:
  // Garante que perguntas em negrito terminadas em '?' (mesmo contendo itálicos *termo*)
  // tenham quebras de linha duplas antes e depois, evitando que fiquem coladas na resposta ou em outras perguntas.
  const questionBoldPattern = /\*\*(?:(?:\d+[\.\)]\s*)?(?:[^*]|\*(?!\*))+?\?)\*\*/;
  text = text.replace(new RegExp(`([^\\n])\\n*(${questionBoldPattern.source})`, 'g'), '$1\n\n$2');
  text = text.replace(new RegExp(`(${questionBoldPattern.source})[ \\t]*\\n*([^\\n#\\s])`, 'g'), '$1\n\n$2');

  // 2. Fix tables where rows were concatenated on the same line without \n
  // Pattern: "| cell 1 | cell 2 | |---|---| | cell 3 | cell 4 |"
  text = text.replace(/\|\s*\|/g, '|\n|');

  // 3. Fix table headers or cells glued together like "| cell 1 || cell 2 |"
  text = text.replace(/\|{2,}/g, '|\n|');

  // 4. Ensure headers (## / ###) have a blank line preceding them if preceded by text
  text = text.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');

  // 5. Ensure table blocks starting with '|' have a blank line preceding them if preceded by text
  text = text.replace(/([^\n])\n(\|[^\n]+\|)/g, (match, p1, p2) => {
    if (p1.trim().startsWith('|')) {
      return `${p1}\n${p2}`;
    }
    return `${p1}\n\n${p2}`;
  });

  // 6. Ensure blockquotes (Destaque / Dicas) starting with '>' have a blank line preceding them
  text = text.replace(/([^\n])\n(>\s*)/g, '$1\n\n$2');

  // 7. Fix spaces in markdown links like "[ text ] ( url )" -> "[text](url)"
  text = text.replace(/\[\s*([^\]]+?)\s*\]\s*\(\s*([^\s\)]+?)\s*\)/g, '[$1]($2)');

  // 8. Convert standalone URLs (http:// or https://) not in markdown link syntax or code into [url](url)
  // Protect existing markdown links [text](url) and HTML <a> tags
  const protectedParts: string[] = [];
  const placeholder = '___RAW_LINK_PROT_';

  text = text.replace(/\[[^\]]*\]\([^\)]*\)|<a\b[^>]*>[\s\S]*?<\/a>|`[^`]+`|```[\s\S]*?```/g, (match) => {
    const idx = protectedParts.length;
    protectedParts.push(match);
    return `${placeholder}${idx}___`;
  });

  // Convert standalone http/https URLs into markdown links
  text = text.replace(/(?<![\[\(])(https?:\/\/[^\s\)\<\>"']+)/g, '[$1]($1)');

  // Restore protected parts
  protectedParts.forEach((part, idx) => {
    text = text.replace(`${placeholder}${idx}___`, part);
  });

  return text;
}
