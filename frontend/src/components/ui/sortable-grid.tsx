"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

// Any list the person can re-order by press-and-hold + drag (or keyboard:
// Tab to an item, Space to pick up, arrows to move, Space to drop). It only
// moves things — saving is the caller's job, usually with useSavedOrder:
//
//   const { ordered, setOrder } = useSavedOrder(`home.grid.${userId}`, ids);
//   <SortableGrid as="nav" className="grid grid-cols-3 gap-2.5"
//     items={ordered.map(byId)} getId={(i) => i.href}
//     renderItem={(i) => <Tile item={i} />} onReorder={setOrder} />
//
// The drag code (dnd-kit, ~15 KB) is fetched after the page shows. Until then
// the same items render in the same boxes, just not draggable yet, so the page
// paints as fast as before and nothing jumps when the drag code arrives.

export type SortableGridProps<T> = {
  items: T[];
  /** A stable, unique id per item (an href, a database id…). */
  getId: (item: T) => string;
  /** The item itself. Links and buttons inside still work on a normal tap. */
  renderItem: (item: T) => ReactNode;
  /** The new order of ids after a drop. */
  onReorder: (ids: string[]) => void;
  /** Layout classes for the container (grid, flex row…). */
  className?: string;
  as?: "div" | "nav" | "ul";
  "aria-label"?: string;
};

type Impl = ComponentType<SortableGridProps<unknown>>;

// Shared by every SortableGrid on every page: fetched once, then instant.
let loaded: Impl | null = null;
let loading: Promise<Impl> | null = null;
const loadImpl = () => (loading ??= import("./sortable-grid-dnd").then((m) => (loaded = m.SortableGridDnd as Impl)));

export function SortableGrid<T>(props: SortableGridProps<T>) {
  const [Impl, setImpl] = useState<Impl | null>(() => loaded);

  useEffect(() => {
    if (Impl) return;
    let alive = true;
    loadImpl().then((impl) => alive && setImpl(() => impl));
    return () => {
      alive = false;
    };
  }, [Impl]);

  if (Impl) return <Impl {...(props as SortableGridProps<unknown>)} />;

  const { items, getId, renderItem, className, as: Tag = "div" } = props;
  return (
    <Tag className={className} aria-label={props["aria-label"]}>
      {items.map((item) => (
        <div key={getId(item)}>{renderItem(item)}</div>
      ))}
    </Tag>
  );
}
