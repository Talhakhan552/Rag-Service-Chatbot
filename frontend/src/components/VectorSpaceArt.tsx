"use client";

// A small constellation of points representing embedded chunks, with
// one "query" point pulsing and connected to its nearest matches --
// a literal, abstracted picture of what this product actually does
// (vector similarity search), rather than generic decoration.
const POINTS = [
  { x: 120, y: 90, r: 3 },
  { x: 210, y: 60, r: 2.5 },
  { x: 280, y: 140, r: 3.5 },
  { x: 90, y: 220, r: 2.5 },
  { x: 340, y: 220, r: 3 },
  { x: 180, y: 280, r: 2.5 },
  { x: 260, y: 340, r: 3 },
  { x: 60, y: 340, r: 2.5 },
  { x: 380, y: 100, r: 2.5 },
  { x: 150, y: 400, r: 3 },
  { x: 320, y: 400, r: 2.5 },
  { x: 30, y: 150, r: 2 },
];

const QUERY = { x: 220, y: 210 };
const MATCHES = [
  { x: 280, y: 140 },
  { x: 180, y: 280 },
  { x: 340, y: 220 },
];

export function VectorSpaceArt() {
  return (
    <svg viewBox="0 0 420 460" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={QUERY.x} cy={QUERY.y} r="120" fill="url(#glow)" />

      {/* faint ambient connections between nearby points */}
      {POINTS.map((p, i) =>
        POINTS.slice(i + 1).map((q, j) => {
          const dist = Math.hypot(p.x - q.x, p.y - q.y);
          if (dist > 110) return null;
          return (
            <line
              key={`${i}-${j}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke="var(--color-border-strong)"
              strokeWidth="1"
              opacity="0.5"
            />
          );
        })
      )}

      {/* query -> match connections, highlighted */}
      {MATCHES.map((m, i) => (
        <line
          key={i}
          x1={QUERY.x}
          y1={QUERY.y}
          x2={m.x}
          y2={m.y}
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          opacity="0.8"
        />
      ))}

      {POINTS.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="var(--color-text-muted)" />
      ))}

      {MATCHES.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r="4.5" fill="var(--color-accent-text)" />
      ))}

      <circle cx={QUERY.x} cy={QUERY.y} r="6" fill="var(--color-warm)" className="animate-pulse-glow" />
    </svg>
  );
}
