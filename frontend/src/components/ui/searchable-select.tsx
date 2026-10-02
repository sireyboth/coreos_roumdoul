"use client";

import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * A select you can type into to narrow the list (Select2-style), for long
 * option lists like employees. `value` is the chosen option's value, or ""
 * for none; clearing it (the ×) goes back to "". Turn `clearable` off for a
 * field that must always have a value.
 */
export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearable = true,
  className,
}: {
  id?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  clearable?: boolean;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(option) => {
        if (option || clearable) onChange(option?.value ?? "");
      }}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <Combobox.InputGroup
        className={cn(
          "relative flex h-8 w-48 items-center rounded-lg border border-input bg-background text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          className,
        )}
      >
        <Combobox.Input
          id={id}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent pl-2.5 pr-1 outline-none placeholder:text-foreground"
        />
        {clearable && selected && (
          <Combobox.Clear aria-label="Clear" className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </Combobox.Clear>
        )}
        <Combobox.Trigger aria-label="Show options" className="flex size-6 items-center justify-center text-muted-foreground">
          <ChevronDown className="size-3.5" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50 outline-none" sideOffset={4} align="start">
          <Combobox.Popup className="max-h-[min(20rem,var(--available-height))] w-(--anchor-width) min-w-48 overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            <Combobox.Empty className="px-2 py-1.5 text-muted-foreground empty:hidden">No matches</Combobox.Empty>
            <Combobox.List>
              {(option: Option) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  <Combobox.ItemIndicator>
                    <CheckIcon className="size-3.5" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
