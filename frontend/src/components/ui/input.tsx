import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

const dateLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  calendar: "gregory",
  timeZone: "UTC",
})

function formatDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return dateLabel.format(new Date(`${value}T00:00:00Z`))
}

// Phones draw native date boxes themselves: iOS ignores the width (so two side by side
// run off the screen) and uses the phone's calendar (e.g. "Reiwa 8"). On touch screens we
// show our own label and lay the real input invisibly on top, so a tap still opens the
// phone's picker. Mouse users keep the normal native box.
function DateInput({ className, value, ...props }: React.ComponentProps<"input">) {
  const label = formatDate(value)

  return (
    <div
      data-slot="input"
      className={cn(
        "relative flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-transparent text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:bg-input/50 has-disabled:opacity-50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none hidden truncate px-2.5 pointer-coarse:block",
          !label && "text-muted-foreground"
        )}
      >
        {label ?? "Select date"}
      </span>
      <InputPrimitive
        type="date"
        value={value}
        className="h-full w-full min-w-0 bg-transparent px-2.5 py-1 outline-none disabled:pointer-events-none pointer-coarse:absolute pointer-coarse:inset-0 pointer-coarse:appearance-none pointer-coarse:opacity-0"
        {...props}
      />
    </div>
  )
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "date") return <DateInput className={className} {...props} />

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
