import { Loader2, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditableSectionHeaderProps {
  title: string;
  isEditing: boolean;
  saving?: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function EditableSectionHeader({
  title,
  isEditing,
  saving = false,
  disabled = false,
  onEdit,
  onCancel,
  onSave,
}: EditableSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {isEditing ? (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs" disabled={saving}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
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
          className="h-7 text-xs"
          disabled={disabled}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      )}
    </div>
  );
}
