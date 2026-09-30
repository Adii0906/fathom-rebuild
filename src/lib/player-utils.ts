import type { Segment } from "./types";

/** Index of the segment being spoken at time t (the last segment that has started). */
export function activeIndexAt(segments: Segment[], t: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
