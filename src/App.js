import { useState, useCallback, useRef, useEffect } from "react";

// ─── Colour tokens ────────────────────────────────────────────────────────
const C = {
  bg:              "#0e0e0e",
  surfaceLow:      "#131313",
  surfaceContainer:"#1a1919",
  surfaceHigh:     "#201f1f",
  surfaceHighest:  "#262626",
  surfaceVariant:  "#262626",
  primary:         "#3fff8b",
  primaryDim:      "#24f07e",
  onPrimary:       "#005d2c",
  tertiary:        "#7ae6ff",
  error:           "#ff716c",
  warning:         "#f59e0b",
  onSurface:       "#ffffff",
  onSurfaceVar:    "#adaaaa",
  outlineVar:      "#494847",
};

// ─── Global CSS ───────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${C.bg};
    color: ${C.onSurface};
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100dvh;
    overflow-x: hidden;
  }

  input, textarea { color: inherit; background: transparent; }
  input::placeholder, textarea::placeholder { color: ${C.onSurfaceVar}; opacity: 0.5; }
  input:focus, textarea:focus { outline: none; }
  button { cursor: pointer; font-family: inherit; border: none; background: none; }
  ::-webkit-scrollbar { width: 0; height: 0; }

  .material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-variation-settings: 'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24;
    font-size: 24px; line-height: 1;
    display: inline-block; white-space: nowrap;
    user-select: none; vertical-align: middle;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .slide-in { animation: slideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }

  @keyframes barGrow {
    from { width: 0 !important; }
    to   { width: var(--tw); }
  }
  .bar-grow { animation: barGrow 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }

  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 16px rgba(63,255,139,0.35); }
    50%      { box-shadow: 0 0 36px rgba(63,255,139,0.75); }
  }
  .pulse-glow { animation: glowPulse 2s ease-in-out infinite; }

  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ─── Persistence ──────────────────────────────────────────────────────────
const LS_KEY = "moneymirror_v2";
const persist  = {
  load: () => { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
  save: (d) => { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} },
  clear: () => { try { localStorage.removeItem(LS_KEY); } catch {} },
};

// ─── Default data shape ───────────────────────────────────────────────────
const defaultData = () => ({
  income: { salary: "", other: "" },
  fixed: {
    rent: "",
    utilities: [],
    emi: [],
  },
  lifestyle: {
    dining:        { total: "", logs: [] },
    transport:     { total: "", logs: [] },
    shopping:      { total: "", logs: [] },
    entertainment: { total: "", logs: [] },
  },
  subscriptions: [],
  savings: { manual: "", goal: "" },
});

// ─── Calc engine ──────────────────────────────────────────────────────────
const parseNum = (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n; };

const fmtINR = (n, compact = false) => {
  const abs = Math.abs(Math.round(n));
  const sign = n < 0 ? "-" : "";
  if (compact) {
    if (abs >= 1_00_00_000) return sign + "₹" + (abs / 1_00_00_000).toFixed(1) + "Cr";
    if (abs >= 1_00_000)    return sign + "₹" + (abs / 1_00_000).toFixed(1) + "L";
    if (abs >= 1_000)       return sign + "₹" + (abs / 1_000).toFixed(1) + "K";
  }
  return sign + "₹" + abs.toLocaleString("en-IN");
};

function compute(data) {
  const salary = parseNum(data.income.salary);
  const other  = parseNum(data.income.other);
  const income = salary + other;

  const rent      = parseNum(data.fixed.rent);
  const utilities = data.fixed.utilities.reduce((s, u) => s + parseNum(u.amount), 0);
  const emi       = data.fixed.emi.reduce((s, e) => s + parseNum(e.amount), 0);
  const fixedTotal = rent + utilities + emi;

  const lifestyleTotal = Object.values(data.lifestyle).reduce((s, c) => s + parseNum(c.total), 0);

  const subTotal = data.subscriptions.reduce((s, sub) => {
    const amt = parseNum(sub.amount);
    switch (sub.cycle) {
      case "quarterly":    return s + amt / 3;
      case "half-yearly":  return s + amt / 6;
      case "annual":       return s + amt / 12;
      default:             return s + amt;
    }
  }, 0);

  const totalSpend = fixedTotal + lifestyleTotal + subTotal;
  const remaining  = income - totalSpend;
  const committedPct = income > 0 ? Math.min(100, Math.round((totalSpend / income) * 100)) : 0;

  const now      = new Date();
  const daysPassed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft   = daysInMonth - daysPassed;

  const burnRate = daysPassed > 0 ? totalSpend / daysPassed : 0;
  const projectedEnd = remaining - burnRate * daysLeft;

  const savingsRate = income > 0 ? ((remaining / income) * 100) : 0;

  let status = "STABLE";
  if (remaining < 0) status = "BLEEDING";
  else if (remaining < income * 0.2) status = "TIGHT";

  const statusColor = status === "BLEEDING" ? C.error : status === "TIGHT" ? C.warning : C.primary;

  return {
    income, salary, other, rent, utilities, emi,
    fixedTotal, lifestyleTotal, subTotal, totalSpend,
    remaining, committedPct, burnRate, projectedEnd,
    daysLeft, daysPassed, daysInMonth, savingsRate,
    status, statusColor,
  };
}

