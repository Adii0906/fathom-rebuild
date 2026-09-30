import { SPEAKER_PALETTE, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types";

export function speakerIndex(participants: Participant[], id: string) {
  return Math.max(0, participants.findIndex((p) => p.id === id));
}

export function Avatar({ name, index, size = "md", className }: { name: string; index: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const c = SPEAKER_PALETTE[index % SPEAKER_PALETTE.length];
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-2 ring-card",
        c.bg, c.text,
        size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ participants, max = 4, size = "sm" }: { participants: Participant[]; max?: number; size?: "sm" | "md" }) {
  const shown = participants.slice(0, max);
  const extra = participants.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((p, i) => <Avatar key={p.id} name={p.name} index={i} size={size} />)}
      {extra > 0 && (
        <span className={cn("inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card", size === "sm" ? "size-6" : "size-8")}>
          +{extra}
        </span>
      )}
    </span>
  );
}
