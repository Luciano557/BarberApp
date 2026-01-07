import { useState } from 'react';
import { PaymentRegistration } from '@/components/PaymentRegistration';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { DailySummary } from '@/components/DailySummary';
import { AppSidebar } from '@/components/AppSidebar';
import { useBarbershopStore } from '@/hooks/useBarbershopStore';

const Index = () => {
  const [activeTab, setActiveTab] = useState('registro');

  const {
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
    addTransaction,
    getDailySummary,
  } = useBarbershopStore();

  const summary = getDailySummary();

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
