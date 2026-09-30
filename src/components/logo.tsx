export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect width="26" height="26" rx="7" fill="hsl(168 76% 27%)" />
        <rect x="6" y="11" width="2.6" height="4" rx="1.3" fill="#fff" />
        <rect x="10.2" y="7.5" width="2.6" height="11" rx="1.3" fill="#fff" />
        <rect x="14.4" y="9.5" width="2.6" height="7" rx="1.3" fill="#fff" opacity=".85" />
        <rect x="18.6" y="12" width="2.6" height="2" rx="1" fill="#fff" opacity=".7" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">Cadence</span>
    </span>
  );
}
