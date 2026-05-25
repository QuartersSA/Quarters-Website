import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    width: 240,
    maxHeight: null,
  });
  const popoverRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = anchorRef?.current;
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const pad = 12;

    const preferredWidth =
      style && typeof style.width === "number" ? style.width : rect.width;

    // Horizontal: align to anchor left, then clamp into viewport.
    let left = rect.left;
    const width = preferredWidth;
    const maxLeft = window.innerWidth - width - pad;
    if (left > maxLeft) {
      left = Math.max(pad, maxLeft);
    }
    if (left < pad) {
      left = pad;
    }

    // Vertical: prefer below the anchor; if the popover won't fit
    // there, flip above. If neither side has room, pin to the side
    // with more space and cap maxHeight so the popover scrolls
    // instead of falling off-screen.
    const popoverH = popoverRef.current?.offsetHeight || 0;
    const spaceBelow = viewportH - rect.bottom - pad - 8;
    const spaceAbove = rect.top - pad - 8;

    let top;
    let maxHeight = null;

    if (popoverH === 0) {
      // First render — we don't know the height yet. Place below and
      // measure on the next tick.
      top = rect.bottom + 8;
    } else if (popoverH <= spaceBelow) {
      top = rect.bottom + 8;
    } else if (popoverH <= spaceAbove) {
      top = rect.top - popoverH - 8;
    } else if (spaceBelow >= spaceAbove) {
      top = rect.bottom + 8;
      maxHeight = Math.max(160, spaceBelow);
    } else {
      maxHeight = Math.max(160, spaceAbove);
      top = rect.top - maxHeight - 8;
    }

    setPos({ top, left, width, maxHeight });
  }, [anchorRef, style]);

  useEffect(() => {
    if (!open || !mounted) {
      return;
    }

    // First pass — popoverRef may not be attached yet, so we'll
    // re-measure on the next animation frame after the children
    // mount and the popover has a real height.
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

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
      cancelAnimationFrame(raf);
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
    if (pos.maxHeight) {
      base.maxHeight = pos.maxHeight;
      base.overflowY = "auto";
    }

    if (style) {
      return { ...base, ...style };
    }
    return base;
  }, [pos.left, pos.maxHeight, pos.top, pos.width, style, zIndex]);

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
        ref={popoverRef}
        dir={dir}
        style={popoverStyle}
        className={`${ws.popover} rounded-2xl border border-white/15 shadow-2xl ${pos.maxHeight ? "" : "overflow-hidden"} ${className}`}
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
