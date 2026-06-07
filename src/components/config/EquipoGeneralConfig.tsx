import { EquipoUnificado } from './EquipoUnificado';
import { Barber } from '@/types/barbershop';

interface EquipoGeneralConfigProps {
  organizationId: string;
  allBarbers: Barber[];
  allSucursales: { id: string; nombre: string; activa: boolean }[];
  onAddBarberToSucursal: (barber: Omit<Barber, 'id' | 'uid'>, sucursalId: string) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void | Promise<void>;
  onRefreshBarbers?: () => Promise<void> | void;
}

/**
 * Panel "Equipo General" — vive en Mi Negocio › General › Equipo.
 * Administra todo el equipo del negocio (alta, edición, cargos, acceso, PIN)
 * y agrega gestión de sucursal principal (doble escritura legacy + bs) y
 * sucursales secundarias recurrentes por barbero.
 */
export function EquipoGeneralConfig({
  organizationId, allBarbers, allSucursales,
  onAddBarberToSucursal, onUpdateBarber, onRefreshBarbers,
}: EquipoGeneralConfigProps) {
  const sucursalesActivas = allSucursales
    .filter(s => s.activa)
    .map(s => ({ id: s.id, nombre: s.nombre }));

  return (
    <EquipoUnificado
      mode="general"
      sucursalId=""
      organizationId={organizationId}
      barbers={allBarbers}
      allBarbers={allBarbers}
      sucursales={sucursalesActivas}
      sucursalesActivas={sucursalesActivas}
      // Sin sucursal contextual, este handler nunca se usa en general mode.
      onAddBarber={() => { /* no-op: en general usamos onAddBarberToSucursal */ }}
      onAddBarberToSucursal={onAddBarberToSucursal}
      onUpdateBarber={onUpdateBarber}
      onRefreshBarbers={onRefreshBarbers}
    />
  );
}