// ─── Insight engine ───────────────────────────────────────────────────────
function generateInsights(data, stats) {
  const ins = [];
  const { income, remaining, fixedTotal, lifestyleTotal, subTotal, burnRate, projectedEnd, savingsRate } = stats;
  if (income === 0) return ins;

  if (remaining < 0)
    ins.push({ type: "critical", icon: "warning", title: "You're in the red",
      body: `Monthly deficit of ${fmtINR(Math.abs(remaining))}. At this rate you'll accumulate debt.`,
      action: "Find one fixed cost to cut this week." });

  const rentPct = income > 0 ? (parseNum(data.fixed.rent) / income) * 100 : 0;
  if (rentPct > 30)
    ins.push({ type: "warn", icon: "home_work", title: "Rent above 30% ceiling",
      body: `Rent is ${rentPct.toFixed(0)}% of income — the healthy limit is 30%.`,
      action: `Subletting or downsizing could free ${fmtINR(parseNum(data.fixed.rent) * 0.15)}/mo.` });

  if (subTotal > 2000)
    ins.push({ type: "warn", icon: "subscriptions", title: "Subscription creep",
      body: `${fmtINR(subTotal)}/mo = ${fmtINR(subTotal * 12)}/yr on subscriptions.`,
      action: `Audit each one. Cut 2 → save ~${fmtINR(subTotal * 0.3)}/mo.` });

  const diningPct = income > 0 ? (parseNum(data.lifestyle.dining.total) / income) * 100 : 0;
  if (diningPct > 15)
    ins.push({ type: "tip", icon: "restaurant", title: "Dining spend above 15%",
      body: `Food & dining at ${diningPct.toFixed(0)}% of income.`,
      action: `Cook 2 more meals a week → save ~${fmtINR(parseNum(data.lifestyle.dining.total) * 0.2)}/mo.` });

  if (projectedEnd < 0 && burnRate > 0)
    ins.push({ type: "critical", icon: "trending_down", title: "Month-end projection negative",
      body: `At current burn (${fmtINR(burnRate)}/day), you'll end ${fmtINR(Math.abs(projectedEnd))} short.`,
      action: "Freeze discretionary spend for the next week." });

  if (savingsRate >= 30)
    ins.push({ type: "positive", icon: "savings", title: "Strong savings rate",
      body: `Saving ${savingsRate.toFixed(0)}% of income — well above the 20% benchmark.`,
      action: "Route surplus into index fund SIP for compounding." });

  if (stats.emi / income > 0.4)
    ins.push({ type: "warn", icon: "credit_card", title: "EMI load above 40%",
      body: `EMIs consume ${((stats.emi/income)*100).toFixed(0)}% of income — danger zone.`,
      action: "Prioritise prepaying the highest-interest loan." });

  return ins.slice(0, 4);
}

// ─── Shared UI ────────────────────────────────────────────────────────────
function Icon({ name, size = 22, color, style = {} }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size, color: color || "inherit", flexShrink: 0, ...style }}>{name}</span>;
}

function GlowBlobs() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-15%", left: "-8%", width: "45%", height: "45%", background: `${C.primary}09`, borderRadius: "50%", filter: "blur(100px)" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-8%", width: "35%", height: "35%", background: `${C.tertiary}09`, borderRadius: "50%", filter: "blur(90px)" }} />
    </div>
  );
}

function ProgressBar({ pct, color = C.primary, height = 3, glow = true }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ height, background: C.surfaceHighest, borderRadius: height, overflow: "hidden", position: "relative" }}>
      <div className="bar-grow" style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${w}%`, background: color, borderRadius: height, boxShadow: glow ? `0 0 12px ${color}70` : "none", "--tw": `${w}%` }} />
    </div>
  );
}

// Stable input — defined OUTSIDE render to prevent focus bugs
function InputField({ label, value, onChange, placeholder = "0", prefix = "₹", type = "text", small = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar }}>{label}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceHigh, borderRadius: 10, padding: small ? "10px 14px" : "14px 18px", border: `1px solid ${C.outlineVar}30`, transition: "border-color 0.2s" }}
        onFocus={e => e.currentTarget.style.borderColor = `${C.primary}40`}
        onBlur={e => e.currentTarget.style.borderColor = `${C.outlineVar}30`}
      >
        {prefix && <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: small ? 14 : 18, color: C.onSurfaceVar, flexShrink: 0 }}>{prefix}</span>}
        <input
          type={type}
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, border: "none", background: "transparent", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: small ? 14 : 18, color: C.onSurface, minWidth: 0 }}
        />
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder = "", small = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar }}>{label}</span>}
      <div style={{ display: "flex", alignItems: "center", background: C.surfaceHigh, borderRadius: 10, padding: small ? "10px 14px" : "14px 18px", border: `1px solid ${C.outlineVar}30`, transition: "border-color 0.2s" }}
        onFocus={e => e.currentTarget.style.borderColor = `${C.primary}40`}
        onBlur={e => e.currentTarget.style.borderColor = `${C.outlineVar}30`}
      >
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, border: "none", background: "transparent", fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: small ? 13 : 15, color: C.onSurface, minWidth: 0 }}
        />
      </div>
    </div>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>{title}</h3>
      {action && (
        <button onClick={onAction} style={{ display: "flex", alignItems: "center", gap: 6, color: C.primary, fontSize: 12, fontWeight: 700, padding: "6px 12px", background: `${C.primary}14`, borderRadius: 8, transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = `${C.primary}24`}
          onMouseLeave={e => e.currentTarget.style.background = `${C.primary}14`}
        >
          <Icon name="add" size={16} color={C.primary} /> {action}
        </button>
      )}
    </div>
  );
}

function Card({ children, style = {}, onClick }) {
  const base = { background: C.surfaceLow, borderRadius: 16, padding: 24, border: `1px solid ${C.outlineVar}18`, transition: "all 0.25s", ...style };
  if (onClick) {
    return (
      <div style={{ ...base, cursor: "pointer" }} onClick={onClick}
        onMouseEnter={e => { e.currentTarget.style.background = C.surfaceContainer; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = C.surfaceLow; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
      >{children}</div>
    );
  }
  return <div style={base}>{children}</div>;
}

function InsightCard({ insight, delay = 0 }) {
  const map = {
    critical: { border: C.error,   bg: `${C.error}10`,   tag: "Critical" },
    warn:     { border: C.warning, bg: "#f59e0b10",      tag: "Warning"  },
    tip:      { border: C.tertiary,bg: `${C.tertiary}0d`,tag: "Tip"      },
    info:     { border: C.primary, bg: `${C.primary}08`, tag: "Insight"  },
    positive: { border: C.primary, bg: `${C.primary}10`, tag: "Strong"   },
  };
  const s = map[insight.type] ?? map.info;
  return (
    <div className="slide-in" style={{ background: s.bg, borderRadius: 12, padding: "18px 20px", borderLeft: `3px solid ${s.border}`, border: `1px solid ${s.border}18`, borderLeftWidth: 3, animationDelay: `${delay}ms` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Icon name={insight.icon} size={18} color={s.border} />
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, flex: 1 }}>{insight.title}</span>
        <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: s.border, background: `${s.border}20`, padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>{s.tag}</span>
      </div>
      <p style={{ fontSize: 13, color: C.onSurfaceVar, lineHeight: 1.6, marginBottom: 8 }}>{insight.body}</p>
      <p style={{ fontSize: 11, color: s.border, fontWeight: 700 }}>→ {insight.action}</p>
    </div>
  );
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: 8, background: `${C.error}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.background = `${C.error}28`}
      onMouseLeave={e => e.currentTarget.style.background = `${C.error}14`}
    >
      <Icon name="delete" size={16} color={C.error} />
    </button>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { screen: "home",          icon: "home_max",          label: "Home"     },
  { screen: "income",        icon: "payments",          label: "Income"   },
  { screen: "fixed",         icon: "home_work",         label: "Fixed"    },
  { screen: "lifestyle",     icon: "restaurant",        label: "Lifestyle"},
  { screen: "subscriptions", icon: "subscriptions",     label: "Subs"     },
  { screen: "insights",      icon: "auto_awesome",      label: "Insights" },
  { screen: "mirror",        icon: "blur_on",           label: "Mirror"   },
];

