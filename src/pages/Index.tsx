import { useState, useEffect } from 'react';
import { PaymentRegistration } from '@/components/PaymentRegistration';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { DailySummary } from '@/components/DailySummary';
import { SueldosPanel } from '@/components/SueldosPanel';
import { EstadisticasPanel } from '@/components/EstadisticasPanel';
import { AppSidebar } from '@/components/AppSidebar';
import { UserManagement } from '@/components/UserManagement';
import { PinProtectedSection } from '@/components/PinProtectedSection';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { canManagePayments, canManageConfig, canManageUsers } = useAuth();
  
  // Set default tab based on permissions
  const getDefaultTab = () => {
    if (canManagePayments) return 'registro';
    return 'resumen';
  };
  
  const [activeTab, setActiveTab] = useState(getDefaultTab);

  // Update active tab if current tab becomes inaccessible
  useEffect(() => {
    if (activeTab === 'registro' && !canManagePayments) {
      setActiveTab('resumen');
    }
    if (activeTab === 'config' && !canManageConfig) {
      setActiveTab('resumen');
    }
  }, [activeTab, canManagePayments, canManageConfig]);

  const {
    isLoading,
    services,
    allServices,
    extras,
    allExtras,
    barbers,
    allBarbers,
    discounts,
    lines,
    allLines,
    addService,
    updateService,
    addExtra,
    updateExtra,
    addBarber,
    updateBarber,
    addDiscount,
    updateDiscount,
    deleteDiscount,
    addLine,
    updateLine,
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
      {/* Sidebar */}
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          {activeTab === 'registro' && canManagePayments && (
            <PaymentRegistration
              services={services}
              extras={extras}
              barbers={barbers}
              discounts={discounts}
              onSubmit={addTransaction}
            />
          )}

          {activeTab === 'resumen' && (
            <PinProtectedSection sectionName="Resumen">
              <DailySummary 
                summary={summary} 
                barbers={barbers}
                services={services}
                lines={lines}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onVoidTransaction={voidTransaction}
              />
            </PinProtectedSection>
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

          {activeTab === 'config' && canManageConfig && (
            <PinProtectedSection sectionName="Configuración">
              <div className="space-y-8">
                <ConfigurationPanel
                  services={allServices}
                  extras={allExtras}
                  barbers={allBarbers}
                  discounts={discounts}
                  lines={allLines}
                  onAddService={addService}
                  onUpdateService={updateService}
                  onAddExtra={addExtra}
                  onUpdateExtra={updateExtra}
                  onAddBarber={addBarber}
                  onUpdateBarber={updateBarber}
                  onAddDiscount={addDiscount}
                  onUpdateDiscount={updateDiscount}
                  onDeleteDiscount={deleteDiscount}
                  onAddLine={addLine}
                  onUpdateLine={updateLine}
                />
                
                {/* User Management - only for owner */}
                {canManageUsers && (
                  <UserManagement barbers={allBarbers} />
                )}
              </div>
            </PinProtectedSection>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
