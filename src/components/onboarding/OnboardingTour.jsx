import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// ── Tour steps ─────────────────────────────────────────────────────────────────
// Each step can target a CSS selector or be a "modal" step (no anchor)
const ADMIN_STEPS = [
  {
    id: "welcome",
    type: "modal",
    title: "👋 Welcome to CCS Schedule!",
    body: "This quick tour will walk you through the key features of the TSU College of Computer Studies Room Scheduling System. It only takes about a minute.",
    cta: "Start Tour →",
  },
  {
    id: "sidebar",
    selector: "nav",
    placement: "right",
    title: "🧭 Sidebar Navigation",
    body: "This is your main navigation. It's organized into Main, Management, and System sections. Admin-only pages are visible only to administrators.",
  },
  {
    id: "dashboard",
    selector: "[data-tour='dashboard-stats']",
    placement: "bottom",
    title: "⊞ Dashboard at a Glance",
    body: "These cards show your real-time scheduling progress — total sections, how many are assigned, active rooms, and any hard conflicts that need attention.",
  },
  {
    id: "quick-actions",
    selector: "[data-tour='quick-actions']",
    placement: "top",
    title: "⚡ Quick Actions",
    body: "From here you can Generate a Schedule, Import data via CSV, Export the timetable as PDF or CSV, and Reset all data. These are the most common admin workflows.",
  },
  {
    id: "schedule",
    selector: "[data-tour='nav-schedule']",
    placement: "right",
    title: "📆 Schedule Timetable",
    body: "The Schedule page shows the full timetable grid. You can filter by Room, Instructor, or Section. As admin, clicking any cell lets you manually edit an assignment.",
  },
  {
    id: "conflicts",
    selector: "[data-tour='nav-conflicts']",
    placement: "right",
    title: "⚠️ Conflict Management",
    body: "If the algorithm creates conflicts (double-booked rooms or instructors), they appear here. Use Auto-Resolve or fix them one by one.",
  },
  {
    id: "management",
    selector: "[data-tour='nav-rooms']",
    placement: "right",
    title: "🏫 Data Management",
    body: "The Rooms, Faculty, Subjects, and Users pages let you manage all the data the scheduling algorithm needs. Always populate these before running a generation.",
  },
  {
    id: "algorithm",
    selector: "[data-tour='nav-algorithm']",
    placement: "right",
    title: "⚙️ Algorithm Settings",
    body: "Tune the four soft-constraint weights (Time Preference, Room Match, Compactness, Balance) before generating. Weights must add up to exactly 100%.",
  },
  {
    id: "theme",
    selector: "[data-tour='header-theme']",
    placement: "bottom",
    title: "🎨 Appearance & Theme",
    body: "You can switch between dark and light mode here. There are 14 palettes including the two TSU-branded themes — Maroon and Gold!",
  },
  {
    id: "done",
    type: "modal",
    title: "🎉 You're all set!",
    body: "That covers the essentials. You can always re-read the full User Guide from the Help section in the sidebar. Good luck with your scheduling!",
    cta: "Get Started →",
  },
];

const USER_STEPS = [
  {
    id: "welcome",
    type: "modal",
    title: "👋 Welcome to CCS Schedule!",
    body: "This quick tour will walk you through what you can see and do as a viewer in the TSU CCS Room Scheduling System.",
    cta: "Start Tour →",
  },
  {
    id: "sidebar",
    selector: "nav",
    placement: "right",
    title: "🧭 Navigation",
    body: "As a regular user, you have access to the Dashboard and Schedule pages. Admin features like Rooms, Faculty, and the Algorithm are restricted.",
  },
  {
    id: "dashboard",
    selector: "[data-tour='dashboard-stats']",
    placement: "bottom",
    title: "⊞ Dashboard",
    body: "Here you can see the current scheduling progress — how many sections have been assigned, rooms in use, and whether there are any conflicts.",
  },
  {
    id: "schedule",
    selector: "[data-tour='nav-schedule']",
    placement: "right",
    title: "📆 Schedule View",
    body: "The Schedule page lets you browse the full timetable. Filter by room, instructor, or section to find the class you're looking for.",
  },
  {
    id: "theme",
    selector: "[data-tour='header-theme']",
    placement: "bottom",
    title: "🎨 Appearance",
    body: "Customize the look and feel — toggle dark/light mode and choose from 14 color palettes including the official TSU Maroon and Gold themes.",
  },
  {
    id: "done",
    type: "modal",
    title: "🎉 You're all set!",
    body: "That's everything you need to know! Check the User Guide in the sidebar if you have questions.",
    cta: "Get Started →",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getElementRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
    bottom: rect.top + window.scrollY + rect.height,
    right: rect.left + window.scrollX + rect.width,
  };
}

const TOOLTIP_W = 300;
const TOOLTIP_H_EST = 170;
const GAP = 14;

