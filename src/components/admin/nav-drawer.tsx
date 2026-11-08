"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type NavDrawer = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };

const Ctx = createContext<NavDrawer>({ open: false, setOpen: () => {}, toggle: () => {} });

/** Below `lg` the sidebar becomes a slide-in drawer; this holds whether it is open. */
export function NavDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Desktop width: the sidebar is always shown, so drop the drawer state.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      document.body.style.overflow = "";
    };
  }, [open]);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNavDrawer = () => useContext(Ctx);
