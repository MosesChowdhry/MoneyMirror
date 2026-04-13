import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ─── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:       "#050507",
  s0:       "#0d0d10",
  s1:       "#121216",
  s2:       "#18181d",
  s3:       "#1e1e24",
  s4:       "#26262e",
  primary:  "#00e87a",
  onPrimary:"#001a0d",
  blue:     "#5fc8ff",
  purple:   "#a78bfa",
  orange:   "#fb923c",
  error:    "#f87171",
  warn:     "#fbbf24",
  text:     "#f1f1f3",
  sub:      "#9494a0",
  muted:    "#55555f",
  border:   "rgba(255,255,255,0.07)",
  glass:    "rgba(255,255,255,0.03)",
};

// ─── Global CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,300,0,0&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{
    background:${C.bg};
    color:${C.text};
    font-family:'DM Sans',sans-serif;
    -webkit-font-smoothing:antialiased;
    overscroll-behavior:none;
  }
  input{font-family:'DM Mono',monospace;color:${C.text};background:transparent;border:none;outline:none;}
  input::placeholder{color:${C.muted};opacity:.6;}
  button{font-family:'DM Sans',sans-serif;cursor:pointer;border:none;background:none;}
  ::-webkit-scrollbar{display:none;}
  .ms{
    font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;
    font-size:20px;line-height:1;display:inline-block;white-space:nowrap;
    font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20;user-select:none;
  }

  @keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
  @keyframes scaleIn{from{transform:scale(.96);opacity:0;}to{transform:scale(1);opacity:1;}}
  @keyframes barGrow{from{width:0!important;}to{width:var(--w);}}
  @keyframes slideD{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes impactIn{0%{opacity:0;transform:translateY(4px);}12%{opacity:1;transform:translateY(0);}88%{opacity:1;}100%{opacity:0;transform:translateY(-3px);}}
  @keyframes modalBg{from{opacity:0;}to{opacity:1;}}
  @keyframes modalCard{from{opacity:0;transform:translateY(20px) scale(.97);}to{opacity:1;transform:translateY(0) scale(1);}}
  @keyframes pulse{0%,100%{opacity:.5;}50%{opacity:1;}}

  .fade-up{animation:fadeUp .36s cubic-bezier(.16,1,.3,1) both;}
  .scale-in{animation:scaleIn .22s cubic-bezier(.16,1,.3,1) both;}
  .bar{animation:barGrow .75s cubic-bezier(.16,1,.3,1) both;}
  .slide-d{animation:slideD .22s cubic-bezier(.16,1,.3,1) both;}
  .impact-anim{animation:impactIn 3.2s ease forwards;}
  .modal-bg{animation:modalBg .2s ease both;}
  .modal-card{animation:modalCard .26s cubic-bezier(.16,1,.3,1) both;}

  .sb{max-height:0;overflow:hidden;transition:max-height .34s cubic-bezier(.16,1,.3,1),opacity .24s ease;opacity:0;}
  .sb.open{max-height:2800px;opacity:1;}
  .prog{transition:width .6s cubic-bezier(.16,1,.3,1);}
  .field:focus-within > div{border-color:${C.primary}44 !important;}

  /* Card hover — CSS only, no JS DOM mutation */
  .card-hover{transition:transform .2s ease, box-shadow .2s ease;}
  .card-hover:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.4);}
`;

// ─── Formatters ─────────────────────────────────────────────────────────────
const fmtINR = (v, compact = false) => {
  const num = Number(v) || 0;
  const abs  = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (compact) {
    if (abs >= 1e7) return sign + "₹" + (abs / 1e7).toFixed(1) + "Cr";
    if (abs >= 1e5) return sign + "₹" + (abs / 1e5).toFixed(1) + "L";
    if (abs >= 1e3) return sign + "₹" + (abs / 1e3).toFixed(0) + "K";
  }
  return sign + "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(abs);
};

const N    = (v) => Number(v) || 0;
const mkId = () => `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

// ─── State shape ─────────────────────────────────────────────────────────────
const initialState = () => ({
  income:   { salary: 0, other: 0 },
  fixed:    { rent: 0, utilities: [], emis: [] },
  lifestyle: {
    dining:        { manual: 0, logs: [] },
    transport:     { manual: 0, logs: [] },
    shopping:      { manual: 0, logs: [] },
    entertainment: { manual: 0, logs: [] },
  },
  subscriptions: [],
  meta: { goal: 0, monthStart: Date.now(), lastOpenedDate: "" },
  checkin : {
    lastDate: "",
    streak: 0
  },

  }
);

// ─── Data layer ───────────────────────────────────────────────────────────────
const DB_KEY = "mm_v8";

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const b = initialState();
    return { ...b, ...p, fixed: { ...b.fixed, ...p.fixed }, lifestyle: { ...b.lifestyle, ...p.lifestyle }, meta: { ...b.meta, ...p.meta } };
  } catch { return null; }
}
function saveData(s) { try { localStorage.setItem(DB_KEY, JSON.stringify(s)); } catch {} }
function clearData()  { try { localStorage.removeItem(DB_KEY); } catch {} }

// ─── Calc engine ─────────────────────────────────────────────────────────────
function calcEngine(s) {
  const income = N(s.income.salary) + N(s.income.other);

  const rent      = N(s.fixed.rent);
  const utilities = s.fixed.utilities.reduce((t, u) => t + N(u.amount), 0);
  const emis      = s.fixed.emis.reduce((t, e) => t + N(e.amount), 0);
  const fixedPlan = rent + utilities + emis;

  const cats = ["dining", "transport", "shopping", "entertainment"];
  const lifePlan = {}, lifeActual = {};
  for (const c of cats) {
    lifePlan[c] = N(s.lifestyle[c].manual);
    const ls = s.lifestyle[c].logs.reduce((t, l) => t + N(l.amount), 0);
    lifeActual[c] = s.lifestyle[c].logs.length > 0 ? ls : N(s.lifestyle[c].manual);
  }
  const lifestylePlanTotal   = Object.values(lifePlan).reduce((t, v) => t + v, 0);
  const lifestyleActualTotal = Object.values(lifeActual).reduce((t, v) => t + v, 0);

  const subMonthly = s.subscriptions.reduce((t, sub) => {
    const a = N(sub.amount);
    if (sub.cycle === "quarterly")   return t + a / 3;
    if (sub.cycle === "half-yearly") return t + a / 6;
    if (sub.cycle === "annual")      return t + a / 12;
    return t + a;
  }, 0);

  const plannedTotal = fixedPlan + lifestylePlanTotal + subMonthly;
  const actualTotal  = fixedPlan + lifestyleActualTotal + subMonthly;
  const savings = income - actualTotal;
  const variableBudget = income - fixedPlan - subMonthly;
  const variableRemaining = variableBudget - lifestyleActualTotal;

  const now         = new Date();
  const daysPassed  = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft    = daysInMonth - daysPassed;

  const fixedDaily    = (fixedPlan + subMonthly) / daysInMonth;
  const variableSpent = lifestyleActualTotal;
  const variableDaily = daysPassed > 0 ? variableSpent / daysPassed : 0;
  const variableBurnRate= variableDaily;
  const projectedTotal = fixedPlan + subMonthly + (variableBurnRate * daysInMonth);
  const projectedEnd   = income - projectedTotal;
  const drift          = projectedTotal - plannedTotal;
  const committedPct = income > 0 ? Math.min(100, (actualTotal / income) * 100) : 0;
  const savingsRate  = income > 0 ? ( savings / income) * 100 : 0;
  const safeDaily    = daysLeft > 0 ? Math.max(0, variableRemaining / daysLeft) : 0;

  const todayStr = now.toISOString().slice(0, 10);
  let todaySpent = 0;
  for (const c of cats)
    for (const l of s.lifestyle[c].logs)
      if (l.date === todayStr) todaySpent += N(l.amount);




  let clarity = 0;
  if (income > 0) clarity += 25;
  const hasFixedMeaning = rent > 0 || (s.fixed.utilities.length + s.fixed.emis.length) >= 2;
  if (hasFixedMeaning) clarity += 25;
  const filledCats = cats.filter(c => N(s.lifestyle[c].manual) > 0 || s.lifestyle[c].logs.length > 0).length;
  if (filledCats >= 2) clarity += 25;
  if (s.subscriptions.length > 0) clarity += 15;
  if (cats.some(c => s.lifestyle[c].logs.length > 0)) clarity += 10;
  clarity = Math.min(100, clarity);

  const steps = {
    income:        income > 0,
    fixed:         hasFixedMeaning,
    lifestyle:     filledCats >= 2,
    subscriptions: s.subscriptions.length > 0,
  };

  return {
    income, rent, utilities, emis, fixedPlan,
    lifePlan, lifeActual, lifestylePlanTotal, lifestyleActualTotal,
    subMonthly, plannedTotal, actualTotal, savings, variableBudget, variableRemaining,
    daysPassed, daysInMonth, daysLeft, fixedDaily, variableDaily,
     projectedTotal, projectedEnd, drift,
    committedPct, savingsRate, safeDaily, todaySpent,
     clarity, steps, burnRate: variableBurnRate, 
    stepsComplete: Object.values(steps).filter(Boolean).length, cats,
  };
}

