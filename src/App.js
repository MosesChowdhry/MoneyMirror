import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ─── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "#090909", s0: "#0f0f0f", s1: "#141414", s2: "#1a1a1a",
  s3: "#222222", s4: "#2a2a2a",
  primary: "#3fff8b", onPrimary: "#001f0c",
  blue: "#7ae6ff", purple: "#b78fff", orange: "#ff9d6c",
  error: "#ff5f5b", warn: "#f5a623",
  text: "#f0f0f0", muted: "#777777",
  border: "rgba(255,255,255,0.06)",
};

// ─── Global CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,300,0,0&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{background:${C.bg};color:${C.text};font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased;overscroll-behavior:none;}
  input{font-family:'Space Grotesk',sans-serif;color:${C.text};background:transparent;border:none;outline:none;}
  input::placeholder{color:${C.muted};opacity:.4;}
  button{font-family:'Manrope',sans-serif;cursor:pointer;border:none;background:none;}
  ::-webkit-scrollbar{display:none;}
  .ms{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:20px;line-height:1;
      display:inline-block;white-space:nowrap;font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20;user-select:none;}

  @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes scaleIn{from{transform:scale(.95);opacity:0;}to{transform:scale(1);opacity:1;}}
  @keyframes barGrow{from{width:0!important;}to{width:var(--w);}}
  @keyframes glow{0%,100%{text-shadow:0 0 16px currentColor;}50%{text-shadow:0 0 44px currentColor;}}
  @keyframes slideD{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
  @keyframes impactIn{0%{opacity:0;transform:translateY(4px);}15%{opacity:1;transform:translateY(0);}85%{opacity:1;}100%{opacity:0;transform:translateY(-4px);}}
  @keyframes modalIn{from{opacity:0;transform:scale(.93) translateY(12px);}to{opacity:1;transform:scale(1) translateY(0);}}
  @keyframes overlayIn{from{opacity:0;}to{opacity:1;}}

  .fade-up{animation:fadeUp .32s cubic-bezier(.16,1,.3,1) both;}
  .scale-in{animation:scaleIn .2s cubic-bezier(.16,1,.3,1) both;}
  .bar{animation:barGrow .7s cubic-bezier(.16,1,.3,1) both;}
  .glow{animation:glow 3s ease-in-out infinite;}
  .slide-d{animation:slideD .2s cubic-bezier(.16,1,.3,1) both;}
  .impact-anim{animation:impactIn 3s ease forwards;}
  .modal-in{animation:modalIn .25s cubic-bezier(.16,1,.3,1) both;}
  .overlay-in{animation:overlayIn .2s ease both;}

  .sb{max-height:0;overflow:hidden;transition:max-height .32s cubic-bezier(.16,1,.3,1),opacity .22s ease;opacity:0;}
  .sb.open{max-height:2600px;opacity:1;}
  .prog{transition:width .55s cubic-bezier(.16,1,.3,1);}
  .field:focus-within{border-color:rgba(63,255,139,.28)!important;}
  .num-val{transition:color .25s ease;}
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

const N = (v) => Number(v) || 0;
const mkId = () => `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

// ─── State shape (cloud-ready) ───────────────────────────────────────────────
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
});

// ─── Data layer — isolated for future backend swap ───────────────────────────
const DB_KEY = "mm_v6";

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const base   = initialState();
    return {
      ...base, ...parsed,
      fixed:     { ...base.fixed,     ...parsed.fixed     },
      lifestyle: { ...base.lifestyle, ...parsed.lifestyle  },
      meta:      { ...base.meta,      ...parsed.meta       },
    };
  } catch { return null; }
}

function saveData(state) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(state)); } catch {}
}

function clearData() {
  try { localStorage.removeItem(DB_KEY); } catch {}
}

// ─── Calc engine (fixed burn rate + projection) ──────────────────────────────
function calcEngine(s) {
  const income = N(s.income.salary) + N(s.income.other);

  const rent      = N(s.fixed.rent);
  const utilities = s.fixed.utilities.reduce((t, u) => t + N(u.amount), 0);
  const emis      = s.fixed.emis.reduce((t, e) => t + N(e.amount), 0);
  const fixedPlan = rent + utilities + emis;

  const cats = ["dining", "transport", "shopping", "entertainment"];
  const lifePlan   = {};
  const lifeActual = {};
  for (const c of cats) {
    lifePlan[c]   = N(s.lifestyle[c].manual);
    const logSum  = s.lifestyle[c].logs.reduce((t, l) => t + N(l.amount), 0);
    lifeActual[c] = s.lifestyle[c].logs.length > 0 ? logSum : N(s.lifestyle[c].manual);
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
  const remaining    = income - actualTotal;

  const now         = new Date();
  const daysPassed  = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft    = daysInMonth - daysPassed;

  // Fixed burn: fixed costs + subs are known monthly amounts, spread evenly
  // Variable burn: only lifestyle is pace-tracked (day-by-day)
  const fixedDaily    = (fixedPlan + subMonthly) / daysInMonth;
  const variableSpent = lifestyleActualTotal;
  const variableDaily = daysPassed > 0 ? variableSpent / daysPassed : 0;
  const burnRate      = fixedDaily + variableDaily;

  const projectedTotal = burnRate * daysInMonth;
  const projectedEnd   = income - projectedTotal;
  const drift          = projectedTotal - plannedTotal;

  const committedPct = income > 0 ? Math.min(100, (actualTotal / income) * 100) : 0;
  const savingsRate  = income > 0 ? (remaining / income) * 100 : 0;

  // Safe daily spend — never negative, never Infinity
  const safeDaily = daysLeft > 0 ? Math.max(0, remaining / daysLeft) : 0;

  // Today's actual log spend
  const todayStr = now.toISOString().slice(0, 10);
  let todaySpent = 0;
  for (const c of cats) {
    for (const l of s.lifestyle[c].logs) {
      if (l.date === todayStr) todaySpent += N(l.amount);
    }
  }

  const status =
    remaining < 0      ? "BLEEDING" :
    savingsRate < 10   ? "TIGHT"    : "STABLE";
  const statusColor = status === "BLEEDING" ? C.error : status === "TIGHT" ? C.warn : C.primary;

  // Clarity score (stricter)
  let clarity = 0;
  if (income > 0) clarity += 25;
  const hasFixedMeaning = rent > 0 || (s.fixed.utilities.length + s.fixed.emis.length) >= 2;
  if (hasFixedMeaning) clarity += 25;
  const filledCats = cats.filter(c => N(s.lifestyle[c].manual) > 0 || s.lifestyle[c].logs.length > 0).length;
  if (filledCats >= 2) clarity += 25;
  if (s.subscriptions.length > 0) clarity += 15;
  const hasLogs = cats.some(c => s.lifestyle[c].logs.length > 0);
  if (hasLogs) clarity += 10;
  clarity = Math.min(100, clarity);

  const steps = {
    income:        income > 0,
    fixed:         hasFixedMeaning,
    lifestyle:     filledCats >= 2,
    subscriptions: s.subscriptions.length > 0,
  };
  const stepsComplete = Object.values(steps).filter(Boolean).length;

  return {
    income, rent, utilities, emis, fixedPlan,
    lifePlan, lifeActual, lifestylePlanTotal, lifestyleActualTotal,
    subMonthly, plannedTotal, actualTotal, remaining,
    daysPassed, daysInMonth, daysLeft,
    fixedDaily, variableDaily, burnRate,
    projectedTotal, projectedEnd, drift,
    committedPct, savingsRate,
    safeDaily, todaySpent,
    status, statusColor,
    clarity, steps, stepsComplete, cats,
  };
}

// ─── Feedback engine ──────────────────────────────────────────────────────────
function getFeedback(stats) {
  const { income, fixedPlan, lifestyleActualTotal, savingsRate, remaining, drift } = stats;
  if (income === 0) return null;
  if (remaining < 0) return { text: "You're slightly above your plan. Pulling back in one area can fix this.", color: C.error, icon: "warning" };
  if (fixedPlan / income > 0.5) return { text: "Fixed costs are eating most of your income. Flexibility is limited.", color: C.warn, icon: "lock" };
  if (lifestyleActualTotal / income > 0.3) return { text: "Lifestyle spend is high — this is where most people can optimise.", color: C.warn, icon: "tune" };
  if (savingsRate < 10) return { text: "Savings rate is below 10%. There's real room to move here.", color: C.warn, icon: "savings" };
  if (drift > income * 0.05) return { text: "Spending is drifting above plan. Worth catching now, not later.", color: C.warn, icon: "trending_up" };
  if (savingsRate >= 30) return { text: "You're saving well. Most people never get here — keep the discipline.", color: C.primary, icon: "trending_up" };
  return { text: "You're on track. Small optimisations now compound over months.", color: C.blue, icon: "check_circle" };
}

function getStatusLabel(savingsRate) {
  if (savingsRate >= 30) return { emoji: "🔥", label: "Strong",    color: C.primary };
  if (savingsRate >= 10) return { emoji: "👍", label: "Decent",    color: C.blue    };
  if (savingsRate >=  0) return { emoji: "⚠️", label: "Tight",     color: C.warn    };
  return                        { emoji: "🚨", label: "Over plan", color: C.error   };
}

function getMiniInsights(state, stats) {
  const { income, lifestylePlanTotal, lifestyleActualTotal, fixedPlan, subMonthly, savingsRate, drift } = stats;
  const ins = [];
  if (income === 0) return ins;
  const lifeUsedPct = lifestylePlanTotal > 0 ? (lifestyleActualTotal / lifestylePlanTotal) * 100 : 0;
  if (lifeUsedPct > 0) ins.push(`You've used ${lifeUsedPct.toFixed(0)}% of your lifestyle plan`);
  const fixedPct = income > 0 ? (fixedPlan / income) * 100 : 0;
  if (fixedPct > 0) ins.push(`Fixed costs are ${fixedPct.toFixed(0)}% of income`);
  if (subMonthly > 0) ins.push(`Subscriptions cost ${fmtINR(subMonthly, true)}/month`);
  if (drift > 0) ins.push(`At this pace, you'll exceed your plan by ${fmtINR(drift, true)}`);
  else if (drift < -200) ins.push(`You're ${fmtINR(Math.abs(drift), true)} under your plan — good control`);
  return ins.slice(0, 2);
}

