import { useEffect, useMemo, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { DrawerForm } from '@/components/ui/drawer-form';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Marca, ProductoConSucursal, ComisionProductoModo } from './types';
import { productSharedFieldsSchema, NO_BRAND } from './productSharedFields';

interface Props {
  open: boolean;
  producto: ProductoConSucursal | null; // null = nuevo
  marcas: Marca[];
  sucursalId: string;
  onClose: () => void;
  onSaved: () => void;
  onManageMarcas: () => void;
}

const productoSchema = productSharedFieldsSchema
  .extend({
    activoSucursal: z.boolean(),
    precioCosto: z.string().optional(),
    precioVenta: z.string().refine((v) => {
      const n = parseFloat(v);
      return !Number.isNaN(n) && n >= 0;
    }, 'El precio de venta debe ser un número igual o mayor a 0.'),
    stockMinimo: z.string().optional(),
    stockInicial: z.string().optional(),
    comisionModo: z.enum(['barbero', 'ninguna', 'personalizada']),
    comisionPct: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.comisionModo === 'personalizada') {
      const n = parseFloat((data.comisionPct || '').replace(',', '.'));
      if (Number.isNaN(n) || n < 0 || n > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['comisionPct'], message: 'Ingresá un porcentaje de comisión entre 0 y 100.' });
      }
    }
    if (data.comisionModo !== 'ninguna' && !(data.precioCosto || '').trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['precioCosto'], message: 'Para que el producto genere comisión, cargá un precio de costo.' });
    }
  });

type ProductoFormValues = z.infer<typeof productoSchema>;

function buildDefaults(producto: ProductoConSucursal | null): ProductoFormValues {
  if (producto) {
    const ps = producto.sucursal;
    return {
      nombre: producto.producto.nombre,
      marcaId: producto.producto.marca_id || NO_BRAND,
      descripcion: producto.producto.descripcion || '',
      activoSucursal: ps?.activo ?? true,
      precioCosto: ps?.precio_costo != null ? String(ps.precio_costo) : '',
      precioVenta: ps?.precio_venta != null ? String(ps.precio_venta) : '',
      stockMinimo: ps?.stock_minimo != null ? String(ps.stock_minimo) : '',
      stockInicial: '',
      comisionModo: (ps?.comision_modo as ComisionProductoModo) || 'barbero',
      comisionPct: ps?.comision_porcentaje != null ? String(ps.comision_porcentaje) : '',
    };
  }
  return {
    nombre: '', marcaId: NO_BRAND, descripcion: '',
    activoSucursal: true, precioCosto: '', precioVenta: '', stockMinimo: '', stockInicial: '',
    comisionModo: 'barbero', comisionPct: '',
  };
}