// ─── Feedback engines ─────────────────────────────────────────────────────────
function getFeedback(stats) {
  const { income, fixedPlan, lifestyleActualTotal, savingsRate, savings, drift } = stats;
  if (income === 0) return null;
  if (savings < 0)                       return { text: "You're in the red. Pull back in one area — today.", color: C.error, icon: "warning" };
  if (fixedPlan / income > 0.5)            return { text: `${((fixedPlan / income) * 100).toFixed(0)}% of income is already locked. Flexibility is low.`, color: C.warn, icon: "lock" };
  if (lifestyleActualTotal / income > 0.3) return { text: "Lifestyle spend is where it usually leaks. Time to look.", color: C.warn, icon: "tune" };
  if (savingsRate < 10)                    return { text: "Savings rate below 10%. A small shift here compounds fast.", color: C.warn, icon: "savings" };
  if (drift > income * 0.05)               return { text: `You're drifting ${fmtINR(drift, true)} above plan. Catch it now.`, color: C.warn, icon: "trending_up" };
  if (savingsRate >= 30)                   return { text: "You're in control. Most people don't get here.", color: C.primary, icon: "trending_up" };
  return { text: "On track. Compound the discipline.", color: C.blue, icon: "check_circle" };
}

function getStatusLabel(savingsRate) {
if (savingsRate < 10) return { label: "Tight", color: C.warn };
if (savingsRate < 30) return { label: "Stable", color: C.primary};
return {label: "Strong", color: C.blue}; 
}
// ─── Status level (4-state) ──────────────────────────────────────────────
function getStatusLevel(stats) {
  const { variableRemaining, safeDaily, variableBudget, lifestyleActualTotal, daysInMonth, daysPassed } = stats;

  if (variableRemaining < 0) return "BLEEDING";

  const idealSoFar = daysInMonth > 0
    ? (variableBudget / daysInMonth) * daysPassed
    : 0;

  const isOverspending = lifestyleActualTotal - idealSoFar > 0;

  if (isOverspending) return "RECKLESS";
  if (safeDaily < 500) return "TIGHT";
  return "IN_CONTROL";
}

const STATUS_UI = {
  BLEEDING: {
    color: "#f87171",
    label: "You're losing control",
  },
  RECKLESS: {
    color: "#fb923c",
    label: "You're slipping",
  },
  TIGHT: {
    color: "#fbbf24",
    label: "You're close",
  },
  IN_CONTROL: {
    color: "#00e87a",
    label: "You're ahead this month",
  },
};

function getMiniInsights(state, stats) {
  const { income, lifestylePlanTotal, lifestyleActualTotal, fixedPlan, subMonthly, drift } = stats;
  const ins = [];
  if (income === 0) return ins;
  const lifeUsedPct = lifestylePlanTotal > 0 ? (lifestyleActualTotal / lifestylePlanTotal) * 100 : 0;
  if (lifeUsedPct > 0) ins.push(`${lifeUsedPct.toFixed(0)}% of lifestyle budget used`);
  const fixedPct = income > 0 ? (fixedPlan / income) * 100 : 0;
  if (fixedPct > 0) ins.push(`Fixed costs: ${fixedPct.toFixed(0)}% of income`);
  if (subMonthly > 0) ins.push(`Subscriptions: ${fmtINR(subMonthly, true)}/mo`);
  if (drift > 0) ins.push(`Pace exceeds plan by ${fmtINR(drift, true)}`);
  else if (drift < -200) ins.push(`${fmtINR(Math.abs(drift), true)} under plan — keep it up`);
  return ins.slice(0, 2);
}

// ─── Store ─────────────────────────────────────────────────────────────────
function useStore() {
  const [state, _set] = useState(() => loadData() || initialState());
  const set = useCallback((fn) => { _set(p => { const n = fn(p); saveData(n); return n; }); }, []);

  const setIncomeSalary   = useCallback((v) => set(p => ({ ...p, income: { ...p.income, salary: v === "" ? 0 : Number(v) } })), [set]);
  const setIncomeOther    = useCallback((v) => set(p => ({ ...p, income: { ...p.income, other:  v === "" ? 0 : Number(v) } })), [set]);
  const setRent           = useCallback((v) => set(p => ({ ...p, fixed: { ...p.fixed, rent: v === "" ? 0 : Number(v) } })), [set]);
  const addUtil           = useCallback(() => set(p => ({ ...p, fixed: { ...p.fixed, utilities: [...p.fixed.utilities, { id: mkId(), name: "", amount: 0 }] } })), [set]);
  const delUtil           = useCallback((id) => set(p => ({ ...p, fixed: { ...p.fixed, utilities: p.fixed.utilities.filter(u => u.id !== id) } })), [set]);
  const setUtil           = useCallback((id, k, v) => set(p => ({ ...p, fixed: { ...p.fixed, utilities: p.fixed.utilities.map(u => u.id === id ? { ...u, [k]: k === "amount" ? (v === "" ? 0 : Number(v)) : v } : u) } })), [set]);
  const addEmi            = useCallback(() => set(p => ({ ...p, fixed: { ...p.fixed, emis: [...p.fixed.emis, { id: mkId(), name: "", amount: 0 }] } })), [set]);
  const delEmi            = useCallback((id) => set(p => ({ ...p, fixed: { ...p.fixed, emis: p.fixed.emis.filter(e => e.id !== id) } })), [set]);
  const setEmi            = useCallback((id, k, v) => set(p => ({ ...p, fixed: { ...p.fixed, emis: p.fixed.emis.map(e => e.id === id ? { ...e, [k]: k === "amount" ? (v === "" ? 0 : Number(v)) : v } : e) } })), [set]);
  const setLifeManual     = useCallback((cat, v) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], manual: v === "" ? 0 : Number(v) } } })), [set]);
  const addLifeLog        = useCallback((cat, e) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], logs: [...p.lifestyle[cat].logs, { id: mkId(), ...e }] } } })), [set]);
  const delLifeLog        = useCallback((cat, id) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], logs: p.lifestyle[cat].logs.filter(l => l.id !== id) } } })), [set]);
  const addSub            = useCallback(() => set(p => ({ ...p, subscriptions: [...p.subscriptions, { id: mkId(), name: "", amount: 0, cycle: "monthly" }] })), [set]);
  const delSub            = useCallback((id) => set(p => ({ ...p, subscriptions: p.subscriptions.filter(s => s.id !== id) })), [set]);
  const setSub            = useCallback((id, k, v) => set(p => ({ ...p, subscriptions: p.subscriptions.map(s => s.id === id ? { ...s, [k]: k === "amount" ? (v === "" ? 0 : Number(v)) : v } : s) })), [set]);
  const setGoal           = useCallback((v) => set(p => ({ ...p, meta: { ...p.meta, goal: v === "" ? 0 : Number(v) } })), [set]);
  const reset             = useCallback(() => { clearData(); _set(initialState()); }, []);

  return { state, set, setIncomeSalary, setIncomeOther, setRent, addUtil, delUtil, setUtil, addEmi, delEmi, setEmi, setLifeManual, addLifeLog, delLifeLog, addSub, delSub, setSub, setGoal, reset };
}

// ════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — reusable primitives
// ════════════════════════════════════════════════════════════════

// Icon
const Ic = ({ n: name, size = 20, color, style = {} }) => (
  <span className="ms" style={{ fontSize: size, color: color || "inherit", flexShrink: 0, lineHeight: 1, ...style }}>{name}</span>
);

// Unified glass card — all cards derive from this
function Card({ children, style = {}, accent, className = "" }) {
  const accentBorder = accent ? `1px solid ${accent}30` : `1px solid ${C.border}`;
  const accentBg     = accent ? `${accent}06` : C.glass;
  return (
    <div className={className} style={{
      background: `linear-gradient(135deg, ${accentBg}, rgba(255,255,255,0.01))`,
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      border: accentBorder,
      borderRadius: 18,
      padding: 18,
      ...style,
    }}>
      {children}
    </div>
  );
}

// Progress bar
function Bar({ pct, color = C.primary, h = 3, animated = true }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ height: h, background: "rgba(255,255,255,0.05)", borderRadius: h }}>
      <div className={animated ? "bar" : "prog"}
        style={{ height: "100%", width: `${w}%`, background: color, borderRadius: h, "--w": `${w}%` }} />
    </div>
  );
}

// Label (uppercase muted)
const Label = ({ children, style = {} }) => (
  <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", color: C.sub, ...style }}>{children}</span>
);

// Stat value (monospace number)
const StatVal = ({ children, color = C.text, size = 22, style = {} }) => (
  <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: size, color, letterSpacing: "-.02em", ...style }}>{children}</span>
);

const Divider = () => <div style={{ height: 1, background: C.border, margin: "4px 0" }} />;

// ─── Stable input atoms (module-level — no focus loss) ────────────────────
function NumInput({ value, onChange, placeholder = "0", style = {} }) {
  const handleChange = useCallback((e) => {
    let v = e.target.value.replace(/[^0-9.]/g, "");
    const p = v.split(".");
    if (p.length > 2) v = p[0] + "." + p.slice(1).join("");
    onChange(v === "" ? 0 : v);
  }, [onChange]);
  const display = (value === 0 || value === "") ? "" : String(value);
  return (
    <input type="text" inputMode="decimal" value={display} onChange={handleChange}
      placeholder={placeholder} style={{ fontWeight: 500, fontSize: 16, width: "100%", ...style }} />
  );
}

function StrInput({ value, onChange, placeholder = "", style = {} }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 14, color: C.text, width: "100%", ...style }} />
  );
}

