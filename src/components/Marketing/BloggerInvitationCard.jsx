"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * Brand-led invitation card. Solid olive ground, cream serif wordmark,
 * minimal ornaments. Mirrors the official Quarters Bar identity.
 *
 * Presentational — accepts blogger + settings and computes the welcome
 * URL from `welcomeURL` prop (caller is responsible for it so the same
 * markup works in the printed page, in image exports, and in standalone
 * preview screens).
 *
 * Wrapped in forwardRef so callers (e.g. html-to-image exporter) can grab
 * the outer DOM node to rasterize.
 */
export const BloggerInvitationCard = React.forwardRef(
  function BloggerInvitationCard({ blogger, settings, welcomeURL }, ref) {
    const accent = settings?.accent_color || "#7a8b5f";
    const cream = settings?.cream_color || "#e8e9d6";
    const cafeName = settings?.cafe_name || "QUARTERS";
    const cafeNameAr = settings?.cafe_name_ar || "كوارتـــرز";
    const cafeTagline = settings?.cafe_tagline || "BAR";

    if (!blogger) return null;
    const b = blogger;

    return (
      <div
        ref={ref}
        className="print-card"
        style={{
          width: "100%",
          maxWidth: 460,
          position: "relative",
          borderRadius: 26,
          background: accent,
          color: cream,
          padding: "56px 38px 44px",
          textAlign: "center",
          boxShadow: `0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px ${cream}22`,
          fontFamily:
            '"Cormorant Garamond", "Playfair Display", "Times New Roman", serif',
          overflow: "hidden",
        }}
      >
        {/* Double inner border */}
        <div
          style={{
            position: "absolute",
            inset: 12,
            borderRadius: 20,
            border: `1px solid ${cream}22`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 18,
            borderRadius: 16,
            border: `1px solid ${cream}11`,
            pointerEvents: "none",
          }}
        />

        {/* Paper texture wash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at top, ${cream}12 0%, transparent 55%), radial-gradient(ellipse at bottom, ${cream}08 0%, transparent 60%)`,
            pointerEvents: "none",
          }}
        />

        {/* Decorative corner ornaments */}
        <Leaf corner="tl" cream={cream} />
        <Leaf corner="tr" cream={cream} />
        <Leaf corner="bl" cream={cream} />
        <Leaf corner="br" cream={cream} />

        {/* Wordmark */}
        <div style={{ position: "relative", marginBottom: 30 }}>
          <div
            style={{
              position: "relative",
              display: "inline-block",
            }}
          >
            <div
              style={{
                fontFamily:
                  '"Cormorant Garamond", "Playfair Display", serif',
                fontWeight: 700,
                fontSize: 58,
                letterSpacing: "0.02em",
                lineHeight: 1,
                color: cream,
              }}
            >
              {cafeName}
            </div>
            {cafeTagline ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: -22,
                  fontFamily:
                    '"Cormorant Garamond", "Playfair Display", serif',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  color: cream,
                }}
              >
                {cafeTagline}
              </div>
            ) : null}
          </div>
          {cafeNameAr ? (
            <div
              style={{
                fontFamily:
                  '"El Messiri", "Cairo", "Tahoma", sans-serif',
                fontSize: 30,
                fontWeight: 600,
                color: cream,
                marginTop: 6,
                letterSpacing: "0.05em",
              }}
            >
              {cafeNameAr}
            </div>
          ) : null}
        </div>

        <Flourish cream={cream} marginBottom={22} />

        <div
          style={{
            fontFamily:
              '"Cormorant Garamond", "Playfair Display", serif',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.55em",
            color: cream,
            opacity: 0.85,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Private Invitation
        </div>
        <div
          style={{
            fontFamily:
              '"El Messiri", "Cairo", "Tahoma", sans-serif',
            fontSize: 12,
            color: cream,
            opacity: 0.6,
            marginBottom: 24,
            letterSpacing: "0.1em",
          }}
        >
          دعوة خاصة
        </div>

        {/* Blogger name. Handle was previously rendered on a second
            line ("@…") but admins were filling it with full URLs and
            the card came out cluttered, so the handle now lives in
            the admin UI only — never on the printed/exported card. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            marginBottom: 26,
          }}
        >
          <SideMark cream={cream} />
          <div
            style={{
              fontFamily:
                '"El Messiri", "Cairo", "Tahoma", sans-serif',
              fontSize: 30,
              fontWeight: 700,
              color: cream,
              lineHeight: 1.3,
              letterSpacing: "0.01em",
            }}
          >
            {b.name}
          </div>
          <SideMark cream={cream} />
        </div>

        {/* QR */}
        <div
          style={{
            display: "inline-block",
            position: "relative",
            padding: 18,
            background: cream,
            borderRadius: 18,
            marginBottom: 24,
            boxShadow: `0 10px 28px rgba(0,0,0,0.22), inset 0 0 0 1px ${darkenForQR(accent)}1a`,
          }}
        >
          <QRCodeSVG
            value={welcomeURL || ""}
            size={196}
            level="M"
            bgColor={cream}
            fgColor={darkenForQR(accent)}
            includeMargin={false}
          />
        </div>

        {/* Hairline */}
        <div
          style={{
            width: 56,
            height: 1,
            background: `${cream}40`,
            margin: "0 auto 18px",
          }}
        />

        <div
          style={{
            fontFamily:
              '"El Messiri", "Cairo", "Tahoma", sans-serif',
            fontSize: 13,
            color: cream,
            opacity: 0.82,
            lineHeight: 1.9,
            letterSpacing: "0.02em",
          }}
        >
          امسح الكود وسلّمه للكاشير لتفعيل بطاقتك
        </div>
        <div
          style={{
            fontFamily:
              '"El Messiri", "Cairo", "Tahoma", sans-serif',
            fontSize: 12,
            color: cream,
            opacity: 0.55,
            lineHeight: 1.9,
            letterSpacing: "0.02em",
          }}
        >
          بعد التفعيل تظهر لك قائمة الضيافة
        </div>
      </div>
    );
  },
);

