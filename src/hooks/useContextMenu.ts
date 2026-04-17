import { useState, useCallback } from "react";

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  data?: any;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });

  const open = useCallback((e: React.MouseEvent | MouseEvent, data?: any) => {
    e.preventDefault();
    setMenu({
      visible: true,
      x: (e as MouseEvent).clientX,
      y: (e as MouseEvent).clientY,
      data,
    });
  }, []);

  const close = useCallback(() => {
    setMenu((m) => ({ ...m, visible: false }));
  }, []);

  return { menu, open, close };
}
