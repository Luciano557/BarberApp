import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground px-2.5 py-0.5 text-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs",
        destructive: "border-transparent bg-destructive text-destructive-foreground px-2.5 py-0.5 text-xs",
        outline: "text-foreground border-input px-2.5 py-0.5 text-xs",
        category: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const categoryColors = {
  default: "bg-secondary text-secondary-foreground border-border",
} as const;

const sizeClasses = {
  sm: "text-[10px] px-2 py-0.5",
  md: "text-xs px-2.5 py-0.5",
} as const;

type CategoryColor = keyof typeof categoryColors;
type BadgeSize = keyof typeof sizeClasses;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  color?: CategoryColor;
  size?: BadgeSize;
}

function Badge({ className, variant, color, size = "sm", ...props }: BadgeProps) {
  const colorClass = variant === "category"
    ? categoryColors[color ?? "default"]
    : "";
  const sizeClass = variant === "category" ? sizeClasses[size] : "";

  return (
    <span
      className={cn(badgeVariants({ variant }), colorClass, sizeClass, className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
