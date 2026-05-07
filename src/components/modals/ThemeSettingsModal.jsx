import { useState } from "react";
import Modal from "../common/Modal";
import { PALETTES, useTheme } from "../../context/ThemeContext";

// ─── Mini palette preview card ────────────────────────────────────────────────
function PaletteCard({ palette, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isDark = palette.mode === "dark";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: "pointer",
        borderRadius: 10,
        border: isSelected
          ? `2px solid ${palette.accent}`
          : `2px solid ${hovered ? palette.accent + "70" : "transparent"}`,
        overflow: "hidden",
        transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
        transform: isSelected || hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: isSelected
          ? `0 4px 20px ${palette.accent}40`
          : hovered
            ? `0 2px 10px ${palette.accent}25`
            : "0 1px 4px rgba(0,0,0,0.15)",
        background: palette.preview[0],
      }}
    >
      {/* Mini app preview */}
      <div
        style={{
          background: palette.preview[0],
          padding: "10px 10px 8px",
          height: 80,
        }}
      >
        <div
          style={{
            height: 5,
            borderRadius: 3,
            background: palette.preview[2],
            width: "40%",
            marginBottom: 7,
            opacity: 0.9,
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {[0.9, 0.6, 0.75].map((w, i) => (
            <div
              key={i}
              style={{
                flex: w,
                height: 38,
                borderRadius: 5,
                background: palette.preview[1],
                border: `1px solid ${palette.accent}30`,
                padding: "5px 6px",
              }}
            >
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: palette.preview[2],
                  width: "70%",
                  marginBottom: 4,
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  height: 3,
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
                  marginTop: 3,
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
          background: palette.preview[1],
          borderTop: `1px solid ${palette.accent}25`,
          padding: "6px 9px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isDark ? "#fff" : "#1a1a2e",
              lineHeight: 1.2,
            }}
          >
            {palette.name}
          </div>
          <div
            style={{
              fontSize: 9,
              color: isDark ? "#ffffff55" : "#00000055",
              marginTop: 1,
            }}
          >
            {palette.description}
          </div>
        </div>
        {isSelected && (
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: palette.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
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

// ─── Settings toggle row ──────────────────────────────────────────────────────
function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
          {description}
        </div>
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 42,
          height: 24,
          borderRadius: 12,
          cursor: "pointer",
          position: "relative",
          flexShrink: 0,
          background: checked ? "var(--accent)" : "var(--surface3)",
          border: "1px solid var(--border)",
          transition: "background 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────
function SegmentedControl({ options, value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--surface3)",
        borderRadius: 8,
        padding: 3,
        gap: 2,
        border: "1px solid var(--border)",
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            padding: "5px 10px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            transition: "all 0.15s",
            background: value === opt.value ? "var(--accent)" : "transparent",
            color: value === opt.value ? "#fff" : "var(--text2)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text3)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{children}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function ThemeSettingsModal({ onClose }) {
  const {
    paletteId,
    darkPaletteId,
    lightPaletteId,
    fontSize,
    density,
    sidebarStyle,
    animationsEnabled,
    savePrefs,
  } = useTheme();

  // Local draft state — nothing applies until Save
  const [draftDark, setDraftDark] = useState(darkPaletteId);
  const [draftLight, setDraftLight] = useState(lightPaletteId);
  const [draftFontSize, setDraftFontSize] = useState(fontSize);
  const [draftDensity, setDraftDensity] = useState(density);
  const [draftSidebar, setDraftSidebar] = useState(sidebarStyle);
  const [draftAnimations, setDraftAnimations] = useState(animationsEnabled);
  const [activeTab, setActiveTab] = useState("themes");

  const darkPalettes = PALETTES.filter((p) => p.mode === "dark");
  const lightPalettes = PALETTES.filter((p) => p.mode === "light");

  const handleSave = () => {
    savePrefs({
      darkPaletteId: draftDark,
      lightPaletteId: draftLight,
      fontSize: draftFontSize,
      density: draftDensity,
      sidebarStyle: draftSidebar,
      animationsEnabled: draftAnimations,
    });
    onClose();
  };

  const hasChanges =
    draftDark !== darkPaletteId ||
    draftLight !== lightPaletteId ||
    draftFontSize !== fontSize ||
    draftDensity !== density ||
    draftSidebar !== sidebarStyle ||
    draftAnimations !== animationsEnabled;

  const tabs = [
    { id: "themes", label: "🎨 Themes" },
    { id: "display", label: "⚙️ Display" },
  ];

  return (
    <Modal isOpen onClose={onClose} size="lg">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 3,
            }}
          >
            Appearance Settings
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            Customize how CCS Schedule looks and feels.
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

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--border)",
          marginBottom: 20,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: activeTab === t.id ? "var(--accent)" : "var(--text2)",
              borderBottom:
                activeTab === t.id
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── THEMES TAB ── */}
      {activeTab === "themes" && (
        <div>
          {/* Dark section */}
          <div style={{ marginBottom: 22 }}>
            <SectionLabel>🌙 Dark Themes</SectionLabel>
            <div
              style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}
            >
              Used when dark mode is active. Currently selected:{" "}
              <strong style={{ color: "var(--accent)" }}>
                {PALETTES.find((p) => p.id === draftDark)?.name}
              </strong>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 9,
              }}
            >
              {darkPalettes.map((p) => (
                <PaletteCard
                  key={p.id}
                  palette={p}
                  isSelected={draftDark === p.id}
                  onClick={() => setDraftDark(p.id)}
                />
              ))}
            </div>
          </div>

          {/* Light section */}
          <div style={{ marginBottom: 8 }}>
            <SectionLabel>☀️ Light Themes</SectionLabel>
            <div
              style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}
            >
              Used when light mode is active. Currently selected:{" "}
              <strong style={{ color: "var(--accent)" }}>
                {PALETTES.find((p) => p.id === draftLight)?.name}
              </strong>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 9,
              }}
            >
              {lightPalettes.map((p) => (
                <PaletteCard
                  key={p.id}
                  palette={p}
                  isSelected={draftLight === p.id}
                  onClick={() => setDraftLight(p.id)}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              background: "var(--surface2)",
              borderRadius: 8,
              padding: "10px 14px",
              marginTop: 16,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text2)" }}>
              💡 <strong>Tip:</strong> Select one dark theme and one light
              theme. Use the <strong>🌙 / ☀️</strong> toggle in the header to
              instantly switch between them anytime.
            </div>
          </div>
        </div>
      )}

      {/* ── DISPLAY TAB ── */}
      {activeTab === "display" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <SectionLabel>Typography</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: 6,
                  }}
                >
                  Font Size
                </div>
                <SegmentedControl
                  value={draftFontSize}
                  onChange={setDraftFontSize}
                  options={[
                    { label: "Small", value: "small" },
                    { label: "Medium", value: "medium" },
                    { label: "Large", value: "large" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Layout</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  Density
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text3)",
                    marginBottom: 6,
                  }}
                >
                  Controls spacing between elements.
                </div>
                <SegmentedControl
                  value={draftDensity}
                  onChange={setDraftDensity}
                  options={[
                    { label: "Compact", value: "compact" },
                    { label: "Comfortable", value: "comfortable" },
                    { label: "Spacious", value: "spacious" },
                  ]}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  Sidebar Style
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text3)",
                    marginBottom: 6,
                  }}
                >
                  Show full labels or icons only.
                </div>
                <SegmentedControl
                  value={draftSidebar}
                  onChange={setDraftSidebar}
                  options={[
                    { label: "Full Labels", value: "full" },
                    { label: "Icons Only", value: "icons" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Accessibility</SectionLabel>
            <ToggleRow
              label="Animations & Transitions"
              description="Disable to reduce motion for accessibility."
              checked={draftAnimations}
              onChange={setDraftAnimations}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
          marginTop: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--text3)" }}>
          {hasChanges ? "⚠️ You have unsaved changes." : "No unsaved changes."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            style={{
              opacity: hasChanges ? 1 : 0.5,
              cursor: hasChanges ? "pointer" : "default",
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}
