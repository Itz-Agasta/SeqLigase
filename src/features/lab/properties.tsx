import { candidateOf } from "@/scene/candidate";
import { useLab } from "@/state/lab-store";
import { propertyRows } from "./format";

export function PropertiesPanel() {
  const record = useLab((s) => s.record);
  const response = useLab((s) => s.response);
  if (!record) return null;
  const predicted = response?.valid
    ? (candidateOf(record, response)?.properties ?? record.properties)
    : null;
  return (
    <section className="px-3.5 pt-3 pb-3.5">
      <h3 className="mb-2 text-[12.5px] font-medium">Properties</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-subtle text-right">
            <th className="font-normal" />
            <th className="py-0.5 font-normal">Original</th>
            <th className="py-0.5 font-normal">Predicted</th>
            <th className="py-0.5 font-normal">Change</th>
          </tr>
        </thead>
        <tbody>
          {propertyRows(record.properties, predicted).map((row) => (
            <tr key={row.label} className="text-right font-mono">
              <td className="text-muted-foreground py-[3px] text-left font-sans">{row.label}</td>
              <td>{row.original}</td>
              <td>{row.predicted}</td>
              <td>{row.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
