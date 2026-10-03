import { describe, it, expect, vi } from 'vitest';
import {
  decompressPdfFlateStream,
  pdfStreamFilter,
  pdfFilterIsText,
  decodePdfLiteral,
  decodePdfHexString,
  extractLinesFromContentStream,
  joinPdfTextPieces,
} from '@/lib/admin/ingestion/pdfUtils';

vi.mock('@/lib/admin/ingestion/pdfUtils', async () => {
  const actual = await vi.importActual('@/lib/admin/ingestion/pdfUtils');
  return {
    ...actual,
  };
});

describe('pdfUtils - decodePdfLiteral', () => {
  it('passes through plain text', () => {
    expect(decodePdfLiteral('Hello World')).toBe('Hello World');
  });

  it('decodes octal escapes', () => {
    expect(decodePdfLiteral('\\101\\102\\103')).toBe('ABC');
  });

  it('decodes newline and tab escapes', () => {
    expect(decodePdfLiteral('line1\\nline2\\t')).toBe('line1\nline2\t');
  });

  it('handles backslash escape sequences', () => {
    expect(decodePdfLiteral('\\(test\\)')).toBe('(test)');
    expect(decodePdfLiteral('foo') + '\\n' + 'bar').toContain('\\');
  });

  it('escapes parentheses in literals', () => {
    expect(decodePdfLiteral('\\(test\\)')).toBe('(test)');
  });
});

describe('pdfUtils - decodePdfHexString', () => {
  it('decodes UTF-16BE hex string', () => {
    const result = decodePdfHexString('00480065006c006c006f');
    expect(result).toBe('Hello');
  });

  it('decodes single-byte hex (Latin-1)', () => {
    const result = decodePdfHexString('48656c6c6f');
    expect(result).toBe('Hello');
  });

  it('decodes windows-1252 characters', () => {
    const result = decodePdfHexString('446973636f2048696472c3');
    expect(result).toContain('Disco Hidr');
  });

  it('returns empty for odd-length hex', () => {
    expect(decodePdfHexString('abc')).toBe('');
  });

  it('returns empty for too-short hex', () => {
    expect(decodePdfHexString('1')).toBe('');
  });
});

describe('pdfUtils - pdfStreamFilter', () => {
  it('returns FlateDecode when no filter present', () => {
    expect(pdfStreamFilter('<< /Length 100 >>')).toBe('FlateDecode');
  });

  it('extracts single filter', () => {
    expect(pdfStreamFilter('<< /Filter /FlateDecode /Length 100 >>')).toBe('FlateDecode');
  });

  it('extracts multiple filters from array', () => {
    const result = pdfStreamFilter('<< /Filter [/ASCII85Decode /FlateDecode] >>');
    expect(result).toContain('FlateDecode');
    expect(result).toContain('ASCII85');
  });
});

describe('pdfUtils - pdfFilterIsText', () => {
  it('accepts FlateDecode', () => {
    expect(pdfFilterIsText('FlateDecode')).toBe(true);
  });

  it('rejects JPEG images (DCTDecode)', () => {
    expect(pdfFilterIsText('DCTDecode')).toBe(false);
  });

  it('rejects image filters', () => {
    expect(pdfFilterIsText('JPXDecode')).toBe(false);
    expect(pdfFilterIsText('CCITTFaxDecode')).toBe(false);
  });

  it('rejects ASCII filters', () => {
    expect(pdfFilterIsText('ASCIIHexDecode')).toBe(false);
    expect(pdfFilterIsText('ASCII85Decode')).toBe(false);
  });

  it('rejects empty filter', () => {
    expect(pdfFilterIsText('')).toBe(false);
  });
});

describe('pdfUtils - extractLinesFromContentStream', () => {
  it('extracts text from Tj operators', () => {
    const content = 'BT /F1 12 Tf 100 700 Td (Hello) Tj (World) Tj ET';
    const lines = extractLinesFromContentStream(content);
    expect(lines).toContain('HelloWorld');
  });

  it('extracts text from TJ arrays', () => {
    const content = 'BT [ (Foo) -10 (Bar) ] TJ ET';
    const lines = extractLinesFromContentStream(content);
    expect(lines).toContain('FooBar');
  });

  it('handles empty content', () => {
    expect(extractLinesFromContentStream('')).toEqual([]);
  });

  it('handles content with text segments', () => {
    const content = 'BT (Line1) Tj (Line2) Tj ET';
    const lines = extractLinesFromContentStream(content);
    expect(lines).toContain('Line1Line2');
  });
});

describe('pdfUtils - joinPdfTextPieces', () => {
  it('joins pieces with newlines', () => {
    expect(joinPdfTextPieces(['Hello', 'World'])).toBe('Hello\nWorld');
  });

  it('trims whitespace from each piece', () => {
    expect(joinPdfTextPieces(['  Foo  ', '  Bar  '])).toBe('Foo\nBar');
  });

  it('filters empty pieces', () => {
    expect(joinPdfTextPieces(['Hello', '', 'World'])).toBe('Hello\nWorld');
  });

  it('collapses multiple spaces', () => {
    expect(joinPdfTextPieces(['Hello    World'])).toBe('Hello World');
  });

  it('handles empty array', () => {
    expect(joinPdfTextPieces([])).toBe('');
  });
});

describe('pdfUtils - decompressPdfFlateStream', () => {
  it('returns empty for short input', async () => {
    const result = await decompressPdfFlateStream(new Uint8Array([1, 2, 3]));
    expect(result).toBe('');
  });

  it('handles decompression failure gracefully', async () => {
    const result = await decompressPdfFlateStream(new Uint8Array(100).fill(0xff));
    expect(result).toBe('');
  });
});
