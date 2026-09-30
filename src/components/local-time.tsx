"use client";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";

/** Renders in UTC on the server (deterministic), then switches to the viewer's timezone on mount. */
export function LocalTime({ iso, variant = "datetime" }: { iso: string; variant?: "date" | "datetime" | "time" | "day" }) {
  const [text, setText] = useState(() => formatDate(iso, variant));
  useEffect(() => setText(formatDate(iso, variant, undefined)), [iso, variant]);
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
