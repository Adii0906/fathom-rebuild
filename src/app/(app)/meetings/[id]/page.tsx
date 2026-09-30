import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingView } from "@/components/meeting/meeting-view";
import { isTemplateId } from "@/lib/templates";
import { getMeetingBundle } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; template?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const b = await getMeetingBundle((await params).id);
  return { title: b?.meeting.title ?? "Meeting" };
}

export default async function MeetingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await getMeetingBundle(id);
  if (!bundle) notFound();
  const t = sp.t !== undefined ? Number(sp.t) : undefined;
  return (
    <MeetingView
      key={id}
      meeting={bundle.meeting}
      state={bundle.state}
      initialTime={t !== undefined && Number.isFinite(t) ? t : undefined}
      initialTemplate={isTemplateId(sp.template) ? sp.template : undefined}
    />
  );
}
