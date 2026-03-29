import { useState, useEffect } from 'react';
import { PaymentRegistration } from '@/components/PaymentRegistration';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { DailySummary } from '@/components/DailySummary';
import { SueldosPanel } from '@/components/SueldosPanel';
import { EstadisticasPanel } from '@/components/EstadisticasPanel';
import { FinanzasPanel } from '@/components/FinanzasPanel';
import { TareasPanel } from '@/components/TareasPanel';
import { MiNegocioPanel } from '@/components/MiNegocioPanel';
import { AppSidebar } from '@/components/AppSidebar';
import { PinProtectedSection } from '@/components/PinProtectedSection';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const Index = () => {
  const isMobile = useIsMobile();
  const { canManagePayments, canManageConfig, isOwner, hasNoAccess, canViewResumen, canViewTareas } = useAuth();
  
  const getDefaultTab = () => {
    if (hasNoAccess) return 'no-access';
    if (canManagePayments) return 'registro';
    if (canViewResumen) return 'resumen';
    return 'no-access';
  };
  
  const [activeTab, setActiveTab] = useState(getDefaultTab);

  useEffect(() => {
    if (hasNoAccess) {
      setActiveTab('no-access');
      return;
    }
    if (activeTab === 'registro' && !canManagePayments) {
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
  }, [activeTab, canManagePayments, canManageConfig, canViewResumen, canViewTareas, hasNoAccess]);

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
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          {activeTab === 'registro' && canManagePayments && (
            <PaymentRegistration
              services={services}
              extras={extras}
              barbers={barbers.filter(b => b.teamRole !== 'otros')}
              discounts={discounts}
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

          {activeTab === 'estadisticas' && canManageConfig && (
            <PinProtectedSection sectionName="Estadísticas">
              <EstadisticasPanel />
            </PinProtectedSection>
          )}

          {activeTab === 'sueldos' && canManageConfig && (
            <PinProtectedSection sectionName="Sueldos">
              <SueldosPanel barbers={barbers} />
            </PinProtectedSection>
          )}

          {activeTab === 'finanzas' && canManageConfig && (
            <PinProtectedSection sectionName="Finanzas">
              <FinanzasPanel />
            </PinProtectedSection>
          )}

          {activeTab === 'tareas' && canViewTareas && (
            <TareasPanel barbers={allBarbers} />
          )}

          {activeTab === 'no-access' && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Lock className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Sin acceso</h2>
              <p className="text-muted-foreground max-w-md">
                No tenés permisos para acceder al sistema. Contactá al dueño o encargado de tu negocio para que te asigne un cargo.
              </p>
            </div>
          )}

          {activeTab === 'mi-negocio' && isOwner && (
            <PinProtectedSection sectionName="Mi Negocio">
              <MiNegocioPanel />
            </PinProtectedSection>
          )}

          {activeTab === 'config' && canManageConfig && (
            <PinProtectedSection sectionName="Configuración">
              <ConfigurationPanel />
            </PinProtectedSection>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
