import type { PlatformAdminOrganizationDetail } from '@/types/platformAdmin';

// Synthetic QA data, never a real tenant or provider reference.
export const adminCommercialFixture: PlatformAdminOrganizationDetail = {
  organization: { id: '11111111-1111-4111-8111-111111111111', name: 'Barbería de prueba · El Taller',
    slug: 'el-taller-fixture', phone: '+54 11 5555 0100', address: 'Avenida de Prueba 123, Buenos Aires',
    contactEmail: 'contacto@example.com', isEnabled: true, createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00.380602Z', branchesCount: 2, usersCount: 6 },
  subscription: { id: '22222222-2222-4222-8222-222222222222', sourceStatus: 'active', provider: 'manual',
    effectivePlanCode: 'basico', currentPlanCode: 'basico', billingPlanCode: null, pendingPlanCode: null,
    billingAmountArs: null, billingPriceVersion: null, trialEndsAt: null, currentPeriodStart: '2026-01-01T00:00:00Z',
    currentPeriodEnd: null, providerStatus: null, hasPreapproval: false, cancelAtPeriodEnd: false, updatedAt: '2026-09-01T00:00:00.380602Z' },
  plans: ['basico', 'profesional', 'premium'].map((code, i) => ({ code, name: code, description: null,
    amountArs: (i + 1) * 10000, priceVersion: 1, billingPeriod: 'monthly', isActive: true, sortOrder: i, updatedAt: '2026-09-01T00:00:00Z' })),
  capabilities: { mutationsEnabled: true, canAssignManualPlan: true, canExtendTrial: false, blockCode: null }, hasApprovedPayments: false,
};
