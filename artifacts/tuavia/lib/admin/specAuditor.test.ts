import { describe, it, expect } from 'vitest';
import {
  isUnconfirmedValue,
  auditEBikeSpecs,
} from '@/lib/admin/specAuditor';
import type { EBikeSpecSection, EBikeSpecItem } from '@/types/ebike';

const makeSection = (
  title: string,
  items: EBikeSpecItem[]
): EBikeSpecSection => ({ title, items });

describe('specAuditor - isUnconfirmedValue', () => {
  it('returns true for empty/null/undefined', () => {
    expect(isUnconfirmedValue('')).toBe(true);
    expect(isUnconfirmedValue(null)).toBe(true);
    expect(isUnconfirmedValue(undefined)).toBe(true);
  });

  it('detects common unconfirmed patterns', () => {
    expect(isUnconfirmedValue('Não informado')).toBe(true);
    expect(isUnconfirmedValue('nao informado')).toBe(true);
    expect(isUnconfirmedValue('Pendente')).toBe(true);
    expect(isUnconfirmedValue('a definir')).toBe(true);
    expect(isUnconfirmedValue('N/A')).toBe(true);
    expect(isUnconfirmedValue('n/a')).toBe(true);
    expect(isUnconfirmedValue('Desconhecido')).toBe(true);
    expect(isUnconfirmedValue('Indisponível')).toBe(true);
  });

  it('returns false for valid values', () => {
    expect(isUnconfirmedValue('500W')).toBe(false);
    expect(isUnconfirmedValue('Shimano')).toBe(false);
    expect(isUnconfirmedValue('100 km')).toBe(false);
  });
});