// ─── Store (shallow updates, no deep clone) ───────────────────────────────────
function useStore() {
  const [state, _set] = useState(() => loadData() || initialState());

  const set = useCallback((fn) => {
    _set(prev => { const next = fn(prev); saveData(next); return next; });
  }, []);

  const setIncomeSalary = useCallback((v) => set(p => ({ ...p, income: { ...p.income, salary: v === "" ? 0 : Number(v) } })), [set]);
  const setIncomeOther  = useCallback((v) => set(p => ({ ...p, income: { ...p.income, other:  v === "" ? 0 : Number(v) } })), [set]);
  const setRent         = useCallback((v) => set(p => ({ ...p, fixed: { ...p.fixed, rent: v === "" ? 0 : Number(v) } })), [set]);

  const addUtil  = useCallback(() => set(p => ({ ...p, fixed: { ...p.fixed, utilities: [...p.fixed.utilities, { id: mkId(), name: "", amount: 0 }] } })), [set]);
  const delUtil  = useCallback((id) => set(p => ({ ...p, fixed: { ...p.fixed, utilities: p.fixed.utilities.filter(u => u.id !== id) } })), [set]);
  const setUtil  = useCallback((id, k, v) => set(p => ({ ...p, fixed: { ...p.fixed, utilities: p.fixed.utilities.map(u => u.id === id ? { ...u, [k]: k === "amount" ? (v === "" ? 0 : Number(v)) : v } : u) } })), [set]);

  const addEmi   = useCallback(() => set(p => ({ ...p, fixed: { ...p.fixed, emis: [...p.fixed.emis, { id: mkId(), name: "", amount: 0 }] } })), [set]);
  const delEmi   = useCallback((id) => set(p => ({ ...p, fixed: { ...p.fixed, emis: p.fixed.emis.filter(e => e.id !== id) } })), [set]);
  const setEmi   = useCallback((id, k, v) => set(p => ({ ...p, fixed: { ...p.fixed, emis: p.fixed.emis.map(e => e.id === id ? { ...e, [k]: k === "amount" ? (v === "" ? 0 : Number(v)) : v } : e) } })), [set]);

  const setLifeManual = useCallback((cat, v) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], manual: v === "" ? 0 : Number(v) } } })), [set]);
  const addLifeLog    = useCallback((cat, entry) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], logs: [...p.lifestyle[cat].logs, { id: mkId(), ...entry }] } } })), [set]);
  const delLifeLog    = useCallback((cat, id) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], logs: p.lifestyle[cat].logs.filter(l => l.id !== id) } } })), [set]);

  const addSub   = useCallback(() => set(p => ({ ...p, subscriptions: [...p.subscriptions, { id: mkId(), name: "", amount: 0, cycle: "monthly" }] })), [set]);
  const delSub   = useCallback((id) => set(p => ({ ...p, subscriptions: p.subscriptions.filter(s => s.id !== id) })), [set]);
  const setSub   = useCallback((id, k, v) => set(p => ({ ...p, subscriptions: p.subscriptions.map(s => s.id === id ? { ...s, [k]: k === "amount" ? (v === "" ? 0 : Number(v)) : v } : s) })), [set]);

  const setGoal  = useCallback((v) => set(p => ({ ...p, meta: { ...p.meta, goal: v === "" ? 0 : Number(v) } })), [set]);
  const setLastOpenedDate = useCallback((d) => set(p => ({ ...p, meta: { ...p.meta, lastOpenedDate: d } })), [set]);
  const reset    = useCallback(() => { clearData(); _set(initialState()); }, []);

  return {
    state, setIncomeSalary, setIncomeOther, setRent,
    addUtil, delUtil, setUtil, addEmi, delEmi, setEmi,
    setLifeManual, addLifeLog, delLifeLog,
    addSub, delSub, setSub,
    setGoal, setLastOpenedDate, reset,
  };
}

// ─── Primitive UI atoms ──────────────────────────────────────────────────────
const Ic = ({ n: name, size = 20, color, style = {} }) => (
  <span className="ms" style={{ fontSize: size, color: color || "inherit", flexShrink: 0, lineHeight: 1, ...style }}>{name}</span>
);

function Bar({ pct, color = C.primary, h = 3, animated = true }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ height: h, background: "rgba(255,255,255,0.05)", borderRadius: h }}>
      <div className={animated ? "bar" : "prog"} style={{ height: "100%", width: `${w}%`, background: color, borderRadius: h, boxShadow: `0 0 10px ${color}44`, "--w": `${w}%` }} />
    </div>
  );
}

const Divider = () => <div style={{ height: 1, background: C.border, margin: "2px 0" }} />;

// All input components at module level — NEVER inside render (prevents focus loss)
function NumInput({ value, onChange, placeholder = "0", style = {} }) {
  const handleChange = useCallback((e) => {
    let v = e.target.value.replace(/[^0-9.]/g, "");
    const parts = v.split(".");
    if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
    onChange(v === "" ? 0 : v);
  }, [onChange]);
  const display = (value === 0 || value === "") ? "" : String(value);
  return (
    <input type="text" inputMode="decimal" value={display} onChange={handleChange}
      placeholder={placeholder} style={{ fontWeight: 700, fontSize: 16, width: "100%", ...style }} />
  );
}

function StrInput({ value, onChange, placeholder = "", style = {} }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 600, fontSize: 14, color: C.text, width: "100%", ...style }} />
  );
}

