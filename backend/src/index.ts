import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  AuthUser,
  BusinessCase,
  BusinessCaseResponse,
  LeaderboardSortBy,
  LoginRequest,
  LoginResponse,
  SalespersonLeaderboardItem,
  SalespersonLeaderboardResponse
} from './types';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const demoUser = {
  email: 'manager@raynet.cz',
  password: 'Raynet',
  name: 'Raynet Manager',
  role: 'manager' as const
};

const loginRateLimit = {
  maxFailedAttempts: 5,
  windowMs: 2 * 60 * 1000
};

const sessionDurationMs = 60 * 60 * 1000;
const failedLoginAttempts = new Map<string, number[]>();
const sessions = new Map<string, { user: AuthUser; expiresAt: number }>();

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

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

function logInfo(event: string, details: Record<string, unknown> = {}): void {
  console.info(
    JSON.stringify({
      level: 'info',
      event,
      timestamp: new Date().toISOString(),
      ...details
    })
  );
}

function logWarning(event: string, details: Record<string, unknown> = {}): void {
  console.warn(
    JSON.stringify({
      level: 'warn',
      event,
      timestamp: new Date().toISOString(),
      ...details
    })
  );
}

function logError(event: string, error: unknown, details: Record<string, unknown> = {}): void {
  const normalizedError =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      : { message: 'Unknown error' };

  console.error(
    JSON.stringify({
      level: 'error',
      event,
      timestamp: new Date().toISOString(),
      error: normalizedError,
      ...details
    })
  );
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() || req.ip || 'unknown';
  }

  return req.ip || 'unknown';
}

function getLoginIdentifier(req: Request, username: string): string {
  return `${getClientIp(req)}:${username.toLowerCase()}`;
}

function pruneOldFailedAttempts(attempts: number[], now: number): number[] {
  return attempts.filter((attemptAt) => now - attemptAt < loginRateLimit.windowMs);
}

function isRateLimited(identifier: string, now: number): boolean {
  const attempts = pruneOldFailedAttempts(failedLoginAttempts.get(identifier) ?? [], now);
  failedLoginAttempts.set(identifier, attempts);

  return attempts.length >= loginRateLimit.maxFailedAttempts;
}

function recordFailedLogin(identifier: string, now: number): number {
  const attempts = pruneOldFailedAttempts(failedLoginAttempts.get(identifier) ?? [], now);
  attempts.push(now);
  failedLoginAttempts.set(identifier, attempts);

  return attempts.length;
}

function clearFailedLogins(identifier: string): void {
  failedLoginAttempts.delete(identifier);
}

function getBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
}

function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({
      message: 'Missing authorization token',
      status: 'error'
    });
    return;
  }

  const session = sessions.get(token);

  if (!session) {
    res.status(401).json({
      message: 'Invalid authorization token',
      status: 'error'
    });
    return;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    res.status(401).json({
      message: 'Authorization token expired',
      status: 'error'
    });
    return;
  }

  req.user = session.user;
  next();
}

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

app.post('/api/login', (req: Request, res: Response<LoginResponse | { message: string; status: string }>) => {
  const loginBody = (req.body ?? {}) as LoginRequest;
  const username = (loginBody.username ?? loginBody.email ?? '').trim();
  const password = loginBody.password ?? '';
  const identifier = getLoginIdentifier(req, username || 'unknown');
  const now = Date.now();

  if (isRateLimited(identifier, now)) {
    logWarning('auth.rate_limit_exceeded', {
      ip: getClientIp(req),
      username: username || null,
      failedAttempts: loginRateLimit.maxFailedAttempts,
      windowMs: loginRateLimit.windowMs
    });

    res.status(429).json({
      message: 'Too many failed login attempts. Try again later.',
      status: 'error'
    });
    return;
  }

  if (username !== demoUser.email || password !== demoUser.password) {
    const failedAttempts = recordFailedLogin(identifier, now);

    logWarning('auth.login_failed', {
      ip: getClientIp(req),
      username: username || null,
      failedAttempts,
      remainingAttempts: Math.max(loginRateLimit.maxFailedAttempts - failedAttempts, 0)
    });

    if (failedAttempts >= loginRateLimit.maxFailedAttempts) {
      logWarning('auth.suspicious_login_activity', {
        ip: getClientIp(req),
        username: username || null,
        failedAttempts,
        windowMs: loginRateLimit.windowMs
      });
    }

    res.status(401).json({
      message: 'Invalid username or password',
      status: 'error'
    });
    return;
  }

  clearFailedLogins(identifier);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = now + sessionDurationMs;
  const user: AuthUser = {
    email: demoUser.email,
    name: demoUser.name,
    role: demoUser.role
  };

  sessions.set(token, {
    user,
    expiresAt
  });

  logInfo('auth.login_success', {
    ip: getClientIp(req),
    username,
    expiresAt: new Date(expiresAt).toISOString()
  });

  res.json({
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    user
  });
});

app.post('/api/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const token = getBearerToken(req);

  if (token) {
    sessions.delete(token);
  }

  logInfo('auth.logout_success', {
    ip: getClientIp(req),
    username: req.user?.email ?? null
  });

  res.json({
    message: 'Logged out',
    status: 'ok'
  });
});

app.get('/api/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user
  });
});

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
    logError('api.hello_failed', error, {
      path: req.path
    });
    res.status(500).json({
      message: 'Error reading data',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/leaderboard', authenticate, (req: AuthenticatedRequest, res) => {
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
    logError('api.leaderboard_failed', error, {
      path: req.path,
      username: req.user?.email ?? null
    });
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
