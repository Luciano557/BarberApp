import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileSpreadsheet, Download, FileUp } from 'lucide-react';
import { generateTemplate } from './lib/parseImportFile';
import { toast } from 'sonner';

interface Props {
  onPickVittroTemplate: () => void;
  onPickFile: (file: File) => void;
  onPickFreshaFile: (file: File) => void;
}

type SourceApp = '' | 'fresha';

export function ImportMethodStep({ onPickFile, onPickFreshaFile }: Props) {
  const [sourceApp, setSourceApp] = useState<SourceApp>('');

  const handleDownload = () => {
    try {
      const blob = generateTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-clientes-vittro.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('No se pudo generar la plantilla');
    }
  };

  const handleFileInput =
    (cb: (f: File) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) cb(file);
      e.target.value = '';
    };

  const handleExternalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (sourceApp === 'fresha') {
      onPickFreshaFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">Usar plantilla de Vittro</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Descargá la plantilla, completala y subila.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Descargar plantilla
              </Button>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  className="hidden"
                  onChange={handleFileInput(onPickFile)}
                />
                <Button size="sm" asChild>
                  <span>Subir archivo</span>
                </Button>
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <FileUp className="h-5 w-5 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">Importar desde otra aplicación</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Elegí la app de origen y subí el archivo.
            </p>
            <div className="space-y-2 mt-3 max-w-sm">
              <Label className="text-xs">Aplicación de origen</Label>
              <Select value={sourceApp} onValueChange={(v) => setSourceApp(v as SourceApp)}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una aplicación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresha">Fresha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  className="hidden"
                  onChange={handleExternalFile}
                  disabled={!sourceApp}
                />
                <Button size="sm" variant="outline" asChild disabled={!sourceApp}>
                  <span>Subir archivo</span>
                </Button>
              </label>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
