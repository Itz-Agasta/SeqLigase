import { CircleCheck, TriangleAlert } from "lucide-react";
import { useLab } from "@/state/lab-store";
import { ExplainNote } from "./explain-note";
import { verdictOf } from "./format";

export function ResultPanel() {
  const response = useLab((s) => s.response);
  const { moleculeId, model, start, length } = useLab((s) => s.selection);
  const verdict = response ? verdictOf(response) : null;
  const correct = response
    ? Math.round(response.token_accuracy * response.mask_positions.length)
    : 0;
  const rows: [React.ReactNode, string][] = [
    ["Masked tokens correct", response ? `${correct} of ${response.mask_positions.length}` : "–"],
    [
      <>
        Tanimoto similarity <small className="text-subtle text-[11.5px]">Morgan r2</small>
      </>,
      response ? response.tanimoto_similarity.toFixed(3) : "–",
    ],
    ["Normalised edit distance", response ? response.normalized_edit_distance.toFixed(2) : "–"],
    ["RDKit validity", response ? (response.valid ? "Valid" : "Invalid") : "–"],
  ];
  return (
    <section className="border-b px-3.5 pt-3 pb-3.5">
      <h3 className="mb-2 text-[12.5px] font-medium">Result</h3>
      <div className="mb-2.5 flex items-center gap-[7px] font-medium">
        {verdict ? (
          <>
            {verdict.tone === "good" ? (
              <CircleCheck className="text-good size-3.5 flex-none" aria-hidden="true" />
            ) : (
              <TriangleAlert className="text-warn size-3.5 flex-none" aria-hidden="true" />
            )}
            {verdict.text}
          </>
        ) : (
          <span className="text-muted-foreground font-normal">
            Press Reconstruct to run the model
          </span>
        )}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-[5px] text-[12.5px]">
        {rows.map(([label, value], i) => (
          <div key={i} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-mono text-xs">{value}</dd>
          </div>
        ))}
      </dl>
      {response?.warnings.map((w) => (
        <p key={w} className="text-warn mt-2 text-xs">
          {w}
        </p>
      ))}
      {response ? (
        <ExplainNote
          key={`${moleculeId}:${model}:${start}:${length}`}
          request={{ moleculeId, model, start, length }}
        />
      ) : null}
    </section>
  );
}
