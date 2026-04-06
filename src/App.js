import { useState, useCallback, useMemo } from "react";

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg:           "#0b0b0b",
  surfaceLow:   "#111111",
  surfaceMid:   "#161616",
  surfaceHigh:  "#1e1e1e",
  surfaceTop:   "#252525",
  primary:      "#3fff8b",
  onPrimary:    "#002d15",
  tertiary:     "#7ae6ff",
  error:        "#ff5f5b",
  warning:      "#f5a623",
  onSurface:    "#f0f0f0",
  onSurfaceVar: "#888888",
  border:       "rgba(255,255,255,0.07)",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,300,0,0&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: ${C.bg};
    color: ${C.onSurface};
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
  }
  input { font-family: 'Space Grotesk', sans-serif; color: ${C.onSurface}; background: transparent; border: none; outline: none; }
  input::placeholder { color: ${C.onSurfaceVar}; opacity: 0.5; }
  button { font-family: 'Manrope', sans-serif; cursor: pointer; border: none; background: none; }
  ::-webkit-scrollbar { display: none; }
  .ms { font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal;
        font-size: 20px; line-height: 1; display: inline-block; white-space: nowrap;
        font-variation-settings: 'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20; user-select: none; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes expandIn { from { opacity:0; transform:scaleY(0.96); } to { opacity:1; transform:scaleY(1); } }
  @keyframes barFill { from { width:0 !important; } to { width:var(--w); } }
  .fade-up { animation: fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }
  .expand-in { animation: expandIn 0.22s cubic-bezier(0.16,1,0.3,1) both; transform-origin: top; }
  .bar { animation: barFill 0.7s cubic-bezier(0.16,1,0.3,1) both; }
  @keyframes glow { 0%,100% { text-shadow: 0 0 20px currentColor; } 50% { text-shadow: 0 0 50px currentColor; } }
  .glow { animation: glow 3s ease-in-out infinite; }
`;

// ─── Pure helpers ──────────────────────────────────────────────────────────
const toNum = (v) => {
  const s = String(v ?? "").replace(/[^0-9.]/g, "");
  const parts = s.split(".");
  const clean = parts[0] + (parts.length > 1 ? "." + parts.slice(1).join("") : "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

const fmt = (n, compact = false) => {
  const abs = Math.abs(Math.round(n));
  const sign = n < 0 ? "-" : "";
  if (compact) {
    if (abs >= 1_00_00_000) return sign + "₹" + (abs / 1_00_00_000).toFixed(1) + "Cr";
    if (abs >= 1_00_000)    return sign + "₹" + (abs / 1_00_000).toFixed(1) + "L";
    if (abs >= 1_000)       return sign + "₹" + (abs / 1_000).toFixed(0) + "K";
  }
  return sign + "₹" + abs.toLocaleString("en-IN");
};

const cycleToMonthly = (amount, cycle) => {
  const a = toNum(amount);
  if (cycle === "quarterly")   return a / 3;
  if (cycle === "half-yearly") return a / 6;
  if (cycle === "annual")      return a / 12;
  return a;
};

// ─── Default state ─────────────────────────────────────────────────────────
const mkId = () => Date.now() + Math.random();
const fresh = () => ({
  income:  { salary: "", other: "" },
  fixed:   { rent: "", utilities: [], emi: [] },
  lifestyle: {
    dining:        { budget: "", logs: [] },
    transport:     { budget: "", logs: [] },
    shopping:      { budget: "", logs: [] },
    entertainment: { budget: "", logs: [] },
  },
  subscriptions: [],
  mirror: { goal: "" },
});

// ─── Persistence ───────────────────────────────────────────────────────────
const KEY = "mm_v3";
const load = () => {
  try {
    const r = localStorage.getItem(KEY);
    if (!r) return null;
    const parsed = JSON.parse(r);
    // Merge with fresh() to handle schema additions
    const f = fresh();
    return {
      ...f,
      ...parsed,
      fixed: { ...f.fixed, ...parsed.fixed },
      lifestyle: { ...f.lifestyle, ...parsed.lifestyle },
      mirror: { ...f.mirror, ...parsed.mirror },
    };
  } catch { return null; }
};
const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };

// ─── Compute (pure) ────────────────────────────────────────────────────────
function compute(s) {
  const income = toNum(s.income.salary) + toNum(s.income.other);

  const rent      = toNum(s.fixed.rent);
  const utilities = s.fixed.utilities.reduce((t, u) => t + toNum(u.amount), 0);
  const emi       = s.fixed.emi.reduce((t, e) => t + toNum(e.amount), 0);
  const fixedTotal = rent + utilities + emi;

  const lifestyle = {};
  for (const [k, v] of Object.entries(s.lifestyle)) {
    const logSum = v.logs.reduce((t, l) => t + toNum(l.amount), 0);
    lifestyle[k] = v.logs.length > 0 ? logSum : toNum(v.budget);
  }
  const lifestyleTotal = Object.values(lifestyle).reduce((t, v) => t + v, 0);

  const subMonthly = s.subscriptions.reduce((t, sub) => t + cycleToMonthly(sub.amount, sub.cycle), 0);

  const totalSpend = fixedTotal + lifestyleTotal + subMonthly;
  const remaining  = income - totalSpend;
  const committed  = income > 0 ? Math.min(100, (totalSpend / income) * 100) : 0;
  const savingsRate = income > 0 ? (remaining / income) * 100 : 0;

  const now = new Date();
  const daysPassed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - daysPassed;
  //only variable (behavioral) spending should affect burn
  const lifestyleDaily = daysPassed >0 ? lifestyleTotal / daysPassed :0; 
  const subsDaily = subMonthly / 30;
  //True Burn = Controllable daily spend
  const burnRate= lifestyleDaily + subsDaily;
  //Projection uses ue burn rate, no total spend
  const projectedEnd = remaining - burnRate + daysLeft;

  const status = remaining < 0 ? "BLEEDING" : remaining < income * 0.15 ? "TIGHT" : "STABLE";
  const statusColor = status === "BLEEDING" ? C.error : status === "TIGHT" ? C.warning : C.primary;

  return {
    income, rent, utilities, emi, fixedTotal,
    lifestyle, lifestyleTotal, subMonthly, totalSpend,
    remaining, committed, savingsRate,
    daysPassed, daysLeft, daysInMonth, burnRate, projectedEnd,
    status, statusColor,
  };
} 
console.log("deploy test");

// ─── Atom store (shallow updates only — no deep clone on every keystroke) ──
function useStore() {
  const [state, _set] = useState(() => load() || fresh());

  const set = useCallback((fn) => {
    _set(prev => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const setIncome     = useCallback((k, v) => set(p => ({ ...p, income: { ...p.income, [k]: v } })), [set]);
  const setRent       = useCallback((v)    => set(p => ({ ...p, fixed: { ...p.fixed, rent: v } })), [set]);
  const setMirrorGoal = useCallback((v)    => set(p => ({ ...p, mirror: { ...p.mirror, goal: v } })), [set]);

  const addUtil  = useCallback(() => set(p => ({ ...p, fixed: { ...p.fixed, utilities: [...p.fixed.utilities, { id: mkId(), name: "", amount: "" }] } })), [set]);
  const delUtil  = useCallback((id) => set(p => ({ ...p, fixed: { ...p.fixed, utilities: p.fixed.utilities.filter(u => u.id !== id) } })), [set]);
  const setUtil  = useCallback((id, k, v) => set(p => ({ ...p, fixed: { ...p.fixed, utilities: p.fixed.utilities.map(u => u.id === id ? { ...u, [k]: v } : u) } })), [set]);

  const addEmi   = useCallback(() => set(p => ({ ...p, fixed: { ...p.fixed, emi: [...p.fixed.emi, { id: mkId(), name: "", amount: "" }] } })), [set]);
  const delEmi   = useCallback((id) => set(p => ({ ...p, fixed: { ...p.fixed, emi: p.fixed.emi.filter(e => e.id !== id) } })), [set]);
  const setEmi   = useCallback((id, k, v) => set(p => ({ ...p, fixed: { ...p.fixed, emi: p.fixed.emi.map(e => e.id === id ? { ...e, [k]: v } : e) } })), [set]);

  const setLifeBudget = useCallback((cat, v) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], budget: v } } })), [set]);
  const addLog   = useCallback((cat, entry) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], logs: [...p.lifestyle[cat].logs, { id: mkId(), ...entry }] } } })), [set]);
  const delLog   = useCallback((cat, id) => set(p => ({ ...p, lifestyle: { ...p.lifestyle, [cat]: { ...p.lifestyle[cat], logs: p.lifestyle[cat].logs.filter(l => l.id !== id) } } })), [set]);

  const addSub   = useCallback(() => set(p => ({ ...p, subscriptions: [...p.subscriptions, { id: mkId(), name: "", amount: "", cycle: "monthly", renewalDate: "" }] })), [set]);
  const delSub   = useCallback((id) => set(p => ({ ...p, subscriptions: p.subscriptions.filter(s => s.id !== id) })), [set]);
  const setSub   = useCallback((id, k, v) => set(p => ({ ...p, subscriptions: p.subscriptions.map(s => s.id === id ? { ...s, [k]: v } : s) })), [set]);

  const reset    = useCallback(() => { localStorage.removeItem(KEY); _set(fresh()); }, []);

  return { state, setIncome, setRent, setMirrorGoal, addUtil, delUtil, setUtil, addEmi, delEmi, setEmi, setLifeBudget, addLog, delLog, addSub, delSub, setSub, reset };
}

// ─── Shared UI atoms ───────────────────────────────────────────────────────
const Ic = ({ n, size = 20, color, style = {} }) => (
  <span className="ms" style={{ fontSize: size, color: color || "inherit", flexShrink: 0, lineHeight: 1, ...style }}>{n}</span>
);

const Divider = () => <div style={{ height: 1, background: C.border, margin: "2px 0" }} />;

function Bar({ pct, color = C.primary, h = 3 }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ height: h, background: "rgba(255,255,255,0.06)", borderRadius: h }}>
      <div className="bar" style={{ height: "100%", width: `${w}%`, background: color, borderRadius: h, boxShadow: `0 0 10px ${color}55`, "--w": `${w}%` }} />
    </div>
  );
}

// ─── Stable input components (DEFINED OUTSIDE RENDER — prevents focus loss) ─

function NumInput({ value, onChange, placeholder = "0", style = {} }) {
  const handleChange = useCallback((e) => {
    let v = e.target.value.replace(/[^0-9.]/g, "");
    const parts = v.split(".");
    if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
    onChange(v);
  }, [onChange]);
  return <input type="text" inputMode="decimal" value={value} onChange={handleChange} placeholder={placeholder} style={{ fontWeight: 700, fontSize: 16, width: "100%", ...style }} />;
}

function StrInput({ value, onChange, placeholder = "", style = {} }) {
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 14, color: C.onSurface, width: "100%", ...style }} />;
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.onSurfaceVar }}>{label}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceTop, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px" }}>
        <span style={{ color: C.onSurfaceVar, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>₹</span>
        {children}
      </div>
      {hint && <span style={{ fontSize: 10, color: C.onSurfaceVar, opacity: 0.55 }}>{hint}</span>}
    </div>
  );
}

function GhostBtn({ children, onClick, color = C.onSurfaceVar }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 4, color, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, background: `${color}12`, border: `1px solid ${color}22`, transition: "background 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}22`}
      onMouseLeave={e => e.currentTarget.style.background = `${color}12`}
    >{children}</button>
  );
}

