import { useState, useEffect, useCallback } from 'react';

/**
 * Custom Card Order & Drag-and-Drop Hook
 * Allows users across all 7 modules to drag-and-drop or use up/down controls
 * to reorder/arrange cards manually and persist their custom sequence to localStorage.
 */
export function useCardOrder<T extends { id: string }>(
  moduleKey: string,
  items: T[],
  currentSort: string,
  onSortChange?: (sort: string) => void
) {
  const storageKey = `rb_card_order_${moduleKey}`;

  const [orderIds, setOrderIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Keep saved IDs in sync with existing items
  useEffect(() => {
    if (items.length > 0) {
      setOrderIds((prev) => {
        const itemIds = new Set(items.map((i) => i.id));
        const filtered = prev.filter((id) => itemIds.has(id));
        const missing = items.map((i) => i.id).filter((id) => !filtered.includes(id));
        const updated = [...filtered, ...missing];
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
    }
  }, [items, storageKey]);

  // Reorder sourceId to targetId's position (for Drag and Drop)
  const reorderItem = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || !targetId || sourceId === targetId) return;

      setOrderIds((prev) => {
        const currentList = prev.length > 0 ? [...prev] : items.map((i) => i.id);
        if (!currentList.includes(sourceId)) currentList.push(sourceId);
        if (!currentList.includes(targetId)) currentList.push(targetId);

        const sIdx = currentList.indexOf(sourceId);
        const tIdx = currentList.indexOf(targetId);
        if (sIdx === -1 || tIdx === -1) return prev;

        currentList.splice(sIdx, 1);
        const newTIdx = currentList.indexOf(targetId);
        const insertIdx = sIdx < tIdx ? newTIdx + 1 : newTIdx;
        currentList.splice(insertIdx, 0, sourceId);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(currentList));
          } catch {}
        }
        return currentList;
      });

      // Automatically activate 'custom' sort mode so changes take effect immediately
      if (currentSort !== 'custom' && onSortChange) {
        onSortChange('custom');
      }
    },
    [items, storageKey, currentSort, onSortChange]
  );

  // Move item up or down relative to visible list
  const moveItem = useCallback(
    (id: string, direction: 'up' | 'down', visibleList?: T[]) => {
      const listToUse = visibleList && visibleList.length > 0 ? visibleList : items;
      const visibleIds = listToUse.map((i) => i.id);
      const vIdx = visibleIds.indexOf(id);
      if (vIdx === -1) return;

      const targetVIdx = direction === 'up' ? vIdx - 1 : vIdx + 1;
      if (targetVIdx < 0 || targetVIdx >= visibleIds.length) return;

      const targetId = visibleIds[targetVIdx];
      reorderItem(id, targetId);
    },
    [items, reorderItem]
  );

  // Sort items according to custom orderIds sequence
  const applyCustomOrder = useCallback(
    (list: T[]): T[] => {
      if (currentSort !== 'custom') return list;
      if (orderIds.length === 0) return list;

      const orderMap = new Map<string, number>();
      orderIds.forEach((id, index) => {
        orderMap.set(id, index);
      });

      return [...list].sort((a, b) => {
        const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return indexA - indexB;
      });
    },
    [currentSort, orderIds]
  );

  // Generates HTML5 drag-and-drop properties for a card element
  const getCardDragProps = useCallback(
    (id: string) => {
      return {
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.setData('text/plain', id);
          e.dataTransfer.effectAllowed = 'move';
          setDraggedId(id);
        },
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverId !== id) {
            setDragOverId(id);
          }
        },
        onDragLeave: (e: React.DragEvent) => {
          if (dragOverId === id) {
            setDragOverId(null);
          }
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
          if (sourceId && sourceId !== id) {
            reorderItem(sourceId, id);
          }
          setDraggedId(null);
          setDragOverId(null);
        },
        onDragEnd: () => {
          setDraggedId(null);
          setDragOverId(null);
        },
        dragClasses: `${
          draggedId === id
            ? 'opacity-40 scale-[0.98] ring-2 ring-violet-500 shadow-inner'
            : dragOverId === id
            ? 'ring-2 ring-violet-500 scale-[1.01] shadow-lg'
            : ''
        }`,
      };
    },
    [draggedId, dragOverId, reorderItem]
  );

  return {
    orderIds,
    moveItem,
    reorderItem,
    applyCustomOrder,
    isCustomOrder: currentSort === 'custom',
    draggedId,
    dragOverId,
    getCardDragProps,
  };
}
