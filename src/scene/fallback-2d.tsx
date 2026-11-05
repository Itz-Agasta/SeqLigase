import { useLab } from "@/state/lab-store";
import { candidateOf } from "./build-molecule";

const SCALE = 46;

export function Fallback2D() {
  const record = useLab((s) => s.record);
  const response = useLab((s) => s.response);
  const view = useLab((s) => s.view);
  const { start, length } = useLab((s) => s.selection);
  if (!record) return null;

  const predicted = view === "reconstructed" || view === "overlay";
  const candidate = predicted ? candidateOf(record, response) : null;
  const source = candidate ?? record;
  const heavy = source.atoms.filter((a) => a.el !== "H");
  const points = source.depiction;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const pad = 1;
  const box = [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) - Math.min(...xs) + pad * 2,
    Math.max(...ys) - Math.min(...ys) + pad * 2,
  ].map((v) => v * SCALE);
  const inMask = (t: number | null) => t !== null && t >= start && t < start + length;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-14">
      <svg
        viewBox={box.join(" ")}
        className="max-h-[70%] w-full max-w-xl"
        role="img"
        aria-label={`2D structure of ${record.name}`}
      >
        {source.bonds
          .filter((b) => b.a < heavy.length && b.b < heavy.length)
          .map((b, i) => {
            const [x1, y1] = points[b.a].map((v) => v * SCALE);
            const [x2, y2] = points[b.b].map((v) => v * SCALE);
            const nx = ((y2 - y1) / Math.hypot(x2 - x1, y2 - y1)) * 5;
            const ny = (-(x2 - x1) / Math.hypot(x2 - x1, y2 - y1)) * 5;
            const unknown =
              view === "masked" && (inMask(heavy[b.a].tokenIndex) || inMask(heavy[b.b].tokenIndex));
            const dash = unknown ? "5 5" : undefined;
            return (
              <g
                key={i}
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray={dash}
                className={unknown ? "text-subtle" : "text-muted-foreground"}
              >
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                {b.order > 1 ? <line x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny} /> : null}
              </g>
            );
          })}
        {heavy.map((a, i) => {
          const [x, y] = points[i].map((v) => v * SCALE);
          const unknown = view === "masked" && inMask(a.tokenIndex);
          const infill = predicted && inMask(a.tokenIndex);
          if (a.el === "C" && !unknown && !infill) return null;
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={14}
                className={infill ? "fill-brand" : "fill-surface"}
                stroke={unknown ? "currentColor" : "none"}
                strokeDasharray="4 3"
              />
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize={15}
                fill="currentColor"
                className={unknown ? "text-subtle" : "text-foreground"}
              >
                {unknown ? "?" : a.el === "C" ? "" : a.el}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-muted-foreground text-xs">
        3D view isn't available in this browser. Showing the 2D structure.
      </p>
    </div>
  );
}
