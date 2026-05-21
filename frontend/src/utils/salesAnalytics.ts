import { DataRow, DealAnalytics, DealStat } from '../hooks/useFetchData';

export type SortKey =
  | 'weightedAmount'
  | 'totalAmount'
  | 'casesCount'
  | 'averageProbability'
  | 'averageDealValue'
  | 'winCount';

export type SortDirection = 'asc' | 'desc';

export const getAverageDealValue = (row: DataRow) =>
  row.casesCount > 0 ? row.totalAmount / row.casesCount : 0;

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value);

export const formatCompactCurrency = (value: number) => {
  if (value >= 1_000_000_000) {
    return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(value / 1_000_000_000)} mld. Kč`;
  }

  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(value / 1_000_000)} mil. Kč`;
  }

  return formatCurrency(value);
};

export const sortSellers = (
  sellers: DataRow[],
  sortKey: SortKey,
  sortDirection: SortDirection
) =>
  [...sellers].sort((a, b) => {
    const firstValue = sortKey === 'averageDealValue' ? getAverageDealValue(a) : a[sortKey];
    const secondValue = sortKey === 'averageDealValue' ? getAverageDealValue(b) : b[sortKey];
    const direction = sortDirection === 'desc' ? -1 : 1;

    return (firstValue - secondValue) * direction;
  });

const buildStat = (name: string, sellers: DataRow[]): DealStat => {
  const count = sellers.reduce((sum, seller) => sum + seller.activeCount, 0);
  const totalAmount = sellers.reduce((sum, seller) => sum + seller.totalAmount, 0);
  const weightedAmount = sellers.reduce((sum, seller) => sum + seller.weightedAmount, 0);

  return {
    name,
    count,
    totalAmount,
    weightedAmount,
    averageProbability: sellers.length
      ? Math.round(sellers.reduce((sum, seller) => sum + seller.averageProbability, 0) / sellers.length)
      : 0,
  };
};

export const buildFallbackDealAnalytics = (sellerRankings: DataRow[]): DealAnalytics => {
  const totalPipeline = sellerRankings.reduce((sum, seller) => sum + seller.totalAmount, 0);
  const weightedPipeline = sellerRankings.reduce((sum, seller) => sum + seller.weightedAmount, 0);
  const activeDeals = sellerRankings.reduce((sum, seller) => sum + seller.activeCount, 0);
  const wonDeals = sellerRankings.reduce((sum, seller) => sum + seller.winCount, 0);
  const lostDeals = sellerRankings.reduce((sum, seller) => sum + seller.lostCount, 0);
  const averageProbability = sellerRankings.length
    ? Math.round(sellerRankings.reduce((sum, seller) => sum + seller.averageProbability, 0) / sellerRankings.length)
    : 0;

  const phases = ['Cenová nabídka', 'Vyjednávání', 'Analýza potřeb', 'Uzavření'];
  const regions = ['Praha', 'Jihomoravský kraj', 'Moravskoslezský kraj', 'Středočeský kraj'];
  const sources = ['Poptávka web/tel/email', 'Doporučení', 'Call centrum', 'Obchodní kampaň'];

  const topDeals = sellerRankings.slice(0, 8).map((seller, index) => ({
    id: seller.id,
    name: `Strategická příležitost ${index + 1}`,
    code: `CRM-${String(index + 1).padStart(3, '0')}`,
    companyName: `${seller.name.split(' ').slice(-1)[0]} Group`,
    ownerName: seller.name,
    region: regions[index % regions.length],
    source: sources[index % sources.length],
    phase: phases[index % phases.length],
    status: 'B_ACTIVE' as const,
    probability: seller.averageProbability,
    totalAmount: seller.totalAmount,
    weightedAmount: seller.weightedAmount,
    scheduledEnd: null,
    nextActivity: index % 3 === 0 ? null : '2026-06-15 09:00',
    currency: 'CZK',
    companyLogoFileName: null,
    ownerPhotoFileName: null,
  }));

  return {
    totalDeals: activeDeals + wonDeals + lostDeals,
    activeDeals,
    wonDeals,
    lostDeals,
    totalPipeline,
    weightedPipeline,
    averageProbability,
    withoutNextActivity: Math.round(activeDeals * 0.28),
    overdueScheduledEnd: Math.round(activeDeals * 0.12),
    highValueLowProbability: sellerRankings.filter((seller) => seller.averageProbability < averageProbability).length,
    phaseStats: phases.map((phase, index) =>
      buildStat(phase, sellerRankings.filter((_, sellerIndex) => sellerIndex % phases.length === index))
    ),
    regionStats: regions.map((region, index) =>
      buildStat(region, sellerRankings.filter((_, sellerIndex) => sellerIndex % regions.length === index))
    ),
    sourceStats: sources.map((source, index) =>
      buildStat(source, sellerRankings.filter((_, sellerIndex) => sellerIndex % sources.length === index))
    ),
    topDeals,
    riskyDeals: topDeals.filter((deal) => !deal.nextActivity || deal.probability < averageProbability).slice(0, 6),
  };
};
