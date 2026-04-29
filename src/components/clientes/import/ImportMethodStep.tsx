import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileSpreadsheet, Download, FileUp } from 'lucide-react';
import { generateTemplate } from './lib/parseImportFile';
import { toast } from 'sonner';

interface Props {
  onPickVittroTemplate: () => void;
  onPickFile: (file: File) => void;
  onPickFreshaFile: (file: File) => void;
}

export function ImportMethodStep({ onPickFile, onPickFreshaFile }: Props) {
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
              Descargá una plantilla en Excel, completala con tus clientes y subila acá.
              Es la forma más segura de importar sin perder datos.
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
            <h3 className="text-sm font-medium">Importar archivo de Fresha</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Subí el archivo de clientes exportado desde Fresha y Vittro mapeará las columnas
              automáticamente. No necesitás conectar tu cuenta.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  className="hidden"
                  onChange={handleFileInput(onPickFreshaFile)}
                />
                <Button size="sm" variant="outline" asChild>
                  <span>Subir archivo de Fresha</span>
                </Button>
              </label>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