function Field({ label, hint, onClear, children }) {
  return (
    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <Label>{label}</Label>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 11, padding: "11px 14px", transition: "border-color .2s" }}>
        <span style={{ color: C.muted, fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: 15, flexShrink: 0 }}>₹</span>
        {children}
        {onClear && (
          <button onClick={onClear} style={{ flexShrink: 0, color: C.muted, opacity: .4, padding: "0 2px", lineHeight: 1, transition: "opacity .15s" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = 1)}
            onMouseLeave={e => (e.currentTarget.style.opacity = ".4")}
          ><Ic n="close" size={14} /></button>
        )}
      </div>
      {hint && <span style={{ fontSize: 10, color: C.muted, opacity: .5 }}>{hint}</span>}
    </div>
  );
}

function GhostBtn({ children, onClick, color = C.sub }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 4, color, fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 7, background: `${color}14`, border: `1px solid ${color}22`, transition: "background .15s" }}
      onMouseEnter={e => (e.currentTarget.style.background = `${color}24`)}
      onMouseLeave={e => (e.currentTarget.style.background = `${color}14`)}
    >{children}</button>
  );
}

// ─── Impact flash ──────────────────────────────────────────────────────────
function ImpactFlash({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="impact-anim" style={{ marginTop: 10, padding: "11px 14px", background: `${C.primary}12`, border: `1px solid ${C.primary}30`, borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
      <Ic n="auto_awesome" size={15} color={C.primary} />
      <span style={{ fontSize: 13, fontWeight: 600, color: C.primary, lineHeight: 1.4 }}>{msg}</span>
    </div>
  );
}

// ─── Collapsible Section ───────────────────────────────────────────────────
function Section({ title, icon, summary, hint, defaultOpen = false, feedbackMsg, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", padding: "14px 18px", gap: 12, background: "none", cursor: "pointer" }}>
        <Ic n={icon} size={17} color={open ? C.primary : C.muted} style={{ transition: "color .2s" }} />
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 14, flex: 1, textAlign: "left" }}>{title}</span>
        {summary !== undefined && (
          <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: 15, color: summary > 0 ? C.text : C.muted }}>{fmtINR(summary, true)}</span>
        )}
        <Ic n={open ? "expand_less" : "expand_more"} size={17} color={C.muted} />
      </button>
      {feedbackMsg && !open && (
        <div style={{ padding: "0 18px 12px" }}>
          <span style={{ fontSize: 11, color: feedbackMsg.color, opacity: .85 }}>{feedbackMsg.text}</span>
        </div>
      )}
      <div className={`sb${open ? " open" : ""}`}>
        <div style={{ padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Divider />
          {children}
        </div>
      </div>
      {!open && hint && summary === 0 && (
        <div style={{ padding: "0 18px 12px" }}>
          <span style={{ fontSize: 11, color: C.muted, opacity: .35 }}>{hint}</span>
        </div>
      )}
    </div>
  );
}

// ─── Array rows (module-level, no focus loss) ──────────────────────────────
const UtilRow = ({ item, onName, onAmt, onDel }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
      <StrInput value={item.name} onChange={onName} placeholder="e.g. Electricity" />
    </div>
    <div style={{ width: 108, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>₹</span>
      <NumInput value={item.amount} onChange={onAmt} placeholder="0" style={{ fontSize: 14 }} />
    </div>
    <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: `${C.error}10`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Ic n="close" size={15} color={C.error} />
    </button>
  </div>
);

const EmiRow = ({ item, onName, onAmt, onDel }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
      <StrInput value={item.name} onChange={onName} placeholder="Loan name" />
    </div>
    <div style={{ width: 108, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>₹</span>
      <NumInput value={item.amount} onChange={onAmt} placeholder="0" style={{ fontSize: 14 }} />
    </div>
    <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: `${C.error}10`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Ic n="close" size={15} color={C.error} />
    </button>
  </div>
);

const CYCLES = ["monthly", "quarterly", "half-yearly", "annual"];
const SubRow = ({ sub, onField, onDel }) => (
  <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
      <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
        <StrInput value={sub.name} onChange={v => onField("name", v)} placeholder="Netflix, Spotify…" />
      </div>
      <div style={{ width: 108, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>₹</span>
        <NumInput value={sub.amount} onChange={v => onField("amount", v)} placeholder="0" style={{ fontSize: 14 }} />
      </div>
      <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: `${C.error}10`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ic n="close" size={15} color={C.error} />
      </button>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {CYCLES.map(c => (
        <button key={c} onClick={() => onField("cycle", c)} style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: sub.cycle === c ? `${C.primary}18` : "rgba(255,255,255,0.04)", color: sub.cycle === c ? C.primary : C.muted, border: `1px solid ${sub.cycle === c ? C.primary + "44" : C.border}`, transition: "all .15s" }}>
          {c}
        </button>
      ))}
      {sub.cycle !== "monthly" && N(sub.amount) > 0 && (
        <span style={{ fontSize: 10, color: C.muted, marginLeft: 2 }}>
          ≈ {fmtINR(sub.cycle === "quarterly" ? N(sub.amount)/3 : sub.cycle === "half-yearly" ? N(sub.amount)/6 : N(sub.amount)/12, true)}/mo
        </span>
      )}
    </div>
  </div>
);

const LogRow = ({ log, onDel }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
    <span style={{ flex: 1, fontSize: 12, color: C.sub }}>{log.note || "Entry"}</span>
    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: 13 }}>{fmtINR(N(log.amount))}</span>
    <button onClick={onDel} style={{ color: C.muted, opacity: .4, padding: 4, lineHeight: 1, transition: "opacity .15s" }}
      onMouseEnter={e => (e.currentTarget.style.opacity = 1)}
      onMouseLeave={e => (e.currentTarget.style.opacity = ".4")}
    ><Ic n="close" size={13} /></button>
  </div>
);

// ─── Lifestyle category ────────────────────────────────────────────────────
function LifeCat({ catKey, label, icon, color, data, manual, onManual, onAddLog, onDelLog, income, daysPassed, daysInMonth }) {
  const [logNote,  setLogNote]  = useState("");
  const [logAmt,   setLogAmt]   = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [impactMsg, setImpactMsg] = useState(null);

  const logSum       = useMemo(() => data.logs.reduce((t, l) => t + N(l.amount), 0), [data.logs]);
  const displayTotal = data.logs.length > 0 ? logSum : N(manual);
  const pct          = income > 0 ? (displayTotal / income) * 100 : 0;
  const barColor     = pct > 20 ? C.error : pct > 12 ? C.warn : color;

  const handleLogAmt  = useCallback((v) => setLogAmt(v), []);
  const handleLogNote = useCallback((e) => setLogNote(e.target.value), []);
  const clearManual   = useCallback(() => onManual(0), [onManual]);

  const submitLog = useCallback(() => {
    const amt = N(logAmt);
    if (!amt) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    onAddLog({ note: logNote.trim(), amount: amt, date: todayStr });
    if (daysPassed > 0) {
      const projAdd = amt * (daysInMonth / daysPassed);
      setImpactMsg(`Adds ~${fmtINR(projAdd, true)} to monthly spend`);
    }
    setLogNote("");
    setLogAmt(0);
  }, [logNote, logAmt, onAddLog, daysPassed, daysInMonth]);

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 13, padding: "14px 15px", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}16`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ic n={icon} size={16} color={color} />
        </div>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{label}</span>
        {data.logs.length > 0 && (
          <span style={{ fontSize: 9, color: C.muted, background: C.s2, padding: "2px 7px", borderRadius: 20 }}>auto · {data.logs.length}</span>
        )}
        <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: 14, color: displayTotal > 0 ? C.text : C.muted }}>{fmtINR(displayTotal, true)}</span>
      </div>

      <Field label="Monthly budget or estimate"
        hint={data.logs.length > 0 ? `Calculated from ${data.logs.length} log entries` : "Monthly amount · logs override this"}
        onClear={N(manual) > 0 ? clearManual : undefined}
      >
        <NumInput value={manual} onChange={onManual} placeholder="0" style={{ fontSize: 15, opacity: data.logs.length > 0 ? .28 : 1 }} />
      </Field>
      {data.logs.length > 0 && (
        <p style={{ fontSize: 10, color: C.warn, opacity: .7, marginTop: 3 }}>Manual value ignored while logs exist</p>
      )}

      {displayTotal > 0 && (
        <div style={{ marginTop: 10 }}>
          <Bar pct={pct} color={barColor} h={2} />
          <span style={{ fontSize: 10, color: C.muted, marginTop: 4, display: "block" }}>{pct.toFixed(0)}% of income</span>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowLogs(o => !o)} style={{ fontSize: 11, fontWeight: 600, color: C.sub, display: "flex", alignItems: "center", gap: 4 }}>
          <Ic n={showLogs ? "expand_less" : "receipt_long"} size={13} />
          {showLogs ? "Hide" : `Log entries (${data.logs.length})`}
        </button>
        <div className={`sb${showLogs ? " open" : ""}`}>
          <div style={{ paddingTop: 10 }}>
            {data.logs.map(l => <LogRow key={l.id} log={l} onDel={() => onDelLog(l.id)} />)}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                <input type="text" value={logNote} onChange={handleLogNote} placeholder="Note (optional)"
                  style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 12, color: C.text, background: "transparent", border: "none", outline: "none", width: "100%" }} />
              </div>
              <div style={{ width: 88, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₹</span>
                <NumInput value={logAmt} onChange={handleLogAmt} placeholder="0" style={{ fontSize: 13 }} />
              </div>
              <button onClick={submitLog} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic n="add" size={17} color={color} />
              </button>
            </div>
            {impactMsg && <ImpactFlash key={impactMsg + Date.now()} msg={impactMsg} onDone={() => setImpactMsg(null)} />}
            <span style={{ fontSize: 9, color: C.muted, opacity: .35, marginTop: 5, display: "block" }}>Per entry · each amount adds to total</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Log Modal ───────────────────────────────────────────────────────
const QUICK_CATS = [
  { key: "dining",        label: "Dining",        icon: "restaurant",   color: "#ffb347" },
  { key: "transport",     label: "Transport",     icon: "commute",      color: C.blue    },
  { key: "shopping",      label: "Shopping",      icon: "shopping_bag", color: C.purple  },
  { key: "entertainment", label: "Entertainment", icon: "movie",        color: C.orange  },
];

function QuickLogModal({ onAdd, onClose }) {
  const [amt,  setAmt]  = useState(0);
  const [note, setNote] = useState("");
  const [cat,  setCat]  = useState("dining");
  const amtRef = useRef(null);

  useEffect(() => { setTimeout(() => amtRef.current?.focus(), 80); }, []);

  
  const handleNote = useCallback((e) => setNote(e.target.value), []);

  const submit = useCallback(() => {
    const a = N(amt);
    if (!a) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    onAdd(cat, { note: note.trim(), amount: a, date: todayStr });
    setAmt(0); setNote(""); 
    onClose();
  }, [amt, note, cat, onAdd, onClose]);

  return (
    <div className="modal-bg" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 20px" }}
    >
      <div className="modal-card" onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: "rgba(15,15,20,0.96)", border: `1px solid ${C.border}`, borderRadius: 22, padding: "24px 20px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 17 }}>Quick Log</span>
          <button onClick={onClose}><Ic n="close" size={22} color={C.sub} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
          {QUICK_CATS.map(({ key: k, label, icon, color }) => (
            <button key={k} onClick={() => setCat(k)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px", borderRadius: 12, background: cat === k ? `${color}16` : "rgba(255,255,255,0.03)", border: `1px solid ${cat === k ? color + "44" : C.border}`, transition: "all .15s" }}>
              <Ic n={icon} size={20} color={cat === k ? color : C.muted} />
              <span style={{ fontSize: 9, fontWeight: 600, color: cat === k ? color : C.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <Field label="Amount" hint="Per entry amount">
            <input ref={amtRef} type="text" inputMode="decimal"
              value={(amt === 0 || amt === "") ? "" : String(amt)}
              onChange={e => { let v = e.target.value.replace(/[^0-9.]/g, ""); const p = v.split("."); if (p.length > 2) v = p[0] + "." + p.slice(1).join(""); setAmt(v === "" ? 0 : v); }}
              placeholder="0"
              style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: 22, width: "100%" }}
            />
          </Field>
        </div>

        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}`, padding: "11px 14px", marginBottom: 18 }}>
          <input type="text" value={note} onChange={handleNote} placeholder="Note (optional)"
            style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 14, color: C.text, background: "transparent", border: "none", outline: "none", width: "100%" }} />
        </div>

        <button onClick={submit} style={{ width: "100%", height: 52, background: C.primary, color: C.onPrimary, borderRadius: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: ".03em", transition: "opacity .15s" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = ".88")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >Add Entry</button>
      </div>
    </div>
  );
}

// ─── Footer modals ─────────────────────────────────────────────────────────
function ModalOverlay({ title, onClose, children }) {
  return (
    <div className="modal-bg" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(8px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div className="modal-card" onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "80dvh", overflowY: "auto", background: "rgba(13,13,18,0.98)", border: `1px solid ${C.border}`, borderRadius: 22, padding: "28px 24px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 18 }}>{title}</span>
          <button onClick={onClose}><Ic n="close" size={22} color={C.sub} /></button>
        </div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.75 }}>{children}</div>
      </div>
    </div>
  );
}

function PrivacyModal({ onClose }) {
  return (
    <ModalOverlay title="Privacy Policy" onClose={onClose}>
      <p style={{ marginBottom: 14, fontWeight: 600, color: C.text }}>Your data stays on your device.</p>
      <p style={{ marginBottom: 12 }}>MoneyMirror stores all financial data locally using your browser's localStorage. No data is transmitted to any server, third party, or analytics service.</p>
      <p style={{ marginBottom: 12 }}>We do not collect, process, or store any personally identifiable information. There are no accounts, no sign-in, and no cloud sync.</p>
      <p style={{ marginBottom: 12 }}>Clearing your browser data or using the Reset button will permanently delete all stored information.</p>
      <p style={{ color: C.muted }}>Last updated: 2025. For questions, use the WhatsApp feedback button.</p>
    </ModalOverlay>
  );
}

function TermsModal({ onClose }) {
  return (
    <ModalOverlay title="Terms of Service" onClose={onClose}>
      <p style={{ marginBottom: 14, fontWeight: 600, color: C.text }}>MoneyMirror is a personal finance awareness tool.</p>
      <p style={{ marginBottom: 12 }}>All projections, burn rate calculations, and financial scores are illustrative estimates based on the data you enter. They are not financial advice.</p>
      <p style={{ marginBottom: 12 }}>The 25-year SIP projections assume a 12% annual return — actual returns vary. Consult a qualified financial advisor before making investment decisions.</p>
      <p style={{ marginBottom: 12 }}>MoneyMirror is provided as-is with no warranties. Use it as a behavioural awareness tool, not as a primary financial record.</p>
      <p style={{ color: C.muted }}>By using this app, you agree to these terms.</p>
    </ModalOverlay>
  );
}

function SupportModal({ onClose }) {
  const openWA = useCallback(() => {
    const msg = encodeURIComponent("Hi, I need support with MoneyMirror 👋");
    window.open(`https://wa.me/919999999999?text=${msg}`, "_blank", "noopener");
  }, []);
  return (
    <ModalOverlay title="Support" onClose={onClose}>
      <p style={{ marginBottom: 14, fontWeight: 600, color: C.text }}>We're here if something feels off.</p>
      <p style={{ marginBottom: 12 }}>MoneyMirror is in active development. If you encounter a bug, have a feature request, or just want to share feedback — reach out directly.</p>
      <p style={{ marginBottom: 20 }}>The fastest way to reach us is WhatsApp:</p>
      <button onClick={openWA} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "#25D36622", border: "1px solid #25D36640", borderRadius: 12, color: "#25D366", fontWeight: 700, fontSize: 14, width: "100%" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49"/></svg>
        Chat on WhatsApp
      </button>
    </ModalOverlay>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────
function Footer({ onPrivacy, onTerms, onSupport }) {
  const linkStyle = { fontSize: 12, color: "rgba (255, 255, 255, 0.6)", cursor: "pointer", transition: "opacity 0.2s"
  };
  
  return (
  <div style={{
    marginTop: 40,
    padding: "24px 16px 32px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    textAlign: "center"
  }}>

    {/* Mirror Line */}
    <p style={{
      fontSize: 13,
      color: "rgba(255,255,255,0.35)",
      marginBottom: 12
    }}>
      This is your trajectory. It changes if you do.
    </p>

    {/* Actions */}
    <div style={{
      display: "flex",
      justifyContent: "center",
      gap: 16,
      marginBottom: 14,
      flexWrap: "wrap"
    }}>
      <span onClick={onPrivacy} style={linkStyle}>Privacy</span>
      <span onClick={onTerms} style={linkStyle}>Terms</span>
      <span onClick={onSupport} style={linkStyle}>Support</span>
    </div>

    {/* Brand Line */}
    <p style={{
      fontSize: 11,
      color: "rgba(255,255,255,0.35)"
    }}>
      MoneyMirror — Face your money. Fix your future.
    </p>

  </div>
);
}

// ─── Clarity Score Header ──────────────────────────────────────────────────
function ClarityHeader({ stats, onNav }) {
  const { clarity, steps, income } = stats;
  const full = clarity >= 100;

  if (income === 0) return (
    <Card accent={C.primary} style={{ marginBottom: 20 }} className="scale-in">
      <p style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Map your money in 30 seconds</p>
      <p style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>Start with your monthly income ↓</p>
      <Bar pct={0} color={C.primary} h={4} animated={false} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <Label>Financial Clarity Score</Label>
        <Label style={{ color: C.primary }}>0%</Label>
      </div>
    </Card>
  );

  if (full) return (
    <Card accent={C.primary} style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }} className="scale-in">
      <div>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 15, color: C.primary, marginBottom: 2 }}>Full clarity achieved 🔥</p>
        <Label>Clarity Score: 100%</Label>
      </div>
      <button onClick={() => onNav("insights")} style={{ padding: "9px 18px", background: C.primary, color: C.onPrimary, borderRadius: 10, fontWeight: 700, fontSize: 12 }}>
        See your reality →
      </button>
    </Card>
  );

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Label>Financial Clarity Score</Label>
        <Label style={{ color: C.primary }}>{clarity}%</Label>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 5, marginBottom: 12 }}>
        <div className="prog" style={{ height: "100%", width: `${clarity}%`, background: C.primary, borderRadius: 5 }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[["income","Income"],["fixed","Fixed"],["lifestyle","Lifestyle"],["subscriptions","Subs"]].map(([k, lbl]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 15, height: 15, borderRadius: "50%", background: steps[k] ? C.primary : "rgba(255,255,255,0.05)", border: `1.5px solid ${steps[k] ? C.primary : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .25s" }}>
              {steps[k] && <Ic n="check" size={9} color={C.onPrimary} />}
            </div>
            <span style={{ fontSize: 10, color: steps[k] ? C.primary : C.muted, fontWeight: steps[k] ? 600 : 400, transition: "color .25s" }}>{lbl}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
function RealityStrip({ stats }) {
  const { variableBudget, lifestyleActualTotal, variableRemaining } = stats;
  const isNeg = variableRemaining < 0;

  const items = [
    { label: "Budget", val: fmtINR(variableBudget, true) },
    { label: "Spent", val: fmtINR(lifestyleActualTotal, true) },
    { label: "Left", val: fmtINR(Math.abs(variableRemaining), true), neg: isNeg },
  ];

  return (
    <div style={{
      display: "flex",
      background: "rgba(255,255,255,0.03)",
      borderRadius: 8,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      marginTop: 8
    }}>
      {items.map((item, i) => (
        <div key={item.label} style={{
          flex: 1,
          padding: "8px 12px",
          borderRight: i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none"
        }}>
          <p style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: C.muted,
            fontWeight: 600,
            marginBottom: 3
          }}>
            {item.label}
          </p>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            fontWeight: 500,
            color: item.neg ? C.error : C.text
          }}>
            {item.neg ? "−" : ""}{item.val}
          </p>
        </div>
      ))}
    </div>
  );
}
// ─── Safe Spend Card ───────────────────────────────────────────────────────
function SafeSpendCard({ stats }) {
  const {
    income,
    safeDaily,
    daysLeft,
    variableBudget,
    daysInMonth,
    daysPassed,
    lifestyleActualTotal,
    variableRemaining
  } = stats;

  if (income === 0) return null;

  const idealSpentSoFar = daysInMonth > 0
    ? (variableBudget / daysInMonth) * daysPassed
    : 0;

  const overTotal = lifestyleActualTotal - idealSpentSoFar;
  const isOverspending = overTotal > 0;

  const statusLevel = getStatusLevel(stats);
  const { color: accent, label: statusLabel } = STATUS_UI[statusLevel];

  const secondary = isOverspending
    ? `${fmtINR(Math.abs(overTotal), true)} over ideal pace`
    : `${fmtINR(variableRemaining, true)} left this month`;

  return (
    <Card accent={accent} style={{ marginBottom: 16 }} className="slide-d">
      
      {/* HERO */}
      <div style={{ marginBottom: 14 }}>
        <p style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: accent,
          marginBottom: 6
        }}>
          You can spend today
        </p>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 40,
            fontWeight: 500,
            color: accent
          }}>
            {fmtINR(safeDaily, true)}
          </span>

          <span style={{ fontSize: 11, color: C.muted }}>
            {daysLeft}d left
          </span>
        </div>

        <p style={{
          fontSize: 12,
          color: isOverspending ? accent : C.sub,
          marginTop: 5
        }}>
          {secondary}
        </p>
      </div>

      {/* REALITY STRIP */}
      <RealityStrip stats={stats} />

      {/* STATUS */}
      <p style={{
        fontSize: 12,
        color: accent,
        fontWeight: 700,
        marginTop: 12
      }}>
        {statusLabel}
      </p>
    </Card>
  );
}
// ─── Mini stat cards ───────────────────────────────────────────────────────
function MiniCards({ stats }) {
  const { income, burnRate, daysLeft, savingsRate, savings} = stats;
  if (income === 0) return null;

  const cards = [
    { label: "Burn rate",    val: fmtINR(burnRate, true) + "/d",           color: savings < 0 ? C.error : C.text },
    { label: "Days left",    val: `${daysLeft}d`,                           color: C.blue    },
    { label: "Savings rate", val: `${Math.max(0, savingsRate).toFixed(1)}%`,color: savingsRate >= 20 ? C.primary : savingsRate >= 10 ? C.warn : C.error },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
      {cards.map(({ label, val, color }) => (
        <Card key={label} className="card-hover" style={{ padding: "12px 13px" }}>
          <Label style={{ marginBottom: 6, display: "block" }}>{label}</Label>
          <StatVal color={color} size={15}>{val}</StatVal>
        </Card>
      ))}
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────
const TABS = [
  { id: "home",     icon: "home_max",     label: "Home"     },
  { id: "insights", icon: "auto_awesome", label: "Insights" },
  { id: "mirror",   icon: "blur_on",      label: "Mirror"   },
];

function Nav({ active, onNav, status }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "rgba(5,5,7,.95)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, padding: "10px 20px 18px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
      {TABS.map(t => {
        const a = active === t.id;
        const dot = t.id === "home" && status === "BLEEDING";
        return (
          <button key={t.id} onClick={() => onNav(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: a ? C.primary : C.muted, opacity: a ? 1 : .36, transform: a ? "translateY(-1px)" : "none", transition: "all .2s", position: "relative", padding: "4px 22px" }}>
            {dot && <span style={{ position: "absolute", top: 2, right: 17, width: 6, height: 6, borderRadius: "50%", background: C.error }} />}
            <Ic n={t.icon} size={21} color="inherit" />
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em" }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── FABs ──────────────────────────────────────────────────────────────────
function QuickLogFAB({ onClick }) {
  return (
    <button onClick={onClick} title="Quick log"
      style={{ position: "fixed", bottom: 108, left: 18, zIndex: 90, width: 48, height: 48, borderRadius: "50%", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${C.primary}44`, transition: "transform .15s" }}
      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      <Ic n="add" size={26} color={C.onPrimary} />
    </button>
  );
}

const WA_NUMBER = "919999999999";
function WAButton() {
  const open = useCallback(() => {
    const msg = encodeURIComponent("Hi, I have feedback for MoneyMirror 👋");
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, "_blank", "noopener");
  }, []);
  return (
    <button onClick={open} title="Send feedback"
      style={{ position: "fixed", bottom: 108, right: 18, zIndex: 90, width: 48, height: 48, borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(37,211,102,.35)", transition: "transform .15s" }}
      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49"/></svg>
    </button>
  );
}

// ─── Background grain texture ───────────────────────────────────────────────
const Blobs = () => (
  <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
    <div style={{ position: "absolute", top: "-20%", left: "-15%", width: "55%", height: "55%", background: `${C.primary}06`, borderRadius: "50%", filter: "blur(120px)" }} />
    <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "45%", height: "45%", background: `${C.blue}05`, borderRadius: "50%", filter: "blur(110px)" }} />
  </div>
);

// ─── Life cats config ──────────────────────────────────────────────────────
const LIFE_CATS_CFG = [
  { key: "dining",        label: "Dining",        icon: "restaurant",   color: "#ffb347" },
  { key: "transport",     label: "Transport",     icon: "commute",      color: C.blue    },
  { key: "shopping",      label: "Shopping",      icon: "shopping_bag", color: C.purple  },
  { key: "entertainment", label: "Entertainment", icon: "movie",        color: C.orange  },
];

