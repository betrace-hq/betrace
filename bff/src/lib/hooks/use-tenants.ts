import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useReactiveAuth } from './use-reactive-auth'

export interface Tenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended' | 'trial' | 'inactive'
  plan: 'starter' | 'professional' | 'enterprise'
  createdAt: string
  updatedAt: string
  metadata?: {
    industry?: string
    website?: string
    phone?: string
    primaryContact?: string
    timezone?: string
  }
  settings?: {
    emailNotifications: boolean
    webhookNotifications: boolean
    dailyDigest: boolean
    twoFactorAuth: boolean
    ipAllowlist: boolean
    sessionTimeout: number
  }
  usage?: {
    signals: number
    rules: number
    storage: number
    apiCalls: number
  }
  limits?: {
    signals: number
    rules: number
    storage: number
    apiCalls: number
  }
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'active' | 'invited' | 'suspended'
  lastLogin?: string
  joinedAt: string
  tenantId: string
}

export function useTenants() {
  const { isAuthenticated, isDemo } = useReactiveAuth()

  return useQuery({
    queryKey: ['tenants'],
    queryFn: async (): Promise<{ tenants: Tenant[] }> => {
      // Demo mode - return mock data
      if (isDemo || !isAuthenticated) {
        return getMockTenants()
      }

      // Real API call would go here
      const response = await fetch('/api/v1/tenants')
      if (!response.ok) {
        return getMockTenants()
      }
      return response.json()
    },
    enabled: true,
    staleTime: 300000, // 5 minutes
  })
}

export function useTenant(tenantId: string) {
  const { isAuthenticated, isDemo } = useReactiveAuth()

  return useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async (): Promise<Tenant> => {
      // Demo mode - return mock data
      if (isDemo || !isAuthenticated) {
        const { tenants } = getMockTenants()
        return tenants.find(t => t.id === tenantId) || tenants[0]
      }

      // Real API call would go here
      const response = await fetch(`/api/v1/tenants/${tenantId}`)
      if (!response.ok) {
        const { tenants } = getMockTenants()
        return tenants.find(t => t.id === tenantId) || tenants[0]
      }
      return response.json()
    },
    enabled: !!tenantId,
    staleTime: 300000, // 5 minutes
  })
}

export function useTeamMembers(tenantId: string) {
  const { isAuthenticated, isDemo } = useReactiveAuth()

  return useQuery({
    queryKey: ['team-members', tenantId],
    queryFn: async (): Promise<{ members: TeamMember[] }> => {
      // Demo mode - return mock data
      if (isDemo || !isAuthenticated) {
        return getMockTeamMembers(tenantId)
      }

      // Real API call would go here
      const response = await fetch(`/api/v1/tenants/${tenantId}/members`)
      if (!response.ok) {
        return getMockTeamMembers(tenantId)
      }
      return response.json()
    },
    enabled: !!tenantId,
    staleTime: 60000, // 1 minute
  })
}

export function useUpdateTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { tenantId: string; updates: Partial<Tenant> }) => {
      // Real API call would go here
      const response = await fetch(`/api/v1/tenants/${data.tenantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data.updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update tenant')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      tenantId: string
      email: string
      role: TeamMember['role']
    }) => {
      // Real API call would go here
      const response = await fetch(`/api/v1/tenants/${data.tenantId}/members/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          role: data.role,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to invite team member')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', variables.tenantId] })
    },
  })
}

function getMockTenants(): { tenants: Tenant[] } {
  return {
    tenants: [
      {
        id: 'tenant-1',
        name: 'Acme Corporation',
        slug: 'acme-corp',
        status: 'active',
        plan: 'enterprise',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        metadata: {
          industry: 'Technology',
          website: 'https://acme.com',
          phone: '+1 (555) 123-4567',
          primaryContact: 'admin@acme.com',
          timezone: 'America/New_York',
        },
        settings: {
          emailNotifications: true,
          webhookNotifications: false,
          dailyDigest: true,
          twoFactorAuth: true,
          ipAllowlist: false,
          sessionTimeout: 30,
        },
        usage: {
          signals: 8234,
          rules: 42,
          storage: 3.2,
          apiCalls: 145678,
        },
        limits: {
          signals: 10000,
          rules: 100,
          storage: 10,
          apiCalls: 500000,
        },
      },
      {
        id: 'tenant-2',
        name: 'Beta Testing Inc',
        slug: 'beta-testing',
        status: 'trial',
        plan: 'professional',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-14T15:30:00Z',
        metadata: {
          industry: 'Software',
          website: 'https://betatesting.io',
          phone: '+1 (555) 987-6543',
          primaryContact: 'contact@betatesting.io',
          timezone: 'America/Los_Angeles',
        },
        settings: {
          emailNotifications: true,
          webhookNotifications: true,
          dailyDigest: false,
          twoFactorAuth: false,
          ipAllowlist: false,
          sessionTimeout: 60,
        },
        usage: {
          signals: 1234,
          rules: 15,
          storage: 0.8,
          apiCalls: 23456,
        },
        limits: {
          signals: 5000,
          rules: 50,
          storage: 5,
          apiCalls: 100000,
        },
      },
    ],
  }
}

function getMockTeamMembers(tenantId: string): { members: TeamMember[] } {
  return {
    members: [
      {
        id: 'member-1',
        name: 'Sarah Chen',
        email: 'sarah.chen@company.com',
        role: 'admin',
        status: 'active',
        lastLogin: '2024-01-15T10:30:00Z',
        joinedAt: '2023-08-01T00:00:00Z',
        tenantId,
      },
      {
        id: 'member-2',
        name: 'Michael Rodriguez',
        email: 'michael.r@company.com',
        role: 'member',
        status: 'active',
        lastLogin: '2024-01-15T09:15:00Z',
        joinedAt: '2023-09-15T00:00:00Z',
        tenantId,
      },
      {
        id: 'member-3',
        name: 'Emily Johnson',
        email: 'emily.j@company.com',
        role: 'viewer',
        status: 'invited',
        lastLogin: undefined,
        joinedAt: '2024-01-10T00:00:00Z',
        tenantId,
      },
      {
        id: 'member-4',
        name: 'David Park',
        email: 'david.p@company.com',
        role: 'member',
        status: 'active',
        lastLogin: '2024-01-14T14:20:00Z',
        joinedAt: '2023-10-20T00:00:00Z',
        tenantId,
      },
    ],
  }
}