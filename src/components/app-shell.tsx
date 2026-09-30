"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, LayoutDashboard, Menu, Plus, Search, Sparkles, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SearchBox } from "@/components/search-box";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/search", label: "Search", icon: Search },
  { href: "/ask", label: "Ask AI", icon: Sparkles },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" className="px-1.5 pt-1"><Logo /></Link>
      <Button asChild className="w-full justify-center">
        <Link href="/import"><Plus /> Import meeting</Link>
      </Button>
      <Nav onNavigate={() => setOpen(false)} />
      <div className="mt-auto rounded-lg border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Demo workspace.</span> Seeded with sample meetings. Live capture bots are stubbed; import a transcript to try the pipeline.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r bg-card/50 lg:block">{sidebar}</aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/30" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72 max-w-[85%] border-r bg-card shadow-xl animate-fade-in">
            <button className="absolute right-3 top-3 rounded p-1 hover:bg-muted" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 py-2.5 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></Button>
          <Link href="/" className="lg:hidden"><Logo /></Link>
          <div className="ml-auto w-full max-w-xl"><SearchBox /></div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
