"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "adminTheme"; // 'dark' | 'light'
const DEFAULT_THEME = "dark";
const SAME_TAB_EVENT = "admin-theme-changed";

function readStored() {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // ignore (private mode / disabled storage)
  }
  return DEFAULT_THEME;
}

function writeStored(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

// Broadcast a same-tab event so every other useAdminTheme instance
// mounted in the page (Sidebar button, floating toggle, layout
// wrapper, login button) re-reads and stays in sync. The native
// `storage` event only fires across TABS, never within the tab that
// wrote, so without this any instance other than the one that called
// toggleTheme would render stale.
function broadcastChange(value) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(SAME_TAB_EVENT, { detail: value }),
    );
  } catch {
    // ignore
  }
}

/**
 * Admin theme switcher.
 *
 * Returns:
 *   theme       — 'dark' | 'light'
 *   isDark      — convenience boolean
 *   setTheme    — explicit setter ('dark' | 'light')
 *   toggleTheme — flip between dark and light
 *
 * Every mounted instance subscribes to the same-tab event so a
 * toggle from one location (e.g. the login floating button) flips
 * every other instance (e.g. the layout wrapper that controls the
 * `dark` class on the outermost div) on the same render cycle.
 */
export default function useAdminTheme() {
  // Lazy initializer reads localStorage on first render (client side
  // only — SSR keeps DEFAULT_THEME because window is undefined).
  // Pair this with the anti-FOUC inline script in root.tsx so the
  // first paint already has the correct `dark` class on
  // documentElement before React mounts.
  const [theme, setThemeState] = useState(readStored);

  useEffect(() => {
    // Re-read on mount in case the lazy initializer ran during SSR
    // (theme === DEFAULT_THEME) but the browser has a different
    // stored value.
    setThemeState(readStored());

    // Cross-tab sync via the native storage event.
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v === "dark" || v === "light") setThemeState(v);
    };

    // Same-tab sync via the custom event we dispatch on toggle.
    const onSameTab = (e) => {
      const v = e.detail;
      if (v === "dark" || v === "light") setThemeState(v);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(SAME_TAB_EVENT, onSameTab);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SAME_TAB_EVENT, onSameTab);
    };
  }, []);

  // Sync to <html class="dark"> so portal-rendered popovers
  // (GlassPopover, modals teleported to document.body) inherit the
  // chosen theme — they can't read the in-tree wrapper class.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    const value = next === "light" ? "light" : "dark";
    writeStored(value);
    setThemeState(value);
    broadcastChange(value);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      writeStored(next);
      broadcastChange(next);
      return next;
    });
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}
