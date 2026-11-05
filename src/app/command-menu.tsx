import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Command as CommandRoot,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { client } from "@/engine/client";
import { type CatalogEntry, MODEL_IDS } from "@/engine/types";
import { useLab } from "@/state/lab-store";
import { type Command, filterCommands, outOfDomainMessage } from "./commands";
import { toggleTheme } from "./theme";

const PAGES = [
  ["/", "Repair Lab"],
  ["/runs", "Runs"],
  ["/experiments", "Experiments"],
  ["/models", "Models"],
  ["/datasets", "Datasets"],
] as const;

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void client.catalog().then(setCatalog);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (useLab.getState().phase !== "idle") return;
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  const commands = useMemo<Command[]>(
    () => [
      ...catalog.map((c) => ({
        id: `mol-${c.id}`,
        label: c.name,
        hint: `${c.formula} ${c.smiles}`,
        group: "Molecules" as const,
        run: () => {
          void navigate({ to: "/" }).then(() => useLab.getState().setMolecule(c.id));
        },
      })),
      ...PAGES.map(([to, label]) => ({
        id: `page-${to}`,
        label: `Open ${label}`,
        hint: "Page",
        group: "Pages" as const,
        run: () => void navigate({ to }),
      })),
      ...MODEL_IDS.map((m) => ({
        id: `model-${m}`,
        label: `Use ${m}`,
        hint: "Model",
        group: "Actions" as const,
        run: () => useLab.getState().setModel(m),
      })),
      {
        id: "run",
        label: "Reconstruct",
        hint: "⌘↵",
        group: "Actions" as const,
        run: () => {
          void navigate({ to: "/" }).then(() => useLab.getState().reconstruct());
        },
      },
      {
        id: "theme",
        label: "Switch theme",
        hint: "Appearance",
        group: "Actions" as const,
        run: toggleTheme,
      },
    ],
    [catalog, navigate],
  );

  const results = filterCommands(commands, query);
  const message = outOfDomainMessage(query, commands);
  const groups = ["Molecules", "Pages", "Actions"] as const;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title="Search"
      description="Search molecules, pages and actions"
    >
      <CommandRoot shouldFilter={false}>
        <CommandInput
          placeholder="Search molecules, pages, actions"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty className="text-muted-foreground px-4 py-6 text-center text-[13px]">
            {message}
          </CommandEmpty>
          {groups.map((group) => {
            const items = results.filter((c) => c.group === group);
            if (items.length === 0) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.label} ${c.hint}`}
                    onSelect={() => {
                      onOpenChange(false);
                      setQuery("");
                      c.run();
                    }}
                  >
                    {c.label}
                    <CommandShortcut className="font-mono text-[11px] tracking-normal">
                      {c.hint.split(" ")[0]}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandRoot>
    </CommandDialog>
  );
}
