import type { Metadata } from "next";
import { AskClient } from "@/components/ask-client";

export const metadata: Metadata = { title: "Ask AI" };

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string; go?: string }> }) {
  const sp = await searchParams;
  return <AskClient initialQuestion={(sp.q ?? "").slice(0, 500)} autoRun={sp.go === "1"} />;
}