// ════════════════════════════════════════════════════════════════
// HOME SCREEN
// ════════════════════════════════════════════════════════════════
function HomeScreen({ store, stats, onNav }) {
  //first-get dependencies 
  const { state, set, setIncomeSalary, setIncomeOther, setRent, addUtil, delUtil, setUtil, addEmi, delEmi, setEmi, setLifeManual, addLifeLog, delLifeLog, addSub, delSub, setSub } = store;
  const today = new
  Date().toDateString();
  const last= store.meta?.lastOpenedDate;
  const isNewDay = last !== today;
  
 const handleCheckin = useCallback(() => {
  if (!isNewDay) return;

  set((prev) => {
    const prevDate = prev.checkin.lastDate;
    const prevStreak = prev.checkin.streak;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const isYesterday =
      prevDate &&
      new Date(prevDate).toDateString() === yesterday.toDateString();

    return {
      ...prev,
      meta: {
        ...prev.meta,
        lastOpenedDate: today,
      },
      checkin: {
        lastDate: today,
        streak: isYesterday ? prevStreak + 1 : 1,
      },
    };
  });
}, [isNewDay, set, today]);

useEffect(()=> {
  handleCheckin ();
  //eslint-disabe-next-line react-hooks/exhaustive-deps
}, [handleCheckin]);
  
  const { income, fixedPlan, lifestyleActualTotal, subMonthly, savings, committedPct, savingsRate, plannedTotal, projectedTotal, drift, daysPassed, daysInMonth } = stats;

  const feedback     = getFeedback(stats);
  const status   = getStatusLevel(stats);
  const statusInfo = STATUS_UI[status] ||
  {
    color: C.primary, label: "Stable" };
  
  const heroSub = status === "IN CONTROL" 
  ? "Stay Sharp - This can slip fast" : status === "RECKLESS" 
  ? "Slow down before this compounds" : status === "BLEEDING" 
  ? "Fix one thing today" : "Keep tightening - you're close";
  const heroColor    = statusInfo.color;
  const commColor    = committedPct > 80 ? C.error : committedPct > 60 ? C.warn : C.primary;
  const miniInsights = getMiniInsights(state, stats);

  

  

  const utilName = useCallback((id, v) => setUtil(id, "name", v),   [setUtil]);
  const utilAmt  = useCallback((id, v) => setUtil(id, "amount", v), [setUtil]);
  const emiName  = useCallback((id, v) => setEmi(id, "name", v),    [setEmi]);
  const emiAmt   = useCallback((id, v) => setEmi(id, "amount", v),  [setEmi]);
  const subFld   = useCallback((id, k, v) => setSub(id, k, v),      [setSub]);

  const fixedFeedback = income > 0 && fixedPlan / income > 0.5
    ? { text: `${((fixedPlan / income) * 100).toFixed(0)}% of income locked in fixed costs.`, color: C.warn } : null;
  const lifeFeedback = income > 0 && lifestyleActualTotal / income > 0.3
    ? { text: "Lifestyle is where it usually leaks.", color: C.warn } : null;

  const spendPct = income > 0 ? (stats.actualTotal / income) * 100 : 0;
  const heroInsight = income > 0
    ? (savingsRate > 0 ? `Saving ${savingsRate.toFixed(1)}% of income` : `Spending ${Math.min(100, spendPct).toFixed(1)}% of income`)
    : null;

  return (
    <div style={{ padding: "64px 16px 130px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>

      {/* Hero purpose */}
      <div style={{ textAlign: "center", marginBottom: 22, paddingTop: 18 }}>
        <h1 style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700}}>
          {statusInfo.label}
        </h1>
        <p style={{ fontSize: 13, color: C.sub}}>
        {heroSub}
        </p>
        {state.checkin?.streak > 0 && (
          <div style={{
            marginTop:8,
            display: "inline-block", 
padding: "4px 10px",
borderRadius: 20,
background: "rgba(0, 232, 122, 0.12)",
border: "1px solid gba(0, 232, 122, 0.3)",
            fontSize: 12,
            color: "#00e87a",
            fontWeight: 600
          }}>
            {state.checkin.streak} day
            streak 
</div>
        )}
       
      </div>

      <ClarityHeader stats={stats} onNav={onNav} />

      {/* Hero number card */}
      <Card accent={heroColor} style={{ textAlign: "center", marginBottom: 16, padding: "26px 20px" }} className="fade-up">
        <Label style={{ marginBottom: 10, display: "block" }}>
          {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · Reflection
        </Label>
        <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: "clamp(44px, 13vw, 72px)", letterSpacing: "-.03em", color: heroColor, lineHeight: 1 }}>
          {income > 0 ? fmtINR(Math.abs(savings), true) : "—"}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 12, color: heroColor, textTransform: "uppercase", letterSpacing: ".08em" }}>
            {income > 0 ? (savings < 0 ? "You're Overspending. Fix this." : "Left this month") : (plannedTotal > 0 ? "You're spening with no income. Fix this now" : "No income set")}
          </span>
          {income > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: statusInfo.color, background: `${statusInfo.color}14`, padding: "3px 10px", borderRadius: 20, border: `1px solid ${statusInfo.color}28` }}>
              {statusInfo.emoji} {statusInfo.label}
            </span>
          )}
        </div>
        {heroInsight && <p style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>{heroInsight}</p>}

        {/* Plan vs Reality strip */}
        {income > 0 && plannedTotal > 0 && (
          <div style={{ marginTop: 16, display: "inline-flex", gap: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.sub }}>Plan <span style={{ color: C.text, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{fmtINR(plannedTotal, true)}</span></span>
            <span style={{ fontSize: 10, color: C.muted }}>→</span>
            <span style={{ fontSize: 11, color: C.sub }}>Projected <span style={{ color: drift > 0 ? C.warn : C.primary, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{fmtINR(projectedTotal, true)}</span></span>
            {Math.abs(drift) > 200 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: drift > 0 ? C.warn : C.primary, background: `${drift > 0 ? C.warn : C.primary}14`, padding: "2px 8px", borderRadius: 20 }}>
                {drift > 0 ? "+" : ""}{fmtINR(drift, true)}
              </span>
            )}
          </div>
        )}

        {/* Committed bar */}
        {income > 0 && (
          <div style={{ marginTop: 18, maxWidth: 280, margin: "18px auto 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <Label>Committed</Label>
              <Label style={{ color: commColor }}>{committedPct.toFixed(0)}%</Label>
            </div>
            <Bar pct={committedPct} color={commColor} h={3} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 9, color: C.muted }}>Spent {fmtINR(stats.actualTotal, true)}</span>
              <span style={{ fontSize: 9, color: C.muted }}>Income {fmtINR(income, true)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Feedback banner */}
      {feedback && income > 0 && (
        <Card style={{ marginBottom: 16, padding: "12px 16px" }} accent={feedback.color} className="slide-d">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Ic n={feedback.icon} size={16} color={feedback.color} style={{ marginTop: 1 }} />
            <p style={{ fontSize: 13, color: feedback.color, lineHeight: 1.6 }}>{feedback.text}</p>
          </div>
        </Card>
      )}

      {/* Safe spend */}
      <SafeSpendCard stats={stats} />

      {/* Mini insights */}
      {miniInsights.length > 0 && (
        <Card style={{ marginBottom: 8, padding: "12px 16px" }}>
          {miniInsights.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < miniInsights.length - 1 ? 8 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.primary, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>{m}</p>
            </div>
          ))}
        </Card>
      )}

      {income > 0 && (
        <p style={{ fontSize: 10, color: C.muted, opacity: .38, textAlign: "center", marginBottom: 16, marginTop: 6 }}>
          Your monthly reality · based on current behaviour
        </p>
      )}

      <MiniCards stats={stats} />

      {/* DATA SECTIONS */}
      <Section title="Income" icon="payments" summary={income} defaultOpen={income === 0} hint="Tap to set your monthly income">
        <Field label="Monthly Salary" hint="Monthly amount" onClear={N(state.income.salary) > 0 ? () => setIncomeSalary(0) : undefined}>
          <NumInput value={state.income.salary} onChange={setIncomeSalary} placeholder="0" style={{ fontSize: 17 }} />
        </Field>
        <Field label="Other Income" hint="Freelance, rent, dividends etc." onClear={N(state.income.other) > 0 ? () => setIncomeOther(0) : undefined}>
          <NumInput value={state.income.other} onChange={setIncomeOther} placeholder="0" style={{ fontSize: 17 }} />
        </Field>
        {income > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ fontSize: 12, color: C.sub }}>Total monthly income</span>
            <StatVal color={C.primary} size={17}>{fmtINR(income)}</StatVal>
          </div>
        )}
      </Section>

      <Section title="Fixed Expenses" icon="home_work" summary={fixedPlan} hint="Rent, utilities, EMIs" feedbackMsg={fixedFeedback}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted, marginBottom: 8 }}>Rent</p>
          <Field label="Monthly Rent" onClear={N(state.fixed.rent) > 0 ? () => setRent(0) : undefined}>
            <NumInput value={state.fixed.rent} onChange={setRent} placeholder="0" style={{ fontSize: 17 }} />
          </Field>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted }}>Utilities</p>
            <GhostBtn onClick={addUtil} color={C.primary}><Ic n="add" size={13} color={C.primary} />Add</GhostBtn>
          </div>
          {state.fixed.utilities.length === 0
            ? <p style={{ fontSize: 11, color: C.muted, opacity: .4 }}>No utilities — monthly amounts</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{state.fixed.utilities.map(u => <UtilRow key={u.id} item={u} onName={v => utilName(u.id, v)} onAmt={v => utilAmt(u.id, v)} onDel={() => delUtil(u.id)} />)}</div>
          }
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted }}>EMI / Loans</p>
            <GhostBtn onClick={addEmi} color={C.primary}><Ic n="add" size={13} color={C.primary} />Add</GhostBtn>
          </div>
          {state.fixed.emis.length === 0
            ? <p style={{ fontSize: 11, color: C.muted, opacity: .4 }}>No EMIs — monthly amount per loan</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{state.fixed.emis.map(e => <EmiRow key={e.id} item={e} onName={v => emiName(e.id, v)} onAmt={v => emiAmt(e.id, v)} onDel={() => delEmi(e.id)} />)}</div>
          }
        </div>
        {fixedPlan > 0 && (
          <div style={{ paddingTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: C.sub }}>Fixed total</span>
              <StatVal color={C.blue} size={15}>{fmtINR(fixedPlan)}</StatVal>
            </div>
            {income > 0 && <Bar pct={(fixedPlan / income) * 100} color={fixedPlan / income > 0.5 ? C.error : C.blue} h={2} />}
          </div>
        )}
      </Section>

      <Section title="Lifestyle" icon="restaurant" summary={lifestyleActualTotal} hint="Dining, transport, shopping, entertainment" feedbackMsg={lifeFeedback}>
        {LIFE_CATS_CFG.map(({ key, label, icon, color }) => (
          <LifeCat key={key} catKey={key} label={label} icon={icon} color={color}
            data={state.lifestyle[key]} manual={state.lifestyle[key].manual}
            onManual={v => setLifeManual(key, v)}
            onAddLog={entry => addLifeLog(key, entry)}
            onDelLog={id => delLifeLog(key, id)}
            income={income} daysPassed={daysPassed} daysInMonth={daysInMonth}
          />
        ))}
        {lifestyleActualTotal > 0 && (
          <div style={{ paddingTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: C.sub }}>Lifestyle total</span>
              <StatVal color={C.warn} size={15}>{fmtINR(lifestyleActualTotal)}</StatVal>
            </div>
            {income > 0 && <Bar pct={(lifestyleActualTotal / income) * 100} color={lifestyleActualTotal / income > 0.3 ? C.error : C.warn} h={2} />}
          </div>
        )}
      </Section>

      <Section title="Subscriptions" icon="subscriptions" summary={subMonthly} hint="Monthly equivalent auto-calculated"
        feedbackMsg={subMonthly > 2000 ? { text: `${fmtINR(subMonthly, true)}/mo = ${fmtINR(subMonthly * 12, true)}/yr — worth auditing`, color: C.warn } : null}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.sub }}>{state.subscriptions.length > 0 ? `${state.subscriptions.length} tracked` : "None yet"}</span>
          <GhostBtn onClick={addSub} color={C.primary}><Ic n="add" size={13} color={C.primary} />Add</GhostBtn>
        </div>
        {state.subscriptions.map(s => <SubRow key={s.id} sub={s} onField={(k, v) => subFld(s.id, k, v)} onDel={() => delSub(s.id)} />)}
        {subMonthly > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.sub }}>Monthly equivalent</span>
              <StatVal color={C.purple} size={14}>{fmtINR(subMonthly)}</StatVal>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: C.muted, opacity: .45 }}>Auto-calculated · all cycles normalised</span>
              <span style={{ fontSize: 10, color: C.muted }}>{fmtINR(subMonthly * 12, true)}/yr</span>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// INSIGHTS SCREEN
