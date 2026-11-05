import { useId, useState } from "react";
import { Check, ArrowUp } from "lucide-react";
import { PARTNER_LEVELS, partnerTier } from "../../../supabase/functions/_shared/partner-domain";

const levels = PARTNER_LEVELS.map((level) => ({
  ...level,
  condition: level.minimumQualified === 0
    ? "Al crear tu código"
    : `${level.minimumQualified} barberías calificadas`,
}));
const bottle =
  "M102 91H138V107C138 119 162 123 170 144C177 162 176 178 176 199L171 264C170 277 161 284 148 284H92C79 284 70 277 69 264L64 199C64 178 63 162 70 144C78 123 102 119 102 107Z";

/** Redundant visual meter: percentages and requirements are always written. */
function LevelSprayer({
  fill,
  className = "",
}: {
  fill: number;
  className?: string;
}) {
  const clipId = useId().replace(/:/g, "");
  const height = 184 * Math.min(1, Math.max(0, fill));
  return (
    <svg viewBox="0 0 240 304" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={clipId}>
          <path d={bottle} />
        </clipPath>
      </defs>
      <path
        d={bottle}
        className="fill-muted stroke-primary/40"
        strokeWidth="2"
      />
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="64"
          y={284 - height}
          width="112"
          height={height}
          className="fill-primary motion-safe:transition-[y,height] motion-safe:duration-200"
          style={{ transitionTimingFunction: "var(--ease-out-quint)" }}
        />
        {[1, 2, 3, 4].map((step) => (
          <line
            key={step}
            x1="148"
            x2="168"
            y1={284 - 46 * step}
            y2={284 - 46 * step}
            className="stroke-background/75"
            strokeWidth="2"
          />
        ))}
      </g>
      <path
        d={bottle}
        className="fill-none stroke-primary/50"
        strokeWidth="2"
      />
      <rect
        x="98"
        y="77"
        width="44"
        height="16"
        rx="3"
        className="fill-secondary stroke-primary/40"
        strokeWidth="2"
      />
      <path
        d="M97 28H151C162 28 169 34 172 43L177 58H149L133 78H105V57H88V40C88 33 91 28 97 28Z"
        className="fill-primary"
      />
      <rect x="170" y="39" width="24" height="19" rx="3" className="fill-primary" />
      <path
        d="M151 59C164 73 169 87 158 105L146 97C151 86 147 79 139 73"
        className="fill-secondary stroke-primary"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M179 44V53M108 83V88M116 83V88M124 83V88M132 83V88"
        className="stroke-background/50"
        strokeWidth="2"
      />
      <path
        d="M205 47H219M203 35L214 30M203 59L214 64"
        className="stroke-primary/40"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M80 159V190"
        className="stroke-background/50"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PartnerLevelExplorer() {
  const [selected, setSelected] = useState(0);
  const active = levels[selected];
  return (
    <div className="mt-8 grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <figure className="flex items-center justify-center gap-5 rounded-container bg-muted/60 p-6 sm:flex-col sm:gap-0">
        <LevelSprayer
          fill={active.level / levels.length}
          className="h-52 w-36 shrink-0 sm:h-64 sm:w-44"
        />
        <figcaption className="min-w-0 text-left sm:text-center" aria-live="polite" aria-atomic="true">
          <p className="text-base font-medium">Nivel {active.level}</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">
            {active.percent}%
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            del primer pago de cada referido
          </p>
        </figcaption>
      </figure>
      <div>
        <p className="mb-4 text-sm text-muted-foreground">
          Elegí un nivel para conocerlo.
        </p>
        <div className="divide-y border-y">
          {levels.map((item, index) => (
            <button
              key={item.level}
              type="button"
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
              className={`flex w-full items-center justify-between gap-4 px-3 py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === index ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
            >
              <span className="min-w-0">
                <span className="block text-lg font-medium">
                  Nivel {item.level}
                </span>
                <span className="mt-1 block text-sm">{item.condition}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-2xl font-semibold tabular-nums">
                {item.percent}%
                {selected === index ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PartnerLevelProgress({
  qualified,
  registrations,
  agreementPercent,
}: {
  qualified: number;
  registrations: number;
  agreementPercent?: number;
}) {
  const tier = partnerTier({ qualifiedOrganizations: qualified }, Date.now());
  const current = levels.find((level) => level.percent === tier.percent)!;
  const next = levels[current.level];
  const fill = (current.level + (next
    ? (qualified - current.minimumQualified) / (next.minimumQualified - current.minimumQualified)
    : 0)) / levels.length;
  const remaining = tier.nextGoal ? tier.nextGoal - qualified : 0;
  return (
    <section className="mt-8 rounded-container border bg-card">
      <div className="border-b p-5">
        <h2 className="text-lg font-medium">Tu nivel por referidos</h2>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="min-w-0">
          <p className="text-2xl font-semibold">
            Nivel {current.level} <span className="text-muted-foreground">·</span>{" "}
            <span className="tabular-nums">{tier.percent}%</span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {qualified}
            </span>{" "}
            barberías calificadas de{" "}
            <span className="tabular-nums">{registrations}</span> registros con
            tu código.
          </p>
          <p className="mt-3 text-sm">
            {remaining
              ? `Te ${remaining === 1 ? "falta 1 barbería calificada" : `faltan ${remaining} barberías calificadas`} para el nivel ${next.level} y una comisión del ${next.percent}%.`
              : "Alcanzaste el nivel 4, el máximo del programa automático."}
          </p>
          {agreementPercent !== undefined && (
            <p className="mt-3 text-sm text-muted-foreground">
              Tu convenio vigente establece una comisión del{" "}
              <span className="tabular-nums">{agreementPercent}%</span>. Este
              progreso muestra tu nivel por referidos.
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Una barbería se califica después de dos mensualidades distintas
            pagadas, sin devoluciones.
          </p>
        </div>
        <LevelSprayer fill={fill} className="w-full" />
      </div>
    </section>
  );
}
