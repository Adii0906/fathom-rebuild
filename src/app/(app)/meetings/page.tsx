import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MeetingsBrowser } from "@/components/meetings-browser";
import { Button } from "@/components/ui/button";
import { listBundles } from "@/lib/store";
import { summarize } from "@/lib/summary";

export const metadata: Metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const rows = (await listBundles()).map((b) => summarize(b.meeting, b.state));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px]">Meetings</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} meetings. Filter by template, person or date.</p>
        </div>
        <Button asChild><Link href="/import"><Plus /> Import meeting</Link></Button>
      </div>
      <MeetingsBrowser meetings={rows} nowIso={new Date().toISOString()} />
    </div>
  );
}
