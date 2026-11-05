import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { client } from "@/engine/client";
import type { MaskRatio, MaxSpan } from "@/engine/mask";
import { type CatalogEntry, MODEL_IDS, type ModelId } from "@/engine/types";
import { useLab } from "@/state/lab-store";
import { Segmented } from "./segmented";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[7px] grid grid-cols-[78px_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="text-muted-foreground text-[12.5px]">
        {label}
      </label>
      {children}
    </div>
  );
}

export function RunForm({ onRun }: { onRun: () => void }) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const selection = useLab((s) => s.selection);
  const ratio = useLab((s) => s.ratio);
  const maxSpan = useLab((s) => s.maxSpan);
  const status = useLab((s) => s.status);
  const setMolecule = useLab((s) => s.setMolecule);
  const setModel = useLab((s) => s.setModel);
  const setMaskPolicy = useLab((s) => s.setMaskPolicy);
  const running = status === "running";

  useEffect(() => {
    void client.catalog().then(setCatalog);
  }, []);

  return (
    <div className="border-b px-3.5 pt-3 pb-3.5">
      <h3 className="mb-2.5 text-[12.5px] font-medium">Run</h3>
      <Field label="Molecule">
        <Select
          value={selection.moleculeId}
          disabled={running}
          onValueChange={(id) => void setMolecule(id)}
        >
          <SelectTrigger
            aria-label="Molecule"
            size="sm"
            className="bg-raise h-[29px]! w-full text-[13px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                <span className="text-subtle ml-2 font-mono text-[11px]">{c.formula}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Model">
        <Segmented<ModelId>
          label="Model"
          disabled={running}
          value={selection.model}
          onChange={setModel}
          options={MODEL_IDS.map((m) => ({ value: m, label: m }))}
        />
      </Field>
      <Field label="Mask ratio">
        <Segmented
          label="Mask ratio"
          disabled={running}
          value={String(ratio)}
          onChange={(v) => setMaskPolicy({ ratio: Number(v) as MaskRatio })}
          options={[15, 25, 35].map((r) => ({ value: String(r), label: `${r}%` }))}
        />
      </Field>
      <Field label="Span">
        <Segmented
          label="Span"
          disabled={running}
          value={String(maxSpan)}
          onChange={(v) => setMaskPolicy({ maxSpan: Number(v) as MaxSpan })}
          options={[
            { value: "1", label: "1" },
            { value: "2", label: "1–2" },
            { value: "3", label: "1–3" },
          ]}
        />
      </Field>
      <Field label="Seed" htmlFor="seed">
        <Input
          id="seed"
          inputMode="numeric"
          disabled={running}
          value={selection.seed}
          onChange={(e) => {
            const seed = Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
            setMaskPolicy({ seed });
          }}
          className="bg-raise h-[29px] font-mono text-xs md:text-xs"
        />
      </Field>
      <Button
        onClick={onRun}
        disabled={running}
        className="mt-1.5 h-8 w-full gap-2 text-[13px] font-medium"
      >
        {running ? "Reconstructing" : "Reconstruct"}
        <kbd className="font-mono text-[11px] opacity-60">⌘↵</kbd>
      </Button>
      <Button
        asChild
        variant="outline"
        className="mt-1.5 h-[29px] w-full text-[12.5px] font-normal"
      >
        <Link to="/models">Compare models</Link>
      </Button>
    </div>
  );
}
