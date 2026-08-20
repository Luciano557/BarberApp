import type { ReactNode } from 'react';
import { Loader2, Pencil, Save, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditableSectionHeaderProps {
  title: ReactNode;
  /** Opcional: chip bg-primary/10 antes del título (mismo tratamiento que
   *  DrawerFormSection). Sin esta prop, el header se ve exactamente igual
   *  que antes — es aditiva, no cambia a los call sites existentes. */
  icon?: LucideIcon;
  isEditing: boolean;
  saving?: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function EditableSectionHeader({
  title,
  icon: Icon,
  isEditing,
  saving = false,
  disabled = false,
  onEdit,
  onCancel,
  onSave,
}: EditableSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      {/* min-w-0 + truncate: el título es el que cede cuando no entra junto a
          los botones (ej. "Límites y cancelaciones" en edición a 390px). Los
          botones nunca se encogen ni se parten. */}
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <h3 className="min-w-0 truncate text-sm font-medium">{title}</h3>
      </div>
      {isEditing ? (
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-9 text-xs" disabled={saving}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-9 text-xs"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-9 shrink-0 text-xs"
          disabled={disabled}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      )}
    </div>
  );
}
