"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/states";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <ErrorBox title="This page failed to load">{error.message || "An unexpected error occurred."}</ErrorBox>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
