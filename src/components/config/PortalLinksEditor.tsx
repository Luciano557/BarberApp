import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import type { PortalLink } from '@/hooks/usePortalConfig';
import { PORTAL_ICONS, getPortalIcon } from '@/components/reservar/lib/portalIcons';
import { cn } from '@/lib/utils';

interface Props {
  links: PortalLink[];
  onChange: (links: PortalLink[]) => void;
}

const URL_RE = /^https?:\/\//i;

export function PortalLinksEditor({ links, onChange }: Props) {
  const update = (idx: number, patch: Partial<PortalLink>) => {
    onChange(links.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const remove = (idx: number) => {
    onChange(links.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sort_order: i })));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next.map((l, i) => ({ ...l, sort_order: i })));
  };

  const add = () => {
    if (links.length >= 4) return;
    onChange([
      ...links,
      { label: '', url: '', active: true, sort_order: links.length, icon: 'link' },
    ]);
  };

  return (
    <div className="space-y-3">
      {links.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sumá hasta 4 links personalizados (Instagram, WhatsApp, ubicación, etc.).
        </p>
      )}

      {links.map((link, idx) => {
        const urlInvalid = link.url.length > 0 && !URL_RE.test(link.url);
        const Icon = getPortalIcon(link.icon);
        return (
          <div key={idx} className="rounded-xl border border-border p-3 space-y-3 bg-card">
            {/* Header: ícono + etiqueta preview */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-2 gap-1.5"
                    type="button"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="grid grid-cols-5 gap-1">
                    {PORTAL_ICONS.map((opt) => {
                      const selected = (link.icon ?? 'link') === opt.key;
                      const OptIcon = opt.Icon;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => update(idx, { icon: opt.key })}
                          title={opt.label}
                          aria-label={opt.label}
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-foreground hover:bg-accent',
                            selected && 'border-border bg-muted'
                          )}
                        >
                          <OptIcon className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <span className="text-sm font-medium text-foreground truncate flex-1">
                {link.label.trim() || 'Nuevo link'}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Etiqueta</Label>
                <Input
                  value={link.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  maxLength={80}
                  placeholder="Instagram"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input
                  value={link.url}
                  onChange={(e) => update(idx, { url: e.target.value })}
                  maxLength={500}
                  placeholder="https://..."
                  inputMode="url"
                />
                {urlInvalid && (
                  <p className="text-xs text-destructive">Debe empezar con http:// o https://</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={link.active}
                  onCheckedChange={(v) => update(idx, { active: v })}
                  id={`active-${idx}`}
                />
                <Label htmlFor={`active-${idx}`} className="text-xs">Activo</Label>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => move(idx, 1)} disabled={idx === links.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={links.length >= 4}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-1" /> Agregar link {links.length}/4
      </Button>
    </div>
  );
}
