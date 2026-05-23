import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { parsePhoneNumberFromString, type CountryCode as LibCountryCode } from 'libphonenumber-js/min';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  canonicalizePhone,
  formatPhoneDisplay,
  phoneErrorMessage,
  type CountryCode,
  type CanonicalizeReason,
} from '@/lib/phone';

const DEFAULT_COUNTRIES: CountryCode[] = ['AR', 'UY', 'CL', 'CO', 'MX', 'ES', 'BR'];

interface CountryMeta {
  code: CountryCode;
  name: string;
  /** Bandera en emoji-text (sobria, sin asset). */
  flag: string;
  dial: string;
  placeholder: string;
}

const COUNTRY_META: Record<CountryCode, CountryMeta> = {
  AR: { code: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '+54', placeholder: '11 2516-2528' },
  MX: { code: 'MX', name: 'México', flag: '🇲🇽', dial: '+52', placeholder: '55 1234 5678' },
  ES: { code: 'ES', name: 'España', flag: '🇪🇸', dial: '+34', placeholder: '612 34 56 78' },
  BR: { code: 'BR', name: 'Brasil', flag: '🇧🇷', dial: '+55', placeholder: '11 91234 5678' },
  UY: { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dial: '+598', placeholder: '9 123 4567' },
  CL: { code: 'CL', name: 'Chile', flag: '🇨🇱', dial: '+56', placeholder: '9 1234 5678' },
  CO: { code: 'CO', name: 'Colombia', flag: '🇨🇴', dial: '+57', placeholder: '300 1234567' },
};

export type PhoneInputMode = 'mobile' | 'any';

export interface PhoneInputChange {
  e164: string | null;
  isValid: boolean;
  country: CountryCode | null;
  display: string;
  reason?: CanonicalizeReason;
}

export interface PhoneInputProps {
  value: string | null;
  onChange: (out: PhoneInputChange) => void;
  defaultCountry?: CountryCode;
  allowedCountries?: CountryCode[];
  /**
   * 'mobile' (default): rechaza fijos AR (`ambiguous_landline`).
   * 'any': acepta móvil o fijo AR. No fuerza el `9` para fijos.
   */
  mode?: PhoneInputMode;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
}

// Permite dígitos y separadores comunes mientras se tipea/pega.
const sanitizeKeepSeparators = (s: string): string => s.replace(/[^\d\s\-()+]/g, '');

