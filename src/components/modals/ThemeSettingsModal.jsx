import Modal from "../common/Modal";
import { PALETTES, useTheme } from "../../context/ThemeContext";

const MODE_LABELS = { dark: "🌙 Dark", light: "☀️ Light" };

export default function ThemeSettingsModal({ onClose }) {
  const { paletteId, setPaletteId } = useTheme();

  const darkPalettes = PALETTES.filter((p) => p.mode === "dark");
  const lightPalettes = PALETTES.filter((p) => p.mode === "light");

  function PaletteCard({ palette }) {
    const isActive = palette.id === paletteId;
    const isDark = palette.mode === "dark";

    return (
      <div
        onClick={() => setPaletteId(palette.id)}
        style={{
          cursor: "pointer",
          borderRadius: 10,
          border: isActive
            ? `2px solid ${palette.accent}`
            : "2px solid transparent",
          outline: isActive ? `1px solid ${palette.accent}40` : "none",
          overflow: "hidden",
          transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
          transform: isActive ? "translateY(-2px)" : "translateY(0)",
          boxShadow: isActive
            ? `0 4px 20px ${palette.accent}30`
            : "0 1px 4px rgba(0,0,0,0.15)",
          position: "relative",
        }}
      >
        {/* Mini app preview */}
        <div
          style={{
            background: palette.preview[0],
            padding: "10px 10px 8px",
            height: 90,
          }}
        >
          {/* Fake header bar */}
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: palette.preview[2],
              width: "40%",
              marginBottom: 8,
              opacity: 0.9,
            }}
          />
          {/* Fake cards */}
          <div style={{ display: "flex", gap: 5 }}>
            {[0.9, 0.6, 0.75].map((w, i) => (
              <div
                key={i}
                style={{
                  flex: w,
                  height: 42,
                  borderRadius: 5,
                  background: palette.preview[1],
                  border: `1px solid ${palette.accent}30`,
                  padding: "5px 6px",
                }}
              >
                <div
                  style={{
                    height: 5,
                    borderRadius: 2,
                    background: palette.preview[2],
                    width: "70%",
                    marginBottom: 4,
                    opacity: 0.85,
                  }}
                />
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: palette.preview[3],
                    width: "50%",
                    opacity: 0.6,
                  }}
                />
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    marginTop: 4,
                    background: isDark ? "#ffffff20" : "#00000015",
                    width: "85%",
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Label strip */}
        <div
          style={{
            backdropFilter: "blur(4px)",
            padding: "7px 10px",
            background: palette.preview[1],
            borderTop: `1px solid ${palette.accent}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isDark ? "#fff" : "#1a1a2e",
                lineHeight: 1.2,
              }}
            >
              {palette.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: isDark ? "#ffffff60" : "#00000060",
                marginTop: 1,
              }}
            >
              {palette.description}
            </div>
          </div>

          {isActive && (
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: palette.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "#fff",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
          )}
        </div>
      </div>
    );
  }

  function Section({ label, palettes }) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{label}</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {palettes.map((p) => (
            <PaletteCard key={p.id} palette={p} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Modal isOpen onClose={onClose} size="lg">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            🎨 Appearance
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            Choose a theme palette. Changes apply instantly.
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            color: "var(--text2)",
            cursor: "pointer",
            fontSize: 13,
            padding: "3px 9px",
            borderRadius: 6,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", marginBottom: 20 }} />

      <Section label="🌙 Dark Themes" palettes={darkPalettes} />
      <Section label="☀️ Light Themes" palettes={lightPalettes} />

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button className="btn btn-secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
