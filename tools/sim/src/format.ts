// Console output shared by the engine and WS modes.

/** Right-aligned columns with a dashed rule under the header. */
export function formatColumns(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((l) => (l[i] ?? "").length)));
  const fmt = (cells: readonly string[]): string => cells.map((c, i) => c.padStart(widths[i] as number)).join("  ");
  return [fmt(header), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(fmt)].join("\n");
}

/** Prints up to `max` failures to stderr; true when there was at least one. */
export function reportFailures(rows: readonly { failures: readonly string[] }[], max = 20): boolean {
  const failures = rows.flatMap((r) => r.failures);
  if (failures.length === 0) return false;
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures.slice(0, max)) console.error("  " + f);
  return true;
}
