import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { Logo } from "@/components/logo";
import { MeetingView } from "@/components/meeting/meeting-view";
import { getMeetingBundle } from "@/lib/store";
import { primaryAnalysis } from "@/lib/summary";
import { isTemplateId } from "@/lib/templates";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; template?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const b = await getMeetingBundle((await params).id);
  if (!b) return { title: "Shared meeting" };
  return {
    title: `${b.meeting.title} (shared)`,
    description: primaryAnalysis(b.meeting)?.summary.slice(0, 200),
    robots: { index: false, follow: false },
  };
}

/** Public, read-only view: no login, no app shell, no mutations. */
export default async function SharedMeetingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await getMeetingBundle(id);
  if (!bundle) notFound();
  const t = sp.t !== undefined ? Number(sp.t) : undefined;
  return (
    <div className="min-h-screen">
      <div className="border-b bg-card/60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Link href="/" aria-label="Cadence home"><Logo /></Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"><Eye className="size-3.5" /> Shared meeting · read-only</span>
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
        <MeetingView
          key={id}
          meeting={bundle.meeting}
          state={bundle.state}
          readOnly
          initialTime={t !== undefined && Number.isFinite(t) ? t : undefined}
          initialTemplate={isTemplateId(sp.template) ? sp.template : undefined}
        />
      </main>
    </div>
  );
}
