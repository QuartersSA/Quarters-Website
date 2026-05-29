"use client";

import { useEffect } from "react";
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

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <FaviconSetter />
      <Toaster position="top-center" richColors dir="rtl" />
      <div
        // Safari/iOS sometimes forces light form controls unless color-scheme is dark.
        // This makes inputs, pickers, and scrollbars match our dark Workspace theme.
        style={{ colorScheme: "dark" }}
        className={ws.appBg}
      >
        {children}
      </div>
    </QueryClientProvider>
  );
}