function Field({ label, hint, onClear, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted }}>{label}</span>}
      <div className="field" style={{ display: "flex", alignItems: "center", gap: 8, background: C.s4, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", transition: "border-color .2s" }}>
        <span style={{ color: C.muted, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>₹</span>
        {children}
        {onClear && (
          <button onClick={onClear} style={{ flexShrink: 0, color: C.muted, opacity: .4, padding: "0 2px", lineHeight: 1, transition: "opacity .15s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = ".4"}
          ><Ic n="close" size={15} /></button>
        )}
      </div>
      {hint && <span style={{ fontSize: 10, color: C.muted, opacity: .5 }}>{hint}</span>}
    </div>
  );
}

function GhostBtn({ children, onClick, color = C.muted }) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, color, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, background: `${color}12`, border: `1px solid ${color}20`, transition: "background .15s" }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}22`}
      onMouseLeave={e => e.currentTarget.style.background = `${color}12`}
    >{children}</button>
  );
}

// ─── Log impact flash ─────────────────────────────────────────────────────────
function ImpactFlash({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="impact-anim" style={{ marginTop: 10, padding: "10px 14px", background: `${C.primary}14`, border: `1px solid ${C.primary}35`, borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
      <Ic n="auto_awesome" size={16} color={C.primary} />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.primary, lineHeight: 1.4 }}>{msg}</span>
    </div>
  );
}

// ─── Collapsible section ─────────────────────────────────────────────────────
function Section({ title, icon, summary, hint, defaultOpen = false, feedbackMsg, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", padding: "15px 18px", gap: 12, background: "none", cursor: "pointer" }}>
        <Ic n={icon} size={18} color={open ? C.primary : C.muted} style={{ transition: "color .2s" }} />
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, flex: 1, textAlign: "left" }}>{title}</span>
        {summary !== undefined && <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 16, color: summary > 0 ? C.text : C.muted }}>{fmtINR(summary, true)}</span>}
        <Ic n={open ? "expand_less" : "expand_more"} size={18} color={C.muted} />
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
          <span style={{ fontSize: 11, color: C.muted, opacity: .4 }}>{hint}</span>
        </div>
      )}
    </div>
  );
}

// ─── Array rows — module level (no focus loss) ───────────────────────────────
const UtilRow = ({ item, onName, onAmt, onDel }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ flex: 1, background: C.s4, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
      <StrInput value={item.name} onChange={onName} placeholder="e.g. Electricity" />
    </div>
    <div style={{ width: 110, background: C.s4, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: C.muted, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14 }}>₹</span>
      <NumInput value={item.amount} onChange={onAmt} placeholder="0" style={{ fontSize: 14 }} />
    </div>
    <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: `${C.error}12`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Ic n="close" size={16} color={C.error} />
    </button>
  </div>
);

const EmiRow = ({ item, onName, onAmt, onDel }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ flex: 1, background: C.s4, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
      <StrInput value={item.name} onChange={onName} placeholder="Loan name" />
    </div>
    <div style={{ width: 110, background: C.s4, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: C.muted, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14 }}>₹</span>
      <NumInput value={item.amount} onChange={onAmt} placeholder="0" style={{ fontSize: 14 }} />
    </div>
    <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: `${C.error}12`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Ic n="close" size={16} color={C.error} />
    </button>
  </div>
);

const CYCLES = ["monthly", "quarterly", "half-yearly", "annual"];
const SubRow = ({ sub, onField, onDel }) => (
  <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
      <div style={{ flex: 1, background: C.s4, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
        <StrInput value={sub.name} onChange={v => onField("name", v)} placeholder="Netflix, Spotify…" />
      </div>
      <div style={{ width: 110, background: C.s4, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: C.muted, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14 }}>₹</span>
        <NumInput value={sub.amount} onChange={v => onField("amount", v)} placeholder="0" style={{ fontSize: 14 }} />
      </div>
      <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: `${C.error}12`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ic n="close" size={16} color={C.error} />
      </button>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {CYCLES.map(c => (
        <button key={c} onClick={() => onField("cycle", c)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, letterSpacing: ".05em", background: sub.cycle === c ? `${C.primary}18` : C.s4, color: sub.cycle === c ? C.primary : C.muted, border: `1px solid ${sub.cycle === c ? C.primary + "50" : C.border}`, transition: "all .15s" }}>
          {c}
        </button>
      ))}
      {sub.cycle !== "monthly" && N(sub.amount) > 0 && (
        <span style={{ fontSize: 10, color: C.muted, marginLeft: 2 }}>
          ≈ {fmtINR(sub.cycle === "quarterly" ? N(sub.amount) / 3 : sub.cycle === "half-yearly" ? N(sub.amount) / 6 : N(sub.amount) / 12, true)}/mo
        </span>
      )}
    </div>
  </div>
);

const LogRow = ({ log, onDel }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
    <span style={{ flex: 1, fontSize: 12, color: C.muted }}>{log.note || "Entry"}</span>
    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14 }}>{fmtINR(N(log.amount))}</span>
    <button onClick={onDel} style={{ color: C.muted, opacity: .4, padding: 4, lineHeight: 1, transition: "opacity .15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = 1}
      onMouseLeave={e => e.currentTarget.style.opacity = ".4"}
    ><Ic n="close" size={14} /></button>
  </div>
);

// ─── Lifestyle category — module level ───────────────────────────────────────
function LifeCat({ catKey, label, icon, color, data, manual, onManual, onAddLog, onDelLog, income, daysPassed, daysInMonth }) {
  const [logNote, setLogNote] = useState("");
  const [logAmt,  setLogAmt]  = useState(0);
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
      setImpactMsg(`This adds ~${fmtINR(projAdd, true)} to your monthly spend`);
    }
    setLogNote("");
    setLogAmt(0);
  }, [logNote, logAmt, onAddLog, daysPassed, daysInMonth]);

  return (
    <div style={{ background: C.s4, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ic n={icon} size={17} color={color} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{label}</span>
        {data.logs.length > 0 && (
          <span style={{ fontSize: 9, color: C.muted, background: C.s2, padding: "2px 8px", borderRadius: 20 }}>auto · {data.logs.length} logs</span>
        )}
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, color: displayTotal > 0 ? C.text : C.muted }}>{fmtINR(displayTotal, true)}</span>
      </div>

      <Field label="Monthly budget or estimate" hint={data.logs.length > 0 ? `Auto-calculated from ${data.logs.length} entries` : "Monthly amount · overridden if logs exist"} onClear={N(manual) > 0 ? clearManual : undefined}>
        <NumInput value={manual} onChange={onManual} placeholder="0" style={{ fontSize: 15, opacity: data.logs.length > 0 ? .28 : 1 }} />
      </Field>
      {data.logs.length > 0 && (
        <p style={{ fontSize: 10, color: C.warn, opacity: .75, marginTop: 3 }}>Manual value ignored while logs exist</p>
      )}

      {displayTotal > 0 && (
        <div style={{ marginTop: 10 }}>
          <Bar pct={pct} color={barColor} h={2} />
          <span style={{ fontSize: 10, color: C.muted, marginTop: 4, display: "block" }}>{pct.toFixed(0)}% of income</span>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowLogs(o => !o)} style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
          <Ic n={showLogs ? "expand_less" : "receipt_long"} size={14} />
          {showLogs ? "Hide" : `Log entries (${data.logs.length})`}
        </button>
        <div className={`sb${showLogs ? " open" : ""}`}>
          <div style={{ paddingTop: 10 }}>
            {data.logs.map(l => <LogRow key={l.id} log={l} onDel={() => onDelLog(l.id)} />)}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <div style={{ flex: 1, background: C.s2, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                <input type="text" value={logNote} onChange={handleLogNote} placeholder="Note (optional)"
                  style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 600, fontSize: 12, color: C.text, background: "transparent", border: "none", outline: "none", width: "100%" }} />
              </div>
              <div style={{ width: 90, background: C.s2, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: C.muted, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13 }}>₹</span>
                <NumInput value={logAmt} onChange={handleLogAmt} placeholder="0" style={{ fontSize: 13 }} />
              </div>
              <button onClick={submitLog} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic n="add" size={18} color={color} />
              </button>
            </div>
            {impactMsg && <ImpactFlash key={impactMsg + Date.now()} msg={impactMsg} onDone={() => setImpactMsg(null)} />}
            <span style={{ fontSize: 9, color: C.muted, opacity: .4, marginTop: 5, display: "block" }}>Per entry amount · each entry adds to total</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Log Modal ──────────────────────────────────────────────────────────
const QUICK_CATS = [
  { key: "dining",        label: "Dining",        icon: "restaurant",   color: C.warn    },
  { key: "transport",     label: "Transport",     icon: "commute",      color: C.blue    },
  { key: "shopping",      label: "Shopping",      icon: "shopping_bag", color: C.purple  },
  { key: "entertainment", label: "Entertainment", icon: "movie",        color: C.orange  },
];

function QuickLogModal({ onAdd, onClose }) {
  const [amt,  setAmt]  = useState(0);
  const [note, setNote] = useState("");
  const [cat,  setCat]  = useState("dining");
  const [key,  setKey]  = useState(0);

  const handleAmt = useCallback((v) => setAmt(v), []);
  const handleNote = useCallback((e) => setNote(e.target.value), []);

  const submit = useCallback(() => {
    const a = N(amt);
    if (!a) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    onAdd(cat, { note: note.trim(), amount: a, date: todayStr });
    setAmt(0); setNote(""); setKey(k => k + 1);
    onClose();
  }, [amt, note, cat, onAdd, onClose]);

  return (
    <div className="overlay-in" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 24px" }}>
      <div className="modal-in" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.s1, borderRadius: 20, padding: "24px 20px", border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 17 }}>Quick Log</span>
          <button onClick={onClose}><Ic n="close" size={22} color={C.muted} /></button>
        </div>

        {/* Category selector */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
          {QUICK_CATS.map(({ key: k, label, icon, color }) => (
            <button key={k} onClick={() => setCat(k)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px", borderRadius: 12, background: cat === k ? `${color}18` : C.s4, border: `1px solid ${cat === k ? color + "40" : C.border}`, transition: "all .15s" }}>
              <Ic n={icon} size={20} color={cat === k ? color : C.muted} />
              <span style={{ fontSize: 9, fontWeight: 700, color: cat === k ? color : C.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 12 }}>
          <Field label="Amount" hint="Per entry amount">
            <NumInput key={key} value={amt} onChange={handleAmt} placeholder="0" style={{ fontSize: 20 }} />
          </Field>
        </div>

        {/* Note */}
        <div style={{ background: C.s4, borderRadius: 10, border: `1px solid ${C.border}`, padding: "11px 14px", marginBottom: 20 }}>
          <input type="text" value={note} onChange={handleNote} placeholder="Note (optional)"
            style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 600, fontSize: 14, color: C.text, background: "transparent", border: "none", outline: "none", width: "100%" }} />
        </div>

        <button onClick={submit} style={{ width: "100%", height: 52, background: C.primary, color: C.onPrimary, borderRadius: 12, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: ".06em", boxShadow: `0 0 24px ${C.primary}35`, transition: "opacity .15s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = ".88"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >Add Entry</button>
      </div>
    </div>
  );
}

// ─── Clarity Score Header ─────────────────────────────────────────────────────
function ClarityHeader({ stats, onNav }) {
  const { clarity, steps, income, stepsComplete } = stats;
  const full = clarity >= 100;

  if (income === 0) return (
    <div className="scale-in" style={{ background: `${C.primary}0d`, border: `1px solid ${C.primary}20`, borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
      <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: "-.02em", marginBottom: 4 }}>Map your money in 30 seconds</p>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Start with your monthly income ↓</p>
      <Bar pct={0} color={C.primary} h={4} animated={false} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: C.muted }}>Financial Clarity Score</span>
        <span style={{ fontSize: 10, color: C.primary, fontWeight: 700 }}>0%</span>
      </div>
    </div>
  );

  if (full) return (
    <div className="scale-in" style={{ background: `${C.primary}0d`, border: `1px solid ${C.primary}22`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <div>
        <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, color: C.primary, marginBottom: 2 }}>Full clarity achieved 🔥</p>
        <p style={{ fontSize: 12, color: C.muted }}>Financial Clarity Score: 100%</p>
      </div>
      <button onClick={() => onNav("insights")} style={{ padding: "9px 18px", background: C.primary, color: C.onPrimary, borderRadius: 9, fontWeight: 800, fontSize: 12, letterSpacing: ".06em", boxShadow: `0 0 20px ${C.primary}35` }}>
        See your reality →
      </button>
    </div>
  );

  const stepDefs = [
    { key: "income", label: "Income", pts: 25 },
    { key: "fixed",  label: "Fixed",  pts: 25 },
    { key: "lifestyle", label: "Lifestyle", pts: 25 },
    { key: "subscriptions", label: "Subs", pts: 15 },
  ];

  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Financial Clarity Score</p>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>{clarity}%</p>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 5, marginBottom: 12 }}>
        <div className="prog" style={{ height: "100%", width: `${clarity}%`, background: C.primary, borderRadius: 5, boxShadow: `0 0 12px ${C.primary}55` }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {stepDefs.map(({ key, label }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: steps[key] ? C.primary : C.s4, border: `1.5px solid ${steps[key] ? C.primary : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .25s" }}>
              {steps[key] && <Ic n="check" size={10} color={C.onPrimary} />}
            </div>
            <span style={{ fontSize: 10, color: steps[key] ? C.primary : C.muted, fontWeight: steps[key] ? 700 : 500, transition: "color .25s" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Safe spend card ──────────────────────────────────────────────────────────
function SafeSpendCard({ stats }) {
  const { income, safeDaily, todaySpent, daysLeft } = stats;
  if (income === 0 || safeDaily <= 0) return null;
  const overToday = todaySpent > safeDaily;
  const usageRatio = safeDaily > 0 ? todaySpent / safeDaily : 0;
  let status = "safe";
  if (usageRatio >1) status = "danger";
  else if (usageRatio > 0.7) status = "warning"; 
  const statusColors = {
    safe: "#22c55e", // green
    warning: "#f59e0b",// yellow
    danger: "#ef4444" // red
  };
  const color = statusColors[status];
  
  const safeSpendMessage = (() => {
  if (safeDaily <= 0) return "You've already crossed your limit";
  if (safeDaily < 300) return "Tight day. Spend carefully.";
  if (safeDaily < 800) return "You're doing okay. Stay aware.";

  return "You're in control today.";
})();

const safeSpendAction = (() => {
  if (safeDaily <= 0) return "Avoid any non-essential spending";

  if (safeDaily < 300) return "Stick to essentials only";
  if (safeDaily < 800) return "Limit impulse spends";

  return "You're safe to spend normally";
})();
  return (
    <div className="slide-d" style={{ border: `1px solid ${color}40`,position: "relative", overflow: "hidden", boxShadow:`0 0 12px ${color}30, 0 0 24px ${color}20, 0 0 48px ${color}10`, backdropFilter: "blur(12px)", 
    webkitBackdropFilter: "blur(12px)", background: `${color}0a`, borderRadius: 13, padding: "14px 18px", marginBottom: 16 }}>
      <div style={{ position: "absolute", top: -20, left: -20, width: 120, height: 120, background: color, opacity: 0.15, filter: "blur(40px)", borderRadius: "50%", zIndex: 0 }}/>
      
      <div style={{position: "relative", zIndex: 1}}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10}}> </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted, marginBottom: 4 }}>Today's safe spend</p>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 36, letterSpacing: "-1px", textShadow: `0 0 18px ${color}70`,  }}>{fmtINR(safeDaily, true)}</p>
          <p style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Based on your current pace</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Days left</p>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 24, color: C.blue }}>{daysLeft}</p>
        </div>
      </div>
      {todaySpent > 0 && (
        <p style={{ fontSize: 11, color: overToday ? C.warn : C.muted, marginBottom: 6 }}>
          {overToday
            ? `⚠ You've spent ${fmtINR(todaySpent, true)} today — ${fmtINR(todaySpent - safeDaily, true)} over`
            : `✓ Spent ${fmtINR(todaySpent, true)} today — on track`}
        </p>
      )}
      <p style={{ fontSize: 11, color: overToday ? C.warn : C.primary, fontWeight: 600 }}>
        {overToday
          ? "At this pace, you'll overshoot your month."
          : "You're controlling your month well."}
      </p>
    </div>
  );
}

