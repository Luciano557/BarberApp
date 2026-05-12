import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SUCURSAL_ACTION_GROUPS,
  SUCURSAL_ACTION_LABELS,
  SUCURSAL_ACTION_DESCRIPTIONS,
  SucursalActionKey,
} from '@/lib/sucursalActions';

interface Props {
  values: (action: SucursalActionKey) => boolean;
  onChange?: (action: SucursalActionKey, value: boolean) => void;
  disabled?: boolean;
  savingAction?: SucursalActionKey | null;
  isLoading?: boolean;
}

export function PinActionsToggleList({ values, onChange, disabled, savingAction, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {SUCURSAL_ACTION_GROUPS.map(group => (
        <div key={group.key} className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">{group.title}</h4>
          <div className="space-y-2 rounded-lg border border-border divide-y divide-border">
            {group.actions.map(action => {
              const id = `pin-toggle-${action}`;
              const checked = values(action);
              return (
                <div key={action} className="flex items-start justify-between gap-4 p-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={id} className="text-sm font-normal text-foreground cursor-pointer">
                      {SUCURSAL_ACTION_LABELS[action]} requiere PIN
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {SUCURSAL_ACTION_DESCRIPTIONS[action]}
                    </p>
                  </div>
                  <Switch
                    id={id}
                    checked={checked}
                    disabled={disabled || savingAction === action}
                    onCheckedChange={(v) => onChange?.(action, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
