import * as React from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsCompactPicker } from "@/hooks/use-compact-picker";
import { cn } from "@/lib/utils";

const SUGGESTION_STEP_MIN = 15;

function buildSuggestions(stepMin: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMin) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
}

const SUGGESTIONS = buildSuggestions(SUGGESTION_STEP_MIN);

/** Máscara de tipeo: dígitos → "HH:MM" progresivo. Nunca redondea. */
function formatTypedTime(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}

/**
 * TimePicker canónico de Vittro (DESIGN.md § Forms): reemplaza `input
 * type="time"` nativo. Combobox — tipeo libre de cualquier HH:MM (primera
 * clase, cubre valores como "09:10" que ya existen en la base) + una lista
 * de sugerencias cada 15' (SLOT_MIN de Agenda) que solo ayuda, nunca
 * normaliza. Desktop/tablet: Popover. Mobile (<640px): Drawer.
 */
export const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(
  ({ value, onChange, disabled, placeholder = "HH:MM", className, id, ...rest }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [highlightIndex, setHighlightIndex] = React.useState(-1);
    const isCompact = useIsCompactPicker();
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    const digitsTyped = value.replace(/[^\d]/g, "");
    const filtered = React.useMemo(
      () => (digitsTyped ? SUGGESTIONS.filter((s) => s.replace(":", "").startsWith(digitsTyped)) : SUGGESTIONS),
      [digitsTyped],
    );

    const commit = (v: string) => {
      onChange(v);
      setOpen(false);
      setHighlightIndex(-1);
      inputRef.current?.focus();
    };

    const handleChange = (raw: string) => {
      onChange(formatTypedTime(raw));
      setOpen(true);
      setHighlightIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        if (open && highlightIndex >= 0 && filtered[highlightIndex]) {
          e.preventDefault();
          commit(filtered[highlightIndex]);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };

    const inputField = (
      <div className={cn("relative w-full", className)}>
        <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={setRefs}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex h-10 w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-base md:text-sm ring-offset-background transition-colors duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          {...rest}
        />
      </div>
    );

    const suggestionList = (
      <div className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Sin coincidencias — podés escribir cualquier hora.
          </p>
        )}
        {filtered.map((s, i) => (
          <button
            key={s}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              commit(s);
            }}
            className={cn(
              "flex w-full items-center px-3 py-2 text-sm tabular-nums hover:bg-muted",
              i === highlightIndex && "bg-muted",
              s === value && "font-medium text-primary",
            )}
          >
            {s}
          </button>
        ))}
      </div>
    );

    if (isCompact) {
      return (
        <>
          {inputField}
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Elegí una hora</DrawerTitle>
              </DrawerHeader>
              <div className="px-2 pb-6">{suggestionList}</div>
            </DrawerContent>
          </Drawer>
        </>
      );
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>{inputField}</PopoverAnchor>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {suggestionList}
        </PopoverContent>
      </Popover>
    );
  },
);
TimePicker.displayName = "TimePicker";
