export type UserRole = 'user' | 'admin';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  surname?: string;
  username?: string;
  birthDate?: string;
  photoURL: string;
  role: UserRole;
  referralCode: string;
  referredBy?: string;
  phoneNumber?: string;
  balance: number;
  profitBalance: number;
  totalInvested: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  createdAt: string;
  notificationSettings?: {
    payouts: boolean;
    referrals: boolean;
    marketing: boolean;
  };
}

export interface MarketData {
  iqdUsdRate: number;
  oilPrice: number;
  inflationRate: number;
  marketTrend: 'bullish' | 'bearish' | 'stable';
  lastUpdated: string;
}

export interface Package {
  id: string;
  name: string;
  priceIQD: number;
  monthlyReturn: number;
  description: string;
}

export interface Investment {
  id: string;
  userId: string;
  packageId: string;
  packageName: string;
  amountIQD: number;
  purchaseDate: string;
  nextPayoutDate: string;
  lastDailyPayoutAt?: string;
  status: 'active' | 'completed' | 'cancelled';
  autoReinvest: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'payout' | 'investment' | 'referral';
  amountIQD: number;
  description: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface DepositRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amountIQD: number;
  method: string;
  proofUrl: string;
  status: 'pending' | 'confirmed' | 'rejected';
  timestamp: string;
  adminNotes?: string;
  processedBy?: string;
  processedAt?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amountIQD: number;
  method: string;
  accountDetails: string;
  status: 'pending' | 'completed' | 'rejected';
  timestamp: string;
  adminNotes?: string;
  processedBy?: string;
  processedAt?: string;
}

export interface GlobalStats {
  totalUsers: number;
  totalInvested: number;
}

export interface UserSession {
  id: string;
  userId: string;
  timestamp: string;
  userAgent: string;
  device: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'payout' | 'referral' | 'update' | 'deposit' | 'withdrawal';
  read: boolean;
  timestamp: string;
  link?: string;
}

export interface AdminTask {
  id: string;
  creatorId: string;
  creatorEmail: string;
  assigneeId?: string;
  assigneeEmail?: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'deposit' | 'withdrawal' | 'support' | 'maintenance';
  relatedId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}
