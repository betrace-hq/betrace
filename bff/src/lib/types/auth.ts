export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string;
  role: UserRole;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  createdAt: string;
  updatedAt: string;
  subscription?: TenantSubscription;
}

export interface TenantSubscription {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt?: string;
  trialEnd?: string;
}

export type UserRole = 'admin' | 'member' | 'viewer';

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface AuthSession {
  user: User;
  tenant: Tenant;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface WorkOSProfile {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string;
}