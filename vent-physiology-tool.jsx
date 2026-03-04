import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";

// ─── Constants & Helpers ───
const COLORS = {
  bg: "#0a0e17",
  card: "#111827",
  cardBorder: "#1e293b",
  accent: "#38bdf8",
  accentDim: "#0c4a6e",
  green: "#34d399",
  greenDim: "#064e3b",
  red: "#f87171",
  redDim: "#7f1d1d",
  yellow: "#fbbf24",
  yellowDim: "#78350f",
  purple: "#a78bfa",
  purpleDim: "#4c1d95",
  orange: "#fb923c",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  textMuted: "#64748b",
};

// ─── Glossary Data ───
const GLOSSARY = {
  "PEEP": { full: "Positive End-Expiratory Pressure", detail: "Pressure maintained in airways at end of exhalation to prevent alveolar collapse." },
  "Pplat": { full: "Plateau Pressure", detail: "Pressure measured during end-inspiratory hold. Reflects alveolar pressure. Target ≤ 30 cmH₂O." },
  "Ppeak": { full: "Peak Airway Pressure", detail: "Highest pressure during inspiration. Includes both resistive and elastic components." },
  "ΔP": { full: "Driving Pressure", detail: "Pplat − total PEEP. Tidal volume normalized to functional lung size. Target ≤ 14 cmH₂O." },
  "Pres": { full: "Resistive Pressure", detail: "Ppeak − Pplat. Reflects airway resistance. Elevated with bronchospasm, mucus, kinked ETT." },
  "Pcond": { full: "Conductive Pressure", detail: "Abrupt pressure rise at onset of insufflation before significant volume entry. Equals Pres when no auto-PEEP or AOP." },
  "AOP": { full: "Airway Opening Pressure", detail: "Pressure at which collapsed airways open during insufflation. If present, set PEEP ≥ AOP." },
  "PEEPi": { full: "Intrinsic PEEP (auto-PEEP)", detail: "Trapped pressure from incomplete exhalation. PEEPtot − set PEEP. Causes missed triggers and overestimated ΔP." },
  "PEEPtot": { full: "Total PEEP", detail: "Set PEEP + intrinsic PEEP. Measured via end-expiratory hold." },
  "C_RS": { full: "Respiratory System Compliance", detail: "Volume change per unit pressure change (mL/cmH₂O). Low in ARDS, fibrosis. Normal ~50-80." },
  "R_RS": { full: "Respiratory System Resistance", detail: "Pressure required to generate flow (cmH₂O/L/s). High in asthma, COPD. Normal 5-10." },
  "E_RS": { full: "Respiratory System Elastance", detail: "Inverse of compliance (1/C_RS). Higher = stiffer lungs." },
  "Vt": { full: "Tidal Volume", detail: "Volume of gas delivered per breath. Target 6-8 mL/kg IBW." },
  "IBW": { full: "Ideal Body Weight", detail: "Weight calculated from height and sex. Used to calculate Vt. NOT actual body weight." },
  "RR": { full: "Respiratory Rate", detail: "Breaths per minute set on ventilator." },
  "FiO₂": { full: "Fraction of Inspired Oxygen", detail: "Percentage of oxygen in delivered gas. Start 100%, wean to < 60%." },
  "MP": { full: "Mechanical Power", detail: "Total energy per minute delivered to respiratory system (J/min). Threshold concern > 17 J/min." },
  "τ": { full: "Time Constant (tau)", detail: "C_RS × R_RS in seconds. After 3τ, 95% of tidal volume is exhaled." },
  "R/I": { full: "Recruitment-to-Inflation Ratio", detail: "Recruited volume divided by passively inflated volume during PEEP step-down. > 0.5 = high recruitability." },
  "SI": { full: "Stress Index", detail: "Exponent b in Paw = a × time^b + c. 0.9-1.1 = linear (desired). < 0.9 = recruitment. > 1.1 = overdistension." },
  "ACV": { full: "Assist-Control Ventilation", detail: "Mode where every breath (triggered or mandatory) gets full set volume/pressure." },
  "VILI": { full: "Ventilator-Induced Lung Injury", detail: "Damage caused by inappropriate ventilator settings (excessive volume, pressure, or power)." },
  "ARDS": { full: "Acute Respiratory Distress Syndrome", detail: "Acute hypoxemic respiratory failure with bilateral opacities not fully explained by cardiac failure." },
  "SBT": { full: "Spontaneous Breathing Trial", detail: "Test of patient's ability to breathe with minimal or no vent support. Used to assess extubation readiness." },
  "ETT": { full: "Endotracheal Tube", detail: "Tube placed in trachea for mechanical ventilation." },
  "Resistance": { full: "Airway Resistance", detail: "Opposition to airflow in the conducting airways (cmH₂O/L/s). Increased by bronchospasm, secretions, narrow ETT, or kinked tubing. Seen as wider P-V loop and elevated Ppeak − Pplat." },
  "Overdistension": { full: "Alveolar Overdistension", detail: "Excessive stretching of alveoli at high volumes/pressures. P-V loop shows upper flattening (beak). Raises VILI risk. Reduce Vt or PEEP." },
  "Air Trapping": { full: "Air Trapping (Auto-PEEP)", detail: "Incomplete exhalation before next breath causes gas to accumulate. P-V loop fails to return to baseline. Common in COPD/asthma. Increase expiratory time or reduce RR." },
  "PaCO₂": { full: "Partial Pressure of Arterial CO₂", detail: "Normal 35-45 mmHg. Reflects adequacy of ventilation (minute ventilation)." },
  "PaO₂": { full: "Partial Pressure of Arterial O₂", detail: "Normal 80-100 mmHg on room air. Reflects oxygenation." },
  "SpO₂": { full: "Peripheral Oxygen Saturation", detail: "Pulse oximetry reading. Target 92-96% in most ventilated patients." },
  "SIMV": { full: "Synchronized Intermittent Mandatory Ventilation", detail: "Mode delivering set mandatory breaths synchronized to patient effort; spontaneous breaths receive PS only." },
  "SAT": { full: "Spontaneous Awakening Trial", detail: "Protocolized daily sedation hold to assess wakefulness. Paired with SBT to reduce vent days." },
  "PE": { full: "Pulmonary Embolism", detail: "Blood clot in pulmonary vasculature. Common cause of unexplained tachypnea and hypoxemia." },
};

// ─── Active Tooltip Context (singleton — only one tooltip open at a time) ───
const ActiveTooltipContext = createContext([null, () => { }]);
function ActiveTooltipProvider({ children }) {
  const state = useState(null);
  return <ActiveTooltipContext.Provider value={state}>{children}</ActiveTooltipContext.Provider>;
}

const lerp = (a, b, t) => a + (b - a) * t;

// ─── Responsive Hooks ───
function useContainerWidth(ref) {
  const [width, setWidth] = useState(300);
  useEffect(() => {
    if (!ref.current) return;
    const update = () => setWidth(Math.floor(ref.current.getBoundingClientRect().width));
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    update();
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 480);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── Waveform Drawing Helpers ───
function drawGrid(ctx, w, h) {
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 0.5;
  const gx = Math.max(25, w / 13);
  const gy = Math.max(18, h / 6);
  for (let x = 0; x < w; x += gx) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += gy) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function generateAcvPressureWave(params) {
  const { peep, ppeak, pplat, rr, ieRatio, ti, stressIndex, hasAutopeep } = params;
  const points = [];
  const totalCycle = 60 / rr;
  const tInsp = ti;
  const tExp = totalCycle - tInsp;
  const steps = 300;

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * totalCycle;
    let p;
    if (t < tInsp * 0.05) {
      // rapid rise
      p = lerp(hasAutopeep ? peep + 3 : peep, ppeak, t / (tInsp * 0.05));
    } else if (t < tInsp * 0.1) {
      // settle from peak to plateau region
      p = lerp(ppeak, pplat + (ppeak - pplat) * 0.3, (t - tInsp * 0.05) / (tInsp * 0.05));
    } else if (t < tInsp) {
      // plateau with stress index curvature
      const frac = (t - tInsp * 0.1) / (tInsp * 0.9);
      const base = pplat;
      if (stressIndex < 0.95) {
        // convex upward = recruitment
        p = base - 2 * Math.sin(frac * Math.PI);
      } else if (stressIndex > 1.05) {
        // concave upward = overdistension
        p = base + 2 * Math.sin(frac * Math.PI);
      } else {
        p = base;
      }
    } else {
      // expiration
      const expFrac = (t - tInsp) / tExp;
      const endP = hasAutopeep ? peep + 3 : peep;
      p = pplat * Math.exp(-4 * expFrac) + endP * (1 - Math.exp(-4 * expFrac));
    }
    points.push({ t, p });
  }
  return points;
}

function generateFlowWave(params) {
  const { peep, rr, ti, peakFlow, hasAutopeep } = params;
  const points = [];
  const totalCycle = 60 / rr;
  const tExp = totalCycle - ti;
  const steps = 300;

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * totalCycle;
    let f;
    if (t < ti * 0.02) {
      f = lerp(0, peakFlow, t / (ti * 0.02));
    } else if (t < ti) {
      f = peakFlow; // constant flow in ACV
    } else if (t < ti + 0.05) {
      f = lerp(peakFlow, 0, (t - ti) / 0.05);
    } else if (t < ti + 0.08) {
      f = lerp(0, -peakFlow * 0.8, (t - ti - 0.05) / 0.03);
    } else {
      const expFrac = (t - ti - 0.08) / (tExp - 0.08);
      const endFlow = hasAutopeep ? -peakFlow * 0.05 : 0;
      f = -peakFlow * 0.8 * Math.exp(-4 * expFrac) + endFlow;
    }
    points.push({ t, f });
  }
  return points;
}

function generateVolumeWave(params) {
  const { vt, rr, ti } = params;
  const points = [];
  const totalCycle = 60 / rr;
  const tExp = totalCycle - ti;
  const steps = 300;

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * totalCycle;
    let v;
    if (t < ti) {
      v = (t / ti) * vt;
    } else {
      const expFrac = (t - ti) / tExp;
      v = vt * Math.exp(-3.5 * expFrac);
    }
    points.push({ t, v });
  }
  return points;
}

// ─── P-V Loop Generator ───
const PV_SCENARIOS = {
  normal: { label: "Normal", crs: 60, rrs: 8, alpha: 0.05, beta: 0.05, color: COLORS.green },
  earlyArds: { label: "Early ARDS", crs: 25, rrs: 12, alpha: 0.15, beta: 0.35, color: COLORS.red },
  fibroproliferative: { label: "Late Fibroprolif.", crs: 20, rrs: 10, alpha: 0.4, beta: 0.05, color: COLORS.purple },
  copd: { label: "COPD", crs: 80, rrs: 22, alpha: 0.05, beta: 0.05, color: COLORS.orange },
};

function generatePVLoop({ peep, vt, crs, rrs, peakFlow = 60, alpha, beta }) {
  const insp = [];
  const exp = [];
  const steps = 120;
  const flowLps = peakFlow / 60; // L/min → L/s

  // Effective compliance at volume v (mL), returns mL/cmH₂O
  const cEff = (v) => {
    const frac = v / vt;
    return Math.max(5, crs * (1 - alpha * frac * frac + beta * frac));
  };

  // Shared elastic pressure via cumulative integration of dv/C_eff(v)
  const elasticSteps = 200;
  const elasticTable = new Float64Array(elasticSteps + 1);
  elasticTable[0] = 0;
  for (let i = 1; i <= elasticSteps; i++) {
    const v = (i / elasticSteps) * vt;
    const dv = vt / elasticSteps;
    elasticTable[i] = elasticTable[i - 1] + dv / cEff(v);
  }
  const elasticP = (v) => {
    const idx = Math.min(elasticSteps, Math.max(0, (v / vt) * elasticSteps));
    const lo = Math.floor(idx), hi = Math.min(elasticSteps, lo + 1);
    const t = idx - lo;
    return elasticTable[lo] * (1 - t) + elasticTable[hi] * t;
  };

  // ── Visible resistance at Y-piece ──
  // Only a fraction of R_RS creates visible pressure offset in the P-V loop
  // (ETT and circuit resistance dominate the proximal pressure measurement)
  const rVis = rrs * 0.35;

  // ── Inspiration: V from 0 → Vt ──
  // Flow envelope: sqrt(frac) — creates smooth rightward banana curvature
  // Offset is 0 at V=0 (converges with exp), max at V=Vt (creates Ppeak)
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const v = frac * vt;
    const flowEnvelope = Math.pow(frac, 0.5);
    const p = peep + elasticP(v) + rVis * flowLps * flowEnvelope;
    insp.push({ p, v });
  }

  // ── End-inspiratory pause: Ppeak drops to Pplat at constant Vt ──
  const ppeak = insp[insp.length - 1].p;
  const pplat = peep + elasticP(vt);

  // ── Expiration: compliance curve with small leftward offset ──
  // Mirror curvature: sqrt(v/vt) — max offset near top, zero at bottom
  // Exp peak flow ≈ 60% of insp flow (longer exp time)
  const expFlowPeak = flowLps * 0.6;

  // Start at Pplat (end-insp pause, no flow)
  exp.push({ p: pplat, v: vt });

  // Trace downward: offset follows sqrt envelope for curvature
  for (let i = 1; i <= steps; i++) {
    const v = vt * (1 - i / steps);
    const flowEnvelope = Math.pow(v / vt, 0.5);
    const resistiveOffset = rVis * expFlowPeak * flowEnvelope;
    const p = peep + elasticP(v) - resistiveOffset;
    exp.push({ p: Math.max(peep, p), v });
  }

  // Loop area = resistive work (area between insp and exp curves)
  let areaInsp = 0;
  for (let i = 1; i < insp.length; i++) {
    areaInsp += 0.5 * (insp[i].p + insp[i - 1].p) * (insp[i].v - insp[i - 1].v);
  }
  let areaExp = 0;
  for (let i = 1; i < exp.length; i++) {
    areaExp += 0.5 * (exp[i].p + exp[i - 1].p) * (exp[i].v - exp[i - 1].v);
  }
  const loopArea = Math.abs(areaInsp - areaExp);

  // Dynamic compliance: slope of mid-portion of inspiratory limb
  const mid = Math.floor(steps * 0.3);
  const top = Math.floor(steps * 0.7);
  const dynC = (insp[top].v - insp[mid].v) / (insp[top].p - insp[mid].p);

  return { insp, exp, loopArea, dynC, ppeak, pplat };
}

// ─── Breath Animation Hook ───
function useBreathAnimation(rr) {
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  useEffect(() => {
    if (!playing) { rafRef.current && cancelAnimationFrame(rafRef.current); return; }
    const breathDuration = (60 / rr) * 1000; // ms
    const tick = (now) => {
      if (document.hidden) { rafRef.current = requestAnimationFrame(tick); return; }
      if (!lastRef.current) lastRef.current = now;
      const dt = now - lastRef.current;
      lastRef.current = now;
      setPhase(prev => {
        const next = prev + dt / breathDuration;
        return next >= 1 ? next - 1 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    const onVis = () => { if (document.hidden) lastRef.current = null; };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(rafRef.current); document.removeEventListener("visibilitychange", onVis); lastRef.current = null; };
  }, [playing, rr]);

  return { breathPhase: phase, isPlaying: playing, toggle: () => setPlaying(p => !p) };
}

// ─── Deterministic Acini Generator ───
function generateAcini(n) {
  const acini = [];
  // Simple seeded LCG for deterministic jitter
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < n; i++) {
    const base = (i / n) * 28;
    const jitter = (rand() - 0.5) * (28 / n) * 0.8;
    acini.push({ id: i, pcrit: Math.max(0, Math.min(28, base + jitter)), row: Math.floor(i / 10), col: i % 10 });
  }
  return acini;
}

// ─── Acinar State Computation (plain function — NOT memoized, called per frame) ───
function getAcinarStates(acini, peep, vt, crs, breathPhase) {
  // Simplified sinusoidal breath: pressure rises during insp (phase 0–0.4), falls during exp (0.4–1)
  const inspFrac = 0.4;
  const pPlateau = peep + vt / crs;
  let paw;
  if (breathPhase < inspFrac) {
    paw = peep + (pPlateau - peep) * Math.sin((breathPhase / inspFrac) * Math.PI * 0.5);
  } else {
    const expPhase = (breathPhase - inspFrac) / (1 - inspFrac);
    paw = peep + (pPlateau - peep) * Math.cos(expPhase * Math.PI * 0.5);
  }

  let recruited = 0, transitional = 0, derecruited = 0;
  const states = acini.map(a => {
    if (a.pcrit <= peep) { recruited++; return { ...a, state: "recruited" }; }
    if (a.pcrit > pPlateau) { derecruited++; return { ...a, state: "derecruited" }; }
    transitional++;
    return { ...a, state: paw >= a.pcrit ? "transitional-open" : "transitional-closed" };
  });
  return { states, recruited, transitional, derecruited, paw, pPlateau };
}

// ─── Canvas Waveform Component ───
function WaveformCanvas({ data, yLabel, yMin, yMax, color, aspectRatio = 0.27, annotations, zeroLine }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const w = useContainerWidth(containerRef);
  const h = Math.max(80, Math.round(w * aspectRatio));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length || w < 10) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h);

    const fs = Math.max(9, Math.round(w * 0.022));

    // y-axis label
    ctx.save();
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `${fs}px 'JetBrains Mono', monospace`;
    ctx.translate(fs, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    const padL = fs * 2.8, padR = 8, padT = 8, padB = fs * 2;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const yKey = Object.keys(data[0]).find(k => k !== "t");
    const mapX = (t) => padL + (t / data[data.length - 1].t) * plotW;
    const mapY = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // zero line
    if (zeroLine !== undefined) {
      ctx.strokeStyle = COLORS.textMuted;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, mapY(zeroLine));
      ctx.lineTo(w - padR, mapY(zeroLine));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((pt, i) => {
      const x = mapX(pt.t);
      const y = mapY(pt[yKey]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // fill under curve
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = color;
    ctx.lineTo(mapX(data[data.length - 1].t), mapY(zeroLine ?? yMin));
    ctx.lineTo(mapX(data[0].t), mapY(zeroLine ?? yMin));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // annotations with background pill
    if (annotations) {
      ctx.font = `bold ${fs}px 'JetBrains Mono', monospace`;
      annotations.forEach(a => {
        const x = mapX(a.t);
        const y = mapY(a.val);
        const label = a.label;
        const tw = ctx.measureText(label).width;
        const px = 3, py = 2;
        // pill background
        ctx.fillStyle = "rgba(13,17,23,0.85)";
        const rx = x + 4, ry = y - fs - py * 2 - 2;
        ctx.beginPath();
        ctx.roundRect(rx, ry, tw + px * 2, fs + py * 2, 3);
        ctx.fill();
        // label
        ctx.fillStyle = a.color || COLORS.yellow;
        ctx.textAlign = "left";
        ctx.fillText(label, rx + px, ry + fs + py - 2);
        // dot
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, fs * 0.35), 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Y axis ticks
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `${Math.max(8, fs - 1)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "right";
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = yMin + (yMax - yMin) * (i / ySteps);
      ctx.fillText(Math.round(val), padL - 3, mapY(val) + fs * 0.35);
    }
  }, [data, yMin, yMax, color, w, h, annotations, zeroLine, yLabel]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", borderRadius: 8, background: "#0d1117", border: `1px solid ${COLORS.cardBorder}` }}
      />
    </div>
  );
}

// ─── Slider Component ───
function Slider({ label, value, min, max, step, onChange, unit, color = COLORS.accent }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: "clamp(11px, 2.5vw, 12px)", color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
        <span style={{ fontSize: "clamp(11px, 2.5vw, 12px)", color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
          {value}{unit}
        </span>
      </div>
      <div style={{ padding: "8px 0" }}>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: "100%", height: 6, appearance: "none", WebkitAppearance: "none",
            background: `linear-gradient(to right, ${color} ${((value - min) / (max - min)) * 100}%, ${COLORS.cardBorder} ${((value - min) / (max - min)) * 100}%)`,
            borderRadius: 3, outline: "none", cursor: "pointer", accentColor: color,
            WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
          }}
        />
      </div>
    </div>
  );
}

// ─── Metric Badge ───
function Metric({ label, value, unit, color = COLORS.accent, warn }) {
  return (
    <div style={{
      background: warn ? `${COLORS.redDim}44` : `${color}11`,
      border: `1px solid ${warn ? COLORS.red + "44" : color + "33"}`,
      borderRadius: 8, padding: "8px 10px", textAlign: "center",
      flex: "1 1 auto", minWidth: 0,
    }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: "clamp(14px, 4vw, 20px)", fontWeight: 800, color: warn ? COLORS.red : color, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}<span style={{ fontSize: 11, color: COLORS.textDim }}> {unit}</span>
      </div>
    </div>
  );
}

// ─── Tab Button ───
function TabBtn({ active, children, onClick, color = COLORS.accent, compact }) {
  return (
    <button onClick={onClick} style={{
      padding: compact ? "8px 4px" : "10px 16px", borderRadius: 6, border: `1px solid ${active ? color : COLORS.cardBorder}`,
      background: active ? `${color}22` : "transparent", color: active ? color : COLORS.textDim,
      fontFamily: "'JetBrains Mono', monospace", fontSize: compact ? 11 : 12, fontWeight: active ? 700 : 400,
      cursor: "pointer", transition: "all 0.2s",
      minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
      WebkitTapHighlightColor: "transparent",
    }}>
      {children}
    </button>
  );
}

// ─── Equation Box ───
function EqBox({ children }) {
  return (
    <div style={{
      background: "#0d1117", border: `1px solid ${COLORS.cardBorder}`, borderRadius: 8,
      padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: "clamp(11px, 2.5vw, 13px)",
      color: COLORS.accent, textAlign: "center", margin: "8px 0",
      overflowX: "auto", WebkitOverflowScrolling: "touch",
    }}>
      {children}
    </div>
  );
}

// ─── Info Callout ───
function Callout({ type = "info", children }) {
  const colorMap = { info: COLORS.accent, warn: COLORS.yellow, danger: COLORS.red, success: COLORS.green };
  const c = colorMap[type];
  const icons = { info: "ℹ", warn: "⚠", danger: "🚨", success: "✓" };
  return (
    <div style={{
      background: `${c}11`, border: `1px solid ${c}33`, borderRadius: 8,
      padding: "10px 14px", fontSize: "clamp(11px, 2.5vw, 12px)", color: COLORS.text, lineHeight: 1.6,
      display: "flex", gap: 10, alignItems: "flex-start", margin: "10px 0",
      wordBreak: "break-word", overflowWrap: "break-word",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// ─── Term Tooltip Component ───
let termIdCounter = 0;
function Term({ abbr, full, detail, children }) {
  const glossEntry = GLOSSARY[abbr] || {};
  const resolvedFull = full || glossEntry.full || abbr;
  const resolvedDetail = detail || glossEntry.detail;
  const [activeId, setActiveId] = useContext(ActiveTooltipContext);
  const [myId] = useState(() => `term-${++termIdCounter}`);
  const [show, setShow] = useState(false);
  const [flipBelow, setFlipBelow] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0, bottom: 0 });
  const wrapperRef = useRef(null);
  const hoverTimer = useRef(null);
  const isOpen = activeId === myId && show;

  // Capture wrapper position for fixed tooltip placement
  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setTooltipPos({
      left: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
    });
    setFlipBelow(rect.top < 80);
  }, []);

  const open = useCallback(() => {
    updatePosition();
    setAnimating(true);
    setShow(true);
    setActiveId(myId);
    setTimeout(() => setAnimating(false), 150);
  }, [myId, setActiveId, updatePosition]);

  const close = useCallback(() => {
    setShow(false);
    setActiveId(prev => prev === myId ? null : prev);
  }, [myId, setActiveId]);

  // Close when another tooltip opens
  useEffect(() => {
    if (activeId !== myId && show) setShow(false);
  }, [activeId, myId, show]);

  // Desktop: hover with 200ms delay
  const handleMouseEnter = useCallback(() => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(open, 200);
  }, [open]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    close();
  }, [close]);

  // Mobile: tap toggle
  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen) close(); else open();
  }, [isOpen, open, close]);

  // Click-outside listener when open (mobile dismiss)
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) close();
    };
    document.addEventListener("touchstart", handleOutside, true);
    document.addEventListener("mousedown", handleOutside, true);
    return () => {
      document.removeEventListener("touchstart", handleOutside, true);
      document.removeEventListener("mousedown", handleOutside, true);
    };
  }, [isOpen, close]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const arrowSize = 6;
  const tooltipStyle = {
    position: "fixed",
    left: tooltipPos.left,
    transform: `translateX(-50%) translateY(${animating ? (flipBelow ? "4px" : "-4px") : "0"})`,
    ...(flipBelow
      ? { top: tooltipPos.bottom + arrowSize + 2 }
      : { bottom: window.innerHeight - tooltipPos.top + arrowSize + 2 }),
    width: "min(280px, 90vw)",
    maxWidth: "min(280px, 90vw)",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 14px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    zIndex: 50,
    pointerEvents: animating ? "none" : "auto",
    opacity: animating ? 0 : 1,
    transition: "opacity 150ms ease-out, transform 150ms ease-out",
    whiteSpace: "normal",
    textAlign: "left",
  };

  const arrowStyle = {
    position: "absolute",
    left: "50%",
    marginLeft: -arrowSize,
    width: 0,
    height: 0,
    borderLeft: `${arrowSize}px solid transparent`,
    borderRight: `${arrowSize}px solid transparent`,
    ...(flipBelow
      ? { top: -arrowSize, borderBottom: `${arrowSize}px solid #1e293b` }
      : { bottom: -arrowSize, borderTop: `${arrowSize}px solid #1e293b` }),
  };

  return (
    <span
      ref={wrapperRef}
      style={{ display: "inline" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <span style={{
        borderBottom: "1px dotted rgba(148,163,184,0.5)",
        cursor: "help",
      }}>
        {children || abbr}
      </span>
      {isOpen && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, lineHeight: 1.4 }}>
            {resolvedFull}
          </div>
          {resolvedDetail && (
            <div style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>
              {resolvedDetail}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

// ─── MODULES ───

// ─── MODULE 0: VENT BASICS ───
function ModuleBasics() {
  const isMobile = useIsMobile();
  const [section, setSection] = useState("why");
  const [initSex, setInitSex] = useState("male");
  const [initHeight, setInitHeight] = useState(170);
  const [initIndication, setInitIndication] = useState("ards");

  const ibw = initSex === "male" ? 50 + 0.91 * (initHeight - 152.4) : 45.5 + 0.91 * (initHeight - 152.4);

  const indications = {
    ards: { vt: Math.round(ibw * 6), rr: 20, peep: 12, fio2: 100, mode: "AC/VC", notes: "Start 6 mL/kg IBW. ARDSNet protocol. Target Pplat ≤ 30. Titrate PEEP/FiO₂ by table." },
    copd: { vt: Math.round(ibw * 8), rr: 12, peep: 5, fio2: 40, mode: "AC/VC", notes: "Higher Vt ok (8 mL/kg). Low RR for long expiratory time (prevent auto-PEEP). Watch for dynamic hyperinflation." },
    postop: { vt: Math.round(ibw * 7), rr: 14, peep: 5, fio2: 40, mode: "AC/VC", notes: "Standard lung-protective. Wean FiO₂ to SpO₂ 92-96%. Plan early extubation." },
    overdose: { vt: Math.round(ibw * 7), rr: 14, peep: 5, fio2: 40, mode: "AC/VC", notes: "Protect the airway. Standard settings. Monitor for aspiration. Plan SBT when mental status improves." },
    status: { vt: Math.round(ibw * 6), rr: 10, peep: 0, fio2: 100, mode: "AC/VC", notes: "Low RR (10-12), long I:E (1:4-1:5). ZERO or low PEEP initially. Watch for auto-PEEP & breath stacking. Permissive hypercapnia ok." },
  };

  const setting = indications[initIndication];

  const sectionKeys = ["why", "anatomy", "modes", "settings", "safety", "board"];
  const sectionLabels = { why: "Why Ventilate?", anatomy: "Breath Cycle", modes: "Modes", settings: "Initial Settings", safety: "Safety & Alarms", board: "Board Essentials" };

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 4px", fontFamily: "'Space Grotesk', sans-serif" }}>
        🫁 Ventilator Fundamentals
      </h3>
      <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px" }}>
        Start here if you're a resident. The basics every intern needs before touching a ventilator.
      </p>

      {/* Sub-navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {sectionKeys.map((key, i) => (
          <button key={key} onClick={() => setSection(key)} style={{
            padding: "6px 12px", borderRadius: 20, fontSize: 11,
            border: `1px solid ${section === key ? COLORS.accent : COLORS.cardBorder}`,
            background: section === key ? `${COLORS.accent}18` : "transparent",
            color: section === key ? COLORS.accent : COLORS.textDim,
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontWeight: section === key ? 700 : 400,
          }}>
            {i + 1}. {sectionLabels[key]}
          </button>
        ))}
      </div>

      {/* ── WHY VENTILATE ── */}
      {section === "why" && (
        <div>
          <p style={bStyles.p}>A mechanical ventilator does two things: pushes air in (positive-pressure ventilation) and holds pressure at end-expiration (<Term abbr="PEEP">PEEP</Term>) to keep alveoli open. That's it. Everything else is settings and modes.</p>

          <div style={bStyles.box}>
            <div style={bStyles.boxTitle}>The Two Reasons You Intubate</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 8 }}>
              <div style={{ ...bStyles.miniCard, borderColor: COLORS.red + "44" }}>
                <div style={{ color: COLORS.red, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>1. Failure to Oxygenate</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
                  SpO₂ {"<"} 88% despite max supplemental O₂. The problem is V/Q mismatch or shunt — you need <Term abbr="PEEP">PEEP</Term> and <Term abbr="FiO₂">FiO₂</Term>.
                </div>
              </div>
              <div style={{ ...bStyles.miniCard, borderColor: COLORS.purple + "44" }}>
                <div style={{ color: COLORS.purple, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>2. Failure to Ventilate</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
                  Rising CO₂, respiratory acidosis, fatigue, or airway protection. You need tidal volume and respiratory rate.
                </div>
              </div>
            </div>
          </div>

          <div style={bStyles.box}>
            <div style={bStyles.boxTitle}>Common Intubation Indications</div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.8, marginTop: 6 }}>
              <span style={{ color: COLORS.accent }}>•</span> Hypoxemic respiratory failure (<Term abbr="ARDS">ARDS</Term>, pneumonia, pulmonary edema, PE)
              <br /><span style={{ color: COLORS.accent }}>•</span> Hypercapnic respiratory failure (COPD failing NIV, status asthmaticus)
              <br /><span style={{ color: COLORS.accent }}>•</span> Airway protection (GCS ≤ 8, massive hematemesis, angioedema)
              <br /><span style={{ color: COLORS.accent }}>•</span> Anticipated clinical course (pre-procedure, expected deterioration)
              <br /><span style={{ color: COLORS.accent }}>•</span> Respiratory muscle fatigue (RR {">"} 35, accessory muscles, paradoxical breathing)
            </div>
          </div>

          <Callout type="info">
            <strong>The decision to intubate is clinical, not based on a single number.</strong> Trend matters more than any single ABG. RR 38 with accessory muscle use and diaphoresis is telling you they're failing — don't wait for the gas.
          </Callout>
        </div>
      )}

      {/* ── BREATH CYCLE ── */}
      {section === "anatomy" && (
        <div>
          <p style={bStyles.p}>Every ventilator breath has 4 phases. Understanding this is the foundation for everything else.</p>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {[
              { phase: "1. Trigger", desc: "What starts the breath? Either the patient (effort-triggered) or the vent (time-triggered at set RR).", color: COLORS.green, icon: "⚡" },
              { phase: "2. Inspiration", desc: "Gas flows in. The vent controls either VOLUME (fixed mL) or PRESSURE (fixed cmH₂O, flow varies). This is the key mode distinction.", color: COLORS.accent, icon: "💨" },
              { phase: "3. Cycling", desc: "What ends inspiration? Volume control: set volume reached. Pressure control: set time. Pressure support: flow drops to % of peak.", color: COLORS.yellow, icon: "🔄" },
              { phase: "4. Expiration", desc: <>Passive — lung recoils, air flows out, pressure falls to <Term abbr="PEEP">PEEP</Term>. Too short → air trapping → auto-PEEP.</>, color: COLORS.orange, icon: "↩️" },
            ].map((p, i) => (
              <div key={i} style={{ ...bStyles.miniCard, borderColor: p.color + "44" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{p.icon}</div>
                <div style={{ color: p.color, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{p.phase}</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ ...bStyles.box, marginTop: 12 }}>
            <div style={bStyles.boxTitle}>The 3 Waveforms on Your Vent Screen</div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.8, marginTop: 6 }}>
              <span style={{ color: COLORS.accent, fontWeight: 700 }}>Pressure (Paw) vs Time</span> — Shows peak pressure, plateau, and <Term abbr="PEEP">PEEP</Term>. Shape → compliance & resistance.
              <br /><br />
              <span style={{ color: COLORS.green, fontWeight: 700 }}>Flow vs Time</span> — Shows inspiratory pattern (constant in VC, decelerating in PC) and expiratory flow. Exp flow not reaching zero → auto-PEEP.
              <br /><br />
              <span style={{ color: COLORS.purple, fontWeight: 700 }}>Volume vs Time</span> — Delivered vs exhaled <Term abbr="Vt">Vt</Term>. Exhaled {"<"} inhaled → leak or air trapping.
            </div>
          </div>
        </div>
      )}

      {/* ── MODES ── */}
      {section === "modes" && (
        <div>
          <p style={bStyles.p}>Modes are confusing because every manufacturer uses different names. Ignore brand names. Answer two questions: (1) What does the vent control — volume or pressure? (2) Is the patient doing any work?</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                mode: "AC/VC — Volume Control",
                aka: "AKA: CMV, VCV, A/C Volume",
                what: "You set: Vt, RR, Flow rate, PEEP, FiO₂",
                how: "Vent delivers fixed volume each breath. Pressure varies with compliance/resistance.",
                when: "Default for most new intubations. Guaranteed minute ventilation. What Carteaux et al. focuses on.",
                color: COLORS.accent,
                pros: "Guaranteed Vt. Easy waveform interpretation. Best for passive patients.",
                cons: "If compliance drops, pressures climb → barotrauma risk if unwatched. Fixed flow may cause dyssynchrony.",
              },
              {
                mode: "AC/PC — Pressure Control",
                aka: "AKA: PCV, A/C Pressure",
                what: "You set: Insp pressure, Insp time, RR, PEEP, FiO₂",
                how: "Vent delivers set pressure. Volume varies with lung mechanics. Decelerating flow.",
                when: "Useful when capping pressures directly. Sometimes used in ARDS with poor compliance.",
                color: COLORS.green,
                pros: "Direct pressure control. Decelerating flow may improve gas distribution.",
                cons: "Vt NOT guaranteed — if compliance worsens, Vt drops silently. Must watch volumes.",
              },
              {
                mode: "PSV — Pressure Support",
                aka: "AKA: PS, Spontaneous + PS",
                what: "You set: PS level (above PEEP), PEEP, FiO₂",
                how: "Patient triggers every breath. Vent augments to set pressure. Patient controls RR and timing.",
                when: "Weaning mode. SBTs. Patient must have reliable respiratory drive.",
                color: COLORS.yellow,
                pros: "Patient comfort. Better synchrony. Maintains respiratory muscle tone.",
                cons: "NO backup rate. Patient stops breathing → they get nothing. Not for unstable patients.",
              },
              {
                mode: "SIMV",
                aka: "AKA: SIMV+PS",
                what: "You set: Mandatory RR, Vt or Pressure, PS for spontaneous breaths, PEEP, FiO₂",
                how: "Set number of mandatory breaths synced to effort. Between them, patient breathes with PS only.",
                when: "Previously popular for weaning. Now falling out of favor.",
                color: COLORS.orange,
                pros: "Backup for patients with unreliable drive.",
                cons: "Increases work of breathing during spontaneous breaths. Shown to prolong weaning vs PSV or T-piece.",
              },
            ].map((m, i) => (
              <details key={i} style={{ ...bStyles.miniCard, borderColor: m.color + "44", cursor: "pointer" }}>
                <summary style={{ color: m.color, fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                  {m.mode}
                </summary>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6 }}>{m.aka}</div>
                <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.7 }}>
                  <strong style={{ color: COLORS.text }}>You set:</strong> {m.what}
                  <br /><strong style={{ color: COLORS.text }}>How it works:</strong> {m.how}
                  <br /><strong style={{ color: COLORS.text }}>When to use:</strong> {m.when}
                  <br /><strong style={{ color: COLORS.green }}>Pros:</strong> {m.pros}
                  <br /><strong style={{ color: COLORS.red }}>Cons:</strong> {m.cons}
                </div>
              </details>
            ))}
          </div>

          <Callout type="info">
            <strong>Bottom line:</strong> Start with AC/VC for almost everything. Most predictable, easiest to troubleshoot. Switch modes when you have a specific reason to.
          </Callout>
        </div>
      )}

      {/* ── INITIAL SETTINGS ── */}
      {section === "settings" && (
        <div>
          <p style={bStyles.p}>You just intubated. The RT is looking at you. Here's what to order — and why.</p>

          <div style={bStyles.box}>
            <div style={bStyles.boxTitle}>The 5 Orders You Write</div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 2, marginTop: 8 }}>
              <span style={{ color: COLORS.accent, fontWeight: 700 }}>1. Mode:</span> AC/VC (default)
              <br />
              <span style={{ color: COLORS.green, fontWeight: 700 }}>2. Tidal Volume:</span> 6–8 mL/kg <strong><Term abbr="IBW">IBW</Term></strong> (NOT actual weight). <Term abbr="ARDS">ARDS</Term>: start at 6. Others: 6–8.
              <br />
              <span style={{ color: COLORS.purple, fontWeight: 700 }}>3. Respiratory Rate:</span> 14–20/min. Match pre-intubation minute ventilation. Higher for metabolic acidosis.
              <br />
              <span style={{ color: COLORS.yellow, fontWeight: 700 }}>4. PEEP:</span> Start 5 cmH₂O for most. <Term abbr="ARDS">ARDS</Term>: ARDSNet <Term abbr="PEEP">PEEP</Term>/<Term abbr="FiO₂">FiO₂</Term> table.
              <br />
              <span style={{ color: COLORS.orange, fontWeight: 700 }}>5. FiO₂:</span> Start 100%, wean rapidly to SpO₂ 92–96%. Hyperoxia is harmful.
            </div>
          </div>

          <div style={bStyles.box}>
            <div style={bStyles.boxTitle}>🧮 Calculate Your Settings</div>
            <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
              {["male", "female"].map(s => (
                <button key={s} onClick={() => setInitSex(s)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${initSex === s ? COLORS.accent : COLORS.cardBorder}`,
                  background: initSex === s ? `${COLORS.accent}22` : "transparent", color: initSex === s ? COLORS.accent : COLORS.textDim,
                  fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                }}>{s}</button>
              ))}
            </div>
            <Slider label="Patient Height" value={initHeight} min={140} max={210} step={1} onChange={setInitHeight} unit=" cm" color={COLORS.accent} />
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>Indication:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { id: "ards", label: "ARDS" },
                  { id: "copd", label: "COPD" },
                  { id: "postop", label: "Post-op" },
                  { id: "overdose", label: "Overdose" },
                  { id: "status", label: "Asthma" },
                ].map(ind => (
                  <button key={ind.id} onClick={() => setInitIndication(ind.id)} style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 11,
                    border: `1px solid ${initIndication === ind.id ? COLORS.accent : COLORS.cardBorder}`,
                    background: initIndication === ind.id ? `${COLORS.accent}22` : "transparent",
                    color: initIndication === ind.id ? COLORS.accent : COLORS.textDim,
                    cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                  }}>{ind.label}</button>
                ))}
              </div>
            </div>

            <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, border: `1px solid ${COLORS.cardBorder}` }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>IBW = {ibw.toFixed(1)} kg</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Metric label="Mode" value={setting.mode} unit="" color={COLORS.accent} />
                <Metric label="Vt" value={setting.vt} unit="mL" color={COLORS.green} />
                <Metric label="RR" value={setting.rr} unit="/min" color={COLORS.purple} />
                <Metric label="PEEP" value={setting.peep} unit="cmH₂O" color={COLORS.yellow} />
                <Metric label="FiO₂" value={setting.fio2} unit="%" color={COLORS.orange} />
              </div>
              <div style={{ fontSize: 11, color: COLORS.accent, marginTop: 8, lineHeight: 1.6 }}>
                {setting.notes}
              </div>
            </div>
          </div>

          <EqBox>
            IBW (M) = 50 + 0.91 × (ht cm − 152.4) &nbsp;|&nbsp; (F) = 45.5 + 0.91 × (ht cm − 152.4)
          </EqBox>

          <Callout type="warn">
            <strong>#1 resident mistake:</strong> Using actual body weight for <Term abbr="Vt">Vt</Term>. A 150 kg patient at 170 cm has <Term abbr="IBW">IBW</Term> ~66 kg → <Term abbr="Vt">Vt</Term> ~400 mL, not 1000 mL. Ventilating by actual weight causes <Term abbr="VILI">VILI</Term>.
          </Callout>
        </div>
      )}

      {/* ── SAFETY ── */}
      {section === "safety" && (
        <div>
          <p style={bStyles.p}>After you write initial orders, here's what to watch and when to worry. These numbers keep patients alive.</p>

          <div style={bStyles.box}>
            <div style={bStyles.boxTitle}>🎯 Safety Targets (Memorize These)</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginTop: 10 }}>
              {[
                { label: "Plateau Pressure", target: "≤ 30", unit: "cmH₂O", why: "Higher → alveolar overdistension → VILI", color: COLORS.yellow },
                { label: "Driving Pressure", target: "≤ 14", unit: "cmH₂O", why: "Strongest mortality predictor in ARDS (Amato, NEJM 2015)", color: COLORS.orange },
                { label: "Vt / IBW", target: "6–8", unit: "mL/kg", why: "ARDSNet: mortality reduction with low Vt", color: COLORS.green },
                { label: "SpO₂", target: "92–96", unit: "%", why: "Hyperoxia harmful. Don't chase 100%", color: COLORS.accent },
                { label: "pH", target: "> 7.20", unit: "", why: "Permissive hypercapnia ok above 7.20", color: COLORS.purple },
                { label: "FiO₂ goal", target: "< 60", unit: "%", why: "Prolonged high FiO₂ → O₂ toxicity & absorption atelectasis", color: COLORS.red },
              ].map((t, i) => (
                <div key={i} style={{ ...bStyles.miniCard, borderColor: t.color + "33" }}>
                  <div style={{ color: t.color, fontWeight: 700, fontSize: 11 }}>{t.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace", margin: "3px 0" }}>
                    {t.target} <span style={{ fontSize: 10, color: COLORS.textDim }}>{t.unit}</span>
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textDim, lineHeight: 1.4 }}>{t.why}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={bStyles.box}>
            <div style={bStyles.boxTitle}>🚨 High Pressure Alarm — Now What?</div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.7, marginTop: 8 }}>
              <strong style={{ color: COLORS.text }}>Step 1:</strong> Look at the patient, not the vent.
              <br /><strong style={{ color: COLORS.text }}>Step 2:</strong> Bag the patient if in extremis. Easy to bag → vent problem. Hard to bag → patient problem.
              <br /><strong style={{ color: COLORS.text }}>Step 3:</strong> Think <strong style={{ color: COLORS.accent }}>DOPE</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginTop: 10 }}>
              {[
                { letter: "D", word: "Displacement", detail: "ETT dislodged, right mainstem, esophageal. Check depth, auscultate, CXR.", color: COLORS.red },
                { letter: "O", word: "Obstruction", detail: "Mucus plug, kinked tube, biting ETT. Suction, check circuit, bite block.", color: COLORS.orange },
                { letter: "P", word: "Pneumothorax", detail: "Absent breath sounds, tracheal deviation, hypotension. Needle decompress → chest tube.", color: COLORS.yellow },
                { letter: "E", word: "Equipment", detail: "Circuit disconnect, malfunction, wrong settings. Check all connections.", color: COLORS.accent },
              ].map((d, i) => (
                <div key={i} style={{ ...bStyles.miniCard, borderColor: d.color + "33" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: d.color, fontFamily: "'JetBrains Mono', monospace" }}>{d.letter}</span>
                    <span style={{ color: d.color, fontWeight: 700, fontSize: 12 }}>{d.word}</span>
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textDim, lineHeight: 1.5 }}>{d.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={bStyles.box}>
            <div style={bStyles.boxTitle}><Term abbr="Ppeak">Ppeak</Term> vs <Term abbr="Pplat">Pplat</Term> — The Most Important Distinction</div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.8, marginTop: 6 }}>
              <strong style={{ color: COLORS.red }}>High <Term abbr="Ppeak">Ppeak</Term>, normal <Term abbr="Pplat">Pplat</Term></strong> → <em>Resistive</em> problem (airways): bronchospasm, mucus plug, kinked tube, biting.
              <br /><br />
              <strong style={{ color: COLORS.yellow }}>Both <Term abbr="Ppeak">Ppeak</Term> AND <Term abbr="Pplat">Pplat</Term> high</strong> → <em>Compliance</em> problem (lung/chest wall): PTX, pulmonary edema, <Term abbr="ARDS">ARDS</Term>, abdominal compartment syndrome, mainstem intubation.
              <br /><br />
              <strong style={{ color: COLORS.accent }}>To check:</strong> End-inspiratory hold (0.5–1 sec). Read <Term abbr="Pplat">Pplat</Term>. <Term abbr="Pres">P<sub>res</sub></Term> = <Term abbr="Ppeak">Ppeak</Term> − <Term abbr="Pplat">Pplat</Term>. <Term abbr="ΔP">ΔP</Term> = <Term abbr="Pplat">Pplat</Term> − <Term abbr="PEEP">PEEP</Term>.
            </div>
          </div>

          <Callout type="success">
            <strong>You now know:</strong> pressure, flow, volume, the breath cycle, modes, initial settings, safety targets, and troubleshooting. You're ready for the advanced modules which build directly on these concepts.
          </Callout>
        </div>
      )}

      {/* ── BOARD ESSENTIALS ── */}
      {section === "board" && (
        <div>
          <p style={bStyles.p}>Goal-oriented adjustments for the most common board-style ventilator questions. "The gas is abnormal — what do I change?"</p>

          <div style={bStyles.box}>
            <div style={bStyles.boxTitle}>🎛️ Vent Adjustment Cheat Sheet</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>

              {/* Card A — CO₂ Too High */}
              <div style={{ ...bStyles.miniCard, borderColor: COLORS.red + "44" }}>
                <div style={{ color: COLORS.red, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>CO₂ Too High (Respiratory Acidosis)</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.6, marginBottom: 6 }}>
                  <strong style={{ color: COLORS.text }}>Goal:</strong> ↓ <Term abbr="PaCO₂">PaCO₂</Term> → increase minute ventilation
                </div>
                <div style={{ fontSize: 11, color: COLORS.green, lineHeight: 1.6, marginBottom: 6 }}>
                  <strong>Actions:</strong> ↑ <Term abbr="RR">RR</Term> or ↑ <Term abbr="Vt">Vt</Term> (volume mode: set directly; pressure mode: ↑ inspiratory pressure to increase delivered <Term abbr="Vt">Vt</Term>)
                </div>
                <div style={{ fontSize: 11, color: COLORS.yellow, lineHeight: 1.6 }}>
                  <strong>⚠ Warnings:</strong> (1) High <Term abbr="RR">RR</Term> risks auto-PEEP → ↓ venous return → hypotension. (2) In <Term abbr="ARDS">ARDS</Term>, tolerate pH down to ~7.20 rather than exceeding lung-protective <Term abbr="Vt">Vt</Term> (permissive hypercapnia).
                </div>
              </div>

              {/* Card B — CO₂ Too Low */}
              <div style={{ ...bStyles.miniCard, borderColor: COLORS.purple + "44" }}>
                <div style={{ color: COLORS.purple, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>CO₂ Too Low (Respiratory Alkalosis)</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.6, marginBottom: 6 }}>
                  <strong style={{ color: COLORS.text }}>Goal:</strong> ↑ <Term abbr="PaCO₂">PaCO₂</Term> → decrease minute ventilation
                </div>
                <div style={{ fontSize: 11, color: COLORS.green, lineHeight: 1.6, marginBottom: 6 }}>
                  <strong>Actions:</strong> ↓ <Term abbr="RR">RR</Term> or ↓ <Term abbr="Vt">Vt</Term>
                </div>
                <div style={{ fontSize: 11, color: COLORS.yellow, lineHeight: 1.6 }}>
                  <strong>⚠ Warning:</strong> If the patient triggers above the set rate, lowering the set <Term abbr="RR">RR</Term> won't help — the patient is driving. Find the cause: sepsis, <Term abbr="PE">PE</Term>, hepatic failure, pain.
                </div>
              </div>

              {/* Card C — O₂ Too Low */}
              <div style={{ ...bStyles.miniCard, borderColor: COLORS.orange + "44" }}>
                <div style={{ color: COLORS.orange, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>O₂ Too Low (Hypoxemia)</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.6, marginBottom: 6 }}>
                  <strong style={{ color: COLORS.text }}>Goal:</strong> ↑ <Term abbr="SpO₂">SpO₂</Term> / <Term abbr="PaO₂">PaO₂</Term>
                </div>
                <div style={{ fontSize: 11, color: COLORS.green, lineHeight: 1.6, marginBottom: 6 }}>
                  <strong>Actions:</strong> ↑ <Term abbr="FiO₂">FiO₂</Term> or ↑ <Term abbr="PEEP">PEEP</Term>
                </div>
                <div style={{ fontSize: 11, color: COLORS.yellow, lineHeight: 1.6 }}>
                  <strong>⚠ Warning:</strong> <Term abbr="PEEP">PEEP</Term> ↑ can ↓ preload → ↓ cardiac output → tissue O₂ delivery may worsen even as <Term abbr="SpO₂">SpO₂</Term> improves. If BP drops after <Term abbr="PEEP">PEEP</Term> increase, consider volume.
                </div>
              </div>

            </div>
          </div>

          <Callout type="info">
            <strong>Ready to Extubate?</strong> Criteria to consider: <Term abbr="SpO₂">SpO₂</Term> {">"}90% on <Term abbr="FiO₂">FiO₂</Term> ≤0.5, <Term abbr="PEEP">PEEP</Term> ≤5, pH {">"}7.30, and underlying cause improving. Best practice: pair daily <Term abbr="SAT">SAT</Term> (spontaneous awakening trial — hold sedation) with <Term abbr="SBT">SBT</Term> (spontaneous breathing trial — minimal vent support). This <Term abbr="SAT">SAT</Term>+<Term abbr="SBT">SBT</Term> combination reduces vent days, ICU stay, and 1-year mortality.
          </Callout>

          <Callout type="warn">
            <strong style={{ color: COLORS.red }}>Board Trap: <Term abbr="SIMV">SIMV</Term> is not a weaning strategy.</strong> <Term abbr="SIMV">SIMV</Term> as a liberation mode is inferior to daily <Term abbr="SBT">SBT</Term>-based protocols — evidence consistently shows longer time on the vent. If a question asks best weaning approach → daily paired <Term abbr="SAT">SAT</Term> + <Term abbr="SBT">SBT</Term>.
          </Callout>
        </div>
      )}

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <button
          onClick={() => { const idx = sectionKeys.indexOf(section); if (idx > 0) setSection(sectionKeys[idx - 1]); }}
          disabled={sectionKeys.indexOf(section) === 0}
          style={{
            padding: "6px 16px", borderRadius: 6, border: `1px solid ${COLORS.cardBorder}`,
            background: "transparent", color: sectionKeys.indexOf(section) === 0 ? COLORS.textMuted : COLORS.text,
            cursor: sectionKeys.indexOf(section) === 0 ? "not-allowed" : "pointer",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          }}>← Previous</button>
        <button
          onClick={() => { const idx = sectionKeys.indexOf(section); if (idx < sectionKeys.length - 1) setSection(sectionKeys[idx + 1]); }}
          disabled={sectionKeys.indexOf(section) === sectionKeys.length - 1}
          style={{
            padding: "6px 16px", borderRadius: 6, border: `1px solid ${COLORS.accent}`,
            background: sectionKeys.indexOf(section) === sectionKeys.length - 1 ? "transparent" : `${COLORS.accent}22`,
            color: sectionKeys.indexOf(section) === sectionKeys.length - 1 ? COLORS.textMuted : COLORS.accent,
            cursor: sectionKeys.indexOf(section) === sectionKeys.length - 1 ? "not-allowed" : "pointer",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          }}>Next →</button>
      </div>
    </div>
  );
}

const bStyles = {
  p: { fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, margin: "0 0 12px" },
  box: { background: "#0d1117", border: `1px solid #1e293b`, borderRadius: 10, padding: 14, marginBottom: 12 },
  boxTitle: { fontSize: 13, fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" },
  miniCard: { background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 10 },
};

// Module 1: Equation of Motion + Waveform Simulator
function ModuleWaveforms() {
  const isMobile = useIsMobile();
  const [peep, setPeep] = useState(5);
  const [vt, setVt] = useState(450);
  const [rr, setRr] = useState(14);
  const [peakFlow, setPeakFlow] = useState(60);
  const [crs, setCrs] = useState(50);
  const [rrs, setRrs] = useState(10);
  const [stressIndex, setStressIndex] = useState(1.0);
  const [hasAutopeep, setAutopeep] = useState(false);

  const ti = vt / (peakFlow * 1000 / 60);
  const ers = 1000 / crs;
  const pres = rrs * (peakFlow / 60);
  const pel = vt / crs;
  const pplat = peep + pel;
  const ppeak = pplat + pres;
  const dp = pplat - peep;
  const mp = 0.098 * rr * (ppeak - 0.5 * dp);

  const pressureData = useMemo(() => generateAcvPressureWave({ peep, ppeak, pplat, rr, ieRatio: 2, ti, stressIndex, hasAutopeep }), [peep, ppeak, pplat, rr, ti, stressIndex, hasAutopeep]);
  const flowData = useMemo(() => generateFlowWave({ peep, rr, ti, peakFlow, hasAutopeep }), [peep, rr, ti, peakFlow, hasAutopeep]);
  const volumeData = useMemo(() => generateVolumeWave({ vt, rr, ti }), [vt, rr, ti]);

  const pAnnotations = [
    { t: ti * 0.03, val: ppeak, label: "Ppeak", color: COLORS.red },
    { t: ti * 0.6, val: pplat, label: "Pplat", color: COLORS.yellow },
    { t: pressureData[pressureData.length - 1].t, val: hasAutopeep ? peep + 3 : peep, label: hasAutopeep ? "PEEPtot" : "PEEP", color: COLORS.green },
  ];

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Equation of Motion & ACV Waveforms
      </h3>
      <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 12px" }}>
        During volume-assist control ventilation (<Term abbr="ACV">ACV</Term>) with constant inspiratory flow, the airway pressure waveform reflects the equation of motion of the respiratory system in real time.
      </p>
      <EqBox>P<sub>aw</sub>(t) = P₀ + R<sub>RS</sub> × V̇(t) + E<sub>RS</sub> × V(t)</EqBox>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, margin: "12px 0" }}>
        <div>
          <Slider label="PEEP" value={peep} min={0} max={20} step={1} onChange={setPeep} unit=" cmH₂O" color={COLORS.green} />
          <Slider label="Vt" value={vt} min={200} max={700} step={10} onChange={setVt} unit=" mL" color={COLORS.accent} />
          <Slider label="RR" value={rr} min={8} max={30} step={1} onChange={setRr} unit=" /min" color={COLORS.purple} />
          <Slider label="Peak Flow" value={peakFlow} min={30} max={90} step={5} onChange={setPeakFlow} unit=" L/min" color={COLORS.orange} />
        </div>
        <div>
          <Slider label="C_RS" value={crs} min={15} max={100} step={5} onChange={setCrs} unit=" mL/cmH₂O" color={COLORS.green} />
          <Slider label="R_RS" value={rrs} min={5} max={30} step={1} onChange={setRrs} unit=" cmH₂O/L/s" color={COLORS.red} />
          <Slider label="Stress Index" value={stressIndex} min={0.7} max={1.3} step={0.05} onChange={setStressIndex} unit="" color={COLORS.yellow} />
          <label style={{ fontSize: 12, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={hasAutopeep} onChange={e => setAutopeep(e.target.checked)} />
            Intrinsic PEEP (auto-PEEP)
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        <Metric label="Ppeak" value={ppeak.toFixed(0)} unit="cmH₂O" color={COLORS.red} warn={ppeak > 35} />
        <Metric label="Pplat" value={pplat.toFixed(0)} unit="cmH₂O" color={COLORS.yellow} warn={pplat > 30} />
        <Metric label="ΔP" value={dp.toFixed(0)} unit="cmH₂O" color={COLORS.orange} warn={dp > 14} />
        <Metric label="Pres" value={pres.toFixed(1)} unit="cmH₂O" color={COLORS.purple} />
        <Metric label="MP" value={mp.toFixed(1)} unit="J/min" color={COLORS.accent} warn={mp > 17} />
      </div>

      {dp > 14 && <Callout type="danger">Driving pressure {">"} 14 cmH₂O — associated with increased mortality in <Term abbr="ARDS">ARDS</Term> (Amato et al., NEJM 2015). Consider reducing <Term abbr="Vt">Vt</Term> or increasing <Term abbr="PEEP">PEEP</Term> if recruitable lung exists.</Callout>}
      {stressIndex < 0.95 && <Callout type="info">Stress index {"<"} 0.9 → upward convex curve → intratidal recruitment. Consider increasing <Term abbr="PEEP">PEEP</Term>.</Callout>}
      {stressIndex > 1.05 && <Callout type="warn">Stress index {">"} 1.1 → upward concave curve → intratidal overdistension. Consider reducing <Term abbr="PEEP">PEEP</Term> or <Term abbr="Vt">Vt</Term>.</Callout>}
      {hasAutopeep && <Callout type="warn">Auto-PEEP detected: expiratory flow doesn't reach zero. <Term abbr="Pcond">P<sub>cond</sub></Term> {">"} <Term abbr="Pres">P<sub>res</sub></Term> — perform end-expiratory hold to quantify total <Term abbr="PEEP">PEEP</Term>.</Callout>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        <WaveformCanvas data={pressureData} yLabel="Paw (cmH₂O)" yMin={0} yMax={Math.max(ppeak + 5, 40)} color={COLORS.accent} annotations={pAnnotations} />
        <WaveformCanvas data={flowData} yLabel="Flow (L/min)" yMin={-peakFlow} yMax={peakFlow + 10} color={COLORS.green} zeroLine={0} />
        <WaveformCanvas data={volumeData} yLabel="Volume (mL)" yMin={0} yMax={vt + 100} color={COLORS.purple} />
      </div>
    </div>
  );
}

// Module 2: Conductive Pressure & Pcond Algorithm
function ModulePcond() {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "1. Measure Pcond", desc: <>Perform an end-inspiratory hold. Measure <Term abbr="Pplat">Pplat</Term>. Then: <Term abbr="Pres">Pres</Term> = <Term abbr="Ppeak">Ppeak</Term> − <Term abbr="Pplat">Pplat</Term>. The conductive pressure (<Term abbr="Pcond">Pcond</Term>) is the abrupt rise at the onset of insufflation before significant volume enters.</>, color: COLORS.accent },
    { title: "2. Compare Pcond vs Pres", desc: <>If <Term abbr="Pcond">Pcond</Term> = <Term abbr="Pres">Pres</Term> → no intrinsic <Term abbr="PEEP">PEEP</Term> and no airway opening pressure (<Term abbr="AOP">AOP</Term>). Normal.{"\n"}If <Term abbr="Pcond">Pcond</Term> {">"} <Term abbr="Pres">Pres</Term> → either intrinsic <Term abbr="PEEP">PEEP</Term> or <Term abbr="AOP">AOP</Term> above set <Term abbr="PEEP">PEEP</Term> is present.</>, color: COLORS.yellow },
    { title: "3. If Pcond > Pres: End-Expiratory Hold", desc: <>Perform an end-expiratory hold to measure total <Term abbr="PEEP">PEEP</Term> (<Term abbr="PEEPtot">PEEPtot</Term>).</>, color: COLORS.orange },
    { title: "4a. PEEPtot > set PEEP", desc: <>Intrinsic <Term abbr="PEEP">PEEP</Term> (<Term abbr="PEEPi">PEEPi</Term>) is present. <Term abbr="PEEPi">PEEPi</Term> = <Term abbr="PEEPtot">PEEPtot</Term> − set <Term abbr="PEEP">PEEP</Term>. The <Term abbr="Pcond">Pcond</Term> excess is explained by auto-PEEP. <Term abbr="ΔP">ΔP</Term> = <Term abbr="Pplat">Pplat</Term> − <Term abbr="PEEPtot">PEEPtot</Term>.</>, color: COLORS.red },
    { title: "4b. PEEPtot = set PEEP", desc: <>No auto-PEEP → Airway Opening Pressure (<Term abbr="AOP">AOP</Term>) is present. Perform a low-flow insufflation to measure the <Term abbr="AOP">AOP</Term>. <Term abbr="ΔP">ΔP</Term> = <Term abbr="Pplat">Pplat</Term> − <Term abbr="AOP">AOP</Term>.</>, color: COLORS.purple },
    { title: "5. Clinical Significance", desc: <>When <Term abbr="Pcond">Pcond</Term> {">"} <Term abbr="Pres">Pres</Term>, the observed driving pressure (<Term abbr="Ppeak">Ppeak</Term> − <Term abbr="PEEP">PEEP</Term>) OVERESTIMATES the actual <Term abbr="ΔP">ΔP</Term>. The true <Term abbr="ΔP">ΔP</Term> must account for <Term abbr="PEEPi">PEEPi</Term> or <Term abbr="AOP">AOP</Term>. Failure to recognize this → inappropriate ventilator settings. An <Term abbr="AOP">AOP</Term> identified → set <Term abbr="PEEP">PEEP</Term> ≥ <Term abbr="AOP">AOP</Term>.</>, color: COLORS.green },
  ];

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Conductive Pressure Algorithm
      </h3>
      <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 12px" }}>
        Step through the clinical algorithm for interpreting conductive pressure and identifying intrinsic <Term abbr="PEEP">PEEP</Term> vs airway opening pressure.
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i)} style={{
            width: 32, height: 32, borderRadius: "50%", border: `2px solid ${i === step ? s.color : COLORS.cardBorder}`,
            background: i === step ? `${s.color}33` : "transparent", color: i === step ? s.color : COLORS.textMuted,
            fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}>
            {i + 1}
          </button>
        ))}
      </div>

      <div style={{
        background: `${steps[step].color}11`, border: `1px solid ${steps[step].color}33`,
        borderRadius: 10, padding: 16, minHeight: "auto", transition: "all 0.3s",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: steps[step].color, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
          {steps[step].title}
        </div>
        <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7, whiteSpace: "pre-line" }}>
          {steps[step].desc}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{
          padding: "6px 16px", borderRadius: 6, border: `1px solid ${COLORS.cardBorder}`,
          background: "transparent", color: step === 0 ? COLORS.textMuted : COLORS.text,
          cursor: step === 0 ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
        }}>← Back</button>
        <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1} style={{
          padding: "6px 16px", borderRadius: 6, border: `1px solid ${COLORS.accent}`,
          background: step === steps.length - 1 ? "transparent" : `${COLORS.accent}22`,
          color: step === steps.length - 1 ? COLORS.textMuted : COLORS.accent,
          cursor: step === steps.length - 1 ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
        }}>Next →</button>
      </div>

      <EqBox>
        True ΔP = Pplat − PEEPtot (if PEEPi) &nbsp;|&nbsp; Pplat − AOP (if airway closure)
      </EqBox>
    </div>
  );
}

// Module 3: Stress Index Visual
function ModuleStressIndex() {
  const [si, setSi] = useState(1.0);

  const getLabel = () => {
    if (si < 0.9) return { text: "Intratidal Recruitment", color: COLORS.green, action: "Consider ↑ PEEP" };
    if (si > 1.1) return { text: "Intratidal Overdistension", color: COLORS.red, action: "Consider ↓ PEEP or ↓ Vt" };
    return { text: "Linear (Desired)", color: COLORS.accent, action: "Stable compliance during insufflation" };
  };

  const info = getLabel();

  // Draw stress index curve
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const cw = useContainerWidth(containerRef);
  const ch = Math.max(120, Math.round(cw * 0.35));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cw < 10) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);
    drawGrid(ctx, cw, ch);

    const fs = Math.max(9, Math.round(cw * 0.022));
    const padL = fs * 4, padR = fs * 2, padT = fs * 1.5, padB = fs * 2.5;
    const plotW = cw - padL - padR;
    const plotH = ch - padT - padB;

    // Paw = a * t^b + c
    const a = 20, c = 8;
    const steps = 200;
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const val = a * Math.pow(frac, si) + c;
      const x = padL + frac * plotW;
      const y = padT + plotH - (val / 35) * plotH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // reference line (linear)
    ctx.strokeStyle = COLORS.textMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const val = a * frac + c;
      const x = padL + frac * plotW;
      const y = padT + plotH - (val / 35) * plotH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // axis labels
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `${fs}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("Inspiratory Time →", cw / 2, ch - fs * 0.3);

    ctx.save();
    ctx.translate(fs, ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Paw (cmH₂O)", 0, 0);
    ctx.restore();

    // b label
    ctx.fillStyle = info.color;
    ctx.font = `bold ${fs + 1}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "right";
    ctx.fillText(`b = ${si.toFixed(2)}`, cw - padR - 4, padT + fs * 1.5);

    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `${fs - 1}px 'JetBrains Mono', monospace`;
    ctx.fillText("— linear ref (b=1)", cw - padR - 4, padT + fs * 2.8);
  }, [si, info.color, cw, ch]);

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Stress Index
      </h3>
      <EqBox>P<sub>aw</sub> = a × time<sup>b</sup> + c &nbsp;&nbsp;→&nbsp;&nbsp; b = stress index</EqBox>
      <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "6px 0 12px" }}>
        The exponent <em>b</em> characterizes intratidal changes in compliance during constant-flow <Term abbr="ACV">ACV</Term>. A value of 0.9–1.1 indicates stable compliance. Below 0.9 suggests recruitment; above 1.1 suggests overdistension.
      </p>

      <Slider label="Stress Index (b)" value={si} min={0.6} max={1.4} step={0.01} onChange={setSi} unit="" color={info.color} />

      <div style={{
        textAlign: "center", padding: 10, borderRadius: 8,
        background: `${info.color}15`, border: `1px solid ${info.color}33`, marginBottom: 10,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: info.color, fontFamily: "'JetBrains Mono', monospace" }}>{info.text}</div>
        <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>{info.action}</div>
      </div>

      <div ref={containerRef} style={{ width: "100%" }}>
        <canvas ref={canvasRef} style={{ display: "block", borderRadius: 8, background: "#0d1117", border: `1px solid ${COLORS.cardBorder}` }} />
      </div>
    </div>
  );
}

// Module 4: Driving Pressure & Mechanical Power Calculator
function ModuleCalculator() {
  const isMobile = useIsMobile();
  const [height, setHeight] = useState(170);
  const [sex, setSex] = useState("male");
  const [peep, setPeep] = useState(10);
  const [pplat, setPplat] = useState(24);
  const [ppeak, setPpeak] = useState(30);
  const [rr, setRr] = useState(16);
  const [vt, setVt] = useState(420);
  const [peepTot, setPeepTot] = useState(10);

  const ibw = sex === "male" ? 50 + 0.91 * (height - 152.4) : 45.5 + 0.91 * (height - 152.4);
  const vtPerKg = vt / ibw;
  const dp = pplat - peepTot;
  const crs = vt / dp;
  const pres = ppeak - pplat;
  const rrs = pres / (vt / (60 * 1000 / (rr * 0.5))); // rough
  const mp = 0.098 * rr * vt / 1000 * (ppeak - 0.5 * dp);
  const mpNorm = mp / ibw;

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Driving Pressure & Mechanical Power
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["male", "female"].map(s => (
              <button key={s} onClick={() => setSex(s)} style={{
                flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${sex === s ? COLORS.accent : COLORS.cardBorder}`,
                background: sex === s ? `${COLORS.accent}22` : "transparent", color: sex === s ? COLORS.accent : COLORS.textDim,
                fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
              }}>{s}</button>
            ))}
          </div>
          <Slider label="Height" value={height} min={140} max={200} step={1} onChange={setHeight} unit=" cm" color={COLORS.accent} />
          <Slider label="PEEP" value={peep} min={0} max={20} step={1} onChange={setPeep} unit=" cmH₂O" color={COLORS.green} />
          <Slider label="PEEPtot" value={peepTot} min={peep} max={peep + 10} step={1} onChange={setPeepTot} unit=" cmH₂O" color={COLORS.yellow} />
        </div>
        <div>
          <Slider label="Pplat" value={pplat} min={peepTot + 2} max={40} step={1} onChange={setPplat} unit=" cmH₂O" color={COLORS.yellow} />
          <Slider label="Ppeak" value={ppeak} min={pplat} max={50} step={1} onChange={setPpeak} unit=" cmH₂O" color={COLORS.red} />
          <Slider label="Vt" value={vt} min={200} max={700} step={10} onChange={setVt} unit=" mL" color={COLORS.accent} />
          <Slider label="RR" value={rr} min={8} max={30} step={1} onChange={setRr} unit=" /min" color={COLORS.purple} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <Metric label="IBW" value={ibw.toFixed(0)} unit="kg" />
        <Metric label="Vt/IBW" value={vtPerKg.toFixed(1)} unit="mL/kg" color={COLORS.green} warn={vtPerKg > 8} />
        <Metric label="ΔP" value={dp.toFixed(0)} unit="cmH₂O" color={COLORS.orange} warn={dp > 14} />
        <Metric label="C_RS" value={crs.toFixed(0)} unit="mL/cmH₂O" color={COLORS.green} />
        <Metric label="MP" value={mp.toFixed(1)} unit="J/min" color={COLORS.purple} warn={mp > 17} />
      </div>

      {vtPerKg > 8 && <Callout type="danger"><Term abbr="Vt">Vt</Term>/<Term abbr="IBW">IBW</Term> {">"} 8 mL/kg — exceeds lung-protective target. Target 6–8 mL/kg <Term abbr="IBW">IBW</Term> (ARDSNet).</Callout>}
      {dp > 14 && <Callout type="danger"><Term abbr="ΔP">ΔP</Term> {">"} 14 cmH₂O — strongest predictor of mortality in <Term abbr="ARDS">ARDS</Term>. <Term abbr="ΔP">ΔP</Term> = <Term abbr="Vt">Vt</Term>/<Term abbr="C_RS">C<sub>RS</sub></Term>, reflecting tidal volume normalized to functional lung size.</Callout>}
      {mp > 17 && <Callout type="warn"><Term abbr="MP">Mechanical power</Term> {">"} 17 J/min — associated with increased mortality (Costa et al., AJRCCM 2021).</Callout>}
      {peepTot > peep && <Callout type="info"><Term abbr="PEEPtot">PEEPtot</Term> {">"} set <Term abbr="PEEP">PEEP</Term>: {peepTot - peep} cmH₂O of auto-PEEP. True <Term abbr="ΔP">ΔP</Term> uses <Term abbr="PEEPtot">PEEPtot</Term>, not set <Term abbr="PEEP">PEEP</Term>.</Callout>}

      <EqBox>ΔP = Pplat − PEEPtot = Vt / C<sub>RS</sub></EqBox>
      <EqBox>MP ≈ 0.098 × RR × Vt × (Ppeak − ½ΔP)</EqBox>
    </div>
  );
}

// Module 5: Recruitment-to-Inflation Ratio
function ModuleRI() {
  const isMobile = useIsMobile();
  const [vtHighPeep, setVtHighPeep] = useState(420);
  const [vTeHighToLow, setVTeHighToLow] = useState(680);
  const [crsLow, setCrsLow] = useState(35);
  const [deltaPeep, setDeltaPeep] = useState(10);

  const vrec = vTeHighToLow - vtHighPeep - (crsLow * deltaPeep);
  const ri = vrec / (crsLow * deltaPeep);

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Recruitment-to-Inflation (R/I) Ratio
      </h3>
      <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 12px" }}>
        Single-breath maneuver: after ≥10 min at high <Term abbr="PEEP">PEEP</Term>, reduce <Term abbr="RR">RR</Term> to ~10, then abruptly decrease <Term abbr="PEEP">PEEP</Term> (e.g., 15→5). Record the expired volume during the transition breath.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Slider label="Vt at high PEEP" value={vtHighPeep} min={300} max={600} step={10} onChange={setVtHighPeep} unit=" mL" color={COLORS.accent} />
        <Slider label="VTe high→low" value={vTeHighToLow} min={400} max={1200} step={10} onChange={setVTeHighToLow} unit=" mL" color={COLORS.green} />
        <Slider label="C_RS at low PEEP" value={crsLow} min={15} max={80} step={1} onChange={setCrsLow} unit=" mL/cmH₂O" color={COLORS.yellow} />
        <Slider label="ΔPEEP" value={deltaPeep} min={5} max={15} step={1} onChange={setDeltaPeep} unit=" cmH₂O" color={COLORS.orange} />
      </div>

      <EqBox>V<sub>rec</sub> = V<sub>Te high→low</sub> − V<sub>T</sub> − (C<sub>RS_lowPEEP</sub> × ΔPEEP)</EqBox>
      <EqBox>R/I = V<sub>rec</sub> / (C<sub>RS_lowPEEP</sub> × ΔPEEP)</EqBox>

      <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
        <Metric label="Vrec" value={vrec.toFixed(0)} unit="mL" color={vrec > 0 ? COLORS.green : COLORS.red} />
        <Metric label="R/I Ratio" value={ri.toFixed(2)} unit="" color={ri > 0.5 ? COLORS.green : COLORS.yellow} />
      </div>

      {ri > 0.5 ? (
        <Callout type="success"><Term abbr="R/I">R/I</Term> {">"} 0.5 → High recruitability. Higher <Term abbr="PEEP">PEEP</Term> is likely beneficial — recruited volume substantially exceeds passive inflation.</Callout>
      ) : (
        <Callout type="warn"><Term abbr="R/I">R/I</Term> ≤ 0.5 → Low recruitability. Limited benefit from high <Term abbr="PEEP">PEEP</Term>. A low-PEEP approach is physiologically justified.</Callout>
      )}
    </div>
  );
}

// Module 6: Time Constant & Expiratory Flow
function ModuleTimeConstant() {
  const isMobile = useIsMobile();
  const [crs, setCrs] = useState(50);
  const [rrs, setRrs] = useState(10);
  const [vt, setVt] = useState(450);
  const [tExp, setTExp] = useState(3.0);

  const tau = (crs / 1000) * rrs;
  const threeT = 3 * tau;
  const percentExhaled = (1 - Math.exp(-tExp / tau)) * 100;
  const trappedVol = vt * Math.exp(-tExp / tau);

  const data = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * 5;
      const v = vt * Math.exp(-t / tau);
      pts.push({ t, v });
    }
    return pts;
  }, [vt, tau]);

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Expiratory Time Constant (τ)
      </h3>
      <EqBox>τ = C<sub>RS</sub> × R<sub>RS</sub> &nbsp;&nbsp;|&nbsp;&nbsp; V<sub>exp</sub>(t) = V<sub>T</sub> × e<sup>−t/τ</sup></EqBox>
      <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "6px 0 12px" }}>
        After 3<Term abbr="τ">τ</Term>, ~95% of tidal volume is exhaled. Insufficient expiratory time relative to <Term abbr="τ">τ</Term> causes dynamic hyperinflation and intrinsic <Term abbr="PEEP">PEEP</Term>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Slider label="C_RS" value={crs} min={15} max={100} step={5} onChange={setCrs} unit=" mL/cmH₂O" color={COLORS.green} />
        <Slider label="R_RS" value={rrs} min={5} max={30} step={1} onChange={setRrs} unit=" cmH₂O/L/s" color={COLORS.red} />
        <Slider label="Vt" value={vt} min={200} max={700} step={10} onChange={setVt} unit=" mL" color={COLORS.accent} />
        <Slider label="Exp. Time" value={tExp} min={0.5} max={5} step={0.1} onChange={setTExp} unit=" s" color={COLORS.orange} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <Metric label="τ" value={tau.toFixed(2)} unit="s" color={COLORS.accent} />
        <Metric label="3τ" value={threeT.toFixed(2)} unit="s" color={COLORS.yellow} />
        <Metric label="Exhaled" value={percentExhaled.toFixed(0)} unit="%" color={COLORS.green} />
        <Metric label="Trapped" value={trappedVol.toFixed(0)} unit="mL" color={COLORS.red} warn={trappedVol > 50} />
      </div>

      {tExp < threeT && <Callout type="warn">Expiratory time ({tExp.toFixed(1)}s) {"<"} 3<Term abbr="τ">τ</Term> ({threeT.toFixed(2)}s) — incomplete exhalation → dynamic hyperinflation & auto-PEEP. Flow won't reach zero before next breath.</Callout>}

      <WaveformCanvas data={data} yLabel="Volume (mL)" yMin={0} yMax={vt + 50} color={COLORS.orange}
        annotations={[
          { t: tau, val: vt * Math.exp(-1), label: "1τ (63%)", color: COLORS.accent },
          { t: threeT, val: vt * Math.exp(-3), label: "3τ (95%)", color: COLORS.green },
          { t: tExp, val: vt * Math.exp(-tExp / tau), label: `tExp`, color: tExp < threeT ? COLORS.red : COLORS.green },
        ]}
      />
    </div>
  );
}

// ─── Mini P-V Canvas for Board Pattern Cards ───
const NORMAL_PV_PARAMS = { peep: 5, vt: 400, crs: 60, rrs: 8, alpha: 0.02, beta: 0.02 };

function MiniPVCanvas({ pvParams, color, cardName }) {
  const canvasRef = useRef(null);
  const W = 160, H = 110;
  const isNormalCard = cardName === "Normal";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Generate both loops
    const normalLoop = generatePVLoop(NORMAL_PV_PARAMS);
    const pathLoop = generatePVLoop(pvParams);

    // Air trapping: shift the loop upward so it doesn't close at V=0
    const trappedVol = pvParams.trapping || 0;
    if (trappedVol > 0) {
      // Shift insp limb up — starts at trapped volume
      pathLoop.insp.forEach(d => { d.v += trappedVol; });
      // Shift exp limb up — but the last ~20% decays less (incomplete exhalation)
      const n = pathLoop.exp.length;
      pathLoop.exp.forEach((d, i) => {
        const frac = i / n; // 0 at top, 1 at bottom
        // Full offset at top, decays to trappedVol at bottom (never reaches 0)
        d.v += trappedVol * (1 - frac * 0.3);
      });
    }

    // Determine shared axis range from BOTH loops
    const allP = [
      ...normalLoop.insp.map(d => d.p), ...normalLoop.exp.map(d => d.p),
      ...pathLoop.insp.map(d => d.p), ...pathLoop.exp.map(d => d.p),
    ];
    const allV = [
      ...normalLoop.insp.map(d => d.v), ...normalLoop.exp.map(d => d.v),
      ...pathLoop.insp.map(d => d.v), ...pathLoop.exp.map(d => d.v),
    ];
    const pMin = Math.floor(Math.min(...allP) - 2);
    const pMax = Math.ceil(Math.max(...allP) + 2);
    const vMin = Math.min(0, Math.floor(Math.min(...allV) - 10));
    const vMax = Math.ceil(Math.max(...allV) + 20);

    const pad = { l: 6, r: 6, t: 6, b: 6 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const mapP = (p) => pad.l + ((p - pMin) / (pMax - pMin)) * plotW;
    const mapV = (v) => pad.t + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

    // Helper: draw a loop (fill + insp solid + exp dashed)
    const drawLoop = (loop, col, fillAlpha, inspWidth, expWidth, expAlpha, dashed) => {
      // Fill
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      loop.insp.forEach((d, i) => { const x = mapP(d.p), y = mapV(d.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      for (let i = loop.exp.length - 1; i >= 0; i--) { ctx.lineTo(mapP(loop.exp[i].p), mapV(loop.exp[i].v)); }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Insp limb
      ctx.strokeStyle = col;
      ctx.globalAlpha = dashed ? 0.25 : 1;
      ctx.lineWidth = inspWidth;
      ctx.setLineDash([]);
      ctx.beginPath();
      loop.insp.forEach((d, i) => { const x = mapP(d.p), y = mapV(d.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke();

      // Exp limb
      ctx.globalAlpha = dashed ? 0.25 : expAlpha;
      ctx.lineWidth = expWidth;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      loop.exp.forEach((d, i) => { const x = mapP(d.p), y = mapV(d.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };

    // 1) Normal reference loop (faint) — skip for Normal card
    if (!isNormalCard) {
      drawLoop(normalLoop, COLORS.textMuted, 0.05, 1.2, 1, 0.25, true);
    }

    // 2) Static compliance line through NORMAL loop center
    if (!isNormalCard) {
      ctx.strokeStyle = COLORS.textMuted;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mapP(NORMAL_PV_PARAMS.peep), mapV(0));
      ctx.lineTo(mapP(normalLoop.pplat), mapV(NORMAL_PV_PARAMS.vt));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 3) Pathological loop on top
    drawLoop(pathLoop, color, 0.10, 2.5, 2, 0.7, false);

    // 4) Low Compliance: also draw pathological compliance line in accent color
    if (cardName === "Low Compliance") {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mapP(pvParams.peep), mapV(0));
      ctx.lineTo(mapP(pathLoop.pplat), mapV(pvParams.vt));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 5) High Resistance: double-headed arrow at mid-volume showing gap
    if (cardName === "High Resistance") {
      const midIdx = Math.floor(pathLoop.insp.length * 0.5);
      const inspPt = pathLoop.insp[midIdx];
      // Find exp point at same volume
      let expP = inspPt.p;
      for (const d of pathLoop.exp) {
        if (Math.abs(d.v - inspPt.v) < pvParams.vt * 0.05) { expP = d.p; break; }
      }
      const yMid = mapV(inspPt.v);
      const xL = mapP(expP) + 2;
      const xR = mapP(inspPt.p) - 2;
      if (xR - xL > 8) {
        ctx.strokeStyle = COLORS.orange;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.9;
        // Shaft
        ctx.beginPath(); ctx.moveTo(xL, yMid); ctx.lineTo(xR, yMid); ctx.stroke();
        // Left arrowhead
        ctx.beginPath(); ctx.moveTo(xL, yMid); ctx.lineTo(xL + 4, yMid - 3); ctx.moveTo(xL, yMid); ctx.lineTo(xL + 4, yMid + 3); ctx.stroke();
        // Right arrowhead
        ctx.beginPath(); ctx.moveTo(xR, yMid); ctx.lineTo(xR - 4, yMid - 3); ctx.moveTo(xR, yMid); ctx.lineTo(xR - 4, yMid + 3); ctx.stroke();
        // "R" label
        ctx.fillStyle = COLORS.orange;
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("R", (xL + xR) / 2, yMid - 5);
        ctx.globalAlpha = 1;
      }
    }

    // 6) Air Trapping: red highlight at the gap where loop doesn't close
    if (cardName === "Air Trapping") {
      const lastExp = pathLoop.exp[pathLoop.exp.length - 1];
      const firstInsp = pathLoop.insp[0];
      const gapY1 = mapV(firstInsp.v);
      const gapY2 = mapV(lastExp.v);
      if (Math.abs(gapY1 - gapY2) > 3) {
        const gapX = mapP((lastExp.p + firstInsp.p) / 2);
        // Small red arrow pointing at the gap
        ctx.strokeStyle = COLORS.red;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(gapX + 12, Math.min(gapY1, gapY2) + 3);
        ctx.lineTo(gapX + 4, Math.min(gapY1, gapY2) + 3);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(gapX + 4, Math.min(gapY1, gapY2) + 3);
        ctx.lineTo(gapX + 8, Math.min(gapY1, gapY2));
        ctx.moveTo(gapX + 4, Math.min(gapY1, gapY2) + 3);
        ctx.lineTo(gapX + 8, Math.min(gapY1, gapY2) + 6);
        ctx.stroke();
        // Gap bracket
        ctx.strokeStyle = COLORS.red;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(gapX, gapY1);
        ctx.lineTo(gapX, gapY2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

  }, [pvParams, color, cardName, isNormalCard]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: W,
        height: H,
        borderRadius: 6,
        background: "#0d1117",
        border: `1px solid ${COLORS.cardBorder}`,
      }}
    />
  );
}

// Module 8: Dynamic P-V Loops
function ModulePVLoops() {
  const isMobile = useIsMobile();
  const [peep, setPeep] = useState(5);
  const [vt, setVt] = useState(450);
  const [crs, setCrs] = useState(50);
  const [rrs, setRrs] = useState(10);
  const [alpha, setAlpha] = useState(0.1);
  const [beta, setBeta] = useState(0.1);
  const [activeScenario, setActiveScenario] = useState(null);
  const [quizSelected, setQuizSelected] = useState(null);

  const applyScenario = (key) => {
    const s = PV_SCENARIOS[key];
    setCrs(s.crs); setRrs(s.rrs); setAlpha(s.alpha); setBeta(s.beta);
    setActiveScenario(key);
  };

  const pvData = useMemo(() => generatePVLoop({ peep, vt, crs, rrs, alpha, beta }), [peep, vt, crs, rrs, alpha, beta]);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const cw = useContainerWidth(containerRef);
  const ch = Math.max(180, Math.round(cw * 0.55));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cw < 10) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);
    drawGrid(ctx, cw, ch);

    const fs = Math.max(9, Math.round(cw * 0.022));
    const padL = fs * 4, padR = fs * 2, padT = fs * 2, padB = fs * 3;
    const plotW = cw - padL - padR;
    const plotH = ch - padT - padB;

    // Determine axis ranges
    const allP = [...pvData.insp.map(d => d.p), ...pvData.exp.map(d => d.p)];
    const pMin = Math.floor(Math.min(...allP) - 2);
    const pMax = Math.ceil(Math.max(...allP) + 2);
    const vMin = 0;
    const vMax = vt + 50;

    const mapP = (p) => padL + ((p - pMin) / (pMax - pMin)) * plotW;
    const mapV = (v) => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

    // Axis labels
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `${fs}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("Paw (cmH₂O)", cw / 2, ch - fs * 0.5);
    ctx.save();
    ctx.translate(fs, ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Volume (mL)", 0, 0);
    ctx.restore();

    // Y-axis ticks
    ctx.textAlign = "right";
    ctx.font = `${Math.max(8, fs - 1)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = COLORS.textMuted;
    for (let i = 0; i <= 4; i++) {
      const val = vMin + (vMax - vMin) * (i / 4);
      ctx.fillText(Math.round(val), padL - 3, mapV(val) + fs * 0.35);
    }
    // X-axis ticks
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const val = pMin + (pMax - pMin) * (i / 4);
      ctx.fillText(Math.round(val), mapP(val), ch - padB + fs * 1.3);
    }

    // Filled loop area (subtle) — includes end-insp pause connecting line
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    pvData.insp.forEach((d, i) => { const x = mapP(d.p), y = mapV(d.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    // End-insp pause: horizontal line from Ppeak to Pplat at V=Vt
    if (pvData.pplat !== undefined) ctx.lineTo(mapP(pvData.pplat), mapV(vt));
    pvData.exp.forEach((d) => { ctx.lineTo(mapP(d.p), mapV(d.v)); });
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Inspiration limb (solid)
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pvData.insp.forEach((d, i) => { const x = mapP(d.p), y = mapV(d.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke();

    // End-inspiratory pause line (Ppeak → Pplat at Vt) — thin solid line
    if (pvData.ppeak !== undefined && pvData.pplat !== undefined) {
      ctx.strokeStyle = COLORS.textMuted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(mapP(pvData.ppeak), mapV(vt));
      ctx.lineTo(mapP(pvData.pplat), mapV(vt));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Expiration limb (dashed)
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    pvData.exp.forEach((d, i) => { const x = mapP(d.p), y = mapV(d.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke();
    ctx.setLineDash([]);

    // Static compliance line (thin gray dashed) from (PEEP, 0) to (Pplat, Vt)
    if (pvData.pplat !== undefined) {
      ctx.strokeStyle = COLORS.textMuted;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(mapP(peep), mapV(0));
      ctx.lineTo(mapP(pvData.pplat), mapV(vt));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Dynamic compliance slope line
    const mid = Math.floor(pvData.insp.length * 0.3);
    const top = Math.floor(pvData.insp.length * 0.7);
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(mapP(pvData.insp[mid].p), mapV(pvData.insp[mid].v));
    ctx.lineTo(mapP(pvData.insp[top].p), mapV(pvData.insp[top].v));
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow labels
    ctx.font = `bold ${fs}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = COLORS.accent;
    ctx.textAlign = "left";
    ctx.fillText("← Insp", mapP(pvData.insp[Math.floor(pvData.insp.length * 0.5)].p) + 4, mapV(pvData.insp[Math.floor(pvData.insp.length * 0.5)].v) - 6);
    ctx.fillStyle = COLORS.orange;
    ctx.fillText("Exp →", mapP(pvData.exp[Math.floor(pvData.exp.length * 0.5)].p) - fs * 4, mapV(pvData.exp[Math.floor(pvData.exp.length * 0.5)].v) + fs + 4);

    // Ppeak / Pplat labels at top of loop
    if (pvData.ppeak !== undefined && pvData.pplat !== undefined) {
      ctx.font = `bold ${Math.max(8, fs - 1)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = COLORS.red;
      ctx.textAlign = "center";
      ctx.fillText("Ppeak", mapP(pvData.ppeak), mapV(vt) - 6);
      ctx.fillStyle = COLORS.accent;
      ctx.fillText("Pplat", mapP(pvData.pplat), mapV(vt) - 6);
    }

    // UIP annotation
    if (alpha > 0.2) {
      const uipIdx = Math.floor(pvData.insp.length * 0.85);
      const d = pvData.insp[uipIdx];
      ctx.fillStyle = COLORS.red;
      ctx.font = `bold ${fs}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "right";
      ctx.fillText("UIP ↗", mapP(d.p) - 4, mapV(d.v) + 2);
    }
    // LIP annotation
    if (beta > 0.2) {
      const lipIdx = Math.floor(pvData.insp.length * 0.15);
      const d = pvData.insp[lipIdx];
      ctx.fillStyle = COLORS.green;
      ctx.font = `bold ${fs}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "left";
      ctx.fillText("LIP ↗", mapP(d.p) + 4, mapV(d.v) + fs + 2);
    }
  }, [pvData, cw, ch, vt, alpha, beta]);

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 4px", fontFamily: "'Space Grotesk', sans-serif" }}>
        📊 P-V Loops
      </h3>
      <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 14px" }}>
        P-V loops are displayed in real-time on every modern ventilator. The shape tells you <Term abbr="C_RS">compliance</Term>, <Term abbr="Resistance">resistance</Term>, <Term abbr="Overdistension">overdistension</Term>, and <Term abbr="Air Trapping">air trapping</Term> at a glance — without ordering any tests. Board favorite: identifying the pathology from the loop shape.
      </p>

      {/* ── Board Patterns ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>Board Patterns — the 5 loops you must recognize</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
          {[
            {
              name: "Normal", icon: "✅", color: COLORS.green, shape: "Narrow almond, straight compliance slope, small Ppeak–Pplat gap", cause: "Healthy lungs, normal mechanics",
              pv: { peep: 5, vt: 400, crs: 60, rrs: 8, alpha: 0.02, beta: 0.02 }
            },
            {
              name: "Low Compliance", icon: "🫁", color: COLORS.red, shape: "Loop shifts RIGHT and becomes steeper — less volume per unit pressure", cause: "ARDS, pulmonary fibrosis, chest wall restriction",
              pv: { peep: 5, vt: 400, crs: 22, rrs: 10, alpha: 0.15, beta: 0.05 }
            },
            {
              name: "High Resistance", icon: "🌊", color: COLORS.orange, shape: "Loop WIDENS (large gap between insp and exp limbs). Ppeak rises but Pplat stays the same", cause: "Bronchospasm, mucus plug, kinked ETT",
              pv: { peep: 5, vt: 400, crs: 60, rrs: 24, alpha: 0.02, beta: 0.02 }
            },
            {
              name: "Air Trapping", icon: "🔄", color: COLORS.purple, shape: "Exp limb doesn't return to baseline volume — loop doesn't close at the bottom", cause: "COPD, inadequate exp time, auto-PEEP",
              pv: { peep: 8, vt: 400, crs: 70, rrs: 20, alpha: 0.02, beta: 0.02, trapping: 60 }
            },
            {
              name: "Overdistension (Beak Sign)", icon: "⚠️", color: COLORS.yellow, shape: "Upper insp limb flattens and curves rightward — the lung is getting stiffer as you inflate more", cause: "Excessive Vt or PEEP",
              pv: { peep: 5, vt: 500, crs: 45, rrs: 10, alpha: 0.40, beta: 0.02 }
            },
          ].map((card, i) => (
            <div key={i} style={{ ...bStyles.miniCard, borderLeft: `3px solid ${card.color}`, padding: "10px 12px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: card.color, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{card.icon} {card.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.text, lineHeight: 1.5, marginBottom: 4 }}>{card.shape}</div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, lineHeight: 1.4 }}>{card.cause}</div>
                </div>
                <MiniPVCanvas pvParams={card.pv} color={card.color} cardName={card.name} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Key Landmark Callout ── */}
      <Callout type="info">
        <strong>Key Landmark — <Term abbr="Ppeak">Ppeak</Term> vs <Term abbr="Pplat">Pplat</Term>:</strong> On any P-V loop, the horizontal distance from <Term abbr="Pplat">Pplat</Term> to <Term abbr="Ppeak">Ppeak</Term> = resistive pressure (<Term abbr="R_RS">R</Term> × V̇). If <Term abbr="Ppeak">Ppeak</Term> is high but <Term abbr="Pplat">Pplat</Term> is normal → resistance problem (bronchospasm, mucus, kinked <Term abbr="ETT">ETT</Term>). If both are high → compliance problem (<Term abbr="ARDS">ARDS</Term>, fibrosis, pneumothorax). This is the single most testable concept from P-V loops.
      </Callout>

      {/* ── Board-Style Vignette ── */}
      <div style={{ background: "#0d1117", border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Board-Style Question</div>
        <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6, marginBottom: 12 }}>
          A 58-year-old man on <Term abbr="ACV">ACV</Term> (<Term abbr="Vt">Vt</Term> 450, <Term abbr="RR">RR</Term> 16, <Term abbr="PEEP">PEEP</Term> 5) has <Term abbr="Ppeak">Ppeak</Term> 38 and <Term abbr="Pplat">Pplat</Term> 20. The P-V loop shows a wide gap between inspiratory and expiratory limbs. Which is the most likely cause?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "ARDS", idx: 0 },
            { label: "Mucus plugging", idx: 1 },
            { label: "Pneumothorax", idx: 2 },
            { label: "Pulmonary fibrosis", idx: 3 },
          ].map((opt) => {
            const correct = 1;
            let bg = "transparent", border = COLORS.cardBorder, col = COLORS.text;
            if (quizSelected !== null) {
              if (opt.idx === correct) { bg = `${COLORS.green}22`; border = COLORS.green; col = COLORS.green; }
              else if (opt.idx === quizSelected) { bg = `${COLORS.red}22`; border = COLORS.red; col = COLORS.red; }
            }
            return (
              <button key={opt.idx} onClick={() => { if (quizSelected === null) setQuizSelected(opt.idx); }} style={{
                padding: "8px 12px", borderRadius: 8, border: `1px solid ${border}`,
                background: bg, color: col, textAlign: "left", cursor: quizSelected !== null ? "default" : "pointer",
                fontSize: 12, fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s",
              }}>
                <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + opt.idx)}.</span>{opt.label}
              </button>
            );
          })}
        </div>
        {quizSelected !== null && (
          <Callout type={quizSelected === 1 ? "success" : "danger"}>
            <strong>Wide loop = high resistance.</strong> The gap between the inspiratory and expiratory limbs is proportional to <Term abbr="R_RS">R</Term> × V̇. <Term abbr="Ppeak">Ppeak</Term> 38 with <Term abbr="Pplat">Pplat</Term> 20 means P<sub>res</sub> = 18 cmH₂O — that's almost all resistance. <Term abbr="ARDS">ARDS</Term> and fibrosis would elevate <Term abbr="Pplat">Pplat</Term> (compliance problem), not widen the loop.{" "}
            <strong style={{ color: COLORS.accent }}>Try the COPD preset in the simulator below to see this pattern.</strong>
          </Callout>
        )}
      </div>

      {/* ── Divider ── */}
      <hr style={{ border: "none", borderTop: `1px solid ${COLORS.cardBorder}`, margin: "20px 0" }} />

      {/* ── Simulator Section ── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>Interactive Simulator</div>
      <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>Adjust sliders to see how each parameter changes the loop shape.</p>
      <EqBox>C<sub>eff</sub>(V) = C<sub>RS</sub> × (1 − α(V/Vt)² + β(V/Vt))</EqBox>

      {/* Clinical Scenario Presets */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
        {Object.entries(PV_SCENARIOS).map(([key, s]) => (
          <button key={key} onClick={() => applyScenario(key)} style={{
            padding: "5px 12px", borderRadius: 6, fontSize: 11,
            border: `1px solid ${activeScenario === key ? s.color : COLORS.cardBorder}`,
            background: activeScenario === key ? `${s.color}22` : "transparent",
            color: activeScenario === key ? s.color : COLORS.textDim,
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontWeight: activeScenario === key ? 700 : 400,
          }}>{s.label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, margin: "8px 0" }}>
        <div>
          <Slider label="PEEP" value={peep} min={0} max={20} step={1} onChange={v => { setPeep(v); setActiveScenario(null); }} unit=" cmH₂O" color={COLORS.green} />
          <Slider label="Vt" value={vt} min={200} max={700} step={10} onChange={v => { setVt(v); setActiveScenario(null); }} unit=" mL" color={COLORS.accent} />
          <Slider label="C_RS" value={crs} min={15} max={100} step={5} onChange={v => { setCrs(v); setActiveScenario(null); }} unit=" mL/cmH₂O" color={COLORS.green} />
        </div>
        <div>
          <Slider label="R_RS" value={rrs} min={5} max={30} step={1} onChange={v => { setRrs(v); setActiveScenario(null); }} unit=" cmH₂O/L/s" color={COLORS.red} />
          <Slider label="Overdistension (α)" value={alpha} min={0} max={0.5} step={0.05} onChange={v => { setAlpha(v); setActiveScenario(null); }} unit="" color={COLORS.red} />
          <Slider label="Recruitment (β)" value={beta} min={0} max={0.5} step={0.05} onChange={v => { setBeta(v); setActiveScenario(null); }} unit="" color={COLORS.green} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <Metric label="Ppeak" value={pvData.ppeak.toFixed(0)} unit="cmH₂O" color={COLORS.red} />
        <Metric label="Pplat" value={pvData.pplat.toFixed(0)} unit="cmH₂O" color={COLORS.accent} />
        <Metric label="Loop Area" value={pvData.loopArea.toFixed(0)} unit="mL·cmH₂O" color={COLORS.orange} />
        <Metric label="Dyn C" value={pvData.dynC.toFixed(0)} unit="mL/cmH₂O" color={COLORS.yellow} />
        <Metric label="PEEP" value={peep} unit="cmH₂O" color={COLORS.green} />
      </div>

      {alpha > 0.2 && beta > 0.2 && <Callout type="warn"><strong>Simultaneous high recruitment and overdistension is uncommon</strong> — in clinical practice, typically one process dominates. Consider using the clinical scenario presets above for realistic combinations.</Callout>}
      {alpha > 0.3 && <Callout type="danger">High overdistension (α {'>'} 0.3) — note the flattening at high volumes (UIP). Consider reducing <Term abbr="Vt">Vt</Term> or <Term abbr="PEEP">PEEP</Term>.</Callout>}
      {beta > 0.3 && <Callout type="info">Significant recruitment (β {'>'} 0.3) — note the concavity at low volumes (LIP). Consider increasing <Term abbr="PEEP">PEEP</Term> to keep the lung open.</Callout>}

      <div ref={containerRef} style={{ width: "100%", marginTop: 8 }}>
        <canvas ref={canvasRef} style={{ display: "block", borderRadius: 8, background: "#0d1117", border: `1px solid ${COLORS.cardBorder}` }} />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", flexWrap: "wrap" }}>
        <span><span style={{ color: COLORS.accent }}>━━</span> Inspiration</span>
        <span><span style={{ color: COLORS.orange }}>╌╌</span> Expiration</span>
        <span><span style={{ color: COLORS.textMuted }}>╌╌</span> Static C</span>
        <span><span style={{ color: COLORS.yellow }}>╌╌</span> Dyn C</span>
      </div>
    </div>
  );
}

// Module 9: Acinar Recruitment Animation
function ModuleRecruitment() {
  const isMobile = useIsMobile();
  const [peep, setPeep] = useState(8);
  const [vt, setVt] = useState(450);
  const [rr, setRr] = useState(14);
  const crs = 30; // fixed ARDS-range compliance

  const acini = useMemo(() => generateAcini(100), []);
  const { breathPhase, isPlaying, toggle } = useBreathAnimation(rr);

  const { states, recruited, transitional, derecruited, paw, pPlateau } = getAcinarStates(acini, peep, vt, crs, breathPhase);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const cw = useContainerWidth(containerRef);
  const gridSize = Math.min(cw, 400);
  const cellSize = gridSize / 10;

  const stateColors = {
    recruited: COLORS.green,
    "transitional-open": COLORS.yellow,
    "transitional-closed": "#78350f",
    derecruited: "#334155",
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gridSize < 10) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = gridSize * dpr;
    canvas.height = gridSize * dpr;
    canvas.style.width = gridSize + "px";
    canvas.style.height = gridSize + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, gridSize, gridSize);

    // Background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, gridSize, gridSize);

    const r = cellSize * 0.38;
    states.forEach(a => {
      const cx = a.col * cellSize + cellSize / 2;
      const cy = a.row * cellSize + cellSize / 2;

      // Glow for open acini
      if (a.state === "recruited" || a.state === "transitional-open") {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = (a.state === "recruited" ? COLORS.green : COLORS.yellow) + "15";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = stateColors[a.state];
      ctx.fill();

      // Border
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Breath phase indicator bar at bottom
    const barY = gridSize - 4;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, barY, gridSize, 4);
    const inspFrac = 0.4;
    const barColor = breathPhase < inspFrac ? COLORS.accent : COLORS.orange;
    ctx.fillStyle = barColor;
    ctx.fillRect(0, barY, gridSize * breathPhase, 4);
  }, [states, gridSize, cellSize, breathPhase]);

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 4px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Acinar Recruitment & Derecruitment
      </h3>
      <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 10px" }}>
        Each circle represents an acinus with its own critical opening pressure. Watch how <Term abbr="PEEP">PEEP</Term> and <Term abbr="Vt">Vt</Term> determine which acini stay open, which cycle open/shut (atelectrauma risk), and which never participate.
      </p>
      <EqBox>RDC<sub>n</sub> = T<sub>rec</sub> / T<sub>tot</sub> &nbsp;|&nbsp; % Recruited(P) = 3.43 × P + 7.6</EqBox>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, margin: "10px 0" }}>
        <div>
          <Slider label="PEEP" value={peep} min={0} max={20} step={1} onChange={setPeep} unit=" cmH₂O" color={COLORS.green} />
          <Slider label="Vt" value={vt} min={200} max={700} step={10} onChange={setVt} unit=" mL" color={COLORS.accent} />
          <Slider label="RR (animation speed)" value={rr} min={8} max={30} step={1} onChange={setRr} unit=" /min" color={COLORS.purple} />
        </div>
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <Metric label="Paw" value={paw.toFixed(0)} unit="cmH₂O" color={COLORS.accent} />
            <Metric label="Pplat" value={pPlateau.toFixed(0)} unit="cmH₂O" color={COLORS.yellow} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Metric label="Recruited" value={recruited} unit="%" color={COLORS.green} />
            <Metric label="Transitional" value={transitional} unit="%" color={COLORS.yellow} warn={transitional > 60} />
            <Metric label="Derecruited" value={derecruited} unit="%" color={COLORS.red} />
          </div>
        </div>
      </div>

      {/* Horizontal stacked bar */}
      <div style={{ display: "flex", height: 20, borderRadius: 6, overflow: "hidden", border: `1px solid ${COLORS.cardBorder}`, margin: "8px 0" }}>
        {recruited > 0 && <div style={{ width: `${recruited}%`, background: COLORS.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#000", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", minWidth: recruited > 8 ? undefined : 0 }}>{recruited > 8 ? `${recruited}%` : ""}</div>}
        {transitional > 0 && <div style={{ width: `${transitional}%`, background: COLORS.yellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#000", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", minWidth: transitional > 8 ? undefined : 0 }}>{transitional > 8 ? `${transitional}%` : ""}</div>}
        {derecruited > 0 && <div style={{ width: `${derecruited}%`, background: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", minWidth: derecruited > 8 ? undefined : 0 }}>{derecruited > 8 ? `${derecruited}%` : ""}</div>}
      </div>

      {/* Play / Pause */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0" }}>
        <button onClick={toggle} style={{
          padding: "8px 20px", borderRadius: 6, border: `1px solid ${COLORS.accent}`,
          background: isPlaying ? `${COLORS.accent}22` : "transparent", color: COLORS.accent,
          cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
          minHeight: 44, minWidth: 44,
        }}>{isPlaying ? "⏸ Pause" : "▶ Play Breath"}</button>
        <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
          {breathPhase < 0.4 ? "Inspiration" : "Expiration"} — {(breathPhase * 100).toFixed(0)}%
        </span>
      </div>

      {transitional > 60 && <Callout type="warn"><strong>{'>'} 60% transitional acini</strong> — high risk of atelectrauma. These acini cycle open/shut each breath, causing repetitive mechanical stress. Consider increasing <Term abbr="PEEP">PEEP</Term> to keep them recruited.</Callout>}
      {recruited > 80 && vt > 400 && <Callout type="danger"><strong>{'>'} 80% recruited with high Vt</strong> — volutrauma risk. Most of the lung is open and receiving large tidal volumes. Consider reducing <Term abbr="Vt">Vt</Term>.</Callout>}
      {derecruited > 60 && <Callout type="danger"><strong>{'>'} 60% derecruited</strong> — most of the lung is not participating in gas exchange. Consider increasing <Term abbr="PEEP">PEEP</Term> to recruit collapsed acini.</Callout>}

      <div ref={containerRef} style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 8 }}>
        <canvas ref={canvasRef} style={{ display: "block", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}` }} />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", justifyContent: "center", flexWrap: "wrap" }}>
        <span>🟢 Recruited</span>
        <span>🟡 Transitional (open)</span>
        <span style={{ color: "#78350f" }}>⬤ Transitional (closed)</span>
        <span style={{ color: "#475569" }}>⬤ Derecruited</span>
      </div>
    </div>
  );
}

// Module 10: PEEP Optimization Synthesis
function ModuleSynthesis() {
  const [peep, setPeep] = useState(10);
  const [pplat, setPplat] = useState(25);
  const [pOpt, setPOpt] = useState(14);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const cw = useContainerWidth(containerRef);
  const ch = Math.max(180, Math.round(cw * 0.5));

  const recruPct = (p) => Math.min(100, Math.max(0, 3.43 * p + 7.6));
  const eNorm = (p) => 1 + 1.5 * Math.pow((p - pOpt) / pOpt, 2);

  const pctAtPeep = recruPct(peep);
  const pctAtPplat = recruPct(pplat);
  const pctAtOpt = recruPct(pOpt);
  const midP = (peep + pplat) / 2;
  const deviation = midP - pOpt;
  const zoneLabel = Math.abs(deviation) < 3 ? "balanced" : deviation < 0 ? "rd" : "od";
  const zoneColors = { balanced: COLORS.green, rd: COLORS.yellow, od: COLORS.red };
  const zoneMessages = {
    balanced: "Operating near optimal — R/D and overdistension are balanced.",
    rd: "Operating below optimal — derecruitment and atelectrauma dominate.",
    od: "Operating above optimal — overdistension and volutrauma dominate.",
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cw < 10) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);
    drawGrid(ctx, cw, ch);

    const fs = Math.max(9, Math.round(cw * 0.022));
    const padL = fs * 4, padR = fs * 3, padT = fs * 2, padB = fs * 3;
    const plotW = cw - padL - padR;
    const plotH = ch - padT - padB;
    const pMin = 0, pMax = 40;

    const mapP = (p) => padL + ((p - pMin) / (pMax - pMin)) * plotW;
    const mapY = (frac) => padT + plotH - frac * plotH; // frac 0–1

    // Recruitment gradient background (subtle, opacity ~0.15)
    for (let px = 0; px < plotW; px++) {
      const p = pMin + (px / plotW) * (pMax - pMin);
      const pct = recruPct(p) / 100;
      ctx.fillStyle = `rgba(52, 211, 153, ${pct * 0.15})`;
      ctx.fillRect(padL + px, padT, 1, plotH);
    }

    // PEEP-to-Pplat operating window shading
    const x1 = mapP(Math.max(pMin, peep));
    const x2 = mapP(Math.min(pMax, pplat));
    ctx.fillStyle = zoneColors[zoneLabel] + "22";
    ctx.fillRect(x1, padT, x2 - x1, plotH);
    ctx.strokeStyle = zoneColors[zoneLabel] + "66";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x1, padT, x2 - x1, plotH);

    // PEEP and Pplat vertical lines
    [{ p: peep, label: "PEEP", col: COLORS.green }, { p: pplat, label: "Pplat", col: COLORS.yellow }].forEach(({ p, label, col }) => {
      const x = mapP(p);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.font = `bold ${fs}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(label, x, padT - 4);
    });

    // P_opt vertical line (prominent)
    const xOpt = mapP(pOpt);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(xOpt, padT); ctx.lineTo(xOpt, padT + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.accent;
    ctx.font = `bold ${fs + 1}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`P_opt = ${pOpt}`, xOpt, padT + plotH + fs * 1.5);

    // Elastance parabola
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const p = pMin + (px / plotW) * (pMax - pMin);
      const e = eNorm(p);
      const eMax = 4;
      const y = mapY(Math.max(0, 1 - (e - 1) / (eMax - 1))); // invert: lower E = better = higher on Y
      px === 0 ? ctx.moveTo(padL + px, y) : ctx.lineTo(padL + px, y);
    }
    ctx.stroke();

    // Recruitment % curve
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const p = pMin + (px / plotW) * (pMax - pMin);
      const y = mapY(recruPct(p) / 100);
      px === 0 ? ctx.moveTo(padL + px, y) : ctx.lineTo(padL + px, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // "%Recruited at P_opt" annotation
    ctx.fillStyle = COLORS.green;
    ctx.font = `bold ${fs}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    const recAtOpt = recruPct(pOpt);
    ctx.fillText(`${recAtOpt.toFixed(0)}% recruited`, xOpt + 6, mapY(recAtOpt / 100) - 4);

    // Axis labels
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `${fs}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("Paw (cmH₂O)", cw / 2, ch - fs * 0.3);
    ctx.save();
    ctx.translate(fs, ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("← Better mechanics / More recruited →", 0, 0);
    ctx.restore();

    // X-axis ticks
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `${Math.max(8, fs - 1)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    for (let p = 0; p <= 40; p += 10) {
      ctx.fillText(p, mapP(p), padT + plotH + fs * 2.5);
    }
  }, [peep, pplat, pOpt, cw, ch, zoneLabel]);

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 4px", fontFamily: "'Space Grotesk', sans-serif" }}>
        PEEP Optimization: The Tradeoff
      </h3>

      {/* Headline callout */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.accentDim}33, ${COLORS.purpleDim}33)`,
        border: `1px solid ${COLORS.accent}44`, borderRadius: 10,
        padding: 16, margin: "10px 0",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.accent, lineHeight: 1.4, fontFamily: "'Space Grotesk', sans-serif" }}>
          100% recruitment is not the goal.
        </div>
        <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, marginTop: 6 }}>
          At optimal pressure, only <strong style={{ color: COLORS.yellow }}>~40–45%</strong> of the lung is recruited (Amini et al., IEEE 2017). Pressures needed for full recruitment overdistend already-open tissue. The goal is <strong>minimizing total injury</strong> — balancing atelectrauma against volutrauma.
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
        <Slider label="PEEP" value={peep} min={0} max={20} step={1} onChange={setPeep} unit=" cmH₂O" color={COLORS.green} />
        <Slider label="Pplat" value={pplat} min={peep + 2} max={40} step={1} onChange={setPplat} unit=" cmH₂O" color={COLORS.yellow} />
        <Slider label="P_opt (optimal)" value={pOpt} min={8} max={25} step={1} onChange={setPOpt} unit=" cmH₂O" color={COLORS.accent} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <Metric label="% Recr @ PEEP" value={pctAtPeep.toFixed(0)} unit="%" color={COLORS.green} />
        <Metric label="% Recr @ Pplat" value={pctAtPplat.toFixed(0)} unit="%" color={COLORS.yellow} />
        <Metric label="% Recr @ P_opt" value={pctAtOpt.toFixed(0)} unit="%" color={COLORS.accent} />
      </div>

      <div style={{
        textAlign: "center", padding: 10, borderRadius: 8,
        background: `${zoneColors[zoneLabel]}15`, border: `1px solid ${zoneColors[zoneLabel]}33`,
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: zoneColors[zoneLabel], fontFamily: "'JetBrains Mono', monospace" }}>
          {zoneMessages[zoneLabel]}
        </div>
      </div>

      {pplat > 28 && <Callout type="danger">Above ~28 cmH₂O, the model predicts 100% recruitment — further pressure increases cause pure overdistension with no additional recruitment benefit.</Callout>}

      <div ref={containerRef} style={{ width: "100%", marginTop: 8 }}>
        <canvas ref={canvasRef} style={{ display: "block", borderRadius: 8, background: "#0d1117", border: `1px solid ${COLORS.cardBorder}` }} />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", flexWrap: "wrap" }}>
        <span><span style={{ color: COLORS.purple }}>━━</span> Elastance (lower = better)</span>
        <span><span style={{ color: COLORS.green }}>╌╌</span> % Recruited</span>
        <span>█ Operating window</span>
      </div>
    </div>
  );
}

// Module 7: Quiz
function ModuleQuiz() {
  const questions = [
    {
      q: "A patient on ACV has Ppeak 35, Pplat 28, PEEP 8. What is the driving pressure?",
      opts: ["27 cmH₂O", "20 cmH₂O", "7 cmH₂O", "35 cmH₂O"],
      correct: 1,
      explain: "ΔP = Pplat − PEEP = 28 − 8 = 20 cmH₂O. Note: ΔP uses Pplat (not Ppeak) and total PEEP.",
      category: "Basics",
    },
    {
      q: "Stress index of 0.75 on the pressure-time curve during ACV suggests:",
      opts: ["Overdistension — decrease PEEP", "Stable compliance — no change needed", "Intratidal recruitment — consider increasing PEEP", "Auto-PEEP — increase expiratory time"],
      correct: 2,
      explain: "SI < 0.9 → convex upward curve → compliance increasing during insufflation (recruitment). Consider ↑ PEEP.",
      category: "Waveforms",
    },
    {
      q: "Pcond > Pres on the airway pressure waveform. End-expiratory hold shows PEEPtot = set PEEP. What is present?",
      opts: ["Intrinsic PEEP", "Airway Opening Pressure (AOP)", "Normal mechanics", "Circuit leak"],
      correct: 1,
      explain: "Pcond > Pres with PEEPtot = set PEEP → no auto-PEEP → airway closure with AOP above PEEP. Perform low-flow insufflation to measure AOP. Set PEEP ≥ AOP.",
      category: "Waveforms",
    },
    {
      q: "After 3 time constants (3τ), approximately what percentage of tidal volume has been exhaled?",
      opts: ["63%", "86%", "95%", "99%"],
      correct: 2,
      explain: "1τ ≈ 63%, 2τ ≈ 86%, 3τ ≈ 95%, 5τ ≈ 99%. When expiratory time < 3τ, dynamic hyperinflation occurs.",
      category: "Basics",
    },
    {
      q: "R/I ratio of 0.3 after a single-breath PEEP decrement maneuver suggests:",
      opts: ["High recruitability — high PEEP beneficial", "Low recruitability — low PEEP approach justified", "Measurement error — repeat the maneuver", "Need for prone positioning first"],
      correct: 1,
      explain: "R/I ≤ 0.5 → limited recruitable lung → high PEEP provides more overdistension than recruitment. Low-PEEP strategy is physiologically appropriate.",
      category: "R/I Ratio",
    },
    {
      q: "A patient has ΔP 12, RR 20, Vt 400 mL, Ppeak 30. Approximate mechanical power?",
      opts: ["~9.4 J/min", "~18.8 J/min", "~12.0 J/min", "~24.0 J/min"],
      correct: 1,
      explain: "MP ≈ 0.098 × 20 × 0.4 × (30 − 0.5×12) = 0.098 × 20 × 0.4 × 24 = 18.816 → ~18.8 J/min. Actually, let's recalculate: 0.098 × 20 × 0.4 = 0.784. × 24 = 18.8 J/min. The correct answer is ~18.8.",
      category: "ΔP & MP",
    },
    {
      q: "A patient on ACV with ARDS has a P-V loop showing marked flattening at high volumes, with no concavity at low volumes. This pattern suggests:",
      opts: ["High recruitability — increase PEEP", "Overdistension — consider reducing Vt or PEEP", "Normal P-V relationship — no changes needed", "Auto-PEEP — increase expiratory time"],
      correct: 1,
      explain: "Flattening at high volumes = upper inflection point (UIP) = overdistension. The lung is being stretched beyond its elastic limit. With no LIP concavity (no recruitment), this is a 'stiff lung' pattern — reduce Vt or PEEP.",
      category: "P-V Loop",
    },
    {
      q: "You increase PEEP from 8 to 16 cmH₂O. On the recruitment animation, the percentage of transitional acini decreases sharply but the recruited percentage is now 85%. What is the main risk?",
      opts: ["Atelectrauma from cyclic R/D", "Volutrauma from overdistending already-open acini", "Decreased cardiac output only", "No significant risk — higher PEEP is always better"],
      correct: 1,
      explain: "At 85% recruitment with high PEEP, most acini are open and receiving tidal volume. The transitional zone shrank (good — less atelectrauma), but now the dominant risk is volutrauma: the already-open tissue is being overdistended. This is why the 'optimal' pressure is NOT 100% recruitment.",
      category: "Recruitment",
    },
    // ── New questions (9–18) ──
    {
      q: "A 62yo woman on ACV (Vt 350, RR 18, PEEP 10, FiO₂ 60%) has Ppeak 42 and Pplat 38. The most appropriate next step is:",
      opts: ["Suction the ETT", "Decrease tidal volume", "Administer albuterol nebulizer", "Increase PEEP to recruit lung"],
      correct: 1,
      explain: "Both Ppeak AND Pplat are elevated → compliance problem (not resistance). Pres = 42−38 = 4 (normal). Pplat 38 exceeds the 30 cmH₂O safety target. Reducing Vt lowers Pplat and driving pressure. Suctioning and albuterol treat resistance (normal here). More PEEP would worsen overdistension.",
      category: "Basics",
    },
    {
      q: "A patient with severe asthma on ACV suddenly becomes hypotensive. Ppeak is 55, Pplat is 18. The ventilator shows expiratory flow not returning to zero. The best intervention is:",
      opts: ["Increase PEEP to match auto-PEEP", "Disconnect from ventilator and allow full exhalation", "Give IV fluid bolus", "Increase respiratory rate to improve ventilation"],
      correct: 1,
      explain: "Classic auto-PEEP with hemodynamic compromise. Ppeak 55 with Pplat 18 = massive resistance (asthma). Exp flow not reaching zero = air trapping. The trapped volume acts like a PEEP of 30+ cmH₂O, compressing the vena cava and dropping preload. Disconnecting allows full exhalation and immediately restores venous return. Increasing RR would worsen trapping. Fluids are temporizing but don't fix the cause.",
      category: "Basics",
    },
    {
      q: "A patient on ACV has Pplat 22, PEEP 12, PEEPtot 12. The driving pressure is 10 cmH₂O. You increase PEEP to 16. New Pplat is 24, PEEPtot 16. The new driving pressure is:",
      opts: ["12 cmH₂O", "8 cmH₂O", "10 cmH₂O", "24 cmH₂O"],
      correct: 1,
      explain: "ΔP = Pplat − PEEPtot = 24 − 16 = 8 cmH₂O. Driving pressure DECREASED from 10 to 8, meaning compliance improved with higher PEEP (recruited lung made more alveoli available). This is a sign that the PEEP increase was beneficial — the lung is more recruitable. If ΔP had stayed the same or increased, the PEEP increase mainly overdistended without recruiting.",
      category: "ΔP & MP",
    },
    {
      q: "You are called to the bedside because the ventilator high-pressure alarm is sounding. The patient was recently repositioned. Ppeak is elevated but you cannot obtain a Pplat. The most likely cause is:",
      opts: ["Pneumothorax", "Mucus plug with complete airway obstruction", "Right mainstem intubation", "ARDS progression"],
      correct: 1,
      explain: "Inability to obtain a Pplat (no plateau during end-inspiratory hold) suggests complete or near-complete airway obstruction — no gas can equilibrate. A mucus plug with complete obstruction after repositioning is the most likely culprit. Mainstem intubation is possible after repositioning but would still allow a Pplat to be measured. PTX and ARDS would elevate both Ppeak and Pplat but wouldn't prevent obtaining a plateau.",
      category: "Waveforms",
    },
    {
      q: "A 70 kg male (height 178 cm) is intubated for COPD exacerbation. Initial vent settings should prioritize:",
      opts: ["High Vt (10 mL/kg) and high RR (20) to rapidly correct the hypercapnia", "Low Vt (6 mL/kg), low RR (10-12), and prolonged expiratory time", "Low Vt (6 mL/kg) and high PEEP (15) for lung recruitment", "High Vt (8 mL/kg), moderate RR (16), and high PEEP (10)"],
      correct: 1,
      explain: "COPD = high resistance + air trapping. Priority is allowing complete exhalation: low RR (10-12) gives a long expiratory time (3-4× the time constant). Vt 6-8 mL/kg IBW is appropriate. PEEP should be low (≤5) or matched to measured auto-PEEP. High RR or high PEEP would worsen dynamic hyperinflation. Rapidly correcting chronic hypercapnia risks post-hypercapnic alkalosis.",
      category: "Basics",
    },
    {
      q: "An ARDS patient on ACV (Vt 360, RR 28, PEEP 14, FiO₂ 80%) has pH 7.18, PaCO₂ 62. The appropriate response is:",
      opts: ["Increase Vt to 500 mL to improve CO₂ clearance", "Increase RR to 35 breaths/min", "Accept the respiratory acidosis and continue current settings", "Switch to pressure control ventilation"],
      correct: 2,
      explain: "This is permissive hypercapnia. In ARDS, lung-protective ventilation (6 mL/kg IBW) is prioritized over normalizing pH. pH 7.18 is below the commonly tolerated threshold (~7.20), but the answer is still to tolerate it rather than increase Vt above 6-8 mL/kg IBW, which causes VILI. RR 28 is already high — going to 35 risks auto-PEEP. If pH drops below 7.15, consider bicarbonate infusion rather than abandoning lung protection. Increasing Vt to 500 mL (>8 mL/kg) would worsen VILI.",
      category: "Basics",
    },
    {
      q: "A patient meets extubation criteria (FiO₂ 35%, PEEP 5, pH 7.38). The nursing team asks whether to start weaning by gradually reducing SIMV rate from 14 to 8 over 48 hours. Your response should be:",
      opts: ["Agree — SIMV weaning is evidence-based", "Disagree — perform a spontaneous breathing trial now", "Disagree — switch to pressure support and gradually wean", "Agree, but also reduce pressure support simultaneously"],
      correct: 1,
      explain: "The patient already meets extubation criteria. SIMV weaning is inferior to SBT-based protocols — evidence consistently shows longer time to liberation with SIMV. The correct approach: perform a paired SAT (hold sedation) + SBT (T-piece or low PS for 30-120 min). If passed, extubate. Gradual SIMV reduction delays extubation unnecessarily.",
      category: "Basics",
    },
    {
      q: "On the waveform display, you notice the pressure-time curve during constant-flow ACV shows an upward concavity in the latter half of inspiration (the curve bends upward). This suggests:",
      opts: ["Intratidal recruitment — consider increasing PEEP", "Intratidal overdistension — consider reducing Vt or PEEP", "Normal linear compliance — no changes needed", "Auto-PEEP — increase expiratory time"],
      correct: 1,
      explain: "Upward concavity = stress index > 1.1 = compliance is DECREASING during the breath (the lung is getting stiffer as you inflate). This is overdistension. The lung has reached its elastic limit partway through inspiration. Reduce Vt or PEEP. Recruitment would show the opposite pattern — downward convexity (stress index < 0.9), meaning compliance is improving during the breath.",
      category: "Waveforms",
    },
    {
      q: "A patient has C_RS 25 mL/cmH₂O and R_RS 18 cmH₂O/L/s. The time constant (τ) is 0.45 seconds. The RR is set at 22 with I:E ratio 1:2. Is expiratory time adequate?",
      opts: ["Yes — expiratory time exceeds 3τ", "No — expiratory time is less than 3τ, risk of auto-PEEP", "Cannot determine without knowing the tidal volume", "τ calculation is incorrect for these values"],
      correct: 0,
      explain: "At RR 22, total breath cycle = 60/22 = 2.73 seconds. With I:E of 1:2, expiratory time = 2.73 × (2/3) = 1.82 seconds. 3τ = 3 × 0.45 = 1.35 seconds. Expiratory time (1.82s) > 3τ (1.35s), so 95% of Vt should be exhaled. This is adequate. However, it's close — if RR increases to 28, exp time drops to 1.43s which barely exceeds 3τ. Note: τ = C_RS × R_RS = 0.025 L/cmH₂O × 18 = 0.45s ✓.",
      category: "Time Constant",
    },
    {
      q: "You perform a PEEP decrement maneuver (15 → 5 cmH₂O) and measure R/I ratio of 0.7. This result supports which management strategy?",
      opts: ["Use low PEEP (≤8) — the lung has limited recruitable tissue", "Use high PEEP (≥12) — significant recruitable lung is present", "The R/I ratio is uninterpretable at this PEEP step size", "Prone positioning is required before PEEP titration"],
      correct: 1,
      explain: "R/I > 0.5 = high recruitability. The volume gained from recruitment during the PEEP step-down substantially exceeds passive inflation. This means the lung has significant recruitable tissue that benefits from higher PEEP. Maintain PEEP ≥12 or higher. R/I ≤ 0.5 would support a low-PEEP strategy (most PEEP increase causes overdistension, not recruitment).",
      category: "R/I Ratio",
    },
  ];

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);

  const handleSelect = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === questions[current].correct) setScore(s => s + 1);
    setAnswered(a => a + 1);
  };

  const nextQ = () => {
    setSelected(null);
    setCurrent(c => (c + 1) % questions.length);
  };

  const q = questions[current];

  return (
    <div>
      <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Space Grotesk', sans-serif" }}>
        Knowledge Check
      </h3>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
          Q{current + 1}/{questions.length}
        </span>
        {answered > 0 && (
          <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace" }}>
            Score: {score}/{answered} ({Math.round(score / answered * 100)}%)
          </span>
        )}
      </div>

      <div style={{
        background: "#0d1117", border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10,
        padding: 16, marginBottom: 12,
      }}>
        {q.category && (
          <div style={{
            fontSize: 10, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, opacity: 0.8,
          }}>
            {q.category}
          </div>
        )}
        <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.6 }}>
          {q.q}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {q.opts.map((opt, i) => {
          let bg = "transparent", border = COLORS.cardBorder, col = COLORS.text;
          if (selected !== null) {
            if (i === q.correct) { bg = `${COLORS.green}22`; border = COLORS.green; col = COLORS.green; }
            else if (i === selected) { bg = `${COLORS.red}22`; border = COLORS.red; col = COLORS.red; }
          }
          return (
            <button key={i} onClick={() => handleSelect(i)} style={{
              padding: "10px 14px", borderRadius: 8, border: `1px solid ${border}`,
              background: bg, color: col, textAlign: "left", cursor: selected !== null ? "default" : "pointer",
              fontSize: 13, fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s",
            }}>
              <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + i)}.</span>{opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <>
          <Callout type={selected === q.correct ? "success" : "danger"}>
            {q.explain}
          </Callout>
          <button onClick={nextQ} style={{
            padding: "8px 20px", borderRadius: 6, border: `1px solid ${COLORS.accent}`,
            background: `${COLORS.accent}22`, color: COLORS.accent, cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginTop: 8,
          }}>Next Question →</button>
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ───
export default function VentPhysiologyTool() {
  const [activeTab, setActiveTab] = useState("basics");
  const isMobile = useIsMobile();

  const tabs = [
    { id: "basics", label: "🫁 Basics", color: COLORS.accent },
    { id: "waveforms", label: "Waveforms", color: COLORS.accent },
    { id: "pcond", label: "Pcond", color: COLORS.yellow },
    { id: "stress", label: "Stress Index", color: COLORS.green },
    { id: "calc", label: "ΔP & MP", color: COLORS.orange },
    { id: "ri", label: "R/I Ratio", color: COLORS.purple },
    { id: "tau", label: "τ", color: COLORS.red },
    { id: "pv", label: "P-V Loop", color: COLORS.green },
    { id: "recruit", label: "R/D", color: COLORS.orange },
    { id: "synthesis", label: "PEEP Goal", color: COLORS.yellow },
    { id: "quiz", label: "Quiz", color: COLORS.accent },
  ];

  const renderModule = () => {
    switch (activeTab) {
      case "basics": return <ModuleBasics />;
      case "waveforms": return <ModuleWaveforms />;
      case "pcond": return <ModulePcond />;
      case "stress": return <ModuleStressIndex />;
      case "calc": return <ModuleCalculator />;
      case "ri": return <ModuleRI />;
      case "tau": return <ModuleTimeConstant />;
      case "pv": return <ModulePVLoops />;
      case "recruit": return <ModuleRecruitment />;
      case "synthesis": return <ModuleSynthesis />;
      case "quiz": return <ModuleQuiz />;
      default: return null;
    }
  };

  return (
    <ActiveTooltipProvider>
      <div style={{
        minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
        WebkitTapHighlightColor: "transparent",
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0c4a6e 0%, #1e1b4b 50%, #0a0e17 100%)",
          borderBottom: `1px solid ${COLORS.cardBorder}`,
          padding: "clamp(14px, 4vw, 24px)",
        }}>
          <div style={{ maxWidth: "min(95vw, 720px)", margin: "0 auto" }}>
            <div style={{ fontSize: 10, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
              Interactive Teaching Tool
            </div>
            <h1 style={{ fontSize: "clamp(16px, 5vw, 22px)", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              Understanding Lung Physiology Through the Ventilator Screen
            </h1>
            <p style={{ fontSize: "clamp(10px, 2.5vw, 12px)", color: COLORS.textDim, margin: "6px 0 0", lineHeight: 1.5 }}>
              Based on Carteaux, Spinelli & Jaber — <em>Intensive Care Medicine</em> 2026
            </p>
            <p style={{ fontSize: 10, color: COLORS.textMuted, margin: "4px 0 0" }}>
              Basics → Advanced | Start with 🫁 Basics if you're a resident, or jump to Waveforms+ for fellow-level physiology
            </p>
          </div>
        </div>

        {/* Tabs — scrollable on mobile with gradient fade, centered flex on desktop */}
        <div style={{ position: "relative", maxWidth: isMobile ? "100%" : "min(95vw, 720px)", margin: isMobile ? 0 : "0 auto" }}>
          <div style={{
            display: "flex",
            gap: 6,
            padding: "10px clamp(12px, 4vw, 24px) 4px",
            overflowX: isMobile ? "auto" : "visible",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            flexWrap: isMobile ? "nowrap" : "wrap",
            justifyContent: isMobile ? undefined : "center",
          }}>
            {tabs.map(t => (
              <TabBtn key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} color={t.color} compact={isMobile}>
                {t.label}
              </TabBtn>
            ))}
          </div>
          {/* Scroll fade indicator (mobile only) */}
          {isMobile && <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 40,
            background: `linear-gradient(to right, transparent, ${COLORS.bg})`,
            pointerEvents: "none",
          }} />}
        </div>

        {/* Content */}
        <div style={{
          maxWidth: "min(95vw, 720px)", margin: "0 auto",
          padding: `0 clamp(12px, 4vw, 24px) 40px`,
        }}>
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 12, padding: "clamp(14px, 4vw, 20px)", marginTop: 8,
            overflow: "visible",
          }}>
            {renderModule()}
          </div>

          <p style={{ fontSize: 10, color: COLORS.textMuted, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
            Educational tool for resident training. Not for clinical decision-making.
            <br />Content derived from Carteaux G, Spinelli E, Jaber S. ICM 2026. doi:10.1007/s00134-026-08341-5
          </p>
        </div>
      </div>
    </ActiveTooltipProvider>
  );
}
