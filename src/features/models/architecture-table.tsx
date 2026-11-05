import { modelColor } from "@/charts/chart-math";
import type { ExperimentsData } from "@/engine/types";

export function ArchitectureTable({ data }: { data: ExperimentsData }) {
  return (
    <section className="bg-surface flex-none px-[15px] pt-[13px] pb-1.5">
      <h3 className="text-[13px] font-medium">Architectures</h3>
      <p className="text-subtle mt-px mb-2 text-xs">
        All use a 128-dimension embedding and predict over a {data.vocabSize}-token vocabulary,
        built from the training split.
      </p>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-subtle">
            <th className="border-b px-2 py-1 text-left font-normal">Model</th>
            <th className="border-b px-2 py-1 text-left font-normal">Layers</th>
            <th className="border-b px-2 py-1 text-left font-normal">Checkpoint</th>
            <th className="border-b px-2 py-1 text-right font-normal">Parameters</th>
          </tr>
        </thead>
        <tbody>
          {data.architectures.map((a) => (
            <tr
              key={a.id}
              className="hover:bg-secondary transition-colors [&:last-child>td]:border-0"
            >
              <td className="border-b px-2 py-[5px] font-medium">
                <span className="flex items-center gap-2">
                  <i className="size-2 rounded-full" style={{ background: modelColor(a.id) }} />
                  {a.id}
                </span>
              </td>
              <td className="text-muted-foreground border-b px-2 py-[5px]">{a.layers}</td>
              <td className="border-b px-2 py-[5px] font-mono text-xs">{a.checkpoint}</td>
              <td className="border-b px-2 py-[5px] text-right font-mono text-xs">
                {a.params.toLocaleString("en")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
