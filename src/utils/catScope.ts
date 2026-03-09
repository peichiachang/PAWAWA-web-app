import { CatIdentity } from '../types/domain';

export function extractCatSeries(id: string | null | undefined): string | null {
  if (!id) return null;
  const matched = String(id).match(/^cat_(\d+)(?:_|$)/);
  if (!matched) return id;
  return `cat_${matched[1]}`;
}

export function matchesCatSeries(
  candidateId: string | null | undefined,
  targetScope: string
): boolean {
  const candidateSeries = extractCatSeries(candidateId);
  const targetSeries = extractCatSeries(targetScope);
  if (!candidateSeries || !targetSeries) return false;
  return candidateSeries === targetSeries;
}

function extractTimestamp(id: string): number {
  const matched = String(id).match(/^cat_\d+_(\d+)$/);
  if (!matched) return 0;
  const ts = Number(matched[1]);
  return Number.isFinite(ts) ? ts : 0;
}

export function getScopedCats(cats: CatIdentity[]): CatIdentity[] {
  const bySeries = new Map<string, CatIdentity>();
  for (const cat of cats) {
    const series = extractCatSeries(cat.id) || cat.id;
    const current = bySeries.get(series);
    if (!current || extractTimestamp(cat.id) > extractTimestamp(current.id)) {
      bySeries.set(series, cat);
    }
  }
  return Array.from(bySeries.values()).sort((a, b) => {
    const aSeries = extractCatSeries(a.id) || a.id;
    const bSeries = extractCatSeries(b.id) || b.id;
    return aSeries.localeCompare(bSeries, undefined, { numeric: true });
  });
}

export function getCatNameBySeries(cats: CatIdentity[], id: string | null): string {
  if (id === 'household') return '家庭';
  if (!id) return '家庭';
  const direct = cats.find((cat) => cat.id === id);
  if (direct) return direct.name;
  const series = extractCatSeries(id);
  if (!series) return id;
  const fallback = cats.find((cat) => extractCatSeries(cat.id) === series);
  return fallback ? fallback.name : id;
}
