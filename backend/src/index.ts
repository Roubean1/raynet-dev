import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import {
  BusinessCase,
  BusinessCaseResponse,
  LeaderboardSortBy,
  SalespersonLeaderboardItem,
  SalespersonLeaderboardResponse
} from './types';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const leaderboardSortFields: LeaderboardSortBy[] = [
  'wonRevenue',
  'totalRevenue',
  'activeRevenue',
  'weightedRevenue',
  'tradingProfit',
  'businessCasesCount',
  'wonCasesCount',
  'winRate'
];

function loadBusinessCases(): BusinessCase[] {
  const dataPath = path.join(process.cwd(), '../data/data.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const jsonData: BusinessCaseResponse = JSON.parse(rawData);

  return jsonData.data;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getSortBy(value: unknown): LeaderboardSortBy {
  return typeof value === 'string' && leaderboardSortFields.includes(value as LeaderboardSortBy)
    ? (value as LeaderboardSortBy)
    : 'wonRevenue';
}

function getLimit(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function buildLeaderboard(
  businessCases: BusinessCase[],
  sortBy: LeaderboardSortBy
): SalespersonLeaderboardItem[] {
  const salespeople = new Map<number, Omit<SalespersonLeaderboardItem, 'rank' | 'averageDealSize' | 'winRate'>>();

  for (const businessCase of businessCases) {
    const owner = businessCase.owner;
    const current = salespeople.get(owner.id) ?? {
      ownerId: owner.id,
      ownerName: owner.fullName,
      ownerEmail: owner['contactInfo.email'],
      businessCasesCount: 0,
      wonCasesCount: 0,
      activeCasesCount: 0,
      lostCasesCount: 0,
      totalRevenue: 0,
      wonRevenue: 0,
      activeRevenue: 0,
      weightedRevenue: 0,
      tradingProfit: 0
    };

    const revenue = toNumber(businessCase.totalAmountInDefaultCurrency);
    const tradingProfit = toNumber(businessCase.tradingProfit);
    const probability = toNumber(businessCase.probability);

    current.businessCasesCount += 1;
    current.totalRevenue += revenue;
    current.weightedRevenue += revenue * (probability / 100);
    current.tradingProfit += tradingProfit;

    if (businessCase.status === 'E_WIN') {
      current.wonCasesCount += 1;
      current.wonRevenue += revenue;
    } else if (businessCase.status === 'F_LOST') {
      current.lostCasesCount += 1;
    } else {
      current.activeCasesCount += 1;
      current.activeRevenue += revenue;
    }

    salespeople.set(owner.id, current);
  }

  return Array.from(salespeople.values())
    .map((salesperson) => ({
      ...salesperson,
      rank: 0,
      averageDealSize:
        salesperson.businessCasesCount > 0
          ? Math.round(salesperson.totalRevenue / salesperson.businessCasesCount)
          : 0,
      winRate:
        salesperson.businessCasesCount > 0
          ? Number((salesperson.wonCasesCount / salesperson.businessCasesCount).toFixed(4))
          : 0
    }))
    .sort((a, b) => {
      const sortDiff = b[sortBy] - a[sortBy];

      if (sortDiff !== 0) {
        return sortDiff;
      }

      return b.wonRevenue - a.wonRevenue || a.ownerName.localeCompare(b.ownerName, 'cs');
    })
    .map((salesperson, index) => ({
      ...salesperson,
      rank: index + 1,
      totalRevenue: Math.round(salesperson.totalRevenue),
      wonRevenue: Math.round(salesperson.wonRevenue),
      activeRevenue: Math.round(salesperson.activeRevenue),
      weightedRevenue: Math.round(salesperson.weightedRevenue),
      tradingProfit: Math.round(salesperson.tradingProfit)
    }));
}

// Data endpoint
app.get('/api/hello', (req, res) => {
  try {
    const businessCases = loadBusinessCases();

    const dataRows = businessCases.slice(0, 10).map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      type: item._entityName
    }));

    res.json({
      message: 'Hello World from Raynet API!',
      timestamp: new Date().toISOString(),
      status: 'ok',
      dataRows
    });
  } catch (error) {
    console.error('Error reading data:', error);
    res.status(500).json({
      message: 'Error reading data',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const sortBy = getSortBy(req.query.sortBy);
    const limit = getLimit(req.query.limit);
    const leaderboard = buildLeaderboard(loadBusinessCases(), sortBy);
    const data = limit === null ? leaderboard : leaderboard.slice(0, limit);

    const response: SalespersonLeaderboardResponse = {
      generatedAt: new Date().toISOString(),
      totalSalespeople: leaderboard.length,
      sortBy,
      data
    };

    res.json(response);
  } catch (error) {
    console.error('Error building leaderboard:', error);
    res.status(500).json({
      message: 'Error building leaderboard',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server běží na http://localhost:${PORT}`);
  console.log(`📋 API dostupné na http://localhost:${PORT}/api/hello`);
});

export default app;