// ─── Mini insight cards ───────────────────────────────────────────────────────
function MiniCards({ stats }) {
  const { income, burnRate, daysLeft, savingsRate, remaining } = stats;
  if (income === 0) return null;
  const cards = [
    { label: "Burn rate",    val: fmtINR(burnRate, true) + "/day",         color: remaining < 0 ? C.error : C.text },
    { label: "Days left",    val: `${daysLeft}d`,                           color: C.blue },
    { label: "Savings rate", val: `${Math.max(0, savingsRate).toFixed(1)}%`, color: savingsRate >= 20 ? C.primary : savingsRate >= 10 ? C.warn : C.error },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
      {cards.map(({ label, val, color }) => (
        <div key={label} style={{ background: `${C.primary}08`, border: `1px solid ${C.primary}20`, boxShadow: `0 0 12px ${C.primary}15`, borderRadius: 12, padding:"12px 14px", 
        backdropFilter: "blur(8px)", transition: "all 0.2s ease" }}
          onMouseEnter={(e) => { 
            const el = e.currentTarget; 
            el.style.transform = "translateY(-3px)"; el.style.boxShadow = `0 0 18px ${C.primary}25`; }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.transform = "translateY(0)"; el.style.boxShadow= `0 0 12px ${C.primary}15`;
            }}
          
                    
        >
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: C.muted, marginBottom: 6 }}>{label}</p>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: "-.02em", color }}>{val}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "home",     icon: "home_max",     label: "Home"     },
  { id: "insights", icon: "auto_awesome", label: "Insights" },
  { id: "mirror",   icon: "blur_on",      label: "Mirror"   },
];

