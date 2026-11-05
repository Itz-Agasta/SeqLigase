import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        if (v) onChange(v as T);
      }}
      className="bg-raise flex w-full gap-px rounded-[7px] border p-0.5"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="text-muted-foreground hover:text-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground h-[23px] min-w-0 flex-auto rounded-[5px] px-1.5 text-xs font-normal whitespace-nowrap hover:bg-transparent data-[state=on]:font-medium data-[state=on]:shadow-[0_0_0_1px_var(--seq-border-strong)]"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