function Leaf({ corner, cream }) {
  const positions = {
    tl: { top: 18, left: 18, rotate: 0 },
    tr: { top: 18, right: 18, rotate: 90 },
    br: { bottom: 18, right: 18, rotate: 180 },
    bl: { bottom: 18, left: 18, rotate: 270 },
  };
  const pos = positions[corner];
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        ...pos,
        width: 26,
        height: 26,
        transform: `rotate(${pos.rotate}deg)`,
        opacity: 0.55,
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
        <path
          d="M3 21 C 8 16, 12 12, 21 3 M21 3 C 14 4, 9 7, 6 11 M21 3 C 17 9, 14 13, 11 18"
          stroke={cream}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function Flourish({ cream, marginBottom = 20 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginBottom,
      }}
    >
      <span
        style={{
          width: 56,
          height: 1,
          background: `linear-gradient(to right, transparent, ${cream}66)`,
        }}
      />
      <span
        style={{
          width: 5,
          height: 5,
          transform: "rotate(45deg)",
          background: cream,
          opacity: 0.7,
        }}
      />
      <span
        style={{
          width: 8,
          height: 1,
          background: `${cream}88`,
        }}
      />
      <span
        style={{
          width: 5,
          height: 5,
          transform: "rotate(45deg)",
          background: cream,
          opacity: 0.7,
        }}
      />
      <span
        style={{
          width: 56,
          height: 1,
          background: `linear-gradient(to left, transparent, ${cream}66)`,
        }}
      />
    </div>
  );
}

function SideMark({ cream }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        opacity: 0.6,
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: cream,
        }}
      />
      <span
        style={{
          width: 1,
          height: 14,
          background: cream,
        }}
      />
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: cream,
        }}
      />
    </div>
  );
}

/**
 * Drop the brand accent ~50% darker for QR foreground so it stays
 * scannable on the cream backdrop without losing the brand feel.
 */
export function darkenForQR(hex) {
  try {
    const m = String(hex).replace("#", "");
    const r = parseInt(m.length === 3 ? m[0] + m[0] : m.slice(0, 2), 16);
    const g = parseInt(m.length === 3 ? m[1] + m[1] : m.slice(2, 4), 16);
    const b = parseInt(m.length === 3 ? m[2] + m[2] : m.slice(4, 6), 16);
    const f = 0.35;
    const toHex = (n) =>
      Math.max(0, Math.min(255, Math.round(n * f)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return "#1c1917";
  }
}