// ════════════════════════════════════════════════════════════════
function InsightsScreen({ state, stats }) {
  const { income, fixedPlan, lifestyleActualTotal, subMonthly, actualTotal, savings, savingsRate, burnRate, projectedEnd, projectedTotal, plannedTotal, daysLeft, status, drift } = stats;
  const statusInfo = getStatusLabel(savingsRate);
  const tone = status === "BLEEDING" ? "bleeding" : status === "TIGHT" ? "tight" : "stable";
  const reality = {
    bleeding: { text: "You're in the red. Pulling back in one area can change this today.", color: C.error  },
    tight:    { text: "One unplanned expense away from trouble. Stay sharp.",                color: C.warn   },
    stable:   { text: "On track. Compound the discipline — it adds up fast.",               color: C.primary },
  }[tone];

  const breakdown = [
    { label: "Fixed",         val: fixedPlan,           color: C.blue,   icon: "home_work",    pct: income > 0 ? (fixedPlan / income) * 100 : 0           },
    { label: "Lifestyle",     val: lifestyleActualTotal, color: C.warn,   icon: "restaurant",   pct: income > 0 ? (lifestyleActualTotal / income) * 100 : 0 },
    { label: "Subscriptions", val: subMonthly,           color: C.purple, icon: "subscriptions",pct: income > 0 ? (subMonthly / income) * 100 : 0          },
  ];

  const nudges = useMemo(() => {
    if (income === 0) return [];
    const out = [];
    const diningAmt = N(state.lifestyle.dining.manual);
    if (diningAmt / income > 0.12) out.push({ icon: "restaurant", text: `Dining is ${(diningAmt / income * 100).toFixed(0)}% of income. Cut to 10%.` });
    if (subMonthly > 2000) out.push({ icon: "subscriptions", text: `${fmtINR(subMonthly, true)}/mo in subscriptions — that's ${fmtINR(subMonthly * 12, true)}/yr.` });
    if (fixedPlan / income > 0.5) out.push({ icon: "home_work", text: `Fixed costs at ${(fixedPlan / income * 100).toFixed(0)}%. Safe zone is below 50%.` });
    if (savingsRate < 10 && savings >= 0) out.push({ icon: "savings", text: `Savings rate is ${savingsRate.toFixed(0)}%. Target 20%+ for real progress.` });
    if (drift > income * 0.05) out.push({ icon: "trending_up", text: `Pace exceeds plan by ${fmtINR(drift, true)} this month.` });
    if (savingsRate >= 25) out.push({ icon: "star", text: `Saving ${savingsRate.toFixed(0)}% of income. Most people don't reach this.` });
    return out;
  }, [income, state.lifestyle.dining.manual, subMonthly, fixedPlan, savingsRate, savings, drift]);

  if (income === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80dvh", gap: 16, color: C.muted, position: "relative", zIndex: 1, padding: "0 32px", textAlign: "center" }}>
      <Ic n="auto_awesome" size={44} color={C.muted} style={{ opacity: .2 }} />
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>Add your income and expenses to unlock insights.</p>
    </div>
  );

  return (
    <div style={{ padding: "64px 16px 120px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>
      <div className="fade-up">
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: "-.02em", margin: "22px 0 5px" }}>Insights</h2>
        <p style={{ fontSize: 13, color: C.sub, marginBottom: 4 }}>Your money, reflected honestly.</p>
        <p style={{ fontSize: 10, color: C.muted, opacity: .4, marginBottom: 20 }}>Based on your current behaviour this month.</p>

        {/* Status badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${statusInfo.color}10`, border: `1px solid ${statusInfo.color}25`, borderRadius: 10, padding: "8px 14px", marginBottom: 14 }}>
          <span style={{ fontSize: 14 }}>{statusInfo.emoji}</span>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 14, color: statusInfo.color }}>{statusInfo.label}</span>
          <span style={{ fontSize: 12, color: C.sub }}>· {savingsRate.toFixed(1)}%</span>
        </div>

        {/* Reality statement */}
        <Card accent={reality.color} style={{ marginBottom: 14, padding: "15px 17px" }}>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: reality.color, fontStyle: "italic" }}>"{reality.text}"</p>
        </Card>

        {/* Drift panel */}
        {income > 0 && plannedTotal > 0 && (
          <Card style={{ marginBottom: 14 }} accent={Math.abs(drift) > income * 0.05 ? C.warn : undefined}>
            <Label style={{ marginBottom: 12, display: "block" }}>Plan vs Reality</Label>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              {[
                { lbl: "Planned",   val: plannedTotal,   color: C.text                        },
                { lbl: "Drift",     val: drift,          color: drift > 0 ? C.warn : C.primary },
                { lbl: "Projected", val: projectedTotal, color: drift > 0 ? C.warn : C.primary },
              ].map(({ lbl, val, color }) => (
                <div key={lbl} style={{ textAlign: lbl === "Planned" ? "left" : lbl === "Projected" ? "right" : "center" }}>
                  <Label style={{ marginBottom: 3, display: "block" }}>{lbl}</Label>
                  <StatVal color={color} size={17}>
                    {lbl === "Drift" && drift > 0 ? "+" : ""}{fmtINR(val, true)}
                  </StatVal>
                </div>
              ))}
            </div>
            {Math.abs(drift) > 200 && (
              <p style={{ fontSize: 12, color: drift > 0 ? C.warn : C.primary, lineHeight: 1.5 }}>
                {drift > 0
                  ? `You're drifting above plan. Overshoot by ${fmtINR(drift, true)} at this pace.`
                  : `${fmtINR(Math.abs(drift), true)} under plan — good control.`}
              </p>
            )}
          </Card>
        )}

        {/* 4 stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Burn Rate",     val: fmtINR(burnRate, true) + "/day", icon: "local_fire_department", color: savings < 0 ? C.error : C.text  },
            { label: "Days Left",     val: `${daysLeft}d`,                   icon: "calendar_today",        color: C.blue                           },
            { label: "Projected End", val: fmtINR(projectedEnd, true),       icon: projectedEnd >= 0 ? "trending_up" : "trending_down", color: projectedEnd >= 0 ? C.primary : C.error },
            { label: "Savings Rate",  val: `${savingsRate.toFixed(1)}%`,     icon: "savings",               color: savingsRate >= 20 ? C.primary : C.warn },
          ].map(({ label, val, icon, color }) => (
            <Card key={label} className="card-hover" style={{ padding: "14px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Ic n={icon} size={14} color={color} />
                <Label>{label}</Label>
              </div>
              <StatVal color={color} size={21}>{val}</StatVal>
            </Card>
          ))}
        </div>

        {/* Spend breakdown */}
        <Card style={{ marginBottom: 14 }}>
          <Label style={{ marginBottom: 18, display: "block" }}>Spend Breakdown</Label>
          {breakdown.map(({ label, val, color, icon, pct }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Ic n={icon} size={13} color={color} />
                  <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <StatVal size={13}>{fmtINR(val, true)}</StatVal>
                  <span style={{ fontSize: 10, color, fontWeight: 600, minWidth: 32, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                </div>
              </div>
              <Bar pct={pct} color={color} h={2} />
            </div>
          ))}
          <Divider />
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: C.sub }}>Total spend</span>
            <StatVal color={savings < 0 ? C.error : C.text} size={15}>{fmtINR(actualTotal, true)}</StatVal>
          </div>
        </Card>

        {/* Signals */}
        {nudges.length > 0 && (
          <Card>
            <Label style={{ marginBottom: 14, display: "block" }}>Spending Signals</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {nudges.map((nd, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Ic n={nd.icon} size={15} color={C.sub} style={{ marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{nd.text}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MIRROR SCREEN
// ════════════════════════════════════════════════════════════════
function MirrorScreen({ store, stats }) {
  const { state, setGoal } = store;
  const { income, savings, projectedEnd, burnRate, daysLeft, subMonthly, plannedTotal, drift } = stats;

  const goal        = N(state.meta.goal);
  const currentSave = Math.max(0, savings);
  const gap         = goal > 0 ? goal - currentSave : null;
  const goalPct     = goal > 0 ? Math.min(100, (currentSave / goal) * 100) : 0;
  const onGoal      = gap !== null && gap <= 0;
  const diffVsGoal  = goal > 0 ? currentSave - goal : null;

  const quickWins = useMemo(() => {
    if (income === 0) return [];
    const wins = [];
    const dining   = N(state.lifestyle.dining.manual);
    const shopping = N(state.lifestyle.shopping.manual);
    const ent      = N(state.lifestyle.entertainment.manual);
    if (dining > 0 && dining / income > 0.10) wins.push({ icon: "restaurant", action: "Reduce dining 15%",    gain: dining * 0.15 });
    if (subMonthly > 500 && state.subscriptions.length >= 2) wins.push({ icon: "subscriptions", action: "Cut 1 subscription", gain: subMonthly / state.subscriptions.length });
    if (shopping > 0 && shopping / income > 0.08) wins.push({ icon: "shopping_bag", action: "Reduce shopping 20%", gain: shopping * 0.20 });
    if (ent > 0 && ent / income > 0.06) wins.push({ icon: "movie", action: "Trim entertainment 25%", gain: ent * 0.25 });
    return wins.slice(0, 3);
  }, [income, state.lifestyle, subMonthly, state.subscriptions.length]);

  const totalWinGain = quickWins.reduce((t, w) => t + w.gain, 0);

  const invest    = currentSave * 0.5;
  const r         = 0.12 / 12;
  const corpus    = invest > 0 ? invest * ((Math.pow(1 + r, 300) - 1) / r) * (1 + r) : 0;
  const SCENARIOS = [
    { label: "Static",   mult: 0.28, color: C.error,   icon: "trending_flat"  },
    { label: "Adaptive", mult: 0.65, color: C.blue,    icon: "trending_up"    },
    { label: "Mastery",  mult: 1.00, color: C.primary, icon: "auto_awesome", featured: true },
  ];

  const projLabel    = projectedEnd >= 0 ? `${fmtINR(projectedEnd, true)} at month-end` : `${fmtINR(Math.abs(projectedEnd), true)} short at month-end`;
  const projSubLabel = goal > 0
    ? (diffVsGoal !== null && diffVsGoal >= 0 ? `${fmtINR(diffVsGoal, true)} more than your goal.` : `${fmtINR(Math.abs(diffVsGoal ?? 0), true)} less than your ${fmtINR(goal, true)} goal.`)
    : `Burning ${fmtINR(burnRate, true)}/day · ${daysLeft}d left`;

  if (income === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80dvh", gap: 16, color: C.muted, position: "relative", zIndex: 1, padding: "0 32px", textAlign: "center" }}>
      <Ic n="blur_on" size={48} color={C.primary} style={{ opacity: .18 }} />
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>Enter your income and expenses to see your mirror.</p>
    </div>
  );

  return (
    <div style={{ padding: "64px 16px 120px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>
      <div className="fade-up">
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: "-.02em", margin: "22px 0 5px" }}>The Mirror</h2>
        <p style={{ fontSize: 13, color: C.sub, marginBottom: 22 }}>No sugarcoating. Just the truth.</p>

        {/* Projection hero */}
        <Card accent={projectedEnd >= 0 ? C.primary : C.error} style={{ textAlign: "center", marginBottom: 14, padding: "26px 22px" }}>
          <Label style={{ marginBottom: 12, display: "block" }}>If nothing changes…</Label>
          <StatVal color={projectedEnd >= 0 ? C.primary : C.error} size={52}>{fmtINR(projectedEnd, true)}</StatVal>
          <p style = {{ fontSize: 11, color: C.muted, marginTop: 6}}> This is not a forecast. This is your current trajectory. </p> 
            <p style={{ fontSize: 13, color: projectedEnd >= 0 ? C.text : C.error, marginTop: 10, fontWeight: 600 }}>{projLabel}</p>
          <p style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{projSubLabel}</p>
          {plannedTotal > 0 && Math.abs(drift) > 200 && (
            <p style={{ fontSize: 11, color: drift > 0 ? C.warn : C.primary, marginTop: 8, fontWeight: 600 }}>
              {drift > 0 ? `+${fmtINR(drift, true)} above plan` : `${fmtINR(Math.abs(drift), true)} under plan`}
            </p>
          )}
        </Card>

        {/* Savings goal */}
        <Card style={{ marginBottom: 14 }}>
          <Label style={{ marginBottom: 14, display: "block" }}>Savings Goal</Label>
          <Field label="Target Monthly Savings" hint="Monthly amount" onClear={goal > 0 ? () => setGoal(0) : undefined}>
            <NumInput value={state.meta.goal} onChange={setGoal} placeholder="0" style={{ fontSize: 17 }} />
          </Field>
          {goal > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.sub }}>Progress</span>
                <StatVal color={onGoal ? C.primary : C.error} size={16}>
                  {gap !== null ? (gap > 0 ? `${fmtINR(gap, true)} short` : `${fmtINR(Math.abs(gap), true)} ahead`) : "—"}
                </StatVal>
              </div>
              <Bar pct={goalPct} color={onGoal ? C.primary : C.error} h={5} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: C.muted }}>Saving: {fmtINR(currentSave, true)}</span>
                <span style={{ fontSize: 10, color: C.muted }}>Goal: {fmtINR(goal, true)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Quick wins */}
        {quickWins.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 14 }}>Fix it in {quickWins.length} move{quickWins.length > 1 ? "s" : ""}:</p>
              {totalWinGain > 0 && <StatVal color={C.primary} size={13}>+{fmtINR(totalWinGain, true)}/mo</StatVal>}
            </div>
            <p style={{ fontSize: 11, color: C.sub, marginBottom: 14 }}>Small cuts. Real money back.</p>
            {quickWins.map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${C.primary}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ic n={w.icon} size={16} color={C.primary} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{w.action}</p>
                  <p style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>Save {fmtINR(w.gain, true)}/mo</p>
                </div>
                <StatVal color={C.primary} size={13}>+{fmtINR(w.gain, true)}</StatVal>
              </div>
            ))}
          </Card>
        )}

        {/* 25-yr SIP */}
        {corpus > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Label style={{ marginBottom: 10, display: "block" }}>25-Year Projection · 50% of surplus @ 12% CAGR</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SCENARIOS.map(s => (
                <Card key={s.label} accent={s.featured ? C.primary : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 17px" }} className="card-hover">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Ic n={s.icon} size={17} color={s.color} />
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13, color: s.color }}>{s.label}</span>
                  </div>
                  <StatVal color={s.color} size={21}>{fmtINR(corpus * s.mult, true)}</StatVal>
                </Card>
              ))}
            </div>
            <p style={{ fontSize: 9, color: C.muted, opacity: .35, marginTop: 8, textAlign: "center" }}>Based on {fmtINR(invest, true)}/mo. Illustrative — not financial advice.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════
