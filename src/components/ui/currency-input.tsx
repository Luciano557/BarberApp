import * as React from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
  /** Mostrar símbolo de moneda como prefijo. Default true. Pasar false para usos no monetarios. */
  showCurrencySymbol?: boolean;
  /** Símbolo a mostrar. Default "$". */
  currencySymbol?: string;
}

/**
 * Formats a clean numeric string (using "." as decimal sep) into Argentine display format.
 * e.g. "1234567.50" → "1.234.567,50"
 */
function formatForDisplay(clean: string): string {
  if (!clean) return "";

  const parts = clean.split(".");
  const intPart = parts[0] || "";
  const decPart = parts[1]; // may be undefined

  // Add thousand separators with "."
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decPart !== undefined) {
    return `${formatted},${decPart}`;
  }
  return formatted;
}

/**
 * Strips display formatting and returns a clean numeric string (with "." as decimal).
 * e.g. "1.234.567,50" → "1234567.50"
 */
function cleanValue(display: string): string {
  // Remove thousand separators (dots)
  // Replace decimal comma with dot
  let val = display.replace(/\./g, "").replace(",", ".");

  // Allow only digits, one dot, and leading chars
  val = val.replace(/[^\d.]/g, "");

  // Ensure only one decimal point
  const dotIdx = val.indexOf(".");
  if (dotIdx !== -1) {
    val = val.slice(0, dotIdx + 1) + val.slice(dotIdx + 1).replace(/\./g, "");
    // Max 2 decimal places
    const dec = val.slice(dotIdx + 1);
    if (dec.length > 2) {
      val = val.slice(0, dotIdx + 3);
    }
  }

  return val;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, showCurrencySymbol = true, currencySymbol = "$", className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatForDisplay(value));
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    // Sync display when value changes externally (e.g. form reset)
    React.useEffect(() => {
      const currentClean = cleanValue(displayValue);
      if (currentClean !== value) {
        setDisplayValue(formatForDisplay(value));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const cursorPos = e.target.selectionStart || 0;

      // Count dots before cursor in old value
      const oldDotsBeforeCursor = (displayValue.slice(0, cursorPos).match(/\./g) || []).length;

      // Clean and reformat
      const clean = cleanValue(raw);
      const newDisplay = formatForDisplay(clean);

      setDisplayValue(newDisplay);
      onChange(clean);

      // Restore cursor position accounting for added/removed dots
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          const newDotsBeforeCursor = (newDisplay.slice(0, cursorPos).match(/\./g) || []).length;
          const adjustment = newDotsBeforeCursor - oldDotsBeforeCursor;
          const newPos = Math.max(0, Math.min(cursorPos + adjustment, newDisplay.length));
          el.setSelectionRange(newPos, newPos);
        }
      });
    };

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref]
    );

    if (!showCurrencySymbol) {
      return (
        <Input
          {...props}
          ref={setRefs}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          className={className}
        />
      );
    }

    return (
      <div className="relative w-full">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none"
        >
          {currencySymbol}
        </span>
        <Input
          {...props}
          ref={setRefs}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          className={`pl-7 ${className ?? ""}`}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