function BottomNav({ active, onNav, stats }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "rgba(20,20,20,0.85)", backdropFilter: "blur(24px)", borderTop: `1px solid ${C.outlineVar}20`, padding: "10px 8px 16px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
      {NAV_ITEMS.map(({ screen, icon, label }) => {
        const isActive = active === screen;
        const isBleeding = screen === "home" && stats?.status === "BLEEDING";
        return (
          <button key={screen} onClick={() => onNav(screen)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: isActive ? C.primary : C.onSurfaceVar, opacity: isActive ? 1 : 0.45, transform: isActive ? "scale(1.08)" : "scale(1)", transition: "all 0.2s", padding: "4px 8px", position: "relative" }}>
            {isBleeding && <span style={{ position: "absolute", top: -2, right: 2, width: 8, height: 8, borderRadius: "50%", background: C.error }} />}
            <Icon name={icon} size={22} color="inherit" />
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function TopBar({ active, onReset }) {
  const info = NAV_ITEMS.find(n => n.screen === active);
  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: C.bg, height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: `1px solid ${C.outlineVar}18` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="blur_on" size={24} color={C.primary} />
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 18, color: C.primary, letterSpacing: "-0.04em" }}>MoneyMirror</span>
      </div>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: C.onSurfaceVar, textTransform: "uppercase", letterSpacing: "0.15em" }}>{info?.label}</span>
      <button onClick={onReset} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.error, background: `${C.error}14`, border: `1px solid ${C.error}28`, borderRadius: 8, padding: "6px 12px", transition: "background 0.2s" }}
        onMouseEnter={e => e.currentTarget.style.background = `${C.error}28`}
        onMouseLeave={e => e.currentTarget.style.background = `${C.error}14`}
      >Reset</button>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: HOME DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function HomeScreen({ data, stats, onNav }) {
  const { income, totalSpend, remaining, committedPct, status, statusColor, burnRate, projectedEnd, daysLeft, savingsRate } = stats;
  const heroColor = status === "BLEEDING" ? C.error : status === "TIGHT" ? C.warning : C.primary;

  const onTrackLabel = projectedEnd >= 0 ? "On Track" : projectedEnd >= -income * 0.1 ? "Slight Overspend" : "Danger Zone";
  const onTrackColor = projectedEnd >= 0 ? C.primary : projectedEnd >= -income * 0.1 ? C.warning : C.error;

  const summaryCards = [
    { label: "Income",        value: income,      icon: "payments",      color: C.primary,   screen: "income"        },
    { label: "Fixed",         value: stats.fixedTotal,    icon: "home_work",     color: C.tertiary,  screen: "fixed"         },
    { label: "Lifestyle",     value: stats.lifestyleTotal, icon: "restaurant",    color: C.warning,   screen: "lifestyle"     },
    { label: "Subscriptions", value: stats.subTotal,      icon: "subscriptions", color: "#b78fff",   screen: "subscriptions" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, padding: "80px 20px 120px", position: "relative" }}>
      <GlowBlobs />
      <div className="fade-up" style={{ position: "relative", zIndex: 1, maxWidth: 500, margin: "0 auto" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: C.onSurfaceVar, marginBottom: 12 }}>
            Monthly Reflection · {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </p>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: income > 0 ? "clamp(52px, 14vw, 88px)" : 64, letterSpacing: "-0.04em", lineHeight: 1, color: heroColor, textShadow: `0 0 60px ${heroColor}30` }}>
            {income > 0 ? fmtINR(Math.abs(remaining), true) : "₹—"}
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: heroColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {income > 0 ? (remaining < 0 ? "Overspent" : "Left This Month") : "No income set"}
            </span>
            {income > 0 && (
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: onTrackColor, background: `${onTrackColor}18`, padding: "3px 10px", borderRadius: 20 }}>
                {onTrackLabel}
              </span>
            )}
          </div>
          {income > 0 && <div style={{ width: 2, height: 40, background: `${heroColor}25`, borderRadius: 1, margin: "20px auto 0" }} />}
        </div>

        {/* Status strip */}
        {income > 0 && (
          <div style={{ background: `${statusColor}10`, border: `1px solid ${statusColor}25`, borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, boxShadow: `0 0 10px ${statusColor}` }} />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: statusColor }}>{status}</span>
            </div>
            <span style={{ fontSize: 12, color: C.onSurfaceVar }}>Savings rate: <span style={{ color: savingsRate >= 20 ? C.primary : C.warning, fontWeight: 700 }}>{savingsRate.toFixed(0)}%</span></span>
          </div>
        )}

        {/* Committed bar */}
        {income > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 6 }}>Income Committed</p>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 36, letterSpacing: "-0.04em", color: committedPct > 80 ? C.error : committedPct > 60 ? C.warning : C.primary }}>{committedPct}%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 6 }}>Burn Rate</p>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: C.onSurface }}>{fmtINR(burnRate, true)}<span style={{ fontSize: 11, color: C.onSurfaceVar }}>/day</span></div>
                <div style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 2 }}>{daysLeft}d left</div>
              </div>
            </div>
            <ProgressBar pct={committedPct} color={committedPct > 80 ? C.error : committedPct > 60 ? C.warning : C.primary} height={4} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: 10, color: C.onSurfaceVar }}>Total spend: {fmtINR(totalSpend, true)}</span>
              <span style={{ fontSize: 10, color: C.onSurfaceVar }}>Income: {fmtINR(income, true)}</span>
            </div>
          </Card>
        )}

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {summaryCards.map(({ label, value, icon, color, screen }) => (
            <Card key={label} onClick={() => onNav(screen)} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={icon} size={18} color={color} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.onSurfaceVar }}>{label}</span>
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 24, letterSpacing: "-0.03em", color: C.onSurface }}>{fmtINR(value, true)}</div>
              <div style={{ marginTop: 12 }}>
                <ProgressBar pct={income > 0 ? (value / income) * 100 : 0} color={color} height={2} glow={false} />
              </div>
            </Card>
          ))}
        </div>

        {/* Projected end */}
        {income > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: projectedEnd >= 0 ? `${C.primary}14` : `${C.error}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={projectedEnd >= 0 ? "trending_up" : "trending_down"} size={24} color={projectedEnd >= 0 ? C.primary : C.error} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.onSurfaceVar, marginBottom: 4 }}>Month-end Projection</p>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: "-0.03em", color: projectedEnd >= 0 ? C.primary : C.error }}>
                  {fmtINR(projectedEnd, true)}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {income === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Icon name="payments" size={48} color={C.outlineVar} style={{ marginBottom: 16 }} />
            <p style={{ color: C.onSurfaceVar, marginBottom: 24, lineHeight: 1.6 }}>Start by adding your monthly income to see your financial mirror.</p>
            <button onClick={() => onNav("income")} style={{ padding: "14px 32px", background: C.primary, color: C.onPrimary, borderRadius: 10, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.15em", boxShadow: `0 0 30px ${C.primary}40` }}>
              Add Income →
            </button>
          </div>
        )}

        {income > 0 && (
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => onNav("insights")} style={{ flex: 1, height: 60, background: C.primary, color: C.onPrimary, borderRadius: 12, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.15em", boxShadow: `0 0 30px ${C.primary}35`, transition: "transform 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >See Insights →</button>
            <button onClick={() => onNav("mirror")} style={{ flex: 1, height: 60, background: C.surfaceHigh, color: C.onSurface, borderRadius: 12, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.15em", border: `1px solid ${C.outlineVar}30`, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = C.surfaceVariant; e.currentTarget.style.borderColor = `${C.primary}30`; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.surfaceHigh; e.currentTarget.style.borderColor = `${C.outlineVar}30`; }}
            >Open Mirror</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: INCOME
// ═══════════════════════════════════════════════════════════════════════════
function IncomeScreen({ data, onUpdate, stats }) {
  return (
    <div style={{ padding: "80px 20px 120px", maxWidth: 500, margin: "0 auto" }}>
      <div className="fade-up">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", marginBottom: 8 }}>Monthly Fuel</h2>
          <p style={{ color: C.onSurfaceVar, fontSize: 14 }}>What enters the mirror each month?</p>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <InputField label="Monthly Salary" value={data.income.salary} onChange={v => onUpdate("income.salary", v)} placeholder="100000" />
            <InputField label="Other Income (freelance, rent, etc.)" value={data.income.other} onChange={v => onUpdate("income.other", v)} placeholder="0" />
          </div>
        </Card>

        {stats.income > 0 && (
          <Card style={{ background: `${C.primary}0a`, borderColor: `${C.primary}20` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: C.onSurfaceVar, fontSize: 13 }}>Total Monthly Income</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: "-0.03em", color: C.primary }}>{fmtINR(stats.income)}</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: FIXED
// ═══════════════════════════════════════════════════════════════════════════

// These are defined outside to avoid being re-created on render (prevents input focus loss)
function ArrayItemRow({ item, index, onChangeField, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>
        <TextInput value={item.name} onChange={v => onChangeField(index, "name", v)} placeholder="Name" small />
      </div>
      <div style={{ flex: 1 }}>
        <InputField value={item.amount} onChange={v => onChangeField(index, "amount", v)} placeholder="0" small />
      </div>
      <DeleteBtn onClick={() => onDelete(index)} />
    </div>
  );
}

function FixedScreen({ data, onUpdate, stats }) {
  const addUtility = useCallback(() => {
    onUpdate("fixed.utilities", [...data.fixed.utilities, { id: Date.now(), name: "", amount: "" }]);
  }, [data.fixed.utilities, onUpdate]);

  const addEmi = useCallback(() => {
    onUpdate("fixed.emi", [...data.fixed.emi, { id: Date.now(), name: "", amount: "" }]);
  }, [data.fixed.emi, onUpdate]);

  const updateUtility = useCallback((i, field, val) => {
    const arr = [...data.fixed.utilities];
    arr[i] = { ...arr[i], [field]: val };
    onUpdate("fixed.utilities", arr);
  }, [data.fixed.utilities, onUpdate]);

  const deleteUtility = useCallback((i) => {
    onUpdate("fixed.utilities", data.fixed.utilities.filter((_, idx) => idx !== i));
  }, [data.fixed.utilities, onUpdate]);

  const updateEmi = useCallback((i, field, val) => {
    const arr = [...data.fixed.emi];
    arr[i] = { ...arr[i], [field]: val };
    onUpdate("fixed.emi", arr);
  }, [data.fixed.emi, onUpdate]);

  const deleteEmi = useCallback((i) => {
    onUpdate("fixed.emi", data.fixed.emi.filter((_, idx) => idx !== i));
  }, [data.fixed.emi, onUpdate]);

  return (
    <div style={{ padding: "80px 20px 120px", maxWidth: 500, margin: "0 auto" }}>
      <div className="fade-up">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", marginBottom: 8 }}>The Anchors</h2>
          <p style={{ color: C.onSurfaceVar, fontSize: 14 }}>Non-negotiable monthly obligations.</p>
        </div>

        {/* Rent */}
        <Card style={{ marginBottom: 12 }}>
          <SectionHeader title="Rent & Accommodation" />
          <InputField label="Monthly Rent" value={data.fixed.rent} onChange={v => onUpdate("fixed.rent", v)} placeholder="25000" />
        </Card>

        {/* Utilities */}
        <Card style={{ marginBottom: 12 }}>
          <SectionHeader title="Utilities" action="Add" onAction={addUtility} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.fixed.utilities.length === 0 && (
              <p style={{ fontSize: 13, color: C.onSurfaceVar, textAlign: "center", padding: "12px 0" }}>No utilities added yet</p>
            )}
            {data.fixed.utilities.map((u, i) => (
              <ArrayItemRow key={u.id} item={u} index={i} onChangeField={updateUtility} onDelete={deleteUtility} />
            ))}
          </div>
        </Card>

        {/* EMI */}
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader title="EMI / Loans" action="Add Loan" onAction={addEmi} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.fixed.emi.length === 0 && (
              <p style={{ fontSize: 13, color: C.onSurfaceVar, textAlign: "center", padding: "12px 0" }}>No EMIs added yet</p>
            )}
            {data.fixed.emi.map((e, i) => (
              <ArrayItemRow key={e.id} item={e} index={i} onChangeField={updateEmi} onDelete={deleteEmi} />
            ))}
          </div>
        </Card>

        {/* Total */}
        <Card style={{ background: `${C.tertiary}0a`, borderColor: `${C.tertiary}20` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: C.onSurfaceVar, fontSize: 13 }}>Fixed Total</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: "-0.03em", color: C.tertiary }}>{fmtINR(stats.fixedTotal)}</span>
          </div>
          {stats.income > 0 && (
            <>
              <ProgressBar pct={(stats.fixedTotal / stats.income) * 100} color={C.tertiary} height={3} />
              <p style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 8 }}>{((stats.fixedTotal / stats.income) * 100).toFixed(0)}% of income</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: LIFESTYLE
// ═══════════════════════════════════════════════════════════════════════════
const LIFESTYLE_CATEGORIES = [
  { key: "dining",        icon: "restaurant",    label: "Food & Dining",  color: C.warning   },
  { key: "transport",     icon: "commute",       label: "Transport",      color: C.tertiary  },
  { key: "shopping",      icon: "shopping_bag",  label: "Shopping",       color: "#b78fff"   },
  { key: "entertainment", icon: "movie",         label: "Entertainment",  color: "#ff9d6c"   },
];

function LogItemRow({ item, index, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.outlineVar}20` }}>
      <span style={{ flex: 1, fontSize: 13, color: C.onSurfaceVar }}>{item.note || "Entry"}</span>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>{fmtINR(parseNum(item.amount))}</span>
      <DeleteBtn onClick={() => onDelete(index)} />
    </div>
  );
}

function LifestyleScreen({ data, onUpdate, stats }) {
  const [expanded, setExpanded] = useState(null);
  const [newLog, setNewLog] = useState({});

  const toggleExpand = (key) => setExpanded(e => e === key ? null : key);

  const addLog = useCallback((key) => {
    const entry = newLog[key] || {};
    if (!entry.amount) return;
    const logs = [...(data.lifestyle[key].logs || []), { id: Date.now(), note: entry.note || "", amount: entry.amount }];
    onUpdate(`lifestyle.${key}.logs`, logs);
    setNewLog(n => ({ ...n, [key]: { note: "", amount: "" } }));
  }, [newLog, data.lifestyle, onUpdate]);

  const deleteLog = useCallback((key, i) => {
    onUpdate(`lifestyle.${key}.logs`, data.lifestyle[key].logs.filter((_, idx) => idx !== i));
  }, [data.lifestyle, onUpdate]);

  return (
    <div style={{ padding: "80px 20px 120px", maxWidth: 500, margin: "0 auto" }}>
      <div className="fade-up">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", marginBottom: 8 }}>Lifestyle Pulse</h2>
          <p style={{ color: C.onSurfaceVar, fontSize: 14 }}>Where does the rest flow?</p>
        </div>

        {LIFESTYLE_CATEGORIES.map(({ key, icon, label, color }) => {
          const cat = data.lifestyle[key];
          const isOpen = expanded === key;
          return (
            <Card key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, cursor: "pointer" }} onClick={() => toggleExpand(key)}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={icon} size={20} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 11, color: C.onSurfaceVar }}>{cat.logs.length} entries logged</p>
                </div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 20, color: C.onSurface }}>{fmtINR(parseNum(cat.total), true)}</span>
                <Icon name={isOpen ? "expand_less" : "expand_more"} size={20} color={C.onSurfaceVar} />
              </div>

              <InputField label="Monthly Total" value={cat.total} onChange={v => onUpdate(`lifestyle.${key}.total`, v)} placeholder="0" small />

              {isOpen && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 12 }}>Log Entries</p>
                  {cat.logs.map((item, i) => (
                    <LogItemRow key={item.id} item={item} index={i} onDelete={(idx) => deleteLog(key, idx)} />
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <div style={{ flex: 2 }}>
                      <TextInput
                        value={newLog[key]?.note || ""}
                        onChange={v => setNewLog(n => ({ ...n, [key]: { ...n[key], note: v } }))}
                        placeholder="Note (optional)"
                        small
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <InputField
                        value={newLog[key]?.amount || ""}
                        onChange={v => setNewLog(n => ({ ...n, [key]: { ...n[key], amount: v } }))}
                        placeholder="0"
                        small
                      />
                    </div>
                    <button onClick={() => addLog(key)} style={{ flexShrink: 0, width: 36, height: 36, marginTop: 6, background: `${color}18`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="add" size={18} color={color} />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        <Card style={{ background: `${C.warning}0a`, borderColor: `${C.warning}20` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: C.onSurfaceVar, fontSize: 13 }}>Lifestyle Total</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: "-0.03em", color: C.warning }}>{fmtINR(stats.lifestyleTotal)}</span>
          </div>
          {stats.income > 0 && (
            <>
              <ProgressBar pct={(stats.lifestyleTotal / stats.income) * 100} color={C.warning} height={3} />
              <p style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 8 }}>{((stats.lifestyleTotal / stats.income) * 100).toFixed(0)}% of income</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════
const CYCLES = [
  { value: "monthly",     label: "Monthly"     },
  { value: "quarterly",   label: "Quarterly"   },
  { value: "half-yearly", label: "Half-yearly" },
  { value: "annual",      label: "Annual"      },
];

function SubscriptionRow({ sub, index, onChange, onDelete }) {
  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${C.outlineVar}20` }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 2 }}>
          <TextInput value={sub.name} onChange={v => onChange(index, "name", v)} placeholder="Netflix, Spotify..." small />
        </div>
        <div style={{ flex: 1 }}>
          <InputField value={sub.amount} onChange={v => onChange(index, "amount", v)} placeholder="0" small />
        </div>
        <DeleteBtn onClick={() => onDelete(index)} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CYCLES.map(c => (
            <button key={c.value} onClick={() => onChange(index, "cycle", c.value)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.1em", background: sub.cycle === c.value ? `${C.primary}20` : C.surfaceHighest, color: sub.cycle === c.value ? C.primary : C.onSurfaceVar, border: `1px solid ${sub.cycle === c.value ? C.primary + "40" : "transparent"}`, transition: "all 0.15s" }}>
              {c.label}
            </button>
          ))}
        </div>
        <input type="date" value={sub.renewalDate || ""} onChange={e => onChange(index, "renewalDate", e.target.value)}
          style={{ background: C.surfaceHigh, border: `1px solid ${C.outlineVar}30`, borderRadius: 8, padding: "6px 10px", fontSize: 12, color: C.onSurface, fontFamily: "'Manrope', sans-serif" }} />
      </div>
    </div>
  );
}

function SubscriptionsScreen({ data, onUpdate, stats }) {
  const addSub = useCallback(() => {
    onUpdate("subscriptions", [...data.subscriptions, { id: Date.now(), name: "", amount: "", cycle: "monthly", renewalDate: "" }]);
  }, [data.subscriptions, onUpdate]);

  const updateSub = useCallback((i, field, val) => {
    const arr = [...data.subscriptions];
    arr[i] = { ...arr[i], [field]: val };
    onUpdate("subscriptions", arr);
  }, [data.subscriptions, onUpdate]);

  const deleteSub = useCallback((i) => {
    onUpdate("subscriptions", data.subscriptions.filter((_, idx) => idx !== i));
  }, [data.subscriptions, onUpdate]);

  // upcoming renewals
  const today = new Date();
  const upcoming = data.subscriptions.filter(s => {
    if (!s.renewalDate) return false;
    const d = new Date(s.renewalDate);
    const diff = (d - today) / 86400000;
    return diff >= 0 && diff <= 7;
  }).sort((a, b) => new Date(a.renewalDate) - new Date(b.renewalDate));

  return (
    <div style={{ padding: "80px 20px 120px", maxWidth: 500, margin: "0 auto" }}>
      <div className="fade-up">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", marginBottom: 8 }}>Subscriptions</h2>
          <p style={{ color: C.onSurfaceVar, fontSize: 14 }}>Every recurring charge — seen clearly.</p>
        </div>

        {/* Summary strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Monthly",  val: fmtINR(stats.subTotal, true),          color: "#b78fff" },
            { label: "Annual",   val: fmtINR(stats.subTotal * 12, true),     color: C.primary },
            { label: "Daily",    val: fmtINR(stats.subTotal / 30.4, true),   color: C.tertiary },
          ].map(({ label, val, color }) => (
            <Card key={label} style={{ padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.onSurfaceVar, marginBottom: 8 }}>{label}</p>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", color }}>{val}</p>
            </Card>
          ))}
        </div>

        {/* Upcoming renewals */}
        {upcoming.length > 0 && (
          <Card style={{ marginBottom: 16, background: `${C.warning}0a`, borderColor: `${C.warning}25` }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.warning, marginBottom: 14 }}>⚡ Renewing Soon</p>
            {upcoming.map(s => {
              const d = new Date(s.renewalDate);
              const diff = Math.ceil((d - today) / 86400000);
              return (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.outlineVar}15` }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name || "Subscription"}</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>{fmtINR(parseNum(s.amount))}</span>
                    <span style={{ fontSize: 10, color: diff <= 2 ? C.error : C.warning, fontWeight: 700 }}>{diff === 0 ? "Today" : `${diff}d`}</span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* List */}
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader title={`Subscriptions (${data.subscriptions.length})`} action="Add" onAction={addSub} />
          {data.subscriptions.length === 0 && (
            <p style={{ fontSize: 13, color: C.onSurfaceVar, textAlign: "center", padding: "20px 0" }}>No subscriptions tracked yet</p>
          )}
          {data.subscriptions.map((s, i) => (
            <SubscriptionRow key={s.id} sub={s} index={i} onChange={updateSub} onDelete={deleteSub} />
          ))}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════
function InsightsScreen({ data, stats }) {
  const insights = generateInsights(data, stats);
  const { income, totalSpend, remaining, burnRate, projectedEnd, daysLeft, lifestyleTotal, fixedTotal, subTotal } = stats;

  // 25-year SIP projection
  const surplus = Math.max(0, remaining);
  const invest  = surplus * 0.5;
  const r = 0.12 / 12, n = 25 * 12;
  const corpus  = invest > 0 ? Math.round(invest * ((Math.pow(1+r,n)-1)/r) * (1+r)) : 0;

  const tone = stats.status === "BLEEDING" ? "brutal"
    : stats.status === "TIGHT" ? "sharp" : "normal";

  const toneMessage = tone === "brutal"
    ? "You are actively going into debt. This is not a warning — it's a crisis."
    : tone === "sharp"
    ? "You're barely keeping your head above water. One emergency could tip you over."
    : "Your finances are stable. Now is the time to optimise.";

  const breakdown = [
    { label: "Fixed",         val: fixedTotal,     color: C.tertiary, pct: income > 0 ? (fixedTotal/income)*100 : 0    },
    { label: "Lifestyle",     val: lifestyleTotal, color: C.warning,  pct: income > 0 ? (lifestyleTotal/income)*100 : 0},
    { label: "Subscriptions", val: subTotal,       color: "#b78fff",  pct: income > 0 ? (subTotal/income)*100 : 0      },
  ];

  return (
    <div style={{ padding: "80px 20px 120px", maxWidth: 500, margin: "0 auto" }}>
      <div className="fade-up">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", marginBottom: 8 }}>Insights</h2>
          <p style={{ color: C.onSurfaceVar, fontSize: 14 }}>Your money, reflected honestly.</p>
        </div>

        {/* Tone message */}
        {income > 0 && (
          <div style={{ background: tone === "brutal" ? `${C.error}10` : tone === "sharp" ? `${C.warning}10` : `${C.primary}08`, border: `1px solid ${tone === "brutal" ? C.error : tone === "sharp" ? C.warning : C.primary}25`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: tone === "brutal" ? C.error : tone === "sharp" ? C.warning : C.onSurface, fontStyle: "italic" }}>"{toneMessage}"</p>
          </div>
        )}

        {/* Key metrics */}
        {income > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Burn Rate",        val: `${fmtINR(burnRate, true)}/day`,          icon: "local_fire_department", color: C.error    },
              { label: "Days Left",        val: `${daysLeft} days`,                        icon: "calendar_today",        color: C.tertiary  },
              { label: "Projected End",    val: fmtINR(projectedEnd, true),               icon: projectedEnd >= 0 ? "trending_up" : "trending_down", color: projectedEnd >= 0 ? C.primary : C.error },
              { label: "25yr SIP Corpus",  val: corpus > 0 ? fmtINR(corpus, true) : "—", icon: "auto_awesome",          color: C.primary   },
            ].map(({ label, val, icon, color }) => (
              <Card key={label} style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Icon name={icon} size={16} color={color} />
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.onSurfaceVar }}>{label}</span>
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", color }}>{val}</div>
              </Card>
            ))}
          </div>
        )}

        {/* Spend breakdown */}
        {income > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 20 }}>Spend Breakdown</p>
            {breakdown.map(({ label, val, color, pct }) => (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: C.onSurfaceVar }}>{label}</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>{fmtINR(val, true)}</span>
                    <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <ProgressBar pct={pct} color={color} height={3} />
              </div>
            ))}
          </Card>
        )}

        {/* Insight cards */}
        {insights.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar }}>Behavioural Nudges</p>
            {insights.map((ins, i) => <InsightCard key={i} insight={ins} delay={i * 80} />)}
          </div>
        )}

        {income === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.onSurfaceVar }}>
            <Icon name="auto_awesome" size={48} color={C.outlineVar} style={{ marginBottom: 16 }} />
            <p>Add your income and expenses to unlock insights.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: MIRROR
