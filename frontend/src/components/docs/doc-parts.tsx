import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/* Building blocks for the public docs pages: plain, readable, printable. */

export type TocEntry = { id: string; title: string; step?: number };

/** The contents list: a sticky sidebar on wide screens, a box at the top on phones. */
export function Toc({ entries }: { entries: TocEntry[] }) {
  return (
    <nav aria-label="Contents" className="text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
      <ol className="flex flex-col gap-1">
        {entries.map((e) => (
          <li key={e.id}>
            <a href={`#${e.id}`} className="flex gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              {e.step !== undefined && <span className="w-5 shrink-0 text-right tabular-nums text-primary">{e.step}.</span>}
              <span>{e.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Section({ id, step, title, intro, children }: { id: string; step?: number; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border pt-10 first:border-t-0 first:pt-0">
      <h2 className="flex items-baseline gap-3 text-2xl font-semibold tracking-tight">
        {step !== undefined && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-base tabular-nums text-primary">Step {step}</span>}
        {title}
      </h2>
      {intro && <p className="mt-2 text-muted-foreground">{intro}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function H3({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3 id={id} className="scroll-mt-20 text-lg font-semibold">
      {children}
    </h3>
  );
}

export function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("leading-relaxed text-foreground/85", className)}>{children}</p>;
}

/** Numbered how-to steps. */
export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
          <div className="pt-0.5 leading-relaxed text-foreground/85">{item}</div>
        </li>
      ))}
    </ol>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-foreground/85 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Where to click: "Payroll Settings → Pay groups → Add group". */
export function Path({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] font-medium">{children}</span>;
}

export function Table({ head, rows, className }: { head: React.ReactNode[]; rows: React.ReactNode[][]; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-foreground/85">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A worked calculation: label → amount rows, an optional total. */
export function Calc({ title, rows, total, note }: { title: string; rows: [React.ReactNode, React.ReactNode][]; total?: [React.ReactNode, React.ReactNode]; note?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {rows.map(([label, value], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-0.5 text-sm">
          <span className="text-foreground/85">{label}</span>
          <span className="shrink-0 tabular-nums">{value}</span>
        </div>
      ))}
      {total && (
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-1.5 text-sm font-semibold">
          <span>{total[0]}</span>
          <span className="shrink-0 tabular-nums">{total[1]}</span>
        </div>
      )}
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function Note({ title, children, variant = "info" }: { title?: string; children: React.ReactNode; variant?: "info" | "warning" | "success" }) {
  return (
    <Alert variant={variant} title={title}>
      {children}
    </Alert>
  );
}

export function Formula({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-card px-4 py-2.5 font-mono text-sm">{children}</div>;
}
