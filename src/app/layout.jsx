"use client";

import { useEffect } from "react";
import { useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConnectionStatus from "@/components/System/ConnectionStatus";
import { Toaster } from "sonner";
import { ws } from "@/components/Workspace/ui";

const BRAND_LOGO_URL_BASE =
  "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/";

const favicon32 = `${BRAND_LOGO_URL_BASE}-/resize/32x32/-/format/png/`;
const favicon192 = `${BRAND_LOGO_URL_BASE}-/resize/192x192/-/format/png/`;

function FaviconSetter() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const upsertLink = ({ rel, href, sizes, type }) => {
      try {
        const selector = sizes
          ? `link[rel="${rel}"][sizes="${sizes}"]`
          : `link[rel="${rel}"]`;
        let link = document.head.querySelector(selector);
        if (!link) {
          link = document.createElement("link");
          link.setAttribute("rel", rel);
          if (sizes) {
            link.setAttribute("sizes", sizes);
          }
          document.head.appendChild(link);
        }
        if (type) {
          link.setAttribute("type", type);
        }
        link.setAttribute("href", href);
      } catch {
        // ignore
      }
    };

    // Standard favicons
    upsertLink({
      rel: "icon",
      href: favicon32,
      sizes: "32x32",
      type: "image/png",
    });
    upsertLink({
      rel: "icon",
      href: favicon192,
      sizes: "192x192",
      type: "image/png",
    });

    // iOS homescreen icon
    upsertLink({
      rel: "apple-touch-icon",
      href: favicon192,
    });
  }, []);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 sec – avoid redundant refetches on quick navigations
      gcTime: 5 * 60_000, // 5 min garbage-collection window
      retry: (failureCount, error) => {
        const status = Number(error?.status || error?.response?.status);
        if ([400, 401, 403, 404].includes(status)) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});

// Force <html class="dark"> for every route OUTSIDE the admin shell
// sections. Admin / HR / Workspace / Accounting / Marketing all share
// useAdminTheme (light or dark per user preference). Public routes
// (landing, /login, /employee/*, /shift-close/*) stay forced-dark
// because they're still authored as dark-only and would render
// white-on-white if the stored admin theme was 'light' when the user
// last visited.
function GlobalDarkEnforcer() {
  const location = useLocation();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const path = location?.pathname || "";
    if (
      path.startsWith("/admin") ||
      path.startsWith("/hr") ||
      path.startsWith("/workspace") ||
      path.startsWith("/accounting") ||
      path.startsWith("/marketing")
    ) {
      return;
    }
    document.documentElement.classList.add("dark");
  }, [location?.pathname]);
  return null;
}

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionStatus />
      <GlobalDarkEnforcer />
      <FaviconSetter />
      <Toaster position="top-center" richColors dir="rtl" />
      {/* color-scheme is now driven by Tailwind dark variants on
          ws.appBg, so native controls (scrollbars, pickers) follow
          the active theme. */}
      <div className={ws.appBg}>
        {children}
      </div>
    </QueryClientProvider>
  );
}
