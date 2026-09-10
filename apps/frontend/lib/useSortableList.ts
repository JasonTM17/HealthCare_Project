"use client";

import { useEffect, useRef } from "react";
import Sortable from "sortablejs";

export interface UseSortableListOptions<T> {
  items: T[];
  onReorder: (newItems: T[], oldIndex: number, newIndex: number) => void;
  handle?: string;
  animation?: number;
  disabled?: boolean;
  ghostClass?: string;
  chosenClass?: string;
  dragClass?: string;
}

/**
 * Custom React hook wrapping SortableJS for smooth, glitch-free drag-and-drop.
 * Reverts the direct DOM mutation before triggering React state updates,
 * ensuring React's reconciliation retains full control over the DOM.
 */
export function useSortableList<T>({
  items,
  onReorder,
  handle = ".drag-handle",
  animation = 180,
  disabled = false,
  ghostClass = "sortable-ghost",
  chosenClass = "sortable-chosen",
  dragClass = "sortable-drag",
}: UseSortableListOptions<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef(items);
  const onReorderRef = useRef(onReorder);

  itemsRef.current = items;
  onReorderRef.current = onReorder;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const sortable = Sortable.create(el, {
      handle,
      animation,
      ghostClass,
      chosenClass,
      dragClass,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (
          oldIndex === undefined ||
          newIndex === undefined ||
          oldIndex === newIndex
        ) {
          return;
        }

        // Revert the raw DOM manipulation so React's virtual DOM reconciliation
        // applies the reordered state cleanly without duplicate or displaced nodes.
        if (evt.item && evt.from) {
          const children = Array.from(evt.from.children);
          const currentItem = evt.item;
          const targetNode = children[oldIndex];
          if (targetNode && targetNode !== currentItem) {
            if (oldIndex < newIndex) {
              evt.from.insertBefore(currentItem, targetNode);
            } else {
              evt.from.insertBefore(currentItem, targetNode.nextSibling);
            }
          }
        }

        const currentItems = [...itemsRef.current];
        const [movedItem] = currentItems.splice(oldIndex, 1);
        if (!movedItem) return;
        currentItems.splice(newIndex, 0, movedItem);

        onReorderRef.current(currentItems, oldIndex, newIndex);
      },
    });

    return () => {
      sortable.destroy();
    };
  }, [handle, animation, disabled, ghostClass, chosenClass, dragClass]);

  return { containerRef };
}