describe('specAuditor - auditEBikeSpecs', () => {
  it('returns empty summary for empty sections', () => {
    const result = auditEBikeSpecs([]);
    expect(result.auditSummary.totalSpecs).toBe(0);
    expect(result.auditSummary.integrityScore).toBe(0);
    expect(result.specSections).toEqual([]);
  });

  it('audits confirmed items with external source', () => {
    const sections: EBikeSpecSection[] = [
      makeSection('Motor', [
        {
          label: 'Potência Nominal',
          value: '250W',
          status: 'CONFIRMADO',
          confidence: 'ALTA',
          source: 'https://exemplo.com/ficha',
        },
      ]),
    ];

    const { specSections, auditSummary } = auditEBikeSpecs(sections);
    expect(auditSummary.totalSpecs).toBe(1);
    expect(auditSummary.confirmedCount).toBe(1);
    expect(auditSummary.integrityScore).toBe(100);
    expect(specSections[0].auditReport?.confirmados).toBe(1);
  });

  it('downgrades confidence when ALTA without external source', () => {
    const sections: EBikeSpecSection[] = [
      makeSection('Motor', [
        {
          label: 'Potência Nominal',
          value: '250W',
          status: 'CONFIRMADO',
          confidence: 'ALTA',
          source: 'catálogo oficial',
        },
      ]),
    ];

    const { specSections, auditSummary } = auditEBikeSpecs(sections);
    const item = specSections[0].items[0];
    expect(item.confidence).toBe('NAO_CONFIRMADA');
    expect(item.source).toBe('');
    expect(auditSummary.confirmedCount).toBe(0);
    expect(auditSummary.unconfirmedCount).toBe(1);
  });

  it('normalizes placeholder values to NAO_INFORMADO', () => {
    const sections: EBikeSpecSection[] = [
      makeSection('Bateria', [
        {
          label: 'Capacidade',
          value: 'Não informado',
          status: 'CONFIRMADO',
          confidence: 'ALTA',
          source: '',
        },
      ]),
    ];

    const { specSections, auditSummary } = auditEBikeSpecs(sections);
    const item = specSections[0].items[0];
    expect(item.value).toBe('Não informado pelo fabricante');
    expect(item.confidence).toBe('NAO_CONFIRMADA');
    expect(item.status).toBe('NAO_INFORMADO');
    expect(auditSummary.unconfirmedCount).toBe(1);
  });

  it('replaces generic source with fallback domain when provided', () => {
    const sections: EBikeSpecSection[] = [
      makeSection('Motor', [
        {
          label: 'Tipo',
          value: 'Brushless',
          status: 'CONFIRMADO',
          confidence: 'ALTA',
          source: 'manual do fabricante',
        },
      ]),
    ];

    const { specSections, auditSummary } = auditEBikeSpecs(sections, 'https://marca.com.br');
    const item = specSections[0].items[0];
    expect(item.source).toBe('https://marca.com.br');
    expect(auditSummary.confirmedCount).toBe(1);
    expect(auditSummary.integrityScore).toBe(100);
  });

  it('cleans tuavia.com.br sources', () => {
    const sections: EBikeSpecSection[] = [
      makeSection('Teste', [
        {
          label: 'Campo',
          value: '100',
          status: 'CONFIRMADO',
          confidence: 'ALTA',
          source: 'https://tuavia.com.br/ficha',
        },
      ]),
    ];

    const { specSections, auditSummary } = auditEBikeSpecs(sections);
    expect(specSections[0].items[0].source).toBe('');
    expect(auditSummary.confirmedCount).toBe(0);
    expect(auditSummary.unconfirmedCount).toBe(1);
  });

  it('tracks corrections when items change', () => {
    const sections: EBikeSpecSection[] = [
      makeSection('Motor', [
        {
          label: 'Potência',
          value: '250W',
          status: 'CONFIRMADO',
          confidence: 'ALTA',
          source: 'catálogo oficial',
        },
      ]),
    ];

    const { auditSummary } = auditEBikeSpecs(sections);
    expect(auditSummary.corrections.length).toBeGreaterThan(0);
    const corr = auditSummary.corrections[0];
    expect(corr.campo).toContain('Potência');
    expect(corr.de).toContain('catálogo oficial');
  });

  it('produces correct verification breakdown', () => {
    const sections: EBikeSpecSection[] = [
      makeSection('Spec', [
        { label: 'Alta Conf', value: '100', status: 'CONFIRMADO', confidence: 'ALTA', source: 'https://site.com' },
        { label: 'Media Conf', value: '200', status: 'CONFIRMADO', confidence: 'MEDIA', source: 'https://site.com' },
        { label: 'Baixa Conf', value: '300', status: 'CONFIRMADO', confidence: 'BAIXA', source: '' },
        { label: 'No Conf', value: 'Não informado', status: 'NAO_INFORMADO', confidence: 'NAO_CONFIRMADA', source: '' },
      ]),
    ];

    const { auditSummary } = auditEBikeSpecs(sections);
    expect(auditSummary.verificationBreakdown.alta).toBe(1);
    expect(auditSummary.verificationBreakdown.media).toBe(1);
    expect(auditSummary.verificationBreakdown.baixa).toBe(1);
    expect(auditSummary.verificationBreakdown.nao_confirmada).toBe(1);
  });

  it('calculates integrity score correctly', () => {
    const sections: EBikeSpecSection[] = [
      makeSection('Spec', [
        { label: 'Item1', value: '100', status: 'CONFIRMADO', confidence: 'ALTA', source: 'https://site.com' },
        { label: 'Item2', value: '200', status: 'CONFIRMADO', confidence: 'MEDIA', source: 'https://site.com' },
        { label: 'Item3', value: '300', status: 'CALCULADO', confidence: 'MEDIA', source: 'https://site.com' },
        { label: 'Item4', value: '400', status: 'FONTE_COMERCIAL', confidence: 'BAIXA', source: 'https://site.com' },
      ]),
    ];

    const { auditSummary } = auditEBikeSpecs(sections);
    // confirmed=2 (1.0) + calculated=1 (0.8) + commercial=1 (0.6) = 3.4 / 4 = 0.85 → 85
    expect(auditSummary.integrityScore).toBe(85);
  });
});