/** Stripea el prefijo "+54 9 " o "+54 " de un display AR para hidratar el input nacional. */
function stripDialPrefix(display: string, dial: string): string {
  if (display.startsWith(dial + ' 9 ')) return display.slice(dial.length + 3);
  if (display.startsWith(dial + ' ')) return display.slice(dial.length + 1);
  if (display.startsWith(dial)) return display.slice(dial.length).trimStart();
  return display;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      defaultCountry = 'AR',
      allowedCountries = DEFAULT_COUNTRIES,
      mode = 'mobile',
      required = false,
      disabled = false,
      id,
      name,
      className,
      placeholder,
    },
    ref,
  ) {
    const [country, setCountry] = React.useState<CountryCode>(defaultCountry);
    const [raw, setRaw] = React.useState<string>('');
    const [touched, setTouched] = React.useState(false);
    const [pickerOpen, setPickerOpen] = React.useState(false);
    const lastEmittedE164 = React.useRef<string | null>(null);
    const allowLandline = mode === 'any';

    // Hidratar desde value externo (E.164 canónico).
    React.useEffect(() => {
      if (value && value !== lastEmittedE164.current) {
        const display = formatPhoneDisplay(value);
        // AR móvil: "+54 9 ..." | AR fijo: "+54 ..."
        const meta = Object.values(COUNTRY_META).find((m) => display.startsWith(m.dial));
        if (meta) {
          setCountry(meta.code);
          setRaw(stripDialPrefix(display, meta.dial));
        } else {
          setRaw(display || value);
        }
        lastEmittedE164.current = value;
      } else if (!value && lastEmittedE164.current !== null) {
        setRaw('');
        lastEmittedE164.current = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const emit = React.useCallback(
      (nextRaw: string, nextCountry: CountryCode) => {
        const cleaned = sanitizeKeepSeparators(nextRaw);
        if (!cleaned.trim()) {
          const out: PhoneInputChange = {
            e164: null,
            isValid: !required,
            country: nextCountry,
            display: '',
            reason: required ? 'empty' : undefined,
          };
          lastEmittedE164.current = null;
          onChange(out);
          return;
        }
        const r = canonicalizePhone(cleaned, { defaultCountry: nextCountry, allowLandline });
        if (r.ok) {
          const out: PhoneInputChange = {
            e164: r.e164,
            isValid: true,
            country: nextCountry,
            display: formatPhoneDisplay(r.e164),
          };
          lastEmittedE164.current = r.e164;
          onChange(out);
        } else {
          const fail = r as { ok: false; reason: CanonicalizeReason };
          const out: PhoneInputChange = {
            e164: null,
            isValid: false,
            country: nextCountry,
            display: cleaned,
            reason: fail.reason,
          };
          lastEmittedE164.current = null;
          onChange(out);
        }
      },
      [onChange, required, allowLandline],
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = sanitizeKeepSeparators(e.target.value);
      setRaw(cleaned);
      emit(cleaned, country);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData('text');
      const cleaned = sanitizeKeepSeparators(pasted);
      const matched = allowedCountries
        .map((c) => COUNTRY_META[c])
        .find((m) => cleaned.replace(/\s+/g, '').startsWith(m.dial));
      if (matched && matched.code !== country) {
        e.preventDefault();
        const stripped = cleaned.replace(/\s+/g, '').slice(matched.dial.length);
        setCountry(matched.code);
        setRaw(stripped);
        emit(stripped, matched.code);
      }
    };

    const handleBlur = () => {
      setTouched(true);
      const r = canonicalizePhone(raw, { defaultCountry: country, allowLandline });
      if (r.ok) {
        const meta = COUNTRY_META[country];
        if (country === 'AR') {
          const display = formatPhoneDisplay(r.e164);
          setRaw(stripDialPrefix(display, meta.dial));
        } else {
          try {
            const pn = parsePhoneNumberFromString(r.e164);
            if (pn) setRaw(pn.formatNational());
          } catch { /* noop */ }
        }
      }
    };

    const handleCountryChange = (next: CountryCode) => {
      setCountry(next);
      setPickerOpen(false);
      emit(raw, next);
    };

    const meta = COUNTRY_META[country];
    const result = React.useMemo(
      () => canonicalizePhone(sanitizeKeepSeparators(raw), { defaultCountry: country, allowLandline }),
      [raw, country, allowLandline],
    );
    const hasContent = raw.trim().length > 0;
    const showError = touched && hasContent && !result.ok;
    const showRequiredError = touched && required && !hasContent;
    const errorMsg = showError
      ? phoneErrorMessage((result as { ok: false; reason: CanonicalizeReason }).reason)
      : showRequiredError
        ? phoneErrorMessage('empty')
        : '';

    const singleCountry = allowedCountries.length <= 1;

    const CountryTrigger = (
      <button
        type="button"
        disabled={disabled || singleCountry}
        className={cn(
          'flex items-center gap-1.5 px-3 text-sm border-r border-input bg-muted/30 transition-colors shrink-0',
          !singleCountry && 'hover:bg-muted/50 cursor-pointer',
          singleCountry && 'cursor-default',
        )}
        aria-label="Seleccionar país"
        title={`${meta.name} (${meta.dial})`}
      >
        <span className="text-base leading-none" aria-hidden>{meta.flag}</span>
        <span className="text-muted-foreground">{meta.dial}</span>
        {!singleCountry && <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
    );

    return (
      <div className={cn('space-y-1', className)}>
        <div
          className={cn(
            'flex h-10 w-full items-stretch overflow-hidden rounded-lg border border-input bg-background transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
            disabled && 'opacity-50',
            (showError || showRequiredError) && 'border-destructive focus-within:ring-destructive',
          )}
        >
          {singleCountry ? (
            CountryTrigger
          ) : (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>{CountryTrigger}</PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar país..." />
                  <CommandList>
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      {allowedCountries.map((c) => {
                        const m = COUNTRY_META[c];
                        return (
                          <CommandItem
                            key={c}
                            value={`${m.name} ${m.dial}`}
                            onSelect={() => handleCountryChange(c)}
                          >
                            <span className="mr-2 text-base leading-none" aria-hidden>{m.flag}</span>
                            <span className="flex-1">{m.name}</span>
                            <span className="text-xs text-muted-foreground mr-2">{m.dial}</span>
                            {c === country && <Check className="h-3.5 w-3.5" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          <input
            ref={ref}
            id={id}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            disabled={disabled}
            value={raw}
            placeholder={placeholder ?? meta.placeholder}
            onChange={handleInputChange}
            onPaste={handlePaste}
            onBlur={handleBlur}
            className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed min-w-0"
          />
        </div>
        {errorMsg ? (
          <p className="text-xs text-destructive">{errorMsg}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {mode === 'any' && country === 'AR' ? `Móvil o fijo. Ej: ${meta.placeholder}` : `Ej: ${meta.placeholder}`}
          </p>
        )}
      </div>
    );
  },
);
