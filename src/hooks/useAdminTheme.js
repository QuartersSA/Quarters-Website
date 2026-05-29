"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "adminTheme"; // 'dark' | 'light'
const DEFAULT_THEME = "dark";

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

/**
 * Admin theme switcher.
 *
 * Returns:
 *   theme       — 'dark' | 'light'
 *   isDark      — convenience boolean
 *   setTheme    — explicit setter ('dark' | 'light')
 *   toggleTheme — flip between dark and light
 *
 * The hook owns the persistence + emits a `storage`-like event so
 * if two admin tabs are open they stay in sync on the next render.
 */
export default function useAdminTheme() {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(readStored());
    // Listen for changes from other tabs so a toggle in one admin
    // window reflects in another open one.
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v === "dark" || v === "light") setThemeState(v);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      writeStored(next);
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
