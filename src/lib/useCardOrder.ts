import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Custom Card Order Hook
 * Allows users across all 7 modules to reorder/arrange cards manually
 * and persist their custom sequence to localStorage.
 */
export function useCardOrder<T extends { id: string }>(
  moduleKey: string,
  items: T[],
  currentSort: string
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

  const moveItem = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setOrderIds((prev) => {
        const currentList = prev.length > 0 ? [...prev] : items.map((i) => i.id);
        const idx = currentList.indexOf(id);
        if (idx === -1) return currentList;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= currentList.length) return currentList;

        const [moved] = currentList.splice(idx, 1);
        currentList.splice(targetIdx, 0, moved);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(currentList));
          } catch {}
        }
        return currentList;
      });
    },
    [items, storageKey]
  );

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

  return {
    orderIds,
    moveItem,
    applyCustomOrder,
    isCustomOrder: currentSort === 'custom',
  };
}