// ─── Collapsible section ────────────────────────────────────────────────────
function Section({ title, icon, total, hint, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", padding: "16px 18px", gap: 12, background: "none", cursor: "pointer" }}>
        <Ic n={icon} size={18} color={C.onSurfaceVar} />
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, flex: 1, textAlign: "left" }}>{title}</span>
        {total !== undefined && (
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 16, color: total > 0 ? C.onSurface : C.onSurfaceVar }}>{fmt(total, true)}</span>
        )}
        <Ic n={open ? "expand_less" : "expand_more"} size={18} color={C.onSurfaceVar} />
      </button>
      {!open && hint && total === 0 && (
        <div style={{ padding: "0 18px 12px" }}>
          <span style={{ fontSize: 11, color: C.onSurfaceVar, opacity: 0.45 }}>{hint}</span>
        </div>
      )}
      {open && (
        <div className="expand-in" style={{ padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Divider />
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Array row components — DEFINED AT MODULE LEVEL (stable, no focus loss) ─

const UtilRow = ({ item, onName, onAmt, onDel }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ flex: 1, background: C.surfaceTop, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
      <StrInput value={item.name} onChange={onName} placeholder="e.g. Electricity" />
    </div>
    <div style={{ width: 110, background: C.surfaceTop, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: C.onSurfaceVar, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>₹</span>
      <NumInput value={item.amount} onChange={onAmt} placeholder="0" style={{ fontSize: 14 }} />
    </div>
    <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: `${C.error}12`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Ic n="close" size={16} color={C.error} />
    </button>
  </div>
);

const EmiRow = ({ item, onName, onAmt, onDel }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ flex: 1, background: C.surfaceTop, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
      <StrInput value={item.name} onChange={onName} placeholder="Loan name" />
    </div>
    <div style={{ width: 110, background: C.surfaceTop, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: C.onSurfaceVar, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>₹</span>
      <NumInput value={item.amount} onChange={onAmt} placeholder="0" style={{ fontSize: 14 }} />
    </div>
    <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: `${C.error}12`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Ic n="close" size={16} color={C.error} />
    </button>
  </div>
);

const SubRow = ({ sub, onField, onDel }) => {
  const CYCLES = ["monthly", "quarterly", "half-yearly", "annual"];
  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, background: C.surfaceTop, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px" }}>
          <StrInput value={sub.name} onChange={v => onField("name", v)} placeholder="Netflix, Spotify…" />
        </div>
        <div style={{ width: 110, background: C.surfaceTop, borderRadius: 9, border: `1px solid ${C.border}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: C.onSurfaceVar, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>₹</span>
          <NumInput value={sub.amount} onChange={v => onField("amount", v)} placeholder="0" style={{ fontSize: 14 }} />
        </div>
        <button onClick={onDel} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: `${C.error}12`, border: `1px solid ${C.error}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ic n="close" size={16} color={C.error} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {CYCLES.map(c => (
          <button key={c} onClick={() => onField("cycle", c)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, letterSpacing: "0.05em", background: sub.cycle === c ? `${C.primary}18` : C.surfaceTop, color: sub.cycle === c ? C.primary : C.onSurfaceVar, border: `1px solid ${sub.cycle === c ? C.primary + "50" : C.border}`, transition: "all 0.15s" }}>
            {c}
          </button>
        ))}
        {sub.cycle !== "monthly" && toNum(sub.amount) > 0 && (
          <span style={{ fontSize: 10, color: C.onSurfaceVar, marginLeft: 2 }}>≈ {fmt(cycleToMonthly(sub.amount, sub.cycle), true)}/mo</span>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 9, color: C.onSurfaceVar, opacity: 0.5 }}>Per entry · Amount is {sub.cycle} — auto-converted to monthly</span>
      </div>
    </div>
  );
};

const LogRow = ({ log, onDel }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
    <span style={{ flex: 1, fontSize: 12, color: C.onSurfaceVar }}>{log.note || "Entry"}</span>
    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>{fmt(toNum(log.amount), true)}</span>
    <button onClick={onDel} style={{ color: C.onSurfaceVar, opacity: 0.4, padding: 4, lineHeight: 1 }}
      onMouseEnter={e => e.currentTarget.style.opacity = 1}
      onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}
    ><Ic n="close" size={14} /></button>
  </div>
);

// ─── Lifestyle category component — DEFINED AT MODULE LEVEL ─────────────────
function LifeCat({ catKey, label, icon, color, data, onBudget, onAddLog, onDelLog, income }) {
  const [logNote, setLogNote] = useState("");
  const [logAmt,  setLogAmt]  = useState("");
  const [showLogs, setShowLogs] = useState(false);

  const logSum = useMemo(() => data.logs.reduce((t, l) => t + toNum(l.amount), 0), [data.logs]);
  const displayTotal = data.logs.length > 0 ? logSum : toNum(data.budget);
  const pct = income > 0 ? (displayTotal / income) * 100 : 0;
  const barColor = pct > 20 ? C.error : pct > 12 ? C.warning : color;

  const handleLogAmt  = useCallback((v) => setLogAmt(v), []);
  const handleLogNote = useCallback((e) => setLogNote(e.target.value), []);

  const submitLog = useCallback(() => {
    if (!toNum(logAmt)) return;
    onAddLog({ note: logNote.trim(), amount: logAmt });
    setLogNote("");
    setLogAmt("");
  }, [logNote, logAmt, onAddLog]);

  return (
    <div style={{ background: C.surfaceTop, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ic n={icon} size={17} color={color} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{label}</span>
        {data.logs.length > 0 && (
          <span style={{ fontSize: 9, color: C.onSurfaceVar, background: C.surfaceHigh, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.05em" }}>
            Auto · {data.logs.length} logs
          </span>
        )}
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 15, color: displayTotal > 0 ? C.onSurface : C.onSurfaceVar }}>{fmt(displayTotal, true)}</span>
      </div>

      <Field
        label="Monthly budget or estimate"
        hint={data.logs.length > 0 ? `Auto-calculated from ${data.logs.length} entries — manual input ignored` : "Monthly amount · overridden if logs exist"}
      >
        <NumInput value={data.budget} onChange={onBudget} placeholder="0" style={{ fontSize: 15, opacity: data.logs.length > 0 ? 0.35 : 1 }} />
      </Field>

      {displayTotal > 0 && (
        <div style={{ marginTop: 10 }}>
          <Bar pct={pct} color={barColor} h={2} />
          <span style={{ fontSize: 10, color: C.onSurfaceVar, marginTop: 4, display: "block" }}>{pct.toFixed(0)}% of income</span>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowLogs(o => !o)} style={{ fontSize: 11, fontWeight: 700, color: C.onSurfaceVar, display: "flex", alignItems: "center", gap: 4 }}>
          <Ic n={showLogs ? "expand_less" : "receipt_long"} size={14} />
          {showLogs ? "Hide" : `Log entries (${data.logs.length})`}
        </button>

        {showLogs && (
          <div className="expand-in" style={{ marginTop: 10 }}>
            {data.logs.map(l => (
              <LogRow key={l.id} log={l} onDel={() => onDelLog(l.id)} />
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <div style={{ flex: 1, background: C.surfaceMid, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                <input
                  type="text"
                  value={logNote}
                  onChange={handleLogNote}
                  placeholder="Note (optional)"
                  style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: C.onSurface, background: "transparent", border: "none", outline: "none", width: "100%" }}
                />
              </div>
              <div style={{ width: 90, background: C.surfaceMid, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: C.onSurfaceVar, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13 }}>₹</span>
                <NumInput value={logAmt} onChange={handleLogAmt} placeholder="0" style={{ fontSize: 13 }} />
              </div>
              <button onClick={submitLog} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic n="add" size={18} color={color} />
              </button>
            </div>
            <span style={{ fontSize: 9, color: C.onSurfaceVar, opacity: 0.45, marginTop: 5, display: "block" }}>Per entry · Each log amount adds to total</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Nav ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: "home",     icon: "home_max",     label: "Home"     },
  { id: "insights", icon: "auto_awesome", label: "Insights" },
  { id: "mirror",   icon: "blur_on",      label: "Mirror"   },
];

function Nav({ active, onNav, status, statusColor }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "rgba(11,11,11,0.92)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, padding: "10px 24px 18px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
      {TABS.map(t => {
        const isActive = active === t.id;
        const showDot = t.id === "home" && status === "BLEEDING";
        return (
          <button key={t.id} onClick={() => onNav(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: isActive ? C.primary : C.onSurfaceVar, opacity: isActive ? 1 : 0.4, transform: isActive ? "translateY(-1px)" : "none", transition: "all 0.2s", position: "relative", padding: "4px 24px" }}>
            {showDot && <span style={{ position: "absolute", top: 1, right: 16, width: 7, height: 7, borderRadius: "50%", background: C.error, boxShadow: `0 0 8px ${C.error}` }} />}
            <Ic n={t.icon} size={22} color="inherit" />
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const Blobs = () => (
  <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
    <div style={{ position: "absolute", top: "-15%", left: "-10%", width: "50%", height: "50%", background: `${C.primary}06`, borderRadius: "50%", filter: "blur(100px)" }} />
    <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: "40%", height: "40%", background: `${C.tertiary}06`, borderRadius: "50%", filter: "blur(90px)" }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: HOME
// ═══════════════════════════════════════════════════════════════════════════
const LIFE_CATS = [
  { key: "dining",        label: "Dining",        icon: "restaurant",    color: C.warning  },
  { key: "transport",     label: "Transport",     icon: "commute",       color: C.tertiary },
  { key: "shopping",      label: "Shopping",      icon: "shopping_bag",  color: "#b78fff"  },
  { key: "entertainment", label: "Entertainment", icon: "movie",         color: "#ff9d6c"  },
];

function HomeScreen({ store, stats }) {
  const { state, setIncome, setRent, addUtil, delUtil, setUtil, addEmi, delEmi, setEmi, setLifeBudget, addLog, delLog, addSub, delSub, setSub } = store;
  const { income, fixedTotal, lifestyleTotal, subMonthly, remaining, committed, status, statusColor } = stats;

  const heroColor = status === "BLEEDING" ? C.error : status === "TIGHT" ? C.warning : C.primary;
  const commColor = committed > 80 ? C.error : committed > 60 ? C.warning : C.primary;

  // Stable callbacks per id (useCallback at module level via closures)
  const utilName = useCallback((id, v) => setUtil(id, "name", v),   [setUtil]);
  const utilAmt  = useCallback((id, v) => setUtil(id, "amount", v), [setUtil]);
  const emiName  = useCallback((id, v) => setEmi(id, "name", v),    [setEmi]);
  const emiAmt   = useCallback((id, v) => setEmi(id, "amount", v),  [setEmi]);
  const subField = useCallback((id, k, v) => setSub(id, k, v),      [setSub]);

  return (
    <div style={{ padding: "68px 18px 120px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>

      {/* ── Hero ── */}
      <div className="fade-up" style={{ textAlign: "center", margin: "28px 0 32px" }}>
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: C.onSurfaceVar, marginBottom: 10 }}>
          {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · Reflection
        </p>
        <div className={income > 0 ? "glow" : ""} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: "clamp(52px, 16vw, 82px)", lineHeight: 1, letterSpacing: "-0.04em", color: heroColor }}>
          {income > 0 ? fmt(Math.abs(remaining), true) : "₹—"}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: heroColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {income > 0 ? (remaining < 0 ? "Overspent" : "Left this month") : "No income set"}
          </span>
          {income > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: statusColor, background: `${statusColor}14`, padding: "3px 10px", borderRadius: 20, border: `1px solid ${statusColor}28` }}>
              {status === "BLEEDING" ? "Bleeding" : status === "TIGHT" ? "Tight" : "On Track"}
            </span>
          )}
        </div>

        {income > 0 && (
          <div style={{ marginTop: 20, maxWidth: 320, margin: "20px auto 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: C.onSurfaceVar }}>Income committed</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 13, color: commColor }}>{committed.toFixed(0)}%</span>
            </div>
            <Bar pct={committed} color={commColor} h={4} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 9, color: C.onSurfaceVar }}>Spend: {fmt(stats.totalSpend, true)}</span>
              <span style={{ fontSize: 9, color: C.onSurfaceVar }}>Income: {fmt(income, true)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── INCOME ── */}
      <Section title="Income" icon="payments" total={income} defaultOpen={income === 0} hint="Tap to set your monthly income">
        <Field label="Monthly Salary" hint="Enter monthly amount">
          <NumInput value={state.income.salary} onChange={v => setIncome("salary", v)} placeholder="0" style={{ fontSize: 17 }} />
        </Field>
        <Field label="Other Income" hint="Enter monthly amount · freelance, rent, side income, etc.">
          <NumInput value={state.income.other} onChange={v => setIncome("other", v)} placeholder="0" style={{ fontSize: 17 }} />
        </Field>
        {income > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontSize: 12, color: C.onSurfaceVar }}>Total monthly income</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 18, color: C.primary }}>{fmt(income)}</span>
          </div>
        )}
      </Section>

      {/* ── FIXED ── */}
      <Section title="Fixed Expenses" icon="home_work" total={fixedTotal} hint="Rent, utilities, loan EMIs">
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.onSurfaceVar, marginBottom: 8 }}>Rent</p>
          <Field label="Monthly Rent" hint="Monthly amount">
            <NumInput value={state.fixed.rent} onChange={setRent} placeholder="0" style={{ fontSize: 17 }} />
          </Field>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.onSurfaceVar }}>Utilities</p>
            <GhostBtn onClick={addUtil} color={C.primary}><Ic n="add" size={14} color={C.primary} />Add</GhostBtn>
          </div>
          {state.fixed.utilities.length === 0
            ? <p style={{ fontSize: 11, color: C.onSurfaceVar, opacity: 0.45, padding: "4px 0" }}>No utilities — monthly amounts</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {state.fixed.utilities.map(u => (
                  <UtilRow key={u.id} item={u}
                    onName={v => utilName(u.id, v)}
                    onAmt={v => utilAmt(u.id, v)}
                    onDel={() => delUtil(u.id)} />
                ))}
              </div>
          }
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.onSurfaceVar }}>EMI / Loans</p>
            <GhostBtn onClick={addEmi} color={C.primary}><Ic n="add" size={14} color={C.primary} />Add</GhostBtn>
          </div>
          {state.fixed.emi.length === 0
            ? <p style={{ fontSize: 11, color: C.onSurfaceVar, opacity: 0.45, padding: "4px 0" }}>No EMIs — monthly amount per loan</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {state.fixed.emi.map(e => (
                  <EmiRow key={e.id} item={e}
                    onName={v => emiName(e.id, v)}
                    onAmt={v => emiAmt(e.id, v)}
                    onDel={() => delEmi(e.id)} />
                ))}
              </div>
          }
        </div>

        {fixedTotal > 0 && (
          <div style={{ paddingTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.onSurfaceVar }}>Fixed total</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 16, color: C.tertiary }}>{fmt(fixedTotal)}</span>
            </div>
            {income > 0 && <Bar pct={(fixedTotal / income) * 100} color={C.tertiary} h={2} />}
          </div>
        )}
      </Section>

      {/* ── LIFESTYLE ── */}
      <Section title="Lifestyle" icon="restaurant" total={lifestyleTotal} hint="Dining, transport, shopping, entertainment">
        {LIFE_CATS.map(({ key, label, icon, color }) => (
          <LifeCat
            key={key} catKey={key} label={label} icon={icon} color={color}
            data={state.lifestyle[key]}
            onBudget={v => setLifeBudget(key, v)}
            onAddLog={entry => addLog(key, entry)}
            onDelLog={id => delLog(key, id)}
            income={income}
          />
        ))}
        {lifestyleTotal > 0 && (
          <div style={{ paddingTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.onSurfaceVar }}>Lifestyle total</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 16, color: C.warning }}>{fmt(lifestyleTotal)}</span>
            </div>
            {income > 0 && <Bar pct={(lifestyleTotal / income) * 100} color={C.warning} h={2} />}
          </div>
        )}
      </Section>

      {/* ── SUBSCRIPTIONS ── */}
      <Section title="Subscriptions" icon="subscriptions" total={subMonthly} hint="Monthly equivalent auto-calculated from billing cycles">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.onSurfaceVar }}>{state.subscriptions.length > 0 ? `${state.subscriptions.length} tracked` : "None added yet"}</span>
          <GhostBtn onClick={addSub} color={C.primary}><Ic n="add" size={14} color={C.primary} />Add</GhostBtn>
        </div>
        {state.subscriptions.map(s => (
          <SubRow key={s.id} sub={s} onField={(k, v) => subField(s.id, k, v)} onDel={() => delSub(s.id)} />
        ))}
        {subMonthly > 0 && (
          <div style={{ background: C.surfaceTop, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.onSurfaceVar }}>Monthly equivalent</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 15, color: "#b78fff" }}>{fmt(subMonthly)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: C.onSurfaceVar, opacity: 0.5 }}>Auto-calculated · all cycles normalised</span>
              <span style={{ fontSize: 10, color: C.onSurfaceVar }}>{fmt(subMonthly * 12, true)}/yr</span>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════
function InsightsScreen({ state, stats }) {
  const { income, fixedTotal, lifestyleTotal, subMonthly, totalSpend, remaining, savingsRate, burnRate, projectedEnd, daysLeft, status } = stats;

  const tone = status === "BLEEDING" ? "bleeding" : status === "TIGHT" ? "tight" : "stable";
  const reality = {
    bleeding: { text: "You're spending more than you earn. Every day this continues, the hole deepens.", color: C.error },
    tight:    { text: "You're close to the edge. One unexpected expense could push you into deficit.", color: C.warning },
    stable:   { text: "Your finances are under control. This is the moment to optimise — not to relax.", color: C.primary },
  }[tone];

  const breakdown = [
    { label: "Fixed",         val: fixedTotal,     color: C.tertiary, icon: "home_work"    },
    { label: "Lifestyle",     val: lifestyleTotal, color: C.warning,  icon: "restaurant"   },
    { label: "Subscriptions", val: subMonthly,     color: "#b78fff",  icon: "subscriptions"},
  ];

  const nudges = useMemo(() => {
    if (income === 0) return [];
    const out = [];
    const diningPct = toNum(state.lifestyle.dining.budget) / income * 100;
    if (diningPct > 15) out.push({ icon: "restaurant", text: `Dining is ${diningPct.toFixed(0)}% of income — healthy ceiling is 15%.` });
    if (subMonthly > 2000) out.push({ icon: "subscriptions", text: `Subscriptions cost ${fmt(subMonthly, true)}/mo — that's ${fmt(subMonthly * 12, true)}/yr.` });
    const fixedPct = fixedTotal / income * 100;
    if (fixedPct > 50) out.push({ icon: "home_work", text: `Fixed obligations at ${fixedPct.toFixed(0)}% of income — safe zone is below 50%.` });
    if (savingsRate < 10 && remaining >= 0) out.push({ icon: "savings", text: `Saving ${savingsRate.toFixed(0)}% of income — the benchmark is 20%+.` });
    if (savingsRate >= 25) out.push({ icon: "trending_up", text: `Strong: saving ${savingsRate.toFixed(0)}% of income — well above the 20% benchmark.` });
    return out;
  }, [income, state.lifestyle.dining.budget, subMonthly, fixedTotal, savingsRate, remaining]);

  if (income === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80dvh", gap: 16, color: C.onSurfaceVar, position: "relative", zIndex: 1, padding: "0 32px", textAlign: "center" }}>
      <Ic n="auto_awesome" size={48} color={C.onSurfaceVar} style={{ opacity: 0.3 }} />
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>Add your income and expenses on the Home screen to unlock insights.</p>
    </div>
  );

  return (
    <div style={{ padding: "68px 18px 120px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>
      <div className="fade-up">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em", margin: "24px 0 6px" }}>Insights</h2>
        <p style={{ fontSize: 13, color: C.onSurfaceVar, marginBottom: 24 }}>Your money, reflected honestly.</p>

        <div style={{ background: `${reality.color}0c`, border: `1px solid ${reality.color}28`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: reality.color, fontStyle: "italic" }}>"{reality.text}"</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Burn Rate",     val: `${fmt(burnRate, true)}/day`,    icon: "local_fire_department", color: remaining < 0 ? C.error : C.onSurface   },
            { label: "Days Left",     val: `${daysLeft}d`,                   icon: "calendar_today",        color: C.tertiary                               },
            { label: "Projected End", val: fmt(projectedEnd, true),          icon: projectedEnd >= 0 ? "trending_up" : "trending_down", color: projectedEnd >= 0 ? C.primary : C.error },
            { label: "Savings Rate",  val: `${savingsRate.toFixed(0)}%`,     icon: "savings",               color: savingsRate >= 20 ? C.primary : C.warning },
          ].map(({ label, val, icon, color }) => (
            <div key={label} style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <Ic n={icon} size={15} color={color} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.onSurfaceVar }}>{label}</span>
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", color }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 18 }}>Spend Breakdown</p>
          {breakdown.map(({ label, val, color, icon }) => {
            const pct = income > 0 ? (val / income) * 100 : 0;
            return (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Ic n={icon} size={14} color={color} />
                    <span style={{ fontSize: 12, color: C.onSurfaceVar }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>{fmt(val, true)}</span>
                    <span style={{ fontSize: 10, color, fontWeight: 800, minWidth: 32, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <Bar pct={pct} color={color} h={2} />
              </div>
            );
          })}
          <Divider />
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: C.onSurfaceVar }}>Total spend</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 16, color: remaining < 0 ? C.error : C.onSurface }}>{fmt(totalSpend, true)}</span>
          </div>
        </div>

        {nudges.length > 0 && (
          <div style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 14 }}>Observations</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {nudges.map((n, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Ic n={n.icon} size={16} color={C.onSurfaceVar} style={{ marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: C.onSurface, lineHeight: 1.65 }}>{n.text}</p>
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
// SCREEN: MIRROR
// ═══════════════════════════════════════════════════════════════════════════
function MirrorScreen({ store, stats }) {
  const { state, setMirrorGoal } = store;
  const { income, remaining, projectedEnd, burnRate, daysLeft, subMonthly } = stats;

  const goal = toNum(state.mirror.goal);
  const currentSaving = Math.max(0, remaining);
  const gap = goal > 0 ? goal - currentSaving : null;
  const goalPct = goal > 0 ? Math.min(100, (currentSaving / goal) * 100) : 0;
  const onGoal = gap !== null && gap <= 0;

  const nudges = useMemo(() => {
    if (!gap || gap <= 0 || income === 0) return [];
    const out = [];
    const dining = toNum(state.lifestyle.dining.budget);
    if (dining > 0) out.push({ icon: "restaurant", text: `Reduce dining 10%`, impact: dining * 0.10 });
    if (subMonthly > 500) out.push({ icon: "subscriptions", text: `Cut 1–2 subscriptions`, impact: subMonthly * 0.30 });
    const shopping = toNum(state.lifestyle.shopping.budget);
    if (shopping > 0) out.push({ icon: "shopping_bag", text: `Reduce shopping 15%`, impact: shopping * 0.15 });
    const ent = toNum(state.lifestyle.entertainment.budget);
    if (ent > 0) out.push({ icon: "movie", text: `Trim entertainment 20%`, impact: ent * 0.20 });
    return out;
  }, [gap, income, state.lifestyle, subMonthly]);

  const totalNudgeSaving = nudges.reduce((t, n) => t + n.impact, 0);

  const monthlyInvest = currentSaving * 0.5;
  const r = 0.12 / 12;
  const corpus = monthlyInvest > 0 ? Math.round(monthlyInvest * ((Math.pow(1+r,300)-1)/r) * (1+r)) : 0;

  const SCENARIOS = [
    { label: "Static",   mult: 0.28, color: C.error,   icon: "trending_flat" },
    { label: "Adaptive", mult: 0.65, color: C.tertiary, icon: "trending_up"  },
    { label: "Mastery",  mult: 1.00, color: C.primary,  icon: "auto_awesome", featured: true },
  ];

  if (income === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80dvh", gap: 16, color: C.onSurfaceVar, position: "relative", zIndex: 1, padding: "0 32px", textAlign: "center" }}>
      <Ic n="blur_on" size={52} color={C.primary} style={{ opacity: 0.25 }} />
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>Enter your income and expenses to see your mirror projection.</p>
    </div>
  );

  return (
    <div style={{ padding: "68px 18px 120px", maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 }}>
      <div className="fade-up">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em", margin: "24px 0 6px" }}>The Mirror</h2>
        <p style={{ fontSize: 13, color: C.onSurfaceVar, marginBottom: 24 }}>No sugarcoating. Just the truth.</p>

        {/* Projection */}
        <div style={{ background: "#000", border: `1px solid ${projectedEnd >= 0 ? C.primary + "20" : C.error + "20"}`, borderRadius: 16, padding: "28px 24px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: C.onSurfaceVar, marginBottom: 12 }}>At this rate, you'll end with</p>
          <div className="glow" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 58, letterSpacing: "-0.04em", lineHeight: 1, color: projectedEnd >= 0 ? C.primary : C.error }}>
            {fmt(projectedEnd, true)}
          </div>
          <p style={{ fontSize: 12, color: C.onSurfaceVar, marginTop: 10 }}>
            {daysLeft}d left · burning {fmt(burnRate, true)}/day
          </p>
        </div>

        {/* Savings goal */}
        <div style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 14 }}>Savings Goal</p>
          <Field label="Target Monthly Savings" hint="Monthly amount">
            <NumInput value={state.mirror.goal} onChange={setMirrorGoal} placeholder="20000" style={{ fontSize: 17 }} />
          </Field>
          {goal > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.onSurfaceVar }}>Currently saving</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 18, color: onGoal ? C.primary : C.error }}>
                  {gap !== null ? (gap > 0 ? `${fmt(gap, true)} short` : `${fmt(Math.abs(gap), true)} ahead`) : "—"}
                </span>
              </div>
              <Bar pct={goalPct} color={onGoal ? C.primary : C.error} h={5} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: C.onSurfaceVar }}>Saving: {fmt(currentSaving, true)}</span>
                <span style={{ fontSize: 10, color: C.onSurfaceVar }}>Goal: {fmt(goal, true)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Nudges */}
        {nudges.length > 0 && (
          <div style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar }}>If you did all of these</p>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 14, color: C.primary }}>+{fmt(totalNudgeSaving, true)}/mo</span>
            </div>
            {nudges.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <Ic n={n.icon} size={16} color={C.primary} />
                <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: C.onSurface }}>{n.text}</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: C.primary, flexShrink: 0 }}>+{fmt(n.impact, true)}</span>
              </div>
            ))}
          </div>
        )}

        {/* 25-year SIP */}
        {corpus > 0 && (
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, marginBottom: 10 }}>25-Year Projection · 50% of surplus @ 12% CAGR</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SCENARIOS.map(s => (
                <div key={s.label} style={{ background: s.featured ? "#000" : C.surfaceLow, border: `1px solid ${s.featured ? C.primary + "22" : C.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Ic n={s.icon} size={18} color={s.color} />
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: s.color }}>{s.label}</span>
                  </div>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", color: s.color }}>{fmt(Math.round(corpus * s.mult), true)}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 9, color: C.onSurfaceVar, opacity: 0.4, marginTop: 8, textAlign: "center" }}>Based on {fmt(monthlyInvest, true)}/mo invested. Illustrative — not financial advice.</p>
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
  const [screen, setScreen] = useState("home");
  const stats  = useMemo(() => compute(store.state), [store.state]);

  const handleNav   = useCallback((s) => setScreen(s), []);
  const handleReset = useCallback(() => {
    if (window.confirm("Reset all MoneyMirror data? Cannot be undone.")) {
      store.reset();
      setScreen("home");
    }
  }, [store]);

  return (
    <>
      <style>{CSS}</style>
      <Blobs />

      {/* Top bar */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 56, background: "rgba(11,11,11,0.9)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Ic n="blur_on" size={22} color={C.primary} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 17, color: C.primary, letterSpacing: "-0.04em" }}>MoneyMirror</span>
        </div>
        {stats.income > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: stats.statusColor, boxShadow: `0 0 8px ${stats.statusColor}` }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: stats.statusColor }}>{stats.status}</span>
          </div>
        )}
        <button onClick={handleReset} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.error, background: `${C.error}12`, border: `1px solid ${C.error}25`, borderRadius: 7, padding: "5px 12px" }}>
          Reset
        </button>
      </header>

      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh" }}>
        {screen === "home"     && <HomeScreen     store={store} stats={stats} />}
        {screen === "insights" && <InsightsScreen state={store.state} stats={stats} />}
        {screen === "mirror"   && <MirrorScreen   store={store} stats={stats} />}
      </div>

      <Nav active={screen} onNav={handleNav} status={stats.status} statusColor={stats.statusColor} />
    </>
  );
}