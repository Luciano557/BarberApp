import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsCompactPicker } from "@/hooks/use-compact-picker";
import { cn } from "@/lib/utils";

const VALUE_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "dd/MM/yyyy";

function parseValue(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, VALUE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

export interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Muestra una X para limpiar el valor. Solo tiene sentido en campos opcionales. */
  clearable?: boolean;
  /** yyyy-MM-dd — límite inferior seleccionable. */
  fromDate?: string;
  /** yyyy-MM-dd — límite superior seleccionable. */
  toDate?: string;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}

/**
 * DatePicker canónico de Vittro (DESIGN.md § Forms): reemplaza `input
 * type="date"` nativo. Desktop y tablet abren un Popover con el Calendar
 * existente; mobile (<640px) abre el mismo Calendar dentro de un Drawer —
 * un solo cuerpo de selección, dos contenedores de presentación.
 */
export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = "Seleccionar fecha",
      disabled,
      clearable,
      fromDate,
      toDate,
      className,
      id,
      ...rest
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const isCompact = useIsCompactPicker();

    const selected = parseValue(value);
    const fromDateParsed = parseValue(fromDate);
    const toDateParsed = parseValue(toDate);

    const handleSelect = (date: Date | undefined) => {
      onChange(date ? format(date, VALUE_FORMAT) : null);
      setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    };

    const trigger = (
      <button
        type="button"
        ref={ref}
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-base md:text-sm ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground",
          className,
        )}
        {...rest}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">
          {selected ? format(selected, DISPLAY_FORMAT, { locale: es }) : placeholder}
        </span>
        {clearable && selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleClear}
            aria-label="Limpiar fecha"
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
    );

    const calendarBody = (
      <Calendar
        mode="single"
        selected={selected}
        onSelect={handleSelect}
        locale={es}
        fromDate={fromDateParsed}
        toDate={toDateParsed}
        defaultMonth={selected ?? fromDateParsed}
        className="pointer-events-auto"
      />
    );

    if (isCompact) {
      return (
        <>
          {trigger}
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{placeholder}</DrawerTitle>
              </DrawerHeader>
              <div className="flex justify-center pb-6">{calendarBody}</div>
            </DrawerContent>
          </Drawer>
        </>
      );
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>{trigger}</PopoverAnchor>
        <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          {calendarBody}
        </PopoverContent>
      </Popover>
    );
  },
);
DatePicker.displayName = "DatePicker";