function computeTooltipPos(rect, placement) {
  if (!rect)
    return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };

  const vw = window.innerWidth;
  const vh = window.innerHeight + window.scrollY;

  let top, left;

  if (placement === "right") {
    top = rect.top + rect.height / 2 - TOOLTIP_H_EST / 2;
    left = rect.right + GAP;
    if (left + TOOLTIP_W > vw - 16) left = rect.left - TOOLTIP_W - GAP;
  } else if (placement === "left") {
    top = rect.top + rect.height / 2 - TOOLTIP_H_EST / 2;
    left = rect.left - TOOLTIP_W - GAP;
    if (left < 16) left = rect.right + GAP;
  } else if (placement === "top") {
    top = rect.top - TOOLTIP_H_EST - GAP;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    if (top < 80) top = rect.bottom + GAP;
  } else {
    // bottom (default)
    top = rect.bottom + GAP;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    if (top + TOOLTIP_H_EST > vh - 16) top = rect.top - TOOLTIP_H_EST - GAP;
  }

  left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16));
  top = Math.max(80, top);

  return { top, left };
}

// ── Spotlight overlay ──────────────────────────────────────────────────────────
function Spotlight({ rect }) {
  if (!rect) return <div style={overlayStyle} />;

  const pad = 8;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9998,
        transition: "all 0.3s ease",
      }}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={x - window.scrollX}
            y={y - window.scrollY}
            width={w}
            height={h}
            rx={10}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.65)"
        mask="url(#spotlight-mask)"
      />
      {/* Highlight border around target */}
      <rect
        x={x - window.scrollX}
        y={y - window.scrollY}
        width={w}
        height={h}
        rx={10}
        fill="none"
        stroke="var(--accent, #C9A227)"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 0 6px var(--accent, #C9A227))" }}
      />
    </svg>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  zIndex: 9998,
  pointerEvents: "none",
};

// ── Tooltip card ───────────────────────────────────────────────────────────────
function TooltipCard({ step, pos, current, total, onNext, onSkip, isModal }) {
  return (
    <div
      style={{
        position: isModal ? "fixed" : "absolute",
        zIndex: 9999,
        width: TOOLTIP_W,
        ...(isModal
          ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
          : { top: pos.top, left: pos.left }),
        background: "var(--surface, #1d2235)",
        border: "1px solid var(--accent, #C9A227)",
        borderRadius: 14,
        boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,162,39,0.2)",
        overflow: "hidden",
        animation: "tourFadeIn 0.22s ease",
        pointerEvents: "all",
      }}
    >
      {/* Accent top bar */}
      <div
        style={{
          height: 3,
          background: "var(--accent, #C9A227)",
          borderRadius: "14px 14px 0 0",
        }}
      />

      <div style={{ padding: "16px 18px 14px" }}>
        {/* Progress dots */}
        <div
          style={{
            display: "flex",
            gap: 5,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === current ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background:
                  i === current
                    ? "var(--accent, #C9A227)"
                    : i < current
                      ? "var(--accent2, #e8c85a)"
                      : "var(--border, #2e3350)",
                transition: "all 0.2s ease",
              }}
            />
          ))}
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "var(--text3, #565b78)",
              fontFamily: "monospace",
            }}
          >
            {current + 1} / {total}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text, #e8eaf6)",
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        >
          {step.title}
        </div>

        {/* Body */}
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text2, #8b90a8)",
            lineHeight: 1.65,
            marginBottom: 16,
          }}
        >
          {step.body}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onSkip}
            style={{
              background: "none",
              border: "1px solid var(--border, #2e3350)",
              color: "var(--text3, #565b78)",
              fontSize: 11,
              padding: "5px 12px",
              borderRadius: 7,
              cursor: "pointer",
            }}
          >
            {current === total - 1 ? "Close" : "Skip Tour"}
          </button>
          <button
            onClick={onNext}
            style={{
              background: "var(--accent, #C9A227)",
              border: "none",
              color: "#1a0505",
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 16px",
              borderRadius: 7,
              cursor: "pointer",
            }}
          >
            {step.cta || (current === total - 1 ? "Finish ✓" : "Next →")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OnboardingTour({ onDone }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const steps = isAdmin ? ADMIN_STEPS : USER_STEPS;

  const [current, setCurrent] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({});
  const rafRef = useRef(null);

  const step = steps[current];
  const isModal = step.type === "modal";

  const measureTarget = useCallback(() => {
    if (isModal || !step.selector) {
      setTargetRect(null);
      return;
    }
    const rect = getElementRect(step.selector);
    setTargetRect(rect);
    if (rect) {
      setTooltipPos(computeTooltipPos(rect, step.placement));
    }
  }, [step, isModal]);

  // Re-measure on step change and on scroll/resize
  useEffect(() => {
    // Navigate to dashboard for all tour steps so elements are present
    navigate("/");
    const timer = setTimeout(measureTarget, 120);
    return () => clearTimeout(timer);
  }, [current]); // eslint-disable-line

  useEffect(() => {
    const handler = () => measureTarget();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [measureTarget]);

  const handleNext = () => {
    if (current < steps.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      onDone();
    }
  };

  const handleSkip = () => onDone();

  // Scroll target into view
  useEffect(() => {
    if (!step.selector || isModal) return;
    const el = document.querySelector(step.selector);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [current, step.selector, isModal]);

  return (
    <>
      <style>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Backdrop / spotlight */}
      {isModal ? (
        <div
          style={{ ...overlayStyle, pointerEvents: "all" }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Spotlight rect={targetRect} />
      )}

      {/* Tooltip */}
      <TooltipCard
        step={step}
        pos={tooltipPos}
        current={current}
        total={steps.length}
        onNext={handleNext}
        onSkip={handleSkip}
        isModal={isModal}
      />
    </>
  );
}
