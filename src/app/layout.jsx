"use client";

import { useEffect } from "react";
import { useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Force <html class="dark"> for every route OUTSIDE /admin/*. Admin
// owns its own theme via useAdminTheme (light or dark per user
// preference). Without this, navigating from admin-light to a
// non-admin page would inherit `light` on documentElement and the
// existing dark-styled marketing / employee / public pages would
// render with white text on white background.
function GlobalDarkEnforcer() {
  const location = useLocation();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const isAdmin = (location?.pathname || "").startsWith("/admin");
    if (isAdmin) return; // admin's useAdminTheme owns the class
    document.documentElement.classList.add("dark");
  }, [location?.pathname]);
  return null;
}

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
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
