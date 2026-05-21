import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { BusinessCase, BusinessCaseResponse, DealAnalytics, DealStat, SellerRanking } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const getStatName = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;

const buildGroupedStats = (
  data: BusinessCase[],
  getName: (item: BusinessCase) => string
): DealStat[] => {
  const stats = data.reduce<Record<string, DealStat & { probabilitySum: number }>>((acc, item) => {
    const name = getName(item);
    const current = acc[name] ?? {
      name,
      count: 0,
      totalAmount: 0,
      weightedAmount: 0,
      averageProbability: 0,
      probabilitySum: 0,
    };

    current.count += 1;
    current.totalAmount += item.totalAmountInDefaultCurrency;
    current.weightedAmount += item.totalAmountInDefaultCurrency * (item.probability / 100);
    current.probabilitySum += item.probability;
    acc[name] = current;

    return acc;
  }, {});

  return Object.values(stats)
    .map(({ probabilitySum, ...stat }) => ({
      ...stat,
      averageProbability: Math.round(probabilitySum / stat.count),
    }))
    .sort((a, b) => b.weightedAmount - a.weightedAmount)
    .slice(0, 8);
};

const mapDealSummary = (item: BusinessCase) => ({
  id: item.id,
  name: item.name,
  code: item.code,
  companyName: item.company.name,
  ownerName: item.owner.fullNameWithoutTitles || item.owner.fullName,
  region: getStatName(item.company.primaryAddress.territory?.code01, 'Bez regionu'),
  source: getStatName(item.source?.code01, 'Bez zdroje'),
  phase: getStatName(item.businessCasePhase.code01, 'Bez fáze'),
  status: item.status,
  probability: item.probability,
  totalAmount: item.totalAmountInDefaultCurrency,
  weightedAmount: item.totalAmountInDefaultCurrency * (item.probability / 100),
  scheduledEnd: item.scheduledEnd,
  nextActivity: item.nextActivity,
  currency: item.currency.code02,
  companyLogoFileName: item.company.logo?.fileName ?? null,
  ownerPhotoFileName: item.owner.photo?.fileName ?? null,
});

// Data endpoint
app.get('/api/hello', (req, res) => {
  try {
    const dataPath = path.join(process.cwd(), '../data/data.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const jsonData: BusinessCaseResponse = JSON.parse(rawData);

    const sellers = jsonData.data.reduce<Record<number, SellerRanking & { probabilitySum: number }>>(
      (acc, item) => {
        const owner = item.owner;
        const current = acc[owner.id] ?? {
          id: owner.id,
          name: owner.fullNameWithoutTitles || owner.fullName,
          email: owner['contactInfo.email'],
          casesCount: 0,
          totalAmount: 0,
          weightedAmount: 0,
          averageProbability: 0,
          winCount: 0,
          activeCount: 0,
          lostCount: 0,
          probabilitySum: 0,
        };

        current.casesCount += 1;
        current.totalAmount += item.totalAmountInDefaultCurrency;
        current.weightedAmount += item.totalAmountInDefaultCurrency * (item.probability / 100);
        current.probabilitySum += item.probability;

        if (item.status === 'E_WIN') {
          current.winCount += 1;
        } else if (item.status === 'F_LOST') {
          current.lostCount += 1;
        } else {
          current.activeCount += 1;
        }

        acc[owner.id] = current;
        return acc;
      },
      {}
    );

    const sellerRankings = Object.values(sellers)
      .map(({ probabilitySum, ...seller }) => ({
        ...seller,
        averageProbability: Math.round(probabilitySum / seller.casesCount),
      }))
      .sort((a, b) => b.weightedAmount - a.weightedAmount);

    const activeDeals = jsonData.data.filter((item) => item.status === 'B_ACTIVE');
    const today = new Date().toISOString().slice(0, 10);
    const highValueThreshold = activeDeals.length
      ? activeDeals.reduce((sum, item) => sum + item.totalAmountInDefaultCurrency, 0) / activeDeals.length
      : 0;
    const riskyDeals = activeDeals.filter(
      (item) =>
        !item.nextActivity ||
        Boolean(item.scheduledEnd && item.scheduledEnd < today) ||
        (item.totalAmountInDefaultCurrency >= highValueThreshold && item.probability < 40)
    );

    const dealAnalytics: DealAnalytics = {
      totalDeals: jsonData.data.length,
      activeDeals: activeDeals.length,
      wonDeals: jsonData.data.filter((item) => item.status === 'E_WIN').length,
      lostDeals: jsonData.data.filter((item) => item.status === 'F_LOST').length,
      totalPipeline: activeDeals.reduce((sum, item) => sum + item.totalAmountInDefaultCurrency, 0),
      weightedPipeline: activeDeals.reduce(
        (sum, item) => sum + item.totalAmountInDefaultCurrency * (item.probability / 100),
        0
      ),
      averageProbability: activeDeals.length
        ? Math.round(activeDeals.reduce((sum, item) => sum + item.probability, 0) / activeDeals.length)
        : 0,
      withoutNextActivity: activeDeals.filter((item) => !item.nextActivity).length,
      overdueScheduledEnd: activeDeals.filter((item) => item.scheduledEnd && item.scheduledEnd < today).length,
      highValueLowProbability: activeDeals.filter(
        (item) => item.totalAmountInDefaultCurrency >= highValueThreshold && item.probability < 40
      ).length,
      phaseStats: buildGroupedStats(activeDeals, (item) => getStatName(item.businessCasePhase.code01, 'Bez fáze')),
      regionStats: buildGroupedStats(activeDeals, (item) =>
        getStatName(item.company.primaryAddress.territory?.code01, 'Bez regionu')
      ),
      sourceStats: buildGroupedStats(activeDeals, (item) => getStatName(item.source?.code01, 'Bez zdroje')),
      topDeals: activeDeals
        .map(mapDealSummary)
        .sort((a, b) => b.weightedAmount - a.weightedAmount)
        .slice(0, 8),
      riskyDeals: riskyDeals
        .map(mapDealSummary)
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 8),
    };

    res.json({
      message: 'Hello World from Raynet API!',
      timestamp: new Date().toISOString(),
      status: 'ok',
      sellerRankings,
      dealAnalytics
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server běží na http://localhost:${PORT}`);
  console.log(`📋 API dostupné na http://localhost:${PORT}/api/hello`);
});

export default app;
