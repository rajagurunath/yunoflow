import { useId } from "react";

// Yuno's brand mark: a stylized "Y" rendered as a 6×6 dot-matrix halftone
// (large dots trace the Y, smaller dots fill the field). Geometry lifted from
// the official icon; recolored from brand blue to YunoFlow emerald.
const GRID = ["LLSSLL", "MLMMLM", "SLLLLS", "SMLLMS", "SSLLSS", "SSLLSS"];
const RAD: Record<string, number> = { L: 8.6, M: 5.1, S: 3.3 };
const C0 = 63.3, STEP = 25.68;

const DOTS: { cx: number; cy: number; r: number }[] = [];
for (let row = 0; row < 6; row++)
  for (let col = 0; col < 6; col++)
    DOTS.push({ cx: C0 + STEP * col, cy: C0 + STEP * row, r: RAD[GRID[row][col]] });

export function YunoMark({ className = "h-8 w-8", dot = "#f1faf6", rounded = true }: {
  className?: string; dot?: string; rounded?: boolean;
}) {
  const uid = useId();
  return (
    <svg viewBox="0 0 256 256" className={className} role="img" aria-label="YunoFlow">
      <defs>
        <linearGradient id={`yg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17a37a" />
          <stop offset="1" stopColor="#0b6147" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx={rounded ? 58 : 0} fill={`url(#yg-${uid})`} />
      {DOTS.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={dot} />)}
    </svg>
  );
}
