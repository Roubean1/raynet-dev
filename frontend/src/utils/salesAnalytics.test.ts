import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFallbackDealAnalytics,
  formatCompactCurrency,
  getAverageDealValue,
  sortSellers,
} from './salesAnalytics';
import { DataRow } from '../hooks/useFetchData';

const sellers: DataRow[] = [
  {
    id: 1,
    name: 'Anna Admin',
    email: 'anna@example.com',
    casesCount: 10,
    totalAmount: 10_000_000,
    weightedAmount: 7_000_000,
    averageProbability: 70,
    winCount: 4,
    activeCount: 5,
    lostCount: 1,
  },
  {
    id: 2,
    name: 'Karel Klient',
    email: 'karel@example.com',
    casesCount: 4,
    totalAmount: 20_000_000,
    weightedAmount: 4_000_000,
    averageProbability: 20,
    winCount: 1,
    activeCount: 2,
    lostCount: 1,
  },
  {
    id: 3,
    name: 'Petra Pipeline',
    email: 'petra@example.com',
    casesCount: 2,
    totalAmount: 6_000_000,
    weightedAmount: 5_400_000,
    averageProbability: 90,
    winCount: 2,
    activeCount: 1,
    lostCount: 0,
  },
];

describe('sales analytics utilities', () => {
  it('sorts sellers by weighted value descending', () => {
    const sorted = sortSellers(sellers, 'weightedAmount', 'desc');

    assert.deepEqual(
      sorted.map((seller) => seller.name),
      ['Anna Admin', 'Petra Pipeline', 'Karel Klient']
    );
  });

  it('sorts sellers by average deal value ascending', () => {
    const sorted = sortSellers(sellers, 'averageDealValue', 'asc');

    assert.deepEqual(
      sorted.map((seller) => seller.name),
      ['Anna Admin', 'Petra Pipeline', 'Karel Klient']
    );
  });

  it('calculates average deal value safely', () => {
    assert.equal(getAverageDealValue(sellers[0]), 1_000_000);
    assert.equal(getAverageDealValue({ ...sellers[0], casesCount: 0 }), 0);
  });

  it('formats compact Czech currency values', () => {
    assert.equal(formatCompactCurrency(122_800_000), '122,8 mil. Kč');
    assert.equal(formatCompactCurrency(1_510_000_000), '1,51 mld. Kč');
  });

  it('builds fallback deal analytics from seller rankings', () => {
    const analytics = buildFallbackDealAnalytics(sellers);

    assert.equal(analytics.activeDeals, 8);
    assert.equal(analytics.weightedPipeline, 16_400_000);
    assert.equal(analytics.phaseStats.length, 4);
    assert.equal(analytics.regionStats.length, 4);
    assert.equal(analytics.sourceStats.length, 4);
    assert.equal(analytics.topDeals.length, 3);
    assert.ok(analytics.riskyDeals.length > 0);
  });
});