// ═══════════════════════════════════════════════════════════════════════════
function MirrorScreen({ data, onUpdate, stats }) {
  const { income, remaining, projectedEnd, burnRate, daysLeft, subTotal, lifestyleTotal } = stats;
  const goal = parseNum(data.savings.goal);
  const gap  = goal > 0 ? goal - Math.max(0, remaining) : null;

  // Nudges based on gap
  const nudges = [];
  if (gap !== null && gap > 0) {
    const dining = parseNum(data.lifestyle.dining.total);
    if (dining > 0) nudges.push(`Cut dining 20% → save ${fmtINR(dining * 0.2)}/mo`);
    if (subTotal > 500) nudges.push(`Cancel 1 subscription → save ~${fmtINR(subTotal * 0.3)}/mo`);
    const shopping = parseNum(data.lifestyle.shopping.total);
    if (shopping > 0) nudges.push(`Reduce shopping 15% → save ${fmtINR(shopping * 0.15)}/mo`);
  }

  const scenarios = [
    { label: "Static Path",   pct: 0.28, color: C.error,    icon: "trending_flat", desc: "Current trajectory, no changes." },
    { label: "Adaptive Path", pct: 0.65, color: C.tertiary, icon: "trending_up",   desc: "Minor optimisations applied monthly." },
    { label: "Mastery Path",  pct: 1.00, color: C.primary,  icon: "auto_awesome",  desc: "Maximum SIP + debt reduction.",   featured: true },
  ];

  const r = 0.12 / 12, n = 25 * 12;
  const invest = Math.max(0, remaining) * 0.5;
  const corpus = invest > 0 ? Math.round(invest * ((Math.pow(1+r,n)-1)/r) * (1+r)) : 0;

  return (
    <div style={{ padding: "80px 20px 120px", maxWidth: 500, margin: "0 auto" }}>
      <div className="fade-up">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", marginBottom: 8 }}>The Mirror</h2>
          <p style={{ color: C.onSurfaceVar, fontSize: 14 }}>Honest projections. No sugarcoating.</p>
        </div>

        {/* Projection hero */}
        <Card style={{ marginBottom: 16, textAlign: "center", background: "#000", border: `1px solid ${C.primary}18` }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: C.onSurfaceVar, marginBottom: 12 }}>At This Rate, You'll End With</p>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 56, letterSpacing: "-0.04em", color: projectedEnd >= 0 ? C.primary : C.error, textShadow: `0 0 50px ${projectedEnd >= 0 ? C.primary : C.error}40`, lineHeight: 1 }}>
            {income > 0 ? fmtINR(projectedEnd, true) : "₹—"}
          </div>
          {income > 0 && (
            <p style={{ marginTop: 8, fontSize: 13, color: C.onSurfaceVar }}>in {daysLeft} days · burning {fmtINR(burnRate, true)}/day</p>
          )}
        </Card>

        {/* Savings goal */}
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader title="Savings Goal" />
          <InputField label="Target Monthly Savings" value={data.savings.goal} onChange={v => onUpdate("savings.goal", v)} placeholder="20000" />
          {goal > 0 && income > 0 && (
            <div style={{ marginTop: 16, padding: "14px 16px", background: gap !== null && gap <= 0 ? `${C.primary}10` : `${C.error}10`, borderRadius: 10, border: `1px solid ${gap !== null && gap <= 0 ? C.primary : C.error}25` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.onSurfaceVar }}>Goal vs Current</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 20, color: gap !== null && gap <= 0 ? C.primary : C.error }}>
                  {gap !== null ? (gap > 0 ? `-${fmtINR(gap, true)}` : `+${fmtINR(Math.abs(gap), true)}`) : "—"}
                </span>
              </div>
              <ProgressBar pct={goal > 0 ? Math.min(100, (Math.max(0, remaining) / goal) * 100) : 0} color={gap !== null && gap <= 0 ? C.primary : C.error} height={4} />
              <p style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 6 }}>You're saving {fmtINR(Math.max(0, remaining), true)} of {fmtINR(goal)} goal</p>
            </div>
          )}
        </Card>

        {/* Nudges */}
        {nudges.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 14 }}>Light Nudges</p>
            {nudges.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.outlineVar}15` }}>
                <Icon name="arrow_forward" size={14} color={C.primary} />
                <span style={{ fontSize: 13, color: C.onSurface }}>{n}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: "12px 16px", background: `${C.primary}08`, borderRadius: 8 }}>
              <p style={{ fontSize: 13, color: C.onSurfaceVar }}>Implement all nudges → potential monthly gain: <span style={{ color: C.primary, fontWeight: 700 }}>
                {fmtINR(nudges.reduce((s) => s + parseNum(data.lifestyle.dining.total) * 0.2 + subTotal * 0.3 + parseNum(data.lifestyle.shopping.total) * 0.15, 0) / nudges.length * nudges.length, true)}
              </span></p>
            </div>
          </Card>
        )}

        {/* 25-year scenarios */}
        {corpus > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 14 }}>25-Year Projection Paths</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {scenarios.map(s => (
                <div key={s.label} style={{ padding: "18px 20px", background: s.featured ? "#000" : C.surfaceLow, borderRadius: 12, border: `1px solid ${s.featured ? C.primary + "20" : C.outlineVar + "18"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Icon name={s.icon} size={20} color={s.color} />
                    <div>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: s.color }}>{s.label}</p>
                      <p style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 2 }}>{s.desc}</p>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", color: s.color, textAlign: "right" }}>{fmtINR(Math.round(corpus * s.pct), true)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {income === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.onSurfaceVar }}>
            <Icon name="blur_on" size={56} color={C.primary} style={{ marginBottom: 16, opacity: 0.4 }} />
            <p style={{ lineHeight: 1.7 }}>Add your income and expenses to see your mirror projection.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [data, setData]         = useState(() => persist.load() || defaultData());
  const [screen, setScreen]     = useState("home");

  const stats = compute(data);

  // Deep-path updater — supports "a.b.c" keys
  const handleUpdate = useCallback((path, value) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev)); // deep clone
      const keys = path.split(".");
      let ref = next;
      for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]];
      ref[keys[keys.length - 1]] = value;
      persist.save(next);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm("Reset all MoneyMirror data? This cannot be undone.")) {
      persist.clear();
      setData(defaultData());
      setScreen("home");
    }
  }, []);

  const handleNav = useCallback((s) => setScreen(s), []);

  const screenProps = { data, stats, onUpdate: handleUpdate, onNav: handleNav };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <GlowBlobs />
      <TopBar active={screen} onReset={handleReset} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {screen === "home"          && <HomeScreen          {...screenProps} />}
        {screen === "income"        && <IncomeScreen        {...screenProps} />}
        {screen === "fixed"         && <FixedScreen         {...screenProps} />}
        {screen === "lifestyle"     && <LifestyleScreen     {...screenProps} />}
        {screen === "subscriptions" && <SubscriptionsScreen {...screenProps} />}
        {screen === "insights"      && <InsightsScreen      {...screenProps} />}
        {screen === "mirror"        && <MirrorScreen        {...screenProps} />}
      </div>
      <BottomNav active={screen} onNav={handleNav} stats={stats} />
    </>
  );
}