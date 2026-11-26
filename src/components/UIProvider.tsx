"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";

type Toast = { id: number; message: string };
type UIContextValue = {
  toast: (message: string) => void;
  uploadOpen: boolean;
  openUpload: () => void;
  closeUpload: () => void;
  inboxUpdateCount: number;
  setInboxUpdateCount: (count: number) => void;
};

const UIContext = createContext<UIContextValue>({
  toast: () => {}, uploadOpen: false, openUpload: () => {}, closeUpload: () => {},
  inboxUpdateCount: 0, setInboxUpdateCount: () => {},
});

export function useUI() { return useContext(UIContext); }

export default function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [inboxUpdateCount, setInboxUpdateCount] = useState(0);
  const counter = useRef(0);

  useEffect(() => {
    // Home already receives this data from the server. Other entry routes fetch it once,
    // after first paint, rather than blocking the shared navigation or reloading per page.
    if (window.location.pathname === "/" || window.location.pathname === "/activity") return;
    const controller = new AbortController();
    fetch("/api/activity", { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: { items?: { createdAt: string }[] } | null) => {
        if (!data?.items || controller.signal.aborted) return;
        let lastSeen = "";
        try { lastSeen = window.localStorage.getItem("sx-inbox-seen-at") ?? ""; } catch { /* Storage can be disabled. */ }
        setInboxUpdateCount(data.items.filter((item) => !lastSeen || item.createdAt > lastSeen).length);
      })
      .catch(() => { /* Notification loading must not block the current page. */ });
    return () => controller.abort();
  }, []);

  const toast = useCallback((message: string) => {
    const id = ++counter.current;
    setToasts((items) => [...items.slice(-2), { id, message }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 2600);
  }, []);
  const openUpload = useCallback(() => setUploadOpen(true), []);
  const closeUpload = useCallback(() => setUploadOpen(false), []);

  return (
    <UIContext.Provider value={{ toast, uploadOpen, openUpload, closeUpload, inboxUpdateCount, setInboxUpdateCount }}>
      {children}
      <div className="fixed bottom-20 md:bottom-20 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 pointer-events-none w-full px-4" role="status" aria-live="polite">
        {toasts.map((item) => <div key={item.id} className="animate-toast-in bg-[#3a3a3a] text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-2xl max-w-full truncate">{item.message}</div>)}
      </div>
    </UIContext.Provider>
  );
}
