import type { Metadata } from "next";
import { ImportFlow } from "@/components/import-flow";

export const metadata: Metadata = { title: "Import meeting" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  const sp = await searchParams;
  return <ImportFlow initialTitle={(sp.title ?? "").slice(0, 120)} />;
}
