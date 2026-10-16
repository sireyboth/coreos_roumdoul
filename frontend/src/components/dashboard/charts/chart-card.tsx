import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** The frame every dashboard chart sits in: a title that says what is plotted, an optional note, the chart. */
export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  );
}

/** Shown in place of a chart that has nothing to plot. */
export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <p className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">{children}</p>;
}
