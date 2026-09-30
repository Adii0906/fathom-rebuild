import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        outline: "bg-card text-foreground",
        amber: "border-transparent bg-amber-100 text-amber-900",
        rose: "border-transparent bg-rose-100 text-rose-800",
        sky: "border-transparent bg-sky-100 text-sky-900",
        violet: "border-transparent bg-violet-100 text-violet-900",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
