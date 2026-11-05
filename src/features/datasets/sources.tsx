const SOURCES = [
  {
    name: "QM9",
    role: "Primary",
    size: "133,885 molecules",
    detail:
      "Small organic molecules with up to nine heavy atoms: C, H, N, O and F. Used for all reconstruction experiments.",
  },
  {
    name: "MOSES",
    role: "Optional",
    size: "About 1.9 million",
    detail:
      "A larger, drug-like set derived from ZINC. Reserved for the generative stretch experiment.",
  },
  {
    name: "ESOL",
    role: "Baseline",
    size: "About 1,128 compounds",
    detail: "A solubility benchmark from MoleculeNet, used for the fingerprint baseline only.",
  },
];

export function Sources() {
  return (
    <section className="bg-surface col-span-5 px-[15px] pt-[13px] pb-3">
      <h3 className="mb-2 text-[13px] font-medium">Sources</h3>
      <dl className="flex flex-col gap-2.5">
        {SOURCES.map((s) => (
          <div key={s.name}>
            <dt className="flex items-baseline gap-2 font-medium">
              {s.name}
              <span className="text-subtle text-xs font-normal">{s.role}</span>
              <span className="ml-auto font-mono text-xs font-normal">{s.size}</span>
            </dt>
            <dd className="text-muted-foreground text-xs">{s.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
