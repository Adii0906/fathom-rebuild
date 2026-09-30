import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg p-8">
      <EmptyState icon={SearchX} title="We couldn't find that page">
        The meeting may have been removed, or the link is incorrect.
        <div className="mt-4"><Button asChild><Link href="/meetings">Browse meetings</Link></Button></div>
      </EmptyState>
    </div>
  );
}