function Nav({ active, onNav, status }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "rgba(9,9,9,.93)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, padding: "10px 24px 18px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
      {TABS.map(t => {
        const active_ = active === t.id;
        const dot = t.id === "home" && status === "BLEEDING";
        return (
          <button key={t.id} onClick={() => onNav(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active_ ? C.primary : C.muted, opacity: active_ ? 1 : .38, transform: active_ ? "translateY(-1px)" : "none", transition: "all .2s", position: "relative", padding: "4px 24px" }}>
            {dot && <span style={{ position: "absolute", top: 1, right: 16, width: 7, height: 7, borderRadius: "50%", background: C.error, boxShadow: `0 0 8px ${C.error}` }} />}
            <Ic n={t.icon} size={22} color="inherit" />
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const Blobs = () => (
  <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
    <div style={{ position: "absolute", top: "-15%", left: "-10%", width: "50%", height: "50%", background: `${C.primary}05`, borderRadius: "50%", filter: "blur(100px)" }} />
    <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: "40%", height: "40%", background: `${C.blue}05`, borderRadius: "50%", filter: "blur(90px)" }} />
  </div>
);

// ─── WhatsApp button ──────────────────────────────────────────────────────────
const WA_NUMBER = "919999999999"; // replace with actual number
function WAButton() {
  const open = useCallback(() => {
    const msg = encodeURIComponent("Hi, I have feedback for MoneyMirror 👋");
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, "_blank", "noopener");
  }, []);
  return (
    <button onClick={open} title="Send feedback on WhatsApp"
      style={{ position: "fixed", bottom: 108, right: 18, zIndex: 90, width: 48, height: 48, borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(37,211,102,.4)", transition: "transform .15s, box-shadow .15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(37,211,102,.55)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";   e.currentTarget.style.boxShadow = "0 4px 20px rgba(37,211,102,.4)"; }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49" />
      </svg>
    </button>
  );
}

// ─── Quick log FAB ────────────────────────────────────────────────────────────
function QuickLogFAB({ onClick }) {
  return (
    <button onClick={onClick} title="Quick log an expense"
      style={{ position: "fixed", bottom: 108, left: 18, zIndex: 90, width: 48, height: 48, borderRadius: "50%", background: C.primary, color: C.onPrimary, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${C.primary}50`, transition: "transform .15s, box-shadow .15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = `0 6px 28px ${C.primary}70`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";   e.currentTarget.style.boxShadow = `0 4px 20px ${C.primary}50`; }}
    >
      <Ic n="add" size={26} color={C.onPrimary} />
    </button>
  );
}

// ─── LIFE_CATS config ─────────────────────────────────────────────────────────
const LIFE_CATS_CFG = [
  { key: "dining",        label: "Dining",        icon: "restaurant",   color: "#ffb347" }, // more prominent amber-orange
  { key: "transport",     label: "Transport",     icon: "commute",      color: C.blue    },
  { key: "shopping",      label: "Shopping",      icon: "shopping_bag", color: C.purple  },
  { key: "entertainment", label: "Entertainment", icon: "movie",        color: C.orange  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════════════════════════
function HomeScreen({ store, stats, onNav, onQuickLog }) {
  const {
    state, setIncomeSalary, setIncomeOther, setRent,
    addUtil, delUtil, setUtil, addEmi, delEmi, setEmi,
    setLifeManual, addLifeLog, delLifeLog, addSub, delSub, setSub,
    setLastOpenedDate,
  } = store;

  const { income, fixedPlan, lifestyleActualTotal, subMonthly, remaining, committedPct, status, statusColor, savingsRate, plannedTotal, projectedTotal, drift, daysPassed, daysInMonth } = stats;

  const feedback   = getFeedback(stats);
  const statusInfo = getStatusLabel(savingsRate);
  const heroColor  = status === "BLEEDING" ? C.error : status === "TIGHT" ? C.warn : C.primary;
  const commColor  = committedPct > 80 ? C.error : committedPct > 60 ? C.warn : C.primary;
  const miniInsights = getMiniInsights(state, stats);

  // Daily return hook
  const todayStr = new Date().toISOString().slice(0, 10);
  const returnMsg = useMemo(() => {
    const last = state.meta.lastOpenedDate;
    if (!last) return null;
    if (last === todayStr) return { text: "You've checked in today", color: C.primary };
    return { text: "New day — track today's spending", color: C.blue };
  }, [state.meta.lastOpenedDate, todayStr]);

  // Stamp today on mount (only if different day)
  useEffect(() => {
    if (state.meta.lastOpenedDate !== todayStr) {
      setLastOpenedDate(todayStr);
    }
  }, [todayStr]); // eslint-disable-line

  const utilName = useCallback((id, v) => setUtil(id, "name", v),   [setUtil]);
  const utilAmt  = useCallback((id, v) => setUtil(id, "amount", v), [setUtil]);
  const emiName  = useCallback((id, v) => setEmi(id, "name", v),    [setEmi]);
  const emiAmt   = useCallback((id, v) => setEmi(id, "amount", v),  [setEmi]);
  const subFld   = useCallback((id, k, v) => setSub(id, k, v),      [setSub]);

  const fixedFeedback = income > 0 && fixedPlan / income > 0.5 ? { text: "Fixed costs are eating most of your income. Flexibility is limited.", color: C.warn } : null;
  const lifeFeedback  = income > 0 && lifestyleActualTotal / income > 0.3 ? { text: "Lifestyle is where most people can optimise.", color: C.warn } : null;

  const spendPct = income > 0 ? (stats.actualTotal / income) * 100 : 0;
  const heroInsight = income > 0
  const dynamicMessage = (() => {
  if (income === 0) return "Start mapping your money";
  if (remaining < 0) return "You're spending more than you make";
  if (savingsRate < 10) return "You're cutting it close";
  if (savingsRate < 25) return "You're doing okay";
  return "You're in control";
})();

const dynamicSub = (() => {
  if (income === 0) return "Add your income to begin";
  if (remaining < 0) return "Time to pull things back a little";
  if (savingsRate < 10) return "A small shift can fix this";
  if (savingsRate < 25) return "You're on the right path";
  return "Keep the momentum going";
})();

   

  return (
    <div style={{ padding: "68px 18px 130px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>

      {/* Hero purpose — above everything */}
      <div style={{ textAlign: "center", marginBottom: 20, paddingTop: 16 }}>
        <h1 style={{
  fontFamily: "'Space Grotesk',sans-serif",
  fontWeight: 800,
  fontSize: "clamp(22px, 5vw, 28px)",
  letterSpacing: "-.03em",
  color: statusColor,
  lineHeight: 1.2,
  marginBottom: 6
}}>
  {dynamicMessage}
</h1>

<p style={{
  fontSize: 13,
  color: C.muted,
  lineHeight: 1.5
}}>
  {dynamicSub}
</p>
        {returnMsg && (
          <p style={{ fontSize: 11, color: returnMsg.color, marginTop: 8, fontWeight: 700 }}>{returnMsg.text}</p>
        )}
      </div>

      <ClarityHeader stats={stats} onNav={onNav} />

      {/* Hero */}
      <div className="fade-up" style={{ textAlign: "center", marginBottom: 20 }}>
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3em", color: C.muted, marginBottom: 10 }}>
          {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · Reflection
        </p>
       <div
  style={{
    position: "relative",
    padding: "28px 20px",
    borderRadius: 20,
    background: `${C.primary}08`,
    border: `1px solid ${C.primary}20`,
    boxShadow: `0 0 40px ${C.primary}20`,
    backdropFilter: "blur(16px)",
    marginBottom: 20
  }}
>

  {/* Glow orb */}
  <div
    style={{
      position: "absolute",
      top: -40,
      left: "50%",
      transform: "translateX(-50%)",
      width: 180,
      height: 180,
      borderRadius: "50%",
      background: C.primary,
      opacity: 0.12,
      filter: "blur(60px)",
      zIndex: 0
    }}
  />

  {/* Main number */}
  <div
    style={{
      fontFamily: "Space Grotesk, sans-serif",
      fontWeight: 900,
      fontSize: "clamp(48px, 14vw, 78px)",
      letterSpacing: "-0.04em",
      color: heroColor,
      textShadow: `0 0 30px ${heroColor}60`,
      position: "relative",
      zIndex: 1
    }}
  >
    {income > 0 ? fmtINR(Math.abs(remaining), true) : "—"}
  </div>

  {/* Context */}
  <p
    style={{
      fontSize: 12,
      color: C.muted,
      marginTop: 6,
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }}
  >
    Left this month • Stay sharp
  </p>

</div>
        
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13, color: heroColor, textTransform: "uppercase", letterSpacing: ".08em" }}>
            {income > 0 ? (remaining < 0 ? "Over plan" : "Left this month") : "No income set"}
          </span>
          {income > 0 && (
            <span style={{ fontSize: 10, fontWeight: 800, color: statusInfo.color, background: `${statusInfo.color}14`, padding: "3px 10px", borderRadius: 20, border: `1px solid ${statusInfo.color}28` }}>
              {statusInfo.emoji} {statusInfo.label}
            </span>
          )}
        </div>

        {heroInsight && (
          <p style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{heroInsight}</p>
        )}

        {/* Plan vs Reality */}
        {income > 0 && plannedTotal > 0 && (
          <div style={{ marginTop: 14, display: "inline-flex", gap: 8, background: C.s1, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 16px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.muted }}>Planned: <span style={{ color: C.text, fontWeight: 700 }}>{fmtINR(plannedTotal, true)}</span></span>
            <span style={{ fontSize: 10, color: C.muted }}>→</span>
            <span style={{ fontSize: 11, color: C.muted }}>Projected: <span style={{ color: drift > 0 ? C.warn : C.primary, fontWeight: 700 }}>{fmtINR(projectedTotal, true)}</span></span>
            {Math.abs(drift) > 200 && (
              <span style={{ fontSize: 10, fontWeight: 800, color: drift > 0 ? C.warn : C.primary, background: `${drift > 0 ? C.warn : C.primary}14`, padding: "2px 8px", borderRadius: 20 }}>
                {drift > 0 ? "+" : ""}{fmtINR(drift, true)} drift
              </span>
            )}
          </div>
        )}

        {income > 0 && (
          <div style={{ marginTop: 16, maxWidth: 300, margin: "16px auto 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: C.muted }}>Income committed</span>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 12, color: commColor }}>{committedPct.toFixed(0)}%</span>
            </div>
            <Bar pct={committedPct} color={commColor} h={4} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: C.muted }}>Actual: {fmtINR(stats.actualTotal, true)}</span>
              <span style={{ fontSize: 9, color: C.muted }}>Income: {fmtINR(income, true)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && income > 0 && (
        <div className="slide-d" style={{ background: `${feedback.color}0c`, border: `1px solid ${feedback.color}25`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, 
        alignItems: "flex-start" }}>
          <Ic n={feedback.icon} size={17} color={feedback.color} style={{ marginTop: 1 }} />
          <p style={{ fontSize: 13, color: feedback.color, lineHeight: 1.6 }}>{feedback.text}</p>
        </div>
      )}

      {/* Today's safe spend */}
      <SafeSpendCard stats={stats} />

      {/* Mini insights */}
      {miniInsights.length > 0 && (
        <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8 }}>
          {miniInsights.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < miniInsights.length - 1 ? 8 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.primary, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{m}</p>
            </div>
          ))}
        </div>
      )}

      {/* Why this matters */}
      {income > 0 && (
        <p style={{ fontSize: 10, color: C.muted, opacity: .45, textAlign: "center", marginBottom: 16, marginTop: miniInsights.length > 0 ? 6 : 0 }}>
          This is your monthly reality based on your current behaviour
        </p>
      )}

      {/* Mini cards */}
      <MiniCards stats={stats} />

      {/* INCOME */}
      <Section title="Income" icon="payments" summary={income} defaultOpen={income === 0} hint="Tap to set your monthly income">
        <Field label="Monthly Salary" hint="Enter monthly amount" onClear={N(state.income.salary) > 0 ? () => setIncomeSalary(0) : undefined}>
          <NumInput value={state.income.salary} onChange={setIncomeSalary} placeholder="0" style={{ fontSize: 17 }} />
        </Field>
        <Field label="Other Income" hint="Monthly amount · freelance, rent, dividends, etc." onClear={N(state.income.other) > 0 ? () => setIncomeOther(0) : undefined}>
          <NumInput value={state.income.other} onChange={setIncomeOther} placeholder="0" style={{ fontSize: 17 }} />
        </Field>
        {income > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ fontSize: 12, color: C.muted }}>Total monthly income</span>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 18, color: C.primary }}>{fmtINR(income)}</span>
          </div>
        )}
      </Section>

      {/* FIXED */}
      <Section title="Fixed Expenses" icon="home_work" summary={fixedPlan} hint="Rent, utilities, EMIs" feedbackMsg={fixedFeedback}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted, marginBottom: 8 }}>Rent</p>
          <Field label="Monthly Rent" hint="Enter monthly amount" onClear={N(state.fixed.rent) > 0 ? () => setRent(0) : undefined}>
            <NumInput value={state.fixed.rent} onChange={setRent} placeholder="0" style={{ fontSize: 17 }} />
          </Field>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted }}>Utilities</p>
            <GhostBtn onClick={addUtil} color={C.primary}><Ic n="add" size={14} color={C.primary} />Add</GhostBtn>
          </div>
          {state.fixed.utilities.length === 0
            ? <p style={{ fontSize: 11, color: C.muted, opacity: .4 }}>No utilities — monthly amounts</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{state.fixed.utilities.map(u => <UtilRow key={u.id} item={u} onName={v => utilName(u.id, v)} onAmt={v => utilAmt(u.id, v)} onDel={() => delUtil(u.id)} />)}</div>
          }
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted }}>EMI / Loans</p>
            <GhostBtn onClick={addEmi} color={C.primary}><Ic n="add" size={14} color={C.primary} />Add</GhostBtn>
          </div>
          {state.fixed.emis.length === 0
            ? <p style={{ fontSize: 11, color: C.muted, opacity: .4 }}>No EMIs — monthly amount per loan</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{state.fixed.emis.map(e => <EmiRow key={e.id} item={e} onName={v => emiName(e.id, v)} onAmt={v => emiAmt(e.id, v)} onDel={() => delEmi(e.id)} />)}</div>
          }
        </div>
        {fixedPlan > 0 && (
          <div style={{ paddingTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Fixed total</span>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 16, color: C.blue }}>{fmtINR(fixedPlan)}</span>
            </div>
            {income > 0 && <Bar pct={(fixedPlan / income) * 100} color={fixedPlan / income > 0.5 ? C.error : C.blue} h={2} />}
          </div>
        )}
      </Section>

      {/* LIFESTYLE */}
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
              <span style={{ fontSize: 12, color: C.muted }}>Lifestyle total</span>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 16, color: C.warn }}>{fmtINR(lifestyleActualTotal)}</span>
            </div>
            {income > 0 && <Bar pct={(lifestyleActualTotal / income) * 100} color={lifestyleActualTotal / income > 0.3 ? C.error : C.warn} h={2} />}
          </div>
        )}
      </Section>

      {/* SUBSCRIPTIONS */}
      <Section title="Subscriptions" icon="subscriptions" summary={subMonthly} hint="Monthly equivalent auto-calculated"
        feedbackMsg={subMonthly > 2000 ? { text: `${fmtINR(subMonthly, true)}/mo = ${fmtINR(subMonthly * 12, true)}/yr — worth auditing`, color: C.warn } : null}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.muted }}>{state.subscriptions.length > 0 ? `${state.subscriptions.length} tracked` : "None yet"}</span>
          <GhostBtn onClick={addSub} color={C.primary}><Ic n="add" size={14} color={C.primary} />Add</GhostBtn>
        </div>
        {state.subscriptions.map(s => <SubRow key={s.id} sub={s} onField={(k, v) => subFld(s.id, k, v)} onDel={() => delSub(s.id)} />)}
        {subMonthly > 0 && (
          <div style={{ background: C.s4, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.muted }}>Monthly equivalent</span>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, color: C.purple }}>{fmtINR(subMonthly)}</span>
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

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════
function InsightsScreen({ state, stats }) {
  const { income, fixedPlan, lifestyleActualTotal, subMonthly, actualTotal, remaining, savingsRate, burnRate, projectedEnd, projectedTotal, plannedTotal, daysLeft, status, drift } = stats;
  const statusInfo = getStatusLabel(savingsRate);
  const tone = status === "BLEEDING" ? "bleeding" : status === "TIGHT" ? "tight" : "stable";
  const reality = {
    bleeding: { text: "You're slightly above your plan. Pulling back in one area can fix this.", color: C.error },
    tight:    { text: "You're close to the edge. One unplanned expense could push you over.", color: C.warn  },
    stable:   { text: "You're on track. Small optimisations now compound into real money over months.", color: C.primary },
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
    if (diningAmt / income > 0.12) out.push({ icon: "restaurant", text: `Dining is ${(diningAmt / income * 100).toFixed(0)}% of income — try cutting to 10%.` });
    if (subMonthly > 2000) out.push({ icon: "subscriptions", text: `Subscriptions: ${fmtINR(subMonthly, true)}/mo = ${fmtINR(subMonthly * 12, true)}/yr.` });
    if (fixedPlan / income > 0.5) out.push({ icon: "home_work", text: `Fixed obligations at ${(fixedPlan / income * 100).toFixed(0)}% — below 50% is the safe zone.` });
    if (savingsRate < 10 && remaining >= 0) out.push({ icon: "savings", text: `Savings rate is ${savingsRate.toFixed(0)}% — aim for 20%+ to build real momentum.` });
    if (drift > income * 0.05) out.push({ icon: "trending_up", text: `Current pace will exceed plan by ${fmtINR(drift, true)} this month.` });
    if (savingsRate >= 25) out.push({ icon: "star", text: `Saving ${savingsRate.toFixed(0)}% of income — most people don't get here.` });
    return out;
  }, [income, state.lifestyle.dining.manual, subMonthly, fixedPlan, savingsRate, remaining, drift]);

  if (income === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80dvh", gap: 16, color: C.muted, position: "relative", zIndex: 1, padding: "0 32px", textAlign: "center" }}>
      <Ic n="auto_awesome" size={48} color={C.muted} style={{ opacity: .25 }} />
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>Add your income and expenses on Home to unlock insights.</p>
    </div>
  );

  return (
    <div style={{ padding: "68px 18px 120px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>
      <div className="fade-up">
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-.03em", margin: "24px 0 6px" }}>Insights</h2>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Your money, reflected honestly.</p>
        <p style={{ fontSize: 11, color: C.muted, opacity: .45, marginBottom: 20 }}>This is your monthly reality based on your current behaviour.</p>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${statusInfo.color}12`, border: `1px solid ${statusInfo.color}25`, borderRadius: 10, padding: "8px 14px", marginBottom: 16 }}>
          <span style={{ fontSize: 14 }}>{statusInfo.emoji}</span>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: statusInfo.color }}>{statusInfo.label}</span>
          <span style={{ fontSize: 12, color: C.muted }}>· {savingsRate.toFixed(1)}% savings rate</span>
        </div>

        <div style={{ background: `${reality.color}0c`, border: `1px solid ${reality.color}28`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: reality.color, fontStyle: "italic" }}>"{reality.text}"</p>
        </div>

        {/* Drift panel */}
        {income > 0 && plannedTotal > 0 && (
          <div style={{ background: C.s0, border: `1px solid ${Math.abs(drift) > income * 0.05 ? C.warn + "35" : C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: C.muted, marginBottom: 12 }}>Plan vs Reality</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              {[
                { lbl: "Planned",   val: plannedTotal,   color: C.text                               },
                { lbl: "Drift",     val: drift,          color: drift > 0 ? C.warn : C.primary        },
                { lbl: "Projected", val: projectedTotal, color: drift > 0 ? C.warn : C.primary        },
              ].map(({ lbl, val, color }) => (
                <div key={lbl} style={{ textAlign: lbl === "Planned" ? "left" : lbl === "Projected" ? "right" : "center" }}>
                  <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{lbl}</p>
                  <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 18, color }}>
                    {lbl === "Drift" && drift > 0 ? "+" : ""}{fmtINR(val, true)}
                  </p>
                </div>
              ))}
            </div>
            {Math.abs(drift) > 200 && (
              <p style={{ fontSize: 12, color: drift > 0 ? C.warn : C.primary, lineHeight: 1.5 }}>
                {drift > 0
                  ? `You're drifting above your plan. At this pace you'll overshoot by ${fmtINR(drift, true)}.`
                  : `You're under your plan by ${fmtINR(Math.abs(drift), true)} — good control.`
                }
              </p>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Burn Rate",     val: fmtINR(burnRate, true) + "/day", icon: "local_fire_department", color: remaining < 0 ? C.error : C.text  },
            { label: "Days Left",     val: `${daysLeft}d`,                   icon: "calendar_today",        color: C.blue                           },
            { label: "Projected End", val: fmtINR(projectedEnd, true),       icon: projectedEnd >= 0 ? "trending_up" : "trending_down", color: projectedEnd >= 0 ? C.primary : C.error },
            { label: "Savings Rate",  val: `${savingsRate.toFixed(1)}%`,     icon: "savings",               color: savingsRate >= 20 ? C.primary : C.warn },
          ].map(({ label, val, icon, color }) => (
            <div key={label} style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <Ic n={icon} size={15} color={color} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted }}>{label}</span>
              </div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: "-.03em", color }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: C.muted, marginBottom: 18 }}>Spend Breakdown</p>
          {breakdown.map(({ label, val, color, icon, pct }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Ic n={icon} size={14} color={color} />
                  <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14 }}>{fmtINR(val, true)}</span>
                  <span style={{ fontSize: 10, color, fontWeight: 800, minWidth: 32, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                </div>
              </div>
              <Bar pct={pct} color={color} h={2} />
            </div>
          ))}
          <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Total spend</span>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 16, color: remaining < 0 ? C.error : C.text }}>{fmtINR(actualTotal, true)}</span>
          </div>
        </div>

        {nudges.length > 0 && (
          <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: C.muted, marginBottom: 14 }}>Spending Signals</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {nudges.map((nd, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Ic n={nd.icon} size={16} color={C.muted} style={{ marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>{nd.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MIRROR
// ═══════════════════════════════════════════════════════════════════════════
function MirrorScreen({ store, stats }) {
  const { state, setGoal } = store;
  const { income, remaining, projectedEnd, burnRate, daysLeft, subMonthly, plannedTotal, projectedTotal, drift } = stats;

  const goal        = N(state.meta.goal);
  const currentSave = Math.max(0, remaining);
  const gap         = goal > 0 ? goal - currentSave : null;
  const goalPct     = goal > 0 ? Math.min(100, (currentSave / goal) * 100) : 0;
  const onGoal      = gap !== null && gap <= 0;
  const diffVsGoal  = goal > 0 ? currentSave - goal : null;

  // Action block quick wins
  const quickWins = useMemo(() => {
    if (income === 0) return [];
    const wins = [];
    const dining   = N(state.lifestyle.dining.manual);
    const shopping = N(state.lifestyle.shopping.manual);
    const ent      = N(state.lifestyle.entertainment.manual);
    if (dining > 0 && dining / income > 0.10) wins.push({ icon: "restaurant", action: "Reduce dining by 15%",  gain: dining * 0.15   });
    if (subMonthly > 500 && state.subscriptions.length >= 2) wins.push({ icon: "subscriptions", action: `Cut 1 subscription`, gain: subMonthly / state.subscriptions.length });
    if (shopping > 0 && shopping / income > 0.08) wins.push({ icon: "shopping_bag", action: "Reduce shopping 20%", gain: shopping * 0.20 });
    if (ent > 0 && ent / income > 0.06) wins.push({ icon: "movie", action: "Trim entertainment 25%",  gain: ent * 0.25      });
    return wins.slice(0, 3);
  }, [income, state.lifestyle, subMonthly, state.subscriptions.length]);

  const totalWinGain = quickWins.reduce((t, w) => t + w.gain, 0);

  // 25yr SIP
  const invest  = currentSave * 0.5;
  const r       = 0.12 / 12;
  const corpus  = invest > 0 ? invest * ((Math.pow(1 + r, 300) - 1) / r) * (1 + r) : 0;
  const SCENARIOS = [
    { label: "Static",   mult: 0.28, color: C.error,   icon: "trending_flat"  },
    { label: "Adaptive", mult: 0.65, color: C.blue,    icon: "trending_up"    },
    { label: "Mastery",  mult: 1.00, color: C.primary, icon: "auto_awesome", featured: true },
  ];

  const projLabel    = projectedEnd >= 0 ? `You'll have ${fmtINR(projectedEnd, true)} at month-end` : `You'll be ${fmtINR(Math.abs(projectedEnd), true)} short`;
  const projSubLabel = goal > 0
    ? (diffVsGoal !== null && diffVsGoal >= 0 ? `That's ${fmtINR(diffVsGoal, true)} more than your goal.` : `That's ${fmtINR(Math.abs(diffVsGoal ?? 0), true)} less than your ${fmtINR(goal, true)} goal.`)
    : `Burning ${fmtINR(burnRate, true)}/day · ${daysLeft}d remaining`;

  if (income === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80dvh", gap: 16, color: C.muted, position: "relative", zIndex: 1, padding: "0 32px", textAlign: "center" }}>
      <Ic n="blur_on" size={52} color={C.primary} style={{ opacity: .2 }} />
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>Enter your income and expenses to see your mirror.</p>
    </div>
  );

  return (
    <div style={{ padding: "68px 18px 120px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>
      <div className="fade-up">
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-.03em", margin: "24px 0 6px" }}>The Mirror</h2>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>No sugarcoating. Just the truth.</p>

        {/* Projection hero */}
        <div style={{ background: "#000", border: `1px solid ${projectedEnd >= 0 ? C.primary + "20" : C.error + "20"}`, borderRadius: 16, padding: "28px 24px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3em", color: C.muted, marginBottom: 12 }}>If nothing changes…</p>
          <div className="glow" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 54, letterSpacing: "-.04em", lineHeight: 1, color: projectedEnd >= 0 ? C.primary : C.error }}>
            {fmtINR(projectedEnd, true)}
          </div>
          <p style={{ fontSize: 13, color: projectedEnd >= 0 ? C.text : C.error, marginTop: 10, fontWeight: 600 }}>{projLabel}</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{projSubLabel}</p>
          {plannedTotal > 0 && Math.abs(drift) > 200 && (
            <p style={{ fontSize: 11, color: drift > 0 ? C.warn : C.primary, marginTop: 8, fontWeight: 700 }}>
              {drift > 0 ? `+${fmtINR(drift, true)} above plan` : `${fmtINR(Math.abs(drift), true)} under plan`}
            </p>
          )}
        </div>

        {/* Savings goal */}
        <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: C.muted, marginBottom: 14 }}>Savings Goal</p>
          <Field label="Target Monthly Savings" hint="Monthly amount" onClear={goal > 0 ? () => setGoal(0) : undefined}>
            <NumInput value={state.meta.goal} onChange={setGoal} placeholder="0" style={{ fontSize: 17 }} />
          </Field>
          {goal > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Progress to goal</span>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 17, color: onGoal ? C.primary : C.error }}>
                  {gap !== null ? (gap > 0 ? `${fmtINR(gap, true)} short` : `${fmtINR(Math.abs(gap), true)} ahead`) : "—"}
                </span>
              </div>
              <Bar pct={goalPct} color={onGoal ? C.primary : C.error} h={5} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: C.muted }}>Saving: {fmtINR(currentSave, true)}</span>
                <span style={{ fontSize: 10, color: C.muted }}>Goal: {fmtINR(goal, true)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action block */}
        {quickWins.length > 0 && (
          <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif" }}>Fix this in {quickWins.length} move{quickWins.length > 1 ? "s" : ""}:</p>
              {totalWinGain > 0 && <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 13, color: C.primary }}>+{fmtINR(totalWinGain, true)}/mo</span>}
            </div>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>Small cuts, real money back.</p>
            {quickWins.map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${C.primary}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ic n={w.icon} size={17} color={C.primary} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{w.action}</p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Save {fmtINR(w.gain, true)}/mo</p>
                </div>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 14, color: C.primary }}>+{fmtINR(w.gain, true)}</span>
              </div>
            ))}
          </div>
        )}

        {/* 25yr SIP */}
        {corpus > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: C.muted, marginBottom: 10 }}>25-Year Projection · 50% of surplus @ 12% CAGR</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SCENARIOS.map(s => (
                <div key={s.label} style={{ background: s.featured ? "#000" : C.s0, border: `1px solid ${s.featured ? C.primary + "22" : C.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Ic n={s.icon} size={18} color={s.color} />
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13, color: s.color }}>{s.label}</span>
                  </div>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: "-.03em", color: s.color }}>{fmtINR(corpus * s.mult, true)}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 9, color: C.muted, opacity: .38, marginTop: 8, textAlign: "center" }}>Based on {fmtINR(invest, true)}/mo invested. Illustrative — not financial advice.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const store  = useStore();
  const [screen,      setScreen]      = useState("home");
  const [showQuickLog, setShowQuickLog] = useState(false);

  const stats = useMemo(() => calcEngine(store.state), [store.state]);

  const handleNav      = useCallback((s) => setScreen(s), []);
  const openQuickLog   = useCallback(() => setShowQuickLog(true),  []);
  const closeQuickLog  = useCallback(() => setShowQuickLog(false), []);

  const handleQuickAdd = useCallback((cat, entry) => {
    store.addLifeLog(cat, entry);
  }, [store]);

  const handleReset = useCallback(() => {
    if (window.confirm("Reset all data? Cannot be undone.")) {
      store.reset();
      setScreen("home");
    }
  }, [store]);
  return (
    <>
      <style>{CSS}</style>
      <Blobs />

      {/* Top bar */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 56, background: "rgba(9,9,9,.9)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Ic n="blur_on" size={22} color={C.primary} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: 17, color: C.primary, letterSpacing: "-.04em" }}>MoneyMirror</span>
        </div>
        {stats.income > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: stats.statusColor, boxShadow: `0 0 8px ${stats.statusColor}`, transition: "background .3s" }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: stats.statusColor }}>{stats.status}</span>
          </div>
        )}
        <button onClick={handleReset} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: C.error, background: `${C.error}12`, border: `1px solid ${C.error}25`, borderRadius: 7, padding: "5px 12px", transition: "background .15s" }}
          onMouseEnter={e => e.currentTarget.style.background = `${C.error}22`}
          onMouseLeave={e => e.currentTarget.style.background = `${C.error}12`}
        >Reset</button>
      </header>

      {/* Screens */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh" }}>
        {screen === "home"     && <HomeScreen     store={store} stats={stats} onNav={handleNav} onQuickLog={openQuickLog} />}
        {screen === "insights" && <InsightsScreen state={store.state} stats={stats} />}
        {screen === "mirror"   && <MirrorScreen   store={store} stats={stats} />}
      </div>

      {/* FABs */}
      <QuickLogFAB onClick={openQuickLog} />
      <WAButton />

      {/* Quick log modal */}
      {showQuickLog && <QuickLogModal onAdd={handleQuickAdd} onClose={closeQuickLog} />}

      <Nav active={screen} onNav={handleNav} status={stats.status} />
    </>
  );
}