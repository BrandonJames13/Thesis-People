import { useEffect, useRef } from "react";
import styles from "./Notification.module.css";
import { useNotification } from "../../context/NotificationContext";

function drawGearShape(ctx, x, y, outerR, innerR, teeth, rotation) {
  const toothAngle = (Math.PI * 2) / teeth;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = rotation + i * toothAngle - toothAngle * 0.2;
    const a1 = rotation + i * toothAngle + toothAngle * 0.2;
    const a2 = rotation + i * toothAngle + toothAngle * 0.5;
    const a3 = rotation + i * toothAngle + toothAngle * 0.7;
    if (i === 0)
      ctx.moveTo(x + Math.cos(a0) * innerR, y + Math.sin(a0) * innerR);
    else ctx.lineTo(x + Math.cos(a0) * innerR, y + Math.sin(a0) * innerR);
    ctx.lineTo(x + Math.cos(a0) * outerR, y + Math.sin(a0) * outerR);
    ctx.lineTo(x + Math.cos(a1) * outerR, y + Math.sin(a1) * outerR);
    ctx.lineTo(x + Math.cos(a1) * innerR, y + Math.sin(a1) * innerR);
    ctx.lineTo(x + Math.cos(a2) * innerR, y + Math.sin(a2) * innerR);
    ctx.lineTo(x + Math.cos(a3) * innerR, y + Math.sin(a3) * innerR);
  }
  ctx.closePath();
}

function spawnGears(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const W = canvas.width;
  const H = canvas.height;

  // Anchor point: just above the toast (bottom-right area)
  const ax = W - 175;
  const ay = H - 115;

  // Many gears: xs, xs, sm, sm, md, md, lg, xl — outline only, transparent fill
  // dir: 1 = clockwise, -1 = counter-clockwise
  const gears = [
    // xl anchor gear
    {
      x: ax + 115,
      y: ay + 10,
      outerR: 34,
      innerR: 23,
      holeR: 8,
      teeth: 13,
      speed: 0.012,
      dir: 1,
    },
    // large
    {
      x: ax + 58,
      y: ay + 5,
      outerR: 26,
      innerR: 17,
      holeR: 6,
      teeth: 10,
      speed: 0.018,
      dir: -1,
    },
    // medium
    {
      x: ax + 10,
      y: ay - 10,
      outerR: 20,
      innerR: 13,
      holeR: 5,
      teeth: 8,
      speed: 0.024,
      dir: 1,
    },
    {
      x: ax + 155,
      y: ay - 18,
      outerR: 22,
      innerR: 14,
      holeR: 6,
      teeth: 9,
      speed: 0.021,
      dir: -1,
    },
    // small
    {
      x: ax - 25,
      y: ay + 8,
      outerR: 14,
      innerR: 9,
      holeR: 4,
      teeth: 6,
      speed: 0.034,
      dir: -1,
    },
    {
      x: ax + 185,
      y: ay + 8,
      outerR: 15,
      innerR: 10,
      holeR: 4,
      teeth: 6,
      speed: 0.031,
      dir: 1,
    },
    // xs
    {
      x: ax - 45,
      y: ay - 10,
      outerR: 9,
      innerR: 6,
      holeR: 3,
      teeth: 5,
      speed: 0.052,
      dir: 1,
    },
    {
      x: ax + 32,
      y: ay - 28,
      outerR: 8,
      innerR: 5,
      holeR: 2,
      teeth: 5,
      speed: 0.058,
      dir: -1,
    },
    {
      x: ax + 88,
      y: ay - 32,
      outerR: 9,
      innerR: 6,
      holeR: 3,
      teeth: 5,
      speed: 0.055,
      dir: 1,
    },
    {
      x: ax + 140,
      y: ay - 40,
      outerR: 7,
      innerR: 5,
      holeR: 2,
      teeth: 4,
      speed: 0.065,
      dir: -1,
    },
    {
      x: ax + 200,
      y: ay - 15,
      outerR: 8,
      innerR: 5,
      holeR: 2,
      teeth: 5,
      speed: 0.06,
      dir: 1,
    },
  ];

  const STROKE_COLOR = "#3fb950";

  let rotation = 0;
  let frame;
  let elapsed = 0;
  const FADE_IN = 35;
  const HOLD = 110;
  const FADE_OUT = 45;

  function draw() {
    elapsed++;
    ctx.clearRect(0, 0, W, H);

    let alpha;
    if (elapsed <= FADE_IN) {
      alpha = elapsed / FADE_IN;
    } else if (elapsed <= FADE_IN + HOLD) {
      alpha = 1;
    } else if (elapsed <= FADE_IN + HOLD + FADE_OUT) {
      alpha = 1 - (elapsed - FADE_IN - HOLD) / FADE_OUT;
    } else {
      ctx.clearRect(0, 0, W, H);
      return;
    }

    rotation += 0.018;

    gears.forEach((g) => {
      const angle = rotation * (g.speed / 0.018) * g.dir;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Gear body — transparent fill, green outline only
      drawGearShape(ctx, g.x, g.y, g.outerR, g.innerR, g.teeth, angle);
      ctx.fillStyle = "transparent";
      ctx.fill();
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center hole — outline only
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.holeR, 0, Math.PI * 2);
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    });

    frame = requestAnimationFrame(draw);
  }

  draw();
  return () => {
    cancelAnimationFrame(frame);
    ctx.clearRect(0, 0, W, H);
  };
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
      if (notification.noGears) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cleanupRef.current = null;
      } else {
        cleanupRef.current =
          notification.type === "success"
            ? spawnGears(canvas)
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
