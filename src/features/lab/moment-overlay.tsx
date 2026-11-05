import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useLab } from "@/state/lab-store";
import { verdictOf } from "./format";

const PHASE_LABEL = {
  damage: "Masking",
  reading: "Reading both ways",
  ligation: "Reconstructing",
  verify: "Checking with RDKit",
};

export function MomentOverlay() {
  const phase = useLab((s) => s.phase);
  const record = useLab((s) => s.record);
  const run = useLab((s) => s.pendingRun);
  const displayed = useLab((s) => s.displayed);
  const checks = useLab((s) => s.checks);
  const strip = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      useLab.subscribe((s) => {
        const box = strip.current;
        if (!box || !run) return;
        const beams = [left.current, right.current];
        if (s.beam === null) {
          beams.forEach((b) => b && (b.style.opacity = "0"));
          box.querySelectorAll("[data-lit]").forEach((el) => el.removeAttribute("data-lit"));
          return;
        }
        const first =
          box.querySelector<HTMLElement>(`[data-i="${run.mask_positions[0]}"]`)?.offsetLeft ?? 0;
        const lastEl = box.querySelector<HTMLElement>(`[data-i="${run.mask_positions.at(-1)}"]`);
        const end = (lastEl?.offsetLeft ?? 0) + (lastEl?.offsetWidth ?? 0);
        const l = s.beam * first;
        const r = box.offsetWidth - s.beam * (box.offsetWidth - end);
        if (left.current && right.current) {
          left.current.style.opacity = right.current.style.opacity = "0.95";
          left.current.style.left = `${l - 40}px`;
          right.current.style.left = `${r - 40}px`;
        }
        box.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => {
          const c = el.offsetLeft + el.offsetWidth / 2;
          const near =
            !run.mask_positions.includes(Number(el.dataset.i)) &&
            (Math.abs(c - l) < 52 || Math.abs(c - r) < 52);
          el.toggleAttribute("data-lit", near);
        });
      }),
    [run],
  );

  if (phase === "idle" || !record || !run) return null;
  const masked = (i: number) => run.mask_positions.includes(i);
  const verdict = verdictOf(run);
  const correct = Math.round(run.token_accuracy * run.mask_positions.length);
  const showResult = phase === "verify";
  const first = run.mask_positions[0];

  return (
    <div className="pointer-events-none fixed inset-0 z-20 text-[#ededef]" aria-live="polite">
      <div className="absolute top-5 left-6 flex items-center gap-2.5 text-sm font-semibold tracking-tight">
        {record.name}
      </div>
      <div className="absolute top-5 right-6 text-xs text-[#a1a3a9]">{PHASE_LABEL[phase]}</div>
      {checks.length > 0 ? (
        <ul className="absolute top-1/2 right-10 flex -translate-y-1/2 flex-col gap-1.5 text-xs">
          {checks.map((c) => (
            <li key={c} className="flex items-center gap-2 font-mono text-[#a1a3a9]">
              <span className="size-1.5 rounded-full bg-[#4cc38a]" />
              {c}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="absolute bottom-[74px] left-1/2 flex -translate-x-1/2 gap-1.5" ref={strip}>
        {record.tokens.map((t, i) => {
          const d = displayed[i];
          const isMask = masked(i);
          return (
            <div
              key={i}
              data-i={i}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-[7px] border border-[#26272c] bg-[#101114d9] px-2.5 font-mono text-[13px] whitespace-nowrap text-[#a1a3a9] backdrop-blur-sm transition-all duration-200 data-lit:border-[#a5adff] data-lit:bg-[#6f7cf040] data-lit:text-white data-lit:shadow-[0_0_16px_#6f7cf080]",
                isMask && !d && "border-dashed border-[#4a4c54] bg-[#0a0a0c80] text-[#797b82]",
                isMask && d && !d.locked && "border-[#6f7cf0] bg-[#6f7cf01a] text-[#a5adff]",
                isMask &&
                  d?.locked &&
                  d.token === t &&
                  "border-[#a5adff] bg-[#6f7cf047] font-medium text-white shadow-[0_0_26px_#6f7cf0a6]",
                isMask &&
                  d?.locked &&
                  d.token !== t &&
                  "border-[#e0a84e] bg-[#e0a84e26] font-medium text-[#e0a84e] shadow-[0_0_26px_#e0a84e80]",
              )}
              style={{ minWidth: 58 }}
            >
              {isMask ? (d?.token ?? "[MASK]") : t}
              {isMask && d?.locked ? (
                <span className="absolute top-[calc(100%+5px)] right-0 left-0 text-center text-[11.5px] text-[#a5adff]">
                  {(d.p * 100).toFixed(1)}%
                </span>
              ) : null}
              {i === first && d?.alts && phase === "reading" ? (
                <div className="absolute bottom-[calc(100%+12px)] left-1/2 w-32 -translate-x-1/2 rounded-lg border border-[#26272c] bg-[#0e0f12d9] px-2 py-1.5 backdrop-blur-sm">
                  {d.alts.map((a, k) => (
                    <div
                      key={k}
                      className="grid h-4 grid-cols-[52px_1fr] items-center gap-1.5 text-[11px] font-normal text-[#a1a3a9]"
                    >
                      <span className="truncate">{a.token}</span>
                      <span className="h-[3px] overflow-hidden rounded-sm bg-[#24252b]">
                        <i
                          className="block h-full rounded-sm bg-[#a5adff]"
                          style={{ width: `${Math.min(100, a.p * 100)}%` }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <div
          ref={left}
          className="pointer-events-none absolute -top-px -bottom-px w-20 rounded-[7px] opacity-0 mix-blend-screen"
          style={{
            background: "linear-gradient(90deg, transparent, rgb(165 173 255 / 0.95), transparent)",
          }}
        />
        <div
          ref={right}
          className="pointer-events-none absolute -top-px -bottom-px w-20 rounded-[7px] opacity-0 mix-blend-screen"
          style={{
            background: "linear-gradient(90deg, transparent, rgb(165 173 255 / 0.95), transparent)",
          }}
        />
      </div>
      <div
        className={cn(
          "absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-6 text-[13px] whitespace-nowrap text-[#a1a3a9] transition-opacity duration-500",
          showResult ? "opacity-100" : "opacity-0",
        )}
      >
        <span
          className={
            verdict.tone === "good" ? "font-medium text-[#4cc38a]" : "font-medium text-[#e0a84e]"
          }
        >
          {verdict.text}
        </span>
        <span>
          Masked tokens{" "}
          <b className="font-mono font-medium text-[#ededef]">
            {correct} of {run.mask_positions.length}
          </b>
        </span>
        <span>
          Tanimoto{" "}
          <b className="font-mono font-medium text-[#ededef]">
            {run.tanimoto_similarity.toFixed(3)}
          </b>
        </span>
        <span>
          RDKit{" "}
          <b className="font-mono font-medium text-[#ededef]">{run.valid ? "Valid" : "Invalid"}</b>
        </span>
      </div>
      <div className="absolute right-6 bottom-5 text-xs text-[#797b82]">
        <kbd className="rounded border border-[#26272c] px-1 font-mono text-[11px]">Esc</kbd> skip
      </div>
    </div>
  );
}
