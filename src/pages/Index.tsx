import { useState, useEffect } from 'react';
import { Scissors, Lock, Loader2 } from 'lucide-react';
import { PaymentRegistration } from '@/components/PaymentRegistration';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { DailySummary } from '@/components/DailySummary';
import { FinanzasPanel } from '@/components/FinanzasPanel';
import { TareasPanel } from '@/components/TareasPanel';
import { MiNegocioPanel } from '@/components/MiNegocioPanel';
import { TurnosAgendaPanel } from '@/components/TurnosAgendaPanel';
import { ClientesPanel } from '@/components/ClientesPanel';
import { AppSidebar } from '@/components/AppSidebar';
// PinProtectedSection eliminado: el PIN solo aplica a Cuenta de sucursal vía gates de acción/vista.
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useSucursal } from '@/contexts/SucursalContext';
import { useOnboarding } from '@/components/onboarding/OnboardingProvider';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip';

const Index = () => {
  const isMobile = useIsMobile();
  const { canManagePayments, canOperarCajaYGastos, canManageConfig, isOwner, hasNoAccess, canViewResumen, canViewTareas, canViewMiNegocio, canViewFinanzas, canViewTurnosAgenda, canViewClientes, roles, isLoading: authLoading } = useAuth();
  const onboarding = useOnboarding();

  const rolesLoaded = roles.length > 0;

  const getDefaultTab = () => {
    if (!rolesLoaded) return 'welcome';
    if (hasNoAccess) return 'no-access';
    if (canOperarCajaYGastos) return 'registro';
    if (canViewResumen) return 'resumen';
    return 'no-access';
  };
  
  const [activeTab, setActiveTab] = useState(getDefaultTab);
  const [configInitialSection, setConfigInitialSection] = useState<'menu' | 'payments' | 'plan' | 'pin' | 'tareas'>('menu');

  // Register tab setter so onboarding can drive navigation
  useEffect(() => {
    onboarding.registerTabSetter((t) => setActiveTab(t));
    return () => onboarding.registerTabSetter(null);
  }, [onboarding]);

  // Intercepted tab change: blocks navigation outside of allowed tabs during onboarding
  const handleTabChange = (tab: string) => {
    if (onboarding.isActive && !onboarding.isAllowedTab(tab)) return;
    setActiveTab(tab);
  };

  const goToGeneralConfig = () => {
    setConfigInitialSection('payments');
    setActiveTab('config');
  };

  useEffect(() => {
    if (!rolesLoaded) {
      setActiveTab('welcome');
      return;
    }
    if (hasNoAccess) {
      setActiveTab('no-access');
      return;
    }
    // Once roles load and we're still on welcome, navigate to correct default
    if (activeTab === 'welcome') {
      if (canOperarCajaYGastos) setActiveTab('registro');
      else if (canViewResumen) setActiveTab('resumen');
      return;
    }
    if (activeTab === 'registro' && !canOperarCajaYGastos) {
      setActiveTab(canViewResumen ? 'resumen' : 'no-access');
    }
    if (activeTab === 'config' && !canManageConfig) {
      setActiveTab(canViewResumen ? 'resumen' : 'no-access');
    }
    if (activeTab === 'resumen' && !canViewResumen) {
      setActiveTab('no-access');
    }
    if (activeTab === 'tareas' && !canViewTareas) {
      setActiveTab('no-access');
    }
    if (activeTab === 'finanzas' && !canViewFinanzas) {
      setActiveTab(canViewResumen ? 'resumen' : 'no-access');
    }
    if (activeTab === 'mi-negocio' && !canViewMiNegocio) {
      setActiveTab(canViewResumen ? 'resumen' : 'no-access');
    }
    if (activeTab === 'turnos-agenda' && !canViewTurnosAgenda) {
      setActiveTab(canViewResumen ? 'resumen' : 'no-access');
    }
    if (activeTab === 'clientes' && !canViewClientes) {
      setActiveTab(canViewResumen ? 'resumen' : 'no-access');
    }
  }, [activeTab, canManagePayments, canOperarCajaYGastos, canManageConfig, canViewResumen, canViewTareas, canViewFinanzas, canViewMiNegocio, canViewTurnosAgenda, canViewClientes, hasNoAccess, rolesLoaded]);

  const {
    isLoading,
    services,
    extras,
    barbers,
    allBarbers,
    discounts,
    lines,
  } = useSupabaseData();

  const { addTransaction, voidTransaction, getDailySummary, selectedDate, setSelectedDate } = useTransactions();
  const { currentSucursal } = useSucursal();

  const summary = getDailySummary();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className={cn("flex-1 min-h-screen overflow-auto", isMobile && "ml-16")}>
        <div className="max-w-4xl mx-auto p-6 md:p-8">
          {activeTab === 'registro' && canOperarCajaYGastos && (
            <PaymentRegistration
              services={services}
              extras={extras}
              barbers={barbers.filter(b => (b.rolesEquipo ?? []).includes('barber') || b.teamRole === 'barbero')}
              discounts={discounts}
              lines={lines}
              sucursalId={currentSucursal?.id || null}
              onSubmit={addTransaction}
              onNavigateToTareas={() => setActiveTab('tareas')}
            />
          )}

          {activeTab === 'resumen' && canViewResumen && (
            <DailySummary 
              summary={summary} 
              barbers={barbers}
              services={services}
              lines={lines}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onVoidTransaction={voidTransaction}
            />
          )}

          {activeTab === 'finanzas' && canViewFinanzas && (
            <FinanzasPanel barbers={barbers} />
          )}

          {activeTab === 'tareas' && canViewTareas && (
            <TareasPanel barbers={allBarbers} />
          )}

          {/* Welcome / loading screen */}
          {activeTab === 'welcome' && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Scissors className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">Vittro</h1>
              <p className="text-muted-foreground mb-8 max-w-sm">
                Tu sistema de gestión integral para barberías
              </p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Preparando tu espacio de trabajo...</span>
              </div>
            </div>
          )}

          {/* Real no-access (role is 'otros') */}
          {activeTab === 'no-access' && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Lock className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Sin acceso</h2>
              <p className="text-muted-foreground max-w-md">
                No tenés permisos para acceder al sistema. Contactá al dueño o encargado de tu negocio para que te asigne un cargo.
              </p>
            </div>
          )}

          {activeTab === 'turnos-agenda' && canViewTurnosAgenda && (
            <TurnosAgendaPanel />
          )}

          {activeTab === 'clientes' && canViewClientes && (
            <ClientesPanel />
          )}

          {activeTab === 'mi-negocio' && canViewMiNegocio && (
            <MiNegocioPanel onGoToGeneralConfig={canManageConfig ? goToGeneralConfig : undefined} />
          )}

          {activeTab === 'config' && canManageConfig && (
            <ConfigurationPanel
              initialSection={configInitialSection}
              onSectionChange={setConfigInitialSection}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
