import { useEffect, useRef } from "react";
import styles from "./Notification.module.css";
import { useNotification } from "../../context/NotificationContext";

function spawnConfetti(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const W = canvas.width,
    H = canvas.height;
  const COLORS = [
    "#3fb950",
    "#2f81f7",
    "#bc8cff",
    "#f0c500",
    "#ff7b7b",
    "#00d4aa",
    "#ff9f43",
  ];
  const SHAPES = ["rect", "circle", "ribbon"];
  const particles = Array.from({ length: 110 }, () => {
    const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
    const speed = 6 + Math.random() * 7;
    return {
      x: W - 60 - Math.random() * 200,
      y: H - 60,
      vx: -Math.cos(angle) * speed * (0.5 + Math.random()),
      vy: -(speed + Math.random() * 5),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 5,
      r: 0,
      dr: (Math.random() - 0.5) * 0.25,
      gravity: 0.18 + Math.random() * 0.1,
      alpha: 1,
    };
  });
  let frame;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    particles.forEach((p) => {
      if (p.alpha <= 0) return;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.r += p.dr;
      if (p.y > H - 40) p.alpha -= 0.04;
      else if (p.vy > 0 && p.y > H * 0.6) p.alpha -= 0.012;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "ribbon") {
        ctx.beginPath();
        ctx.moveTo(-p.w, 0);
        ctx.bezierCurveTo(-p.w / 2, -p.h, p.w / 2, p.h, p.w, 0);
        ctx.lineWidth = 2;
        ctx.strokeStyle = p.color;
        ctx.stroke();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    });
    if (alive) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, W, H);
  }
  draw();
  return () => cancelAnimationFrame(frame);
}

function spawnShatter(canvas, type) {
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const W = canvas.width,
    H = canvas.height;
  const BASE =
    type === "error"
      ? ["#f85149", "#ff9f43", "#ff6b6b", "#c0392b", "#e74c3c"]
      : ["#8b949e", "#6e7681", "#b0b8c1", "#d29922", "#e3b341"];
  const cx = W - 60,
    cy = H - 60;
  const shards = Array.from({ length: 55 }, (_, i) => {
    const angle = (i / 55) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 2 + Math.random() * 6;
    return {
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      color: BASE[Math.floor(Math.random() * BASE.length)],
      size: 4 + Math.random() * 14,
      sides: 3 + Math.floor(Math.random() * 3),
      r: Math.random() * Math.PI * 2,
      dr: (Math.random() - 0.5) * 0.18,
      gravity: 0.12 + Math.random() * 0.1,
      alpha: 1,
    };
  });
  let frame;
  function drawPoly(c, sides, size) {
    c.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        r = size * (0.7 + Math.random() * 0.3);
      i === 0
        ? c.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        : c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    shards.forEach((s) => {
      if (s.alpha <= 0) return;
      alive = true;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += s.gravity;
      s.vx *= 0.97;
      s.r += s.dr;
      s.alpha -= 0.018;
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.r);
      ctx.fillStyle = s.color;
      drawPoly(ctx, s.sides, s.size);
      ctx.restore();
    });
    if (alive) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, W, H);
  }
  draw();
  return () => cancelAnimationFrame(frame);
}

// Step config for the progress toast
const PROGRESS_STEPS = [
  { key: "clearing", label: "Clear", pct: 10, icon: "🧹" },
  { key: "generating", label: "Generate", pct: 35, icon: "🔮" },
  { key: "saving", label: "Save", pct: 85, icon: "📡" },
  { key: "done", label: "Done", pct: 100, icon: "🎯" },
];

function ProgressToast({ step, pct }) {
  const isError = step === "error";
  const isDone = step === "done";

  const currentStep = PROGRESS_STEPS.find((s) => s.key === step);
  const icon = isError ? "⚠️" : isDone ? "🎯" : (currentStep?.icon ?? "🔮");

  const statusLabel =
    step === "clearing"
      ? "Clearing existing schedule…"
      : step === "generating"
        ? "Running algorithm…"
        : step === "saving"
          ? "Saving to database…"
          : step === "done"
            ? "Schedule generated!"
            : step === "error"
              ? "Generation failed"
              : "";

  return (
    <div
      className={`${styles.progressToast} ${isError ? styles.progressError : isDone ? styles.progressDone : styles.progressActive}`}
    >
      {/* Header row */}
      <div className={styles.progressHeader}>
        <span className={styles.progressIcon}>{icon}</span>
        <span className={styles.progressLabel}>{statusLabel}</span>
        <span className={styles.progressPct}>{pct}%</span>
      </div>

      {/* Bar track */}
      <div className={styles.progressTrack}>
        <div
          className={`${styles.progressFill} ${isError ? styles.fillError : isDone ? styles.fillDone : styles.fillActive}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step dots */}
      <div className={styles.progressSteps}>
        {PROGRESS_STEPS.map((s) => {
          const isActive = pct >= s.pct;
          const isCurrent = step === s.key;
          return (
            <div key={s.key} className={styles.stepItem}>
              <div
                className={`${styles.stepDot} ${isActive ? (isError ? styles.dotError : isDone ? styles.dotDone : styles.dotActive) : styles.dotInactive} ${isCurrent && !isError ? styles.dotPulse : ""}`}
              />
              <span
                className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ""}`}
              >
                {s.icon} {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Notification() {
  const { notification, progress } = useNotification();
  const canvasRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!notification) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    if (cleanupRef.current) cleanupRef.current();
    const canvas = canvasRef.current;
    if (canvas) {
      if (notification.noConfetti) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cleanupRef.current = null;
      } else {
        cleanupRef.current =
          notification.type === "success"
            ? spawnConfetti(canvas)
            : spawnShatter(canvas, notification.type);
      }
    }
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [notification]);

  const icon = !notification
    ? ""
    : notification.type === "error"
      ? "⚠"
      : notification.type === "delete"
        ? "🗑"
        : "✓";
  const text = notification ? notification.text.replace(/^⚠\s*/, "") : "";

  return (
    <>
      <canvas ref={canvasRef} className={styles.canvas} />
      {notification && (
        <div
          className={`${styles.toast} ${styles[notification.type]} ${styles.show}`}
        >
          <span className={styles.icon}>{icon}</span>
          <span>{text}</span>
        </div>
      )}
      {progress && <ProgressToast step={progress.step} pct={progress.pct} />}
    </>
  );
}
