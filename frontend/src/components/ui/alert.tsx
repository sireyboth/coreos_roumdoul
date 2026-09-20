import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex w-full items-start gap-3 rounded-xl border p-4 text-sm",
  {
    variants: {
      variant: {
        info: "border-info/30 bg-info/10 [&_[data-slot=alert-icon]]:text-info",
        success: "border-success/30 bg-success/10 [&_[data-slot=alert-icon]]:text-success",
        warning: "border-warning/40 bg-warning/12 [&_[data-slot=alert-icon]]:text-warning",
        destructive: "border-destructive/30 bg-destructive/10 [&_[data-slot=alert-icon]]:text-destructive",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
} as const;

type AlertProps = Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof alertVariants> & {
    title?: React.ReactNode;
    /** A button or link, shown on the right (or below on small screens). */
    action?: React.ReactNode;
  };

/** A prominent, in-page message — for things the user must not miss. */
function Alert({ variant = "info", title, action, className, children, ...props }: AlertProps) {
  const Icon = ICONS[variant ?? "info"];

  return (
    <div
      role={variant === "destructive" || variant === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon data-slot="alert-icon" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold leading-tight">{title}</p>}
        {children && <div className={cn("text-foreground/80", title && "mt-1")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export { Alert };
