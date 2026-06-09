import React from "react";
import { cn } from "@/lib/utils";

interface SectionShellProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionShell({ id, title, description, children, className }: SectionShellProps) {
  return (
    <section id={id} className={cn("border-t pt-6", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
