import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { ImportMethodStep } from './ImportMethodStep';
import { ImportPreviewStep, PreviewFilter } from './ImportPreviewStep';
import { ImportSummaryStep } from './ImportSummaryStep';
import {
  PreviewRow, parseImportFile, rowToPayload,
} from './lib/parseImportFile';
import { parseFreshaFile, FreshaFormatError } from './lib/parseFreshaFile';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

type Step = 'method' | 'sucursal' | 'preview' | 'summary';

interface AccessibleSucursal { id: string; nombre: string; }

export function ImportClientesDialog({ open, onOpenChange, onImported }: Props) {
  const { organization } = useOrganization();
  const { currentSucursal, sucursales } = useSucursal();
  const { isOwner, isGeneralManager } = useAuth();

  const [step, setStep] = useState<Step>('method');
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [totalParsed, setTotalParsed] = useState(0);
  const [sucursalId, setSucursalId] = useState<string>('');
  const [accessible, setAccessible] = useState<AccessibleSucursal[]>([]);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ inserted: number; total: number; errors: Array<{ index: number; error: string }> } | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep('method');
    setRows([]);
    setUnknownHeaders([]);
    setTruncated(false);
    setTotalParsed(0);
    setSummary(null);
    setPreviewFilter('all');
    setSucursalId(currentSucursal?.id ?? '');
  }, [open, currentSucursal?.id]);

  // Compute accessible sucursales
  useEffect(() => {
    if (!open || !organization?.id) return;
    if (isOwner || isGeneralManager) {
      setAccessible(sucursales.map(s => ({ id: s.id, nombre: s.nombre })));
      return;
    }
    // manager/barber: query user_sucursales
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAccessible([]); return; }
      const { data, error } = await supabase
        .from('user_sucursales')
        .select('sucursal_id')
        .eq('user_id', user.id);
      if (error) { setAccessible([]); return; }
      const ids = new Set((data ?? []).map((r: any) => r.sucursal_id));
      setAccessible(sucursales.filter(s => ids.has(s.id)).map(s => ({ id: s.id, nombre: s.nombre })));
    })();
  }, [open, organization?.id, isOwner, isGeneralManager, sucursales]);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const result = await parseImportFile(file);
      if (result.rows.length === 0) {
        toast.error('El archivo no contiene filas válidas.');
        return;
      }
      setRows(result.rows);
      setUnknownHeaders(result.unknownHeaders);
      setTruncated(result.truncated);
      setTotalParsed(result.totalParsed);
      setStep(sucursalId ? 'preview' : 'sucursal');
    } catch (e: any) {
      console.error(e);
      toast.error('No se pudo leer el archivo. Verificá el formato.');
    } finally {
      setParsing(false);
    }
  };

  const handleFreshaFile = async (file: File) => {
    setParsing(true);
    try {
      const result = await parseFreshaFile(file);
      if (result.rows.length === 0) {
        toast.error('El archivo no contiene filas válidas.');
        return;
      }
      setRows(result.rows);
      setUnknownHeaders(result.unknownHeaders);
      setTruncated(result.truncated);
      setTotalParsed(result.totalParsed);
      setStep(sucursalId ? 'preview' : 'sucursal');
    } catch (e: any) {
      console.error(e);
      if (e instanceof FreshaFormatError) {
        toast.error(e.message);
      } else {
        toast.error('No se pudo leer el archivo. Verificá el formato.');
      }
    } finally {
      setParsing(false);
    }
  };

  const validRows = useMemo(
    () => rows.filter(r =>
      !r.discarded &&
      r.errors.length === 0 &&
      !r.duplicateGroupId
    ),
    [rows]
  );

  const blockingCount = useMemo(() => {
    const active = rows.filter(r => !r.discarded);
    const errs = active.filter(r => r.errors.length > 0).length;
    const dups = active.filter(r => r.duplicateGroupId).length;
    return { errs, dups };
  }, [rows]);

  const canImport = !!sucursalId && validRows.length > 0 &&
    blockingCount.errs === 0 && blockingCount.dups === 0;

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    try {
      const payload = validRows.map(rowToPayload);
      const { data, error } = await supabase.rpc('import_clientes_with_sucursal', {
        _sucursal_id: sucursalId,
        _clientes: payload as any,
      } as any);
      if (error) throw error;
      const result = (data as any) ?? { inserted: 0, errors: [], total: payload.length };
      setSummary({
        inserted: result.inserted ?? 0,
        total: payload.length,
        errors: result.errors ?? [],
      });
      setStep('summary');
      if ((result.inserted ?? 0) > 0) {
        toast.success(`Se importaron ${result.inserted} clientes`);
        onImported?.();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo completar la importación');
    } finally {
      setImporting(false);
    }
  };

  const titleByStep: Record<Step, string> = {
    method: 'Importar clientes',
    sucursal: 'Elegí la sucursal',
    preview: 'Revisá antes de importar',
    summary: 'Importación finalizada',
  };
  const descByStep: Record<Step, string> = {
    method: 'Subí un archivo Excel o CSV con tus clientes para sumarlos a una sucursal.',
    sucursal: 'Los clientes se van a asociar a la sucursal que elijas.',
    preview: 'Corregí los datos que necesiten ajuste y resolvé los duplicados antes de confirmar.',
    summary: 'Estos son los resultados de la importación.',
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!importing) onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {(step === 'preview' || step === 'sucursal') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1"
                onClick={() => setStep(step === 'preview' && rows.length ? 'sucursal' : 'method')}
                disabled={importing}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>{titleByStep[step]}</DialogTitle>
          </div>
          <DialogDescription>{descByStep[step]}</DialogDescription>
        </DialogHeader>

        {parsing ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Procesando archivo...
          </div>
        ) : step === 'method' ? (
          <ImportMethodStep
            onPickVittroTemplate={() => { /* download handled inside */ }}
            onPickFile={handleFile}
            onPickFreshaFile={handleFreshaFile}
          />
        ) : step === 'sucursal' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Sucursal de destino</Label>
              <Select value={sucursalId} onValueChange={setSucursalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {accessible.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                      No tenés sucursales disponibles para importar.
                    </div>
                  ) : (
                    accessible.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo aparecen las sucursales en las que tenés permiso para crear clientes.
              </p>
            </div>
          </div>
        ) : step === 'preview' ? (
          <ImportPreviewStep
            rows={rows}
            onChange={setRows}
            unknownHeaders={unknownHeaders}
            truncated={truncated}
            totalParsed={totalParsed}
            filter={previewFilter}
            onFilterChange={setPreviewFilter}
          />
        ) : (
          <ImportSummaryStep
            inserted={summary?.inserted ?? 0}
            total={summary?.total ?? 0}
            errors={summary?.errors ?? []}
          />
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'method' && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
          )}
          {step === 'sucursal' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                disabled={!sucursalId || rows.length === 0}
                onClick={() => setStep('preview')}
              >
                Continuar
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" disabled={importing} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <div className="flex flex-col items-end gap-1">
                {(blockingCount.errs > 0 || blockingCount.dups > 0) && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      Hay {blockingCount.errs} {blockingCount.errs === 1 ? 'error' : 'errores'}
                      {blockingCount.errs > 0 && blockingCount.dups > 0 ? ' y ' : ''}
                      {blockingCount.dups > 0 ? `${blockingCount.dups} duplicado${blockingCount.dups === 1 ? '' : 's'}` : ''}
                      {' '}pendientes.
                    </p>
                    {blockingCount.errs > 0 && (
                      <Button size="sm" variant="link" className="h-auto p-0 text-[11px]"
                        onClick={() => setPreviewFilter('errors')}>
                        Ver errores
                      </Button>
                    )}
                    {blockingCount.dups > 0 && (
                      <Button size="sm" variant="link" className="h-auto p-0 text-[11px]"
                        onClick={() => setPreviewFilter('duplicates')}>
                        Ver duplicados
                      </Button>
                    )}
                  </div>
                )}
                <Button onClick={handleImport} disabled={!canImport || importing}>
                  {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Importar {validRows.length} {validRows.length === 1 ? 'cliente' : 'clientes'}
                </Button>
              </div>
            </>
          )}
          {step === 'summary' && (
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
