import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      <span className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-muted"><Icon className="size-5 text-muted-foreground" /></span>
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ErrorBox({ title = "Something went wrong", children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="size-4" />{title}</div>
      {children && <div className="mt-1 text-sm text-foreground/80">{children}</div>}
    </div>
  );
}
