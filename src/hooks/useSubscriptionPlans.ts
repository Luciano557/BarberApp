import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BillingPlanCode } from '@/hooks/useSubscriptionAccess';

export interface SubscriptionPlan {
  code: BillingPlanCode;
  name: string;
  amount_ars: number;
  price_version: number;
  sort_order: number;
}

const SUBSCRIPTION_PLANS_QUERY_KEY = ['subscription-plans', 'active'] as const;

function isBillingPlanCode(value: string): value is BillingPlanCode {
  return value === 'basico' || value === 'profesional' || value === 'premium';
}

async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('code, name, amount_ars, price_version, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const amount = Number(row.amount_ars);
    const version = Number(row.price_version);

    if (
      !isBillingPlanCode(row.code) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isInteger(version) ||
      version < 1
    ) {
      console.warn('[subscription-plans] Se omitio un plan con datos invalidos:', row.code);
      return [];
    }

    return [{
      code: row.code,
      name: row.name,
      amount_ars: amount,
      price_version: version,
      sort_order: row.sort_order,
    }];
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: SUBSCRIPTION_PLANS_QUERY_KEY,
    queryFn: fetchSubscriptionPlans,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function formatSubscriptionPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
