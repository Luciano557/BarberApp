import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn, mergeRefs } from "@/lib/utils";
import { useScrollAffordance } from "@/hooks/use-scroll-affordance";
import { NavOverflowControls } from "@/components/ui/NavOverflowControls";
import { isTabActivation, revealInStrip } from "@/lib/nav-strip";

const Tabs = TabsPrimitive.Root;

const ACTIVE_TAB = '[role="tab"][data-state="active"]';

const tabsListVariants = cva("inline-flex items-center text-muted-foreground", {
  variants: {
    variant: {
      pill: "h-10 justify-center rounded-lg bg-muted p-1",
      underline: "h-auto w-full justify-start gap-4 border-b border-border bg-transparent p-0",
    },
  },
  defaultVariants: { variant: "pill" },
});

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>
>(({ className, variant, id, ...props }, forwardedRef) => {
  const isUnderline = variant === "underline";
  const generatedId = React.useId();
  const stripId = id ?? `tabs-strip-${generatedId}`;
  const { ref: scrollRef, canScrollStart, canScrollEnd } = useScrollAffordance<HTMLDivElement>({
    observeContent: isUnderline,
  });

  // Mantiene el tab activo completo y fuera de las flechas. La responsabilidad vive
  // acá (no en el trigger) para que funcione igual con Tabs controlado y con
  // `defaultValue`: Radix cambia `data-state` en el DOM, sin depender de que el
  // wrapper React del trigger se vuelva a renderizar. Reacciona SOLO a un tab que
  // pasa a `active` (o se agrega ya activo): ninguna otra mutación mueve la tira,
  // no hay listener de scroll ni de resize, así que nunca pelea con el scroll
  // manual. Solo modifica `scrollLeft` de la tira, nunca el scroll de la página.
  React.useEffect(() => {
    if (!isUnderline) return;
    const strip = scrollRef.current;
    if (!strip) return;

    const active = strip.querySelector<HTMLElement>(ACTIVE_TAB);
    if (active) revealInStrip(strip, active, "md", { instant: true });

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          const tab = record.target as HTMLElement;
          if (tab.getAttribute("role") === "tab" && isTabActivation(record.oldValue, tab.getAttribute("data-state"))) {
            revealInStrip(strip, tab, "md");
            return;
          }
        } else {
          for (const node of Array.from(record.addedNodes)) {
            if (node instanceof HTMLElement && node.matches(ACTIVE_TAB)) {
              revealInStrip(strip, node, "md", { instant: true });
              return;
            }
          }
        }
      }
    });
    observer.observe(strip, {
      attributes: true,
      attributeFilter: ["data-state"],
      attributeOldValue: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [isUnderline, scrollRef]);

  const getFallbackFocus = React.useCallback(
    () => scrollRef.current?.querySelector<HTMLElement>(ACTIVE_TAB) ?? null,
    [scrollRef],
  );

  if (!isUnderline) {
    return (
      <TabsPrimitive.List
        ref={forwardedRef}
        id={id}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    );
  }

  return (
    <NavOverflowControls
      stripRef={scrollRef}
      stripId={stripId}
      canScrollStart={canScrollStart}
      canScrollEnd={canScrollEnd}
      labels={{ start: "Mostrar opciones anteriores", end: "Mostrar opciones siguientes" }}
      targetSelector='[role="tab"]'
      getFallbackFocus={getFallbackFocus}
      size="md"
      // Fila del label: excluye el pb-3 (12px) + border-b-2 del trigger, así la flecha
      // queda centrada en el texto y no toca la hairline ni el subrayado.
      bottomInset={14}
    >
      <TabsPrimitive.List
        ref={mergeRefs(forwardedRef, scrollRef)}
        id={stripId}
        className={cn(tabsListVariants({ variant }), "flex-nowrap overflow-x-auto scrollbar-hide", className)}
        {...props}
      />
    </NavOverflowControls>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const tabsTriggerVariants = cva(
  "inline-flex items-center whitespace-nowrap text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        pill: "justify-center rounded-md px-3 py-1.5 ring-offset-background focus-visible:ring-offset-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        underline: "gap-2 border-b-2 border-transparent px-1 pb-3 -mb-px text-muted-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground",
      },
    },
    defaultVariants: { variant: "pill" },
  }
);

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
