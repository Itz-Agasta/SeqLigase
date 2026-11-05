export interface Command {
  id: string;
  label: string;
  hint: string;
  group: "Molecules" | "Pages" | "Actions";
  run: () => void;
}

export function filterCommands(commands: Command[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q));
}

export function outOfDomainMessage(query: string, commands: Command[]) {
  const q = query.trim();
  if (!q || filterCommands(commands, q).length > 0) return null;
  return `"${q}" isn't in this set. The model covers neutral molecules with C, H, N, O and F, up to 9 heavy atoms, from QM9.`;
}
