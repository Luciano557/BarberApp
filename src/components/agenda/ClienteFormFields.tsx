import type { Control, FieldValues, Path } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { PhoneInput, type PhoneInputChange } from '@/components/ui/phone-input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface ClienteFormFieldsProps<T extends FieldValues> {
  control: Control<T>;
  nombreName: Path<T>;
  apellidoName: Path<T>;
  telefonoName: Path<T>;
  emailName: Path<T>;
}

/**
 * Campos del sub-formulario "cliente nuevo", compartidos entre NewAppointmentDialog
 * y AppointmentDetailDialog. Nombre/Apellido/Teléfono sin asterisco (obligatorios por
 * default); Email marcado "(opcional)" — canon de Fase 3.
 */
export function ClienteFormFields<T extends FieldValues>({
  control,
  nombreName,
  apellidoName,
  telefonoName,
  emailName,
}: ClienteFormFieldsProps<T>) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={nombreName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs">Nombre</FormLabel>
              <FormControl>
                <Input {...field} maxLength={80} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={apellidoName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs">Apellido</FormLabel>
              <FormControl>
                <Input {...field} maxLength={80} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={telefonoName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs">Telefono</FormLabel>
              <PhoneInput
                value={(field.value as PhoneInputChange | null)?.e164 ?? null}
                onChange={(o) => field.onChange(o)}
                defaultCountry="AR"
                allowedCountries={['AR', 'UY', 'CL', 'CO', 'MX', 'ES', 'BR']}
                mode="mobile"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={emailName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs">Email (opcional)</FormLabel>
              <FormControl>
                <Input type="email" {...field} maxLength={120} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
