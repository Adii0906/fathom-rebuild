"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activeIndexAt } from "@/lib/player-utils";
import type { Participant, Segment } from "@/lib/types";

export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;

interface Options {
  duration: number;
  audioUrl?: string;
  segments: Segment[];
  participants: Participant[];
}

/**
 * One playback API for two sources:
 *  - a real <audio> element when the meeting has a recording (imports can supply a URL), or
 *  - a simulated timeline clock (the seed meetings have transcripts but no audio files).
 * In simulated mode "Voice" reads the transcript aloud with the browser's speech synthesis,
 * so jumping around the transcript is audible as well as visible.
 */
export function usePlayer({ duration, audioUrl, segments, participants }: Options) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [voice, setVoice] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeRef = useRef(0);
  const rateRef = useRef(1);

  const useAudio = Boolean(audioUrl) && !audioFailed;
  const activeIndex = useMemo(() => activeIndexAt(segments, time), [segments, time]);

  useEffect(() => setVoiceSupported("speechSynthesis" in window), []);

  // Simulated clock
  useEffect(() => {
    if (useAudio || !playing) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const next = Math.min(duration, timeRef.current + ((now - last) / 1000) * rateRef.current);
      last = now;
      timeRef.current = next;
      setTime(next);
      if (next >= duration) setPlaying(false);
    }, 200);
    return () => clearInterval(id);
  }, [useAudio, playing, duration]);

  // Real audio events
  useEffect(() => {
    const a = audioRef.current;
    if (!useAudio || !a) return;
    const onTime = () => {
      timeRef.current = a.currentTime;
      setTime(a.currentTime);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      setAudioFailed(true);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onPause);
      a.removeEventListener("error", onError);
    };
  }, [useAudio]);

  // Voice read-out of the current segment (simulated mode only)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    if (!voice || !playing || useAudio) return;
    const seg = segments[activeIndex];
    if (!seg) return;
    const who = Math.max(0, participants.findIndex((p) => p.id === seg.speakerId));
    const u = new SpeechSynthesisUtterance(seg.text);
    u.rate = Math.min(2, rateRef.current * 1.05);
    u.pitch = 0.75 + (who % 6) * 0.12;
    const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"));
    if (voices.length) u.voice = voices[who % voices.length];
    synth.speak(u);
  }, [voice, playing, useAudio, activeIndex, segments, participants]);

  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  const play = useCallback(() => {
    if (useAudio) {
      audioRef.current?.play().catch(() => setAudioFailed(true));
      return;
    }
    if (timeRef.current >= duration) {
      timeRef.current = 0;
      setTime(0);
    }
    setPlaying(true);
  }, [useAudio, duration]);

  const pause = useCallback(() => {
    if (useAudio) audioRef.current?.pause();
    else setPlaying(false);
  }, [useAudio]);

  /** Jump to t seconds. `play: true` also starts playback; default leaves play/pause as is. */
  const seek = useCallback(
    (t: number, opts: { play?: boolean } = {}) => {
      const c = Math.max(0, Math.min(duration, t));
      timeRef.current = c;
      setTime(c);
      if (useAudio && audioRef.current) audioRef.current.currentTime = c;
      if (opts.play) play();
    },
    [useAudio, duration, play],
  );

  const setRate = useCallback((r: number) => {
    rateRef.current = r;
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  return {
    time, playing, rate, voice, voiceSupported, activeIndex,
    audioRef, useAudio, audioFailed,
    play, pause, seek, setRate, setVoice,
    toggle: () => (playing ? pause() : play()),
  };
}

export type Player = ReturnType<typeof usePlayer>;
