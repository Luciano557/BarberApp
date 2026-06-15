import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Sheet, SheetOverlay, SheetPortal } from "@/components/ui/sheet";

interface DrawerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  size: "sm" | "md";
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function DrawerForm({ open, onOpenChange, title, size, children, footer }: DrawerFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col",
            "bg-card border-l shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "data-[state=closed]:duration-200 data-[state=open]:duration-300",
            "[animation-timing-function:cubic-bezier(0.23,1,0.32,1)]",
            "w-[calc(100%-48px)]",
            size === "sm" ? "sm:w-[380px]" : "sm:w-[520px]",
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
            <SheetPrimitive.Title className="text-lg font-semibold text-foreground">
              {title}
            </SheetPrimitive.Title>
            <SheetPrimitive.Close className="rounded-md opacity-70 ring-offset-background transition-opacity duration-150 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </SheetPrimitive.Close>
          </div>

          {/* Body — scrolleable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {children}
          </div>

          {/* Footer — siempre fijo en la parte inferior */}
          <div className="shrink-0 border-t px-6 py-4">
            {footer}
          </div>
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}
