"use client";

import { useRef } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { SortableGridProps } from "./sortable-grid";

// The draggable half of <SortableGrid>, loaded on demand — import SortableGrid,
// never this file, so pages don't pay for dnd-kit up front.

// Hold still this long on a phone to pick an item up. A swipe that moves
// further than TOUCH_TOLERANCE first is a scroll, not a drag.
const TOUCH_DELAY_MS = 400;
const TOUCH_TOLERANCE_PX = 8;
// With a mouse, a press that moves this far is a drag; less is a click.
const MOUSE_DISTANCE_PX = 6;

export function SortableGridDnd<T>({ items, getId, renderItem, onReorder, className, as: Tag = "div", ...rest }: SortableGridProps<T>) {
  const ids = items.map(getId);

  // A drop ends with a mouseup, and the browser then fires a click on the
  // item under it — which would open the link just dragged. Swallow that one.
  const justDropped = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: MOUSE_DISTANCE_PX } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX } }),
    // Space only: Enter must still open the focused link.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  function onDragStart() {
    justDropped.current = true;
    navigator.vibrate?.(10); // A small buzz on Android; iOS ignores it.
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setTimeout(() => (justDropped.current = false), 0);
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setTimeout(() => (justDropped.current = false), 0)}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <Tag
          className={className}
          aria-label={rest["aria-label"]}
          onClickCapture={(e) => {
            if (!justDropped.current) return;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {items.map((item) => (
            <SortableItem key={getId(item)} id={getId(item)}>
              {renderItem(item)}
            </SortableItem>
          ))}
        </Tag>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, listeners, transform, transition, isDragging, active, index } = useSortable({ id });
  // Something in the list is held: the whole list shows it's in re-order mode.
  const sorting = active !== null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={{
        // Translate only (no scale) so the tile keeps its size while it slides.
        transform: CSS.Translate.toString(transform),
        transition,
        // Neighbours swing out of step, so the grid shimmers instead of rocking as one block.
        animationDelay: index % 2 ? "-0.16s" : "0s",
      }}
      className={cn(
        // Phones: no "Open link / Copy" menu or text selection on a long press,
        // and the page can still scroll with a swipe that starts on an item.
        "touch-manipulation select-none [-webkit-touch-callout:none]",
        // The glows follow each item's own shape (drop-shadow, not box-shadow), in the brand colour.
        sorting &&
          !isDragging &&
          "drop-shadow-[0_0_7px_color-mix(in_oklab,var(--brand)_45%,transparent)] motion-safe:animate-[sort-wiggle_0.32s_ease-in-out_infinite_alternate]",
        // Lifted: above its neighbours, bigger, brighter glow, held still.
        isDragging && "relative z-10 drop-shadow-[0_0_16px_color-mix(in_oklab,var(--brand)_70%,transparent)] motion-safe:scale-[1.06]",
      )}
      onContextMenu={(e) => e.preventDefault()}
      // Links are natively draggable on desktop, which would fight the mouse drag.
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
