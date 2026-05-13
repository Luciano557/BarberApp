import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, ImageIcon } from 'lucide-react';

interface Props {
  coverUrl: string | null;
  uploading?: boolean;
  disabled?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

export function PortalCoverUploader({ coverUrl, uploading, disabled, onUpload, onRemove }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center"
        style={
          coverUrl
            ? { backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {!coverUrl && (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">Sin foto de portada</span>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onUpload(f);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => ref.current?.click()}
          disabled={uploading || disabled}
        >
          <Upload className="h-4 w-4 mr-1" />
          {uploading ? 'Subiendo...' : coverUrl ? 'Cambiar portada' : 'Subir portada'}
        </Button>
        {coverUrl && (
          <Button variant="outline" size="sm" onClick={onRemove} disabled={disabled}>
            <Trash2 className="h-4 w-4 mr-1" /> Quitar
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">PNG, JPG o WEBP. Máximo 2 MB. Recomendado 16:9.</p>
    </div>
  );
}
