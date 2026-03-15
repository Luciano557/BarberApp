import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrganizationSettings } from '@/components/OrganizationSettings';
import { StaffConfig } from './StaffConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Barber } from '@/types/barbershop';

interface NegocioConfigProps {
  barbers: Barber[];
  onAddBarber: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void;
}

export function NegocioConfig({ barbers, onAddBarber, onUpdateBarber }: NegocioConfigProps) {
  const { isOwner } = useAuth();

  return (
    <Tabs defaultValue={isOwner ? "business" : "staff"} className="w-full">
      <TabsList className="w-full h-10 bg-muted p-1 rounded-lg">
        {isOwner && (
          <TabsTrigger value="business" className="flex-1 text-sm data-[state=active]:bg-card rounded-md">
            Mi Negocio
          </TabsTrigger>
        )}
        <TabsTrigger value="staff" className="flex-1 text-sm data-[state=active]:bg-card rounded-md">
          Staff
        </TabsTrigger>
      </TabsList>

      {isOwner && (
        <TabsContent value="business" className="mt-6">
          <OrganizationSettings />
        </TabsContent>
      )}

      <TabsContent value="staff" className="mt-6">
        <StaffConfig
          barbers={barbers}
          onAdd={onAddBarber}
          onUpdate={onUpdateBarber}
        />
      </TabsContent>
    </Tabs>
  );
}