export function ProductoDialog({ open, producto, marcas, sucursalId, onClose, onSaved, onManageMarcas }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const isNew = !producto;

  const [activeTab, setActiveTab] = useState('datos');

  const form = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema),
    defaultValues: buildDefaults(null),
  });

  useEffect(() => {
    if (!open) return;
    setActiveTab('datos');
    form.reset(buildDefaults(producto));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, producto]);

  const precioCostoWatch = form.watch('precioCosto');
  const precioVentaWatch = form.watch('precioVenta');
  const comisionModoWatch = form.watch('comisionModo');

  const margenPct = useMemo(() => {
    const c = parseFloat(precioCostoWatch || '');
    const v = parseFloat(precioVentaWatch || '');
    if (!c || !v || c <= 0) return null;
    return ((v - c) / c) * 100;
  }, [precioCostoWatch, precioVentaWatch]);

  const errors = form.formState.errors;
  const tabHasError = {
    datos: !!(errors.nombre || errors.descripcion),
    precio: !!(errors.precioVenta || errors.precioCosto),
    comision: !!errors.comisionPct,
  };
  const showTabDots = form.formState.isSubmitted;

  const onInvalid = (errs: FieldErrors<ProductoFormValues>) => {
    if (errs.nombre || errs.descripcion) setActiveTab('datos');
    else if (errs.precioVenta || errs.precioCosto) setActiveTab('precio');
    else if (errs.comisionPct) setActiveTab('comision');
  };

  const onSubmit = async (values: ProductoFormValues) => {
    if (!orgId) return;

    let comision_porcentaje: number | null = null;
    if (values.comisionModo === 'personalizada') {
      comision_porcentaje = parseFloat((values.comisionPct || '').replace(',', '.'));
    }

    try {
      const nombreNorm = values.nombre.replace(/\s+/g, ' ').trim();
      const marca_id = values.marcaId === NO_BRAND ? null : values.marcaId;
      const precio_costo = values.precioCosto ? parseFloat(values.precioCosto) : null;
      const precio_venta = parseFloat(values.precioVenta);
      const stock_minimo = values.stockMinimo ? parseFloat(values.stockMinimo) : 0;

      let productoId: string;

      if (isNew) {
        const { data, error } = await supabase
          .from('productos')
          .insert({
            organization_id: orgId,
            marca_id,
            nombre: nombreNorm,
            descripcion: values.descripcion?.trim() || null,
            activo: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        productoId = data.id;
      } else {
        productoId = producto!.producto.id;
        const { error } = await supabase
          .from('productos')
          .update({
            marca_id,
            nombre: nombreNorm,
            descripcion: values.descripcion?.trim() || null,
          })
          .eq('id', productoId);
        if (error) throw error;
      }

      // Upsert productos_sucursal
      const existingPs = producto?.sucursal;
      if (existingPs) {
        const { error } = await supabase
          .from('productos_sucursal')
          .update({
            activo: values.activoSucursal,
            precio_costo,
            precio_venta,
            margen_pct: margenPct,
            stock_minimo,
            comision_modo: values.comisionModo,
            comision_porcentaje,
          } as any)
          .eq('id', existingPs.id);
        if (error) throw error;
      } else {
        // Crear vínculo de sucursal
        const { data: psData, error } = await supabase
          .from('productos_sucursal')
          .insert({
            organization_id: orgId,
            sucursal_id: sucursalId,
            producto_id: productoId,
            activo: values.activoSucursal,
            precio_costo,
            precio_venta,
            margen_pct: margenPct,
            stock_minimo,
            stock_actual: 0,
            comision_modo: values.comisionModo,
            comision_porcentaje,
          } as any)
          .select('id')
          .single();
        if (error) throw error;

        // Si carga stock inicial, registrar movimiento
        const inicial = parseFloat(values.stockInicial || '');
        if (psData && !isNaN(inicial) && inicial !== 0) {
          const { error: movErr } = await supabase.rpc('registrar_movimiento_stock', {
            _producto_sucursal_id: psData.id,
            _tipo: 'stock_inicial',
            _cantidad: inicial,
            _motivo: 'Carga inicial al crear producto',
            _venta_id: null,
          });
          if (movErr) {
            toast.error('Producto creado pero falló el stock inicial: ' + movErr.message);
          }
        }
      }

      toast.success(isNew ? 'Producto creado' : 'Producto actualizado');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Error al guardar');
    }
  };

  return (
    <DrawerForm
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={isNew ? 'Nuevo producto' : 'Editar producto'}
      size="md"
      isDirty={form.formState.isDirty}
      footer={
        <div className="flex w-full justify-between">
          <Button variant="ghost" onClick={onClose} disabled={form.formState.isSubmitting}>Cancelar</Button>
          <Button onClick={form.handleSubmit(onSubmit, onInvalid)} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Los datos generales se aplican a toda la organización. Los precios y stock son por sucursal.
          </p>

          <FormField
            control={form.control}
            name="activoSucursal"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Activo en esta sucursal</p>
                  <p className="text-xs text-muted-foreground">Si está inactivo, no aparecerá en el cobro.</p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="datos" className="relative">
                Datos
                {showTabDots && tabHasError.datos && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger value="precio" className="relative">
                Precio y stock
                {showTabDots && tabHasError.precio && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger value="comision" className="relative">
                Comisión
                {showTabDots && tabHasError.comision && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="datos" className="space-y-3 mt-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: Cera matte 100ml" maxLength={80} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="marcaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <div className="flex gap-2">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Sin marca" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_BRAND}>Sin marca</SelectItem>
                          {marcas.filter(m => m.activo).map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              <span className="inline-flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                                {m.nombre}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="sm" onClick={onManageMarcas}>
                        Gestionar
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} maxLength={240} rows={2} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground text-right">{(field.value ?? '').length}/240</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="precio" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="precioCosto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio costo</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value ?? ''} onChange={field.onChange} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="precioVenta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio venta</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value ?? ''} onChange={field.onChange} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FormLabel>Margen estimado</FormLabel>
                  <div className="h-10 px-3 flex items-center rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
                    {margenPct != null ? `${margenPct.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="stockMinimo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock mínimo</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/[^\d.]/g, ''))}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {(isNew || !producto?.sucursal) && (
                <FormField
                  control={form.control}
                  name="stockInicial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock inicial (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/[^\d.\-]/g, ''))}
                          placeholder="0"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Se registrará como movimiento "Stock inicial" en el historial.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </TabsContent>

            <TabsContent value="comision" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Define cómo genera comisión este producto cuando lo vende un barbero. La comisión se calcula sobre la ganancia (precio de venta − precio de costo).
              </p>
              <FormField
                control={form.control}
                name="comisionModo"
                render={({ field }) => (
                  <FormItem>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="barbero">Usar regla del barbero</SelectItem>
                        <SelectItem value="ninguna">No generar comisión</SelectItem>
                        <SelectItem value="personalizada">Comisión personalizada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {comisionModoWatch === 'personalizada' && (
                <FormField
                  control={form.control}
                  name="comisionPct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porcentaje (%)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/[^\d.,]/g, ''))}
                          placeholder="0"
                          maxLength={6}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {comisionModoWatch !== 'ninguna' && !precioCostoWatch && (
                <p className="text-xs text-status-warning-foreground">
                  Falta el precio de costo. Completalo en la pestaña Precio y stock para que el producto genere comisión.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Form>
    </DrawerForm>
  );
}
