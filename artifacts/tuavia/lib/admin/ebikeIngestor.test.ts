import { describe, it, expect, vi } from 'vitest';
import {
  isUnconfirmedValue,
  auditEBikeSpecs,
} from '@/lib/admin/specAuditor';
import {
  findSpecGaps,
  runDeterministicExtraction,
  UNCONFIRMED_LABEL,
} from '@/lib/admin/ebikeIngestor';
import { STANDARD_SPEC_BLUEPRINT } from '@/lib/specAllocations';

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
  isFirebaseConfigured: false,
  checkFirebaseConfigured: () => false,
}));

vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => null,
  getAdminDb: () => null,
  ensureAdminAccessConfig: vi.fn(),
}));

describe('ebikeIngestor - UNCONFIRMED_LABEL', () => {
  it('exports the standard unconfirmed label', () => {
    expect(UNCONFIRMED_LABEL).toBe('Não informado pelo fabricante');
  });
});

describe('ebikeIngestor - findSpecGaps', () => {
  it('returns empty array for empty sections', () => {
    expect(findSpecGaps([])).toEqual([]);
  });

  it('returns empty array when all fields are filled', () => {
    const sections = STANDARD_SPEC_BLUEPRINT.map((s) => ({
      ...s,
      title: s.title,
      items: s.items.map((item) => ({ label: item.label, value: 'some value' })),
    }));

    const gaps = findSpecGaps(sections as any);
    expect(gaps).toEqual([]);
  });

  it('identifies gaps for unconfirmed values', () => {
    const sections = STANDARD_SPEC_BLUEPRINT.map((s) => ({
      ...s,
      title: s.title,
      items: s.items.map((item) => ({
        label: item.label,
        value: UNCONFIRMED_LABEL,
      })),
    }));

    const gaps = findSpecGaps(sections as any);
    expect(gaps.length).toBe(STANDARD_SPEC_BLUEPRINT.reduce(
      (sum, s) => sum + s.items.length, 0
    ));
    expect(gaps[0]).toHaveProperty('sectionIndex');
    expect(gaps[0]).toHaveProperty('synonyms');
  });

  it('marks gaps as truncated when document was truncated', () => {
    const sections: any = [
      {
        title: 'Test Section',
        items: [
          { label: 'Campo Teste', value: UNCONFIRMED_LABEL },
        ],
      },
    ];

    const gaps = findSpecGaps(sections, true);
    expect(gaps[0].truncated).toBe(true);
    expect(gaps[0].reason).toContain('não lido');
  });

  it('does not mark gaps as truncated when document was complete', () => {
    const sections: any = [
      {
        title: 'Test Section',
        items: [
          { label: 'Campo Teste', value: UNCONFIRMED_LABEL },
        ],
      },
    ];

    const gaps = findSpecGaps(sections, false);
    expect(gaps[0].truncated).toBe(false);
  });

  it('only reports gaps for template items, not extra items', () => {
    const sections: any = [
      {
        title: '1. Resumo Rápido & Destaques',
        items: [
          { label: 'Uso Indicado', value: UNCONFIRMED_LABEL },
          { label: 'Extra Field', value: 'extra info' },
        ],
      },
    ];

    const gaps = findSpecGaps(sections, false);
    expect(gaps.length).toBe(1);
    expect(gaps[0].label).toBe('Uso Indicado');
  });
});

describe('ebikeIngestor - runDeterministicExtraction', () => {
  it('returns empty result for empty rawText', () => {
    const result = runDeterministicExtraction({ rawText: '' });
    expect(result.identity).toEqual({});
    expect(result.gaps).toEqual([]);
    expect(result.stats.totalCanonicalItems).toBe(0);
    expect(result.stats.integrityScore).toBe(0);
  });

  it('returns empty result for whitespace-only rawText', () => {
    const result = runDeterministicExtraction({ rawText: '   \n  \t  ' });
    expect(result.stats.totalCanonicalItems).toBe(0);
    expect(result.stats.integrityScore).toBe(0);
  });

  it('produces 10 spec sections for valid ebike text', () => {
    const text = `
# Sense Easy One

## Especificações Técnicas

Potência: 250W
Autonomia: 80 km
Peso: 22 kg
Bateria: 48V 10Ah

## Equipamentos

### Confirmados na ficha comercial:
- Farol dianteiro
- Buzina
- Bagageiro
`;

    const result = runDeterministicExtraction({ rawText: text, fileName: 'sense-easy-one.pdf' });

    expect(result.specSections.length).toBe(10);
    expect(result.stats.totalCanonicalItems).toBeGreaterThan(0);
    expect(result.identity.marca).toBe('Sense');
    expect(result.identity.modelo).toContain('Easy One');
  });

  it('extracts price history data when present', () => {
    const text = `# Bike Test
Potência: 250W`;

    const parsedData = {
      historicoPrecos: [
        { mes: 'Jan/2025', preco: 4990.0, loja: 'Loja A' },
        { mes: 'Fev/2025', preco: 4500.0, loja: 'Loja B' },
      ],
    };

    const result = runDeterministicExtraction({
      rawText: text,
      fileName: 'bike-test.pdf',
      parsedData,
    });
    expect(result.priceHistoryData.hasPriceHistory).toBe(true);
    expect(result.priceHistoryData.historicoPrecos.length).toBe(2);
  });

  it('handles truncated documents with appropriate gap reasons', () => {
    const text = 'Potência: 250W\nAutonomia: 80 km';
    const result = runDeterministicExtraction({
      rawText: text,
      fileName: 'truncated.pdf',
      truncated: true,
    });

    expect(result.stats.truncated).toBe(true);
    result.gaps.forEach((gap) => {
      if (gap.reason) {
        expect(gap.reason).toContain('não lido');
      }
    });
  });

  it('produces YAML output for valid input', () => {
    const text = `
# Bike Test
Potência: 250W
Autonomia: 80 km
Marca: Sense
Modelo: Test Bike
`;

    const result = runDeterministicExtraction({ rawText: text, fileName: 'bike.pdf' });
    expect(typeof result.structuredYaml).toBe('string');
    expect(result.structuredYaml.length).toBeGreaterThan(0);
  });
});
