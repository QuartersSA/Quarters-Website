import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ws } from "@/components/Workspace/ui";

/**
 * GlassPopover
 * - Renders popover content in a portal (document.body) so it won't be clipped by overflow containers.
 * - Provides click-away + Escape key close.
 * - Positioned relative to an anchorRef (usually a button).
 */
export default function GlassPopover({
  open,
  anchorRef,
  onClose,
  children,
  className = "",
  style = null,
  zIndex = 9999,
  dir = "rtl",
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = anchorRef?.current;
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();

    const preferredWidth =
      style && typeof style.width === "number" ? style.width : rect.width;

    // Basic placement: below the anchor, aligned to its left edge.
    let left = rect.left;
    const width = preferredWidth;
    const top = rect.bottom + 8; // mt-2

    // Keep within viewport with a little padding.
    const pad = 12;
    const maxLeft = window.innerWidth - width - pad;
    if (left > maxLeft) {
      left = Math.max(pad, maxLeft);
    }
    if (left < pad) {
      left = pad;
    }

    setPos({ top, left, width });
  }, [anchorRef, style]);

  useEffect(() => {
    if (!open || !mounted) {
      return;
    }

    updatePosition();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    // capture scroll from any ancestor
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [mounted, onClose, open, updatePosition]);

  const popoverStyle = useMemo(() => {
    const base = {
      position: "fixed",
      top: pos.top,
      left: pos.left,
      width: pos.width,
      zIndex,
    };

    if (style) {
      return { ...base, ...style };
    }
    return base;
  }, [pos.left, pos.top, pos.width, style, zIndex]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: zIndex - 1 }}
        onClick={() => onClose?.()}
        aria-hidden="true"
      />
      <div
        dir={dir}
        style={popoverStyle}
        className={`${ws.popover} rounded-2xl overflow-hidden border border-white/15 shadow-2xl ${className}`}
        onClick={(e) => {
          // prevent click-away closing when clicking inside
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
