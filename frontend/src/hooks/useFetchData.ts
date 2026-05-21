import { useState, useEffect } from 'react';
import { buildFallbackDealAnalytics } from '../utils/salesAnalytics';

export interface DataRow {
  id: number;
  name: string;
  email: string | null;
  casesCount: number;
  totalAmount: number;
  weightedAmount: number;
  averageProbability: number;
  winCount: number;
  activeCount: number;
  lostCount: number;
}

export interface DealStat {
  name: string;
  count: number;
  totalAmount: number;
  weightedAmount: number;
  averageProbability: number;
}

export interface DealSummary {
  id: number;
  name: string;
  code: string;
  companyName: string;
  ownerName: string;
  region: string;
  source: string;
  phase: string;
  status: 'B_ACTIVE' | 'E_WIN' | 'F_LOST';
  probability: number;
  totalAmount: number;
  weightedAmount: number;
  scheduledEnd: string | null;
  nextActivity: string | null;
  currency: string;
  companyLogoFileName: string | null;
  ownerPhotoFileName: string | null;
}

export interface DealAnalytics {
  totalDeals: number;
  activeDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalPipeline: number;
  weightedPipeline: number;
  averageProbability: number;
  withoutNextActivity: number;
  overdueScheduledEnd: number;
  highValueLowProbability: number;
  phaseStats: DealStat[];
  regionStats: DealStat[];
  sourceStats: DealStat[];
  topDeals: DealSummary[];
  riskyDeals: DealSummary[];
}

export interface ApiResponse {
  message: string;
  timestamp: string;
  status: string;
  sellerRankings: DataRow[];
  dealAnalytics: DealAnalytics;
}

const emptyDealAnalytics: DealAnalytics = {
  totalDeals: 0,
  activeDeals: 0,
  wonDeals: 0,
  lostDeals: 0,
  totalPipeline: 0,
  weightedPipeline: 0,
  averageProbability: 0,
  withoutNextActivity: 0,
  overdueScheduledEnd: 0,
  highValueLowProbability: 0,
  phaseStats: [],
  regionStats: [],
  sourceStats: [],
  topDeals: [],
  riskyDeals: [],
};

export function useFetchData() {
  const [data, setData] = useState<DataRow[]>([]);
  const [dealAnalytics, setDealAnalytics] = useState<DealAnalytics>(emptyDealAnalytics);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/hello');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const result: ApiResponse = await response.json();
      setData(result.sellerRankings);
      setDealAnalytics(result.dealAnalytics ?? buildFallbackDealAnalytics(result.sellerRankings));
    } catch (err) {
      setData([]);
      setDealAnalytics(emptyDealAnalytics);
    }
  };

  return { data, dealAnalytics };
}
