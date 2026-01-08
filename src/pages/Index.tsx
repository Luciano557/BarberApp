import { useState } from 'react';
import { PaymentRegistration } from '@/components/PaymentRegistration';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { DailySummary } from '@/components/DailySummary';
import { AppSidebar } from '@/components/AppSidebar';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useTransactions } from '@/hooks/useTransactions';

const Index = () => {
  const [activeTab, setActiveTab] = useState('registro');

  const {
    isLoading,
    services,
    allServices,
    extras,
    allExtras,
    barbers,
    allBarbers,
    discounts,
    addService,
    updateService,
    addExtra,
    updateExtra,
    addBarber,
    updateBarber,
    addDiscount,
    updateDiscount,
    deleteDiscount,
  } = useSupabaseData();

  const { addTransaction, getDailySummary } = useTransactions();

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
          {activeTab === 'registro' && (
            <PaymentRegistration
              services={services}
              extras={extras}
              barbers={barbers}
              discounts={discounts}
              onSubmit={addTransaction}
            />
          )}

          {activeTab === 'resumen' && (
            <DailySummary summary={summary} barbers={barbers} />
          )}

          {activeTab === 'config' && (
            <ConfigurationPanel
              services={allServices}
              extras={allExtras}
              barbers={allBarbers}
              discounts={discounts}
              onAddService={addService}
              onUpdateService={updateService}
              onAddExtra={addExtra}
              onUpdateExtra={updateExtra}
              onAddBarber={addBarber}
              onUpdateBarber={updateBarber}
              onAddDiscount={addDiscount}
              onUpdateDiscount={updateDiscount}
              onDeleteDiscount={deleteDiscount}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
