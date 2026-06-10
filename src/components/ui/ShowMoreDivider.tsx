import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShowMoreDividerProps {
  count: number;
  onClick: () => void;
  expanded?: boolean;
  label?: string;
}

export function ShowMoreDivider({ count, onClick, expanded = false, label = 'miembros más' }: ShowMoreDividerProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
    >
      <div className="flex-1 h-px bg-border transition-colors" />
      <span className="flex items-center gap-1 whitespace-nowrap font-medium">
        {expanded ? 'Ver menos' : `+${count} ${label}`}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')}
        />
      </span>
      <div className="flex-1 h-px bg-border transition-colors" />
    </button>
  );
}