export default function App() {
  const store = useStore();
  const [screen,       setScreen]       = useState("home");
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [footerModal,  setFooterModal]  = useState(null); // "privacy"|"terms"|"support"

  const stats = useMemo(() => calcEngine(store.state), [store.state]);

  const handleNav      = useCallback((s) => setScreen(s), []);
  const openQuickLog   = useCallback(() => setShowQuickLog(true),  []);
  const closeQuickLog  = useCallback(() => setShowQuickLog(false), []);
  const handleQuickAdd = useCallback((cat, entry) => store.addLifeLog(cat, entry), [store]);
  const handleReset    = useCallback(() => {
    if (window.confirm("Reset all data? Cannot be undone.")) { store.reset(); setScreen("home"); }
  }, [store]);

  return (
    <>
      <style>{CSS}</style>
      <Blobs />

      {/* Top bar */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 54, background: "rgba(5,5,7,.92)", backdropFilter: "blur(18px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Ic n="blur_on" size={21} color={C.primary} />
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 16, color: C.primary, letterSpacing: "-.02em" }}>MoneyMirror</span>
        </div>
        {stats.income > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: stats.statusColor, transition: "background .3s" }} />
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: stats.statusColor }}>{stats.status}</span>
          </div>
        )}
        <button onClick={handleReset} style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: C.error, background: `${C.error}10`, border: `1px solid ${C.error}22`, borderRadius: 7, padding: "5px 11px", transition: "background .15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = `${C.error}20`)}
          onMouseLeave={e => (e.currentTarget.style.background = `${C.error}10`)}
        >Reset</button>
      </header>

      {/* Screen content */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh", paddingBottom: 100
       }}>
        {screen === "home"     && <HomeScreen     store={store} stats={stats} onNav={handleNav} />}
        {screen === "insights" && <InsightsScreen state={store.state} stats={stats} />}
        {screen === "mirror"   && <MirrorScreen   store={store} stats={stats} />}
        {/* Footer inside each screen scroll area */}
        <div style={{ position: "relative", zIndex: 1, paddingBottom: 8 }}>
          <Footer
            onPrivacy={() => setFooterModal("privacy")}
            onTerms={()   => setFooterModal("terms")}
            onSupport={()  => setFooterModal("support")}
          />
        </div>
      </div>

      {/* FABs */}
      <QuickLogFAB onClick={openQuickLog} />
      <WAButton />

      {/* Quick log modal */}
      {showQuickLog && <QuickLogModal onAdd={handleQuickAdd} onClose={closeQuickLog} />}

      {/* Footer modals */}
      {footerModal === "privacy" && <PrivacyModal onClose={() => setFooterModal(null)} />}
      {footerModal === "terms"   && <TermsModal   onClose={() => setFooterModal(null)} />}
      {footerModal === "support" && <SupportModal onClose={() => setFooterModal(null)} />}

      <Nav active={screen} onNav={handleNav} status={stats.status} />
    </>
  );
}