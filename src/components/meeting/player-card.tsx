"use client";
import { memo, useMemo, useRef } from "react";
import { Captions, Pause, Play, RotateCcw, RotateCw, Star, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SPEAKER_PALETTE, mmss } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/lib/types";
import { Avatar, speakerIndex } from "./avatar";
import { RATES, type Player } from "./use-player";

interface Props {
  meeting: Meeting;
  player: Player;
  /** seconds of highlights to mark on the timeline */
  markers: { at: number; title: string }[];
  readOnly: boolean;
  onHighlightNow: () => void;
}

function PlayerCardImpl({ meeting, player, markers, readOnly, onHighlightNow }: Props) {
  const { time, playing, rate, voice, voiceSupported, activeIndex, useAudio } = player;
  const { durationSec: duration, segments, participants } = meeting;
  const seg = segments[activeIndex];
  const who = seg ? speakerIndex(participants, seg.speakerId) : 0;
  const whoName = participants[who]?.name ?? "";
  const stripRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Merge consecutive segments by one speaker into turns for the timeline strip.
  const turns = useMemo(() => {
    const out: { start: number; end: number; who: number }[] = [];
    for (const s of segments) {
      const w = speakerIndex(participants, s.speakerId);
      const last = out[out.length - 1];
      if (last && last.who === w) last.end = s.end;
      else out.push({ start: s.start, end: s.end, who: w });
    }
    return out;
  }, [segments, participants]);

  const seekFromPointer = (clientX: number) => {
    const r = stripRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    player.seek(((clientX - r.left) / r.width) * duration);
  };

  return (
    <Card className="overflow-hidden">
      {useAudio && <audio ref={player.audioRef} src={meeting.audioUrl} preload="metadata" />}

      {/* "Screen": live caption of whoever is speaking */}
      <div className="relative flex min-h-[132px] items-center gap-4 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white">
        <Avatar name={whoName} index={who} size="lg" className="ring-white/10" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs text-white/60">
            <span className="font-medium text-white/90">{whoName}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{mmss(seg?.start ?? 0)}</span>
          </div>
          <p className="line-clamp-3 text-[15px] leading-relaxed text-white/95" aria-live="off">{seg?.text}</p>
        </div>
        <Badge variant="muted" className="absolute right-3 top-3 bg-white/10 text-white/70">
          <Captions className="size-3" />
          {useAudio ? "Recording" : "Simulated recording"}
        </Badge>
      </div>

      {/* Timeline: coloured by speaker, amber ticks = highlights */}
      <div className="px-4 pb-1 pt-4 sm:px-5">
        <div
          ref={stripRef}
          role="slider"
          tabIndex={0}
          aria-label="Seek recording"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${mmss(time)} of ${mmss(duration)}`}
          className="group relative h-7 cursor-pointer touch-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekFromPointer(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && seekFromPointer(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") player.seek(time + 5);
            else if (e.key === "ArrowLeft") player.seek(time - 5);
            else if (e.key === "Home") player.seek(0);
            else if (e.key === "End") player.seek(duration);
            else return;
            e.preventDefault();
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-3 overflow-hidden rounded-full bg-muted">
            {turns.map((t, i) => (
              <div
                key={i}
                title={participants[t.who]?.name}
                className={cn("absolute inset-y-0 opacity-60 transition-opacity group-hover:opacity-80", SPEAKER_PALETTE[t.who % SPEAKER_PALETTE.length].solid)}
                style={{ left: `${(t.start / duration) * 100}%`, width: `${Math.max(0.25, ((t.end - t.start) / duration) * 100)}%` }}
              />
            ))}
            <div className="absolute inset-y-0 left-0 bg-foreground/15" style={{ width: `${(time / duration) * 100}%` }} />
          </div>
          {markers.map((m, i) => (
            <span
              key={i}
              title={`${m.title} · ${mmss(m.at)}`}
              className="absolute top-0 size-2 -translate-x-1/2 rotate-45 rounded-[2px] bg-amber-500 ring-2 ring-card"
              style={{ left: `${(m.at / duration) * 100}%` }}
            />
          ))}
          <span
            className="absolute bottom-[-2px] h-[16px] w-[3px] -translate-x-1/2 rounded-full bg-foreground shadow"
            style={{ left: `${(time / duration) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-4 sm:px-5">
        <Button size="icon" className="size-10 rounded-full" onClick={player.toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => player.seek(time - 10)} aria-label="Back 10 seconds"><RotateCcw /></Button>
        <Button size="icon" variant="ghost" onClick={() => player.seek(time + 10)} aria-label="Forward 10 seconds"><RotateCw /></Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{mmss(time)}</span> / {mmss(duration)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={onHighlightNow}>
              <Star className="text-amber-500" /> <span className="hidden sm:inline">Highlight moment</span><span className="sm:hidden">Highlight</span>
            </Button>
          )}
          {voiceSupported && !useAudio && (
            <Button
              size="icon" variant={voice ? "secondary" : "ghost"}
              onClick={() => player.setVoice(!voice)}
              aria-pressed={voice}
              aria-label="Read transcript aloud"
              title="Read transcript aloud (browser speech)"
            >
              {voice ? <Volume2 /> : <VolumeX />}
            </Button>
          )}
          <label className="sr-only" htmlFor="rate">Playback speed</label>
          <select
            id="rate"
            value={rate}
            onChange={(e) => player.setRate(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-card px-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </div>
      </div>
      {player.audioFailed && (
        <p className="border-t bg-amber-50 px-5 py-2 text-xs text-amber-900">
          The recording couldn&apos;t be loaded, so playback is simulated from the transcript timeline.
        </p>
      )}
    </Card>
  );
}

export const PlayerCard = memo(PlayerCardImpl);
