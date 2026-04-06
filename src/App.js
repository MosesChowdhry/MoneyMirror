import React, { useState, useEffect, useRef } from "react";

// ─── Colour tokens (from Stitch Tailwind config) ───────────────────────────
const C = {
  bg: "#0e0e0e",
  surface: "#0e0e0e",
  surfaceLow: "#131313",
  surfaceContainer: "#1a1919",
  surfaceHigh: "#201f1f",
  surfaceHighest: "#262626",
  surfaceVariant: "#262626",
  primary: "#3fff8b",
  primaryDim: "#24f07e",
  onPrimary: "#005d2c",
  tertiary: "#7ae6ff",
  error: "#ff716c",
  warning: "#ffb84d",
  onSurface: "#ffffff",
  onSurfaceVar: "#adaaaa",
  outlineVar: "#494847",
};

// ─── Mock financial data ──────────────────────────────────────────────────
const FINANCIAL_DATA = {
  income: 80000,
  fixed: { rent: 22000, transport: 8600, insurance: 12000, debt: 7000 },
  totalFixed: 49600,
  dining: 4200,
  overspent: 12450,
  unusedSubs: 3,
  subCostPerMonth: 1497,
  savingsTarget: 50000,
  // Delta comparisons (mock)
  deltas: {
    overall: 2300,        // positive = better than last month
    dining: -12,          // percentage change
    subs: 0,
    savings: -800,        // negative = worse than last week
  },
};

// ─── Memory Hook — sticky line ────────────────────────────────────────────
const STICKY_LINE = `You're ₹${FINANCIAL_DATA.overspent.toLocaleString("en-IN")} off track this month.`;

// ─── Financial State Engine ───────────────────────────────────────────────
function getFinancialState(data) {
  const ratio = data.overspent / data.income;
  if (ratio > 0.1) return {
    state: "OVERSPENDING", label: "BLEEDING",
    heroText: "BLEEDING", color: C.error,
    badge: "BLEEDING", tone: "sharp",
  };
  if (ratio > 0.03) return {
    state: "WARNING", label: "OFF TRACK",
    heroText: "OFF TRACK", color: C.warning,
    badge: "HIGH", tone: "cautious",
  };
  return {
    state: "STABLE", label: "ON TRACK",
    heroText: "ON TRACK", color: C.primary,
    badge: "STEADY", tone: "calm",
  };
}

// ─── Derived Insights ─────────────────────────────────────────────────────
function getDerivedInsights(data) {
  const commitmentRatio = Math.round((data.totalFixed / data.income) * 100);
  const discretionaryPct = 100 - commitmentRatio;
  const savingsGap = data.income - data.totalFixed - data.savingsTarget;
  const subWaste = data.subCostPerMonth * 12;
  const diningPctOfFreedom = Math.round((data.dining / (data.income - data.totalFixed)) * 100);

  // Health score (0–100)
  let score = 60;
  if (data.overspent > 0) score -= Math.min(25, Math.round(data.overspent / data.income * 100));
  if (commitmentRatio > 65) score -= 10;
  if (data.unusedSubs > 0) score -= data.unusedSubs * 3;
  if (savingsGap < 0) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const getVerdict = (s) => {
    if (s >= 85) return "You're dangerous (in a good way).";
    if (s >= 60) return "You're getting sharper.";
    return "You're leaking money.";
  };

  return {
    commitmentRatio, discretionaryPct, savingsGap,
    subWaste, diningPctOfFreedom, healthScore: score,
    verdict: getVerdict(score),
  };
}

// ─── Count-up hook ────────────────────────────────────────────────────────
function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);
  const raf = useRef(null);

  useEffect(() => {
    if (target === 0) { setValue(0); setDone(true); return; }
    setDone(false);
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(Math.floor(eased * target));
      if (p < 1) { raf.current = requestAnimationFrame(step); }
      else { setValue(target); setDone(true); }
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return { value, done };
}

// ─── Today's Mirror — behavior-driven insights ───────────────────────────
const MIRROR_INSIGHTS = {
  sharp: [
    "You spent more than you earned. The mirror doesn't lie.",
    "3 subscriptions are ghosting you — and you're still paying.",
    "Your dining costs more than your insurance. Sit with that.",
    `₹${FINANCIAL_DATA.overspent.toLocaleString("en-IN")} in the red. Every rupee past zero is borrowed time.`,
    "You're funding habits, not a future.",
  ],
  cautious: [
    "You're close to the edge. One impulse away from overspending.",
    "Your spending is under control — barely.",
    "Subscriptions you forgot about are eating into your margin.",
    "You're not bleeding yet, but the cuts are forming.",
  ],
  calm: [
    "You're in control. Keep the momentum.",
    "The mirror is clean today. Stay sharp.",
    "Consistency is compounding in your favour.",
    "You're building something. Don't stop now.",
  ],
};

function getMirrorInsight(state) {
  const pool = MIRROR_INSIGHTS[state.tone] || MIRROR_INSIGHTS.sharp;
  // Deterministic daily pick based on day of year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return pool[dayOfYear % pool.length];
}

// ─── Global styles injected once ──────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${C.bg};
    color: ${C.onSurface};
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100dvh;
  }

  input { color: inherit; }
  input::placeholder { color: ${C.onSurfaceVar}; }
  input:focus { outline: none; }

  button { cursor: pointer; font-family: inherit; border: none; }

  .material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-weight: normal;
    font-style: normal;
    font-size: 24px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
    user-select: none;
  }

  ::-webkit-scrollbar { width: 0; height: 0; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-in { animation: fadeIn 0.4s ease forwards; }

  @keyframes heroBreath {
    0%, 100% { opacity: 0.88; filter: drop-shadow(0 0 0px transparent); }
    50%      { opacity: 1;    filter: drop-shadow(0 0 20px ${C.primary}44); }
  }

  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 0px transparent; }
    50%      { box-shadow: 0 0 20px ${C.primary}55; }
  }

  @keyframes barGrow {
    from { width: 0%; }
  }

  @keyframes dialFill {
    from { background: conic-gradient(${C.primary} 0deg, ${C.surfaceHighest} 0deg); }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .slide-up { animation: slideUp 0.6s ease forwards; }
`;

// ─── Shared components ────────────────────────────────────────────────────

function Icon({ name, size = 24, color, style = {} }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, color: color || "inherit", ...style }}
    >
      {name}
    </span>
  );
}

function TopBar({ activeTab, onTabChange }) {
  const tabs = ["Home", "Insights", "Mirror"];
  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      background: C.bg, height: 72,
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "0 44px",
      borderBottom: `1px solid ${C.outlineVar}22`,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="blur_on" size={26} color={C.primary} />
        <span style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900, fontSize: 22,
          color: C.primary, letterSpacing: "-0.04em",
        }}>MoneyMirror</span>
      </div>

      {/* Nav tabs */}
      <nav style={{ display: "flex", gap: 40 }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              background: "none", border: "none",
              fontFamily: "'Manrope', sans-serif",
              fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.2em",
              color: activeTab === tab ? C.primary : C.onSurfaceVar,
              opacity: activeTab === tab ? 1 : 0.7,
              cursor: "pointer",
              transition: "color 0.2s, opacity 0.2s",
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        background: C.surfaceHigh,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        <Icon name="account_circle" size={28} color={C.onSurfaceVar} />
      </div>
    </header>
  );
}

function BottomNav({ activeTab, onTabChange }) {
  const items = [
    { tab: "Home", icon: "home_max" },
    { tab: "Insights", icon: "auto_awesome" },
    { tab: "Mirror", icon: "blur_on" },
  ];
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      height: 88,
      background: "rgba(38,38,38,0.6)",
      backdropFilter: "blur(24px)",
      borderRadius: "28px 28px 0 0",
      display: "flex", justifyContent: "space-around", alignItems: "center",
      padding: "0 32px 8px",
      boxShadow: "0px -24px 48px rgba(0,0,0,0.5)",
    }}>
      {items.map(({ tab, icon }) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              background: "none", border: "none",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 4,
              color: active ? C.primary : C.onSurfaceVar,
              opacity: active ? 1 : 0.4,
              filter: active ? `drop-shadow(0 0 8px ${C.primary}99)` : "none",
              transform: active ? "scale(1.1)" : "scale(1)",
              transition: "all 0.2s",
            }}
          >
            <Icon name={icon} size={26} color="inherit" />
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
              {tab}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Decorative glow blobs (reused on every screen) ───────────────────────
function GlowBlobs() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: "40%", height: "40%",
        background: `${C.primary}0d`,
        borderRadius: "50%", filter: "blur(120px)",
      }} />
      <div style={{
        position: "absolute", bottom: "-10%", right: "-10%",
        width: "30%", height: "30%",
        background: `${C.tertiary}0d`,
        borderRadius: "50%", filter: "blur(100px)",
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 1 — ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════

function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [income, setIncome] = useState("");
  const [fixed, setFixed] = useState({ rent: "", transport: "", insurance: "", debt: "" });
  const [categories, setCategories] = useState([]);
  const [savings, setSavings] = useState(50000);

  const totalSteps = 4;

  const fixedFields = [
    { key: "rent", icon: "home_work", label: "Rent & Utilities" },
    { key: "transport", icon: "commute", label: "Transport" },
    { key: "insurance", icon: "health_and_safety", label: "Insurance" },
    { key: "debt", icon: "credit_card", label: "Debt Repayment" },
  ];

  const lifestyleItems = [
    { key: "dining", icon: "restaurant", label: "Dining" },
    { key: "shopping", icon: "shopping_bag", label: "Shopping" },
    { key: "travel", icon: "flight_takeoff", label: "Travel" },
    { key: "subscriptions", icon: "subscriptions", label: "Subscriptions" },
  ];

  const toggleCategory = (key) =>
    setCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  const formatRupee = (val) => {
    const n = parseInt(val.replace(/\D/g, ""), 10);
    if (isNaN(n)) return "₹0";
    return "₹" + n.toLocaleString("en-IN");
  };

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, position: "relative" }}>
      <GlowBlobs />

      {/* Header */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: C.bg, height: 72,
        display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 44px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="blur_on" size={26} color={C.primary} />
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900, fontSize: 22,
            color: C.primary, letterSpacing: "-0.04em",
          }}>MoneyMirror</span>
        </div>
        <span style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.2em",
          color: C.onSurfaceVar,
        }}>Exit</span>
      </header>

      {/* Progress dots */}
      <div style={{
        position: "fixed", top: 88, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 10, zIndex: 40,
      }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            height: 4, width: 44, borderRadius: 4,
            background: i < step ? C.primary : C.surfaceHighest,
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      {/* Content */}
      <main style={{
        position: "relative", zIndex: 1,
        padding: "140px 32px 160px",
        maxWidth: 768, margin: "0 auto",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 80,
      }}>

        {/* STEP 1 — Income */}
        {step >= 1 && (
          <section className="fade-in" style={{ width: "100%", textAlign: "center" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginBottom: 20 }}>
              Step 01 / Monthly Fuel
            </p>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 800, fontSize: "clamp(36px, 7vw, 72px)",
              letterSpacing: "-0.04em", lineHeight: 1,
              marginBottom: 40, color: C.onSurface,
            }}>
              What enters the mirror each month?
            </h1>
            <div style={{ position: "relative", display: "inline-block", width: "100%", maxWidth: 480 }}>
              <input
                type="text"
                placeholder="₹0"
                value={income}
                onChange={e => setIncome(e.target.value)}
                style={{
                  background: "transparent", border: "none",
                  textAlign: "center",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: "clamp(56px, 10vw, 96px)",
                  color: C.primary,
                  width: "100%", cursor: "pointer",
                  letterSpacing: "-0.04em",
                }}
              />
              <div style={{
                height: 1, background: `${C.primary}33`,
                marginTop: 8, borderRadius: 1,
              }} />
            </div>
          </section>
        )}

        {/* STEP 2 — Fixed outflows */}
        {step >= 2 && (
          <section className="fade-in" style={{ width: "100%" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginBottom: 20, textAlign: "center" }}>
              Step 02 / The Anchors
            </p>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700, fontSize: "clamp(28px, 4vw, 44px)",
              letterSpacing: "-0.03em", marginBottom: 48, textAlign: "center",
            }}>
              Define your non-negotiables.
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {fixedFields.map(f => (
                <div key={f.key} style={{
                  padding: "28px 32px",
                  background: C.surfaceLow,
                  borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "background 0.2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = C.surfaceLow}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <Icon name={f.icon} size={22} color={C.onSurfaceVar} />
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16 }}>{f.label}</span>
                  </div>
                  <input
                    type="text"
                    placeholder="₹0"
                    value={fixed[f.key]}
                    onChange={e => setFixed(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{
                      background: "transparent", border: "none",
                      textAlign: "right",
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700, fontSize: 20,
                      color: C.onSurfaceVar, width: 90,
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* STEP 3 — Lifestyle */}
        {step >= 3 && (
          <section className="fade-in" style={{ width: "100%" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginBottom: 20, textAlign: "center" }}>
              Step 03 / Lifestyle Pulse
            </p>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700, fontSize: "clamp(28px, 4vw, 44px)",
              letterSpacing: "-0.03em", marginBottom: 48, textAlign: "center",
            }}>
              Where does the rest flow?
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, maxWidth: 560, margin: "0 auto" }}>
              {lifestyleItems.map(item => {
                const active = categories.includes(item.key);
                return (
                  <button
                    key={item.key}
                    onClick={() => toggleCategory(item.key)}
                    style={{
                      aspectRatio: "1/1",
                      background: active ? `${C.primary}18` : C.surfaceLow,
                      border: `1px solid ${active ? C.primary + "55" : "transparent"}`,
                      borderRadius: 12,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 12,
                      transition: "all 0.2s",
                      transform: active ? "scale(0.97)" : "scale(1)",
                    }}
                  >
                    <Icon name={item.icon} size={32} color={active ? C.primary : C.onSurfaceVar} />
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.2em",
                      color: active ? C.onSurface : C.onSurfaceVar,
                    }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* STEP 4 — Savings goal */}
        {step >= 4 && (
          <section className="fade-in" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginBottom: 20 }}>
              Step 04 / The North Star
            </p>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700, fontSize: "clamp(28px, 4vw, 44px)",
              letterSpacing: "-0.03em", marginBottom: 48, textAlign: "center",
            }}>
              What's the end game?
            </h2>
            <div style={{ width: "100%", maxWidth: 440 }}>
              <div style={{ textAlign: "center", marginBottom: 40 }}>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900, fontSize: 56,
                  color: C.primary, letterSpacing: "-0.04em",
                }}>
                  {formatRupee(String(savings))}
                </span>
                <p style={{ color: C.onSurfaceVar, marginTop: 8, fontSize: 14 }}>Target Monthly Savings</p>
              </div>
              {/* Slider */}
              <div style={{ position: "relative", height: 8, background: C.surfaceHighest, borderRadius: 4, marginBottom: 16, marginTop: 8 }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, height: "100%",
                  width: `${(savings / 200000) * 100}%`,
                  background: C.primary, borderRadius: 4,
                  boxShadow: `0 0 12px ${C.primary}66`,
                  transition: "width 0.1s",
                }} />
                <input
                  type="range" min={0} max={200000} step={1000}
                  value={savings}
                  onChange={e => setSavings(Number(e.target.value))}
                  style={{
                    position: "absolute", inset: 0, width: "100%", opacity: 0,
                    cursor: "pointer", height: "100%",
                  }}
                />
                {/* Dynamic label above thumb */}
                <div style={{
                  position: "absolute", bottom: 28,
                  left: `${(savings / 200000) * 100}%`,
                  transform: "translateX(-50%)",
                  background: C.surfaceHigh,
                  padding: "4px 12px", borderRadius: 8,
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.15em", color: C.primary,
                  whiteSpace: "nowrap",
                  border: `1px solid ${C.primary}33`,
                  pointerEvents: "none",
                }}>
                  {savings < 25000 ? "Survival" : savings < 75000 ? "Building" : savings < 150000 ? "Freedom" : "Independence"}
                </div>
                <div style={{
                  position: "absolute", top: "50%",
                  left: `${(savings / 200000) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 28, height: 28, borderRadius: "50%",
                  background: C.onSurface,
                  boxShadow: `0 0 0 6px ${C.primary}33`,
                  pointerEvents: "none",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, opacity: 0.5 }}>Survival</span>
                <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, opacity: 0.5 }}>Independence</span>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Fixed CTA footer */}
      <footer style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        padding: "24px 32px 32px",
        background: `linear-gradient(to top, ${C.bg} 60%, transparent)`,
      }}>
        <div style={{ maxWidth: 768, margin: "0 auto" }}>
          {step < totalSteps ? (
            <button
              onClick={() => setStep(s => Math.min(s + 1, totalSteps))}
              style={{
                width: "100%", height: 72,
                background: C.primary, color: C.onPrimary,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800, fontSize: 16,
                textTransform: "uppercase", letterSpacing: "0.2em",
                border: "none", borderRadius: 10,
                boxShadow: `0 0 40px ${C.primary}44`,
                transition: "opacity 0.2s, transform 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={onComplete}
              style={{
                width: "100%", height: 72,
                background: C.primary, color: C.onPrimary,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800, fontSize: 16,
                textTransform: "uppercase", letterSpacing: "0.2em",
                border: "none", borderRadius: 10,
                boxShadow: `0 0 40px ${C.primary}44`,
              }}
            >
              SHOW ME THE TRUTH
            </button>
          )}
          <p style={{
            textAlign: "center", marginTop: 16,
            fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em",
            color: C.onSurfaceVar, opacity: 0.4,
          }}>
            Data is encrypted and private to your reflection.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 2 — HOME DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function HomeScreen({ onTabChange }) {
  const fState = getFinancialState(FINANCIAL_DATA);
  const insights = getDerivedInsights(FINANCIAL_DATA);
  const mirrorInsight = getMirrorInsight(fState);
  const { value: heroVal, done: heroDone } = useCountUp(FINANCIAL_DATA.overspent, 1600);
  const { value: commitVal, done: commitDone } = useCountUp(insights.commitmentRatio, 1200);
  const { value: dineVal } = useCountUp(FINANCIAL_DATA.dining, 1000);

  const cardHover = {
    onMouseEnter: e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 16px 48px rgba(0,0,0,0.4)`; },
    onMouseLeave: e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; },
  };

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, position: "relative" }}>
      <GlowBlobs />
      <main className="fade-in" style={{
        position: "relative", zIndex: 1,
        padding: "104px 32px 140px",
        maxWidth: 1280, margin: "0 auto",
      }}>

        {/* ── Today's Mirror ── */}
        <section className="slide-up" style={{
          textAlign: "center", marginBottom: 56,
          padding: "28px 32px",
          background: C.surfaceLow,
          borderRadius: 16,
          border: `1px solid ${C.primary}15`,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${C.primary}08, transparent)`, pointerEvents: "none" }} />
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: C.primary, marginBottom: 12, position: "relative" }}>
            Today's Mirror
          </p>
          <p style={{
            fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600,
            color: C.onSurface, lineHeight: 1.6, position: "relative",
            maxWidth: 520, margin: "0 auto",
          }}>
            "{mirrorInsight}"
          </p>
        </section>

        {/* ── Hero ── */}
        <section style={{ textAlign: "center", marginBottom: 80 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", color: C.onSurfaceVar, marginBottom: 16 }}>
            Monthly Reflection
          </p>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            fontSize: "clamp(48px, 8vw, 88px)",
            letterSpacing: "-0.04em", lineHeight: 0.95,
            color: fState.color,
            animation: heroDone ? "heroBreath 3s ease-in-out infinite" : "none",
          }}>
            ₹{heroVal.toLocaleString("en-IN")}<br />{fState.heroText}
          </h1>
          {/* Tension → Relief */}
          <p style={{ marginTop: 20, fontSize: 13, color: C.onSurfaceVar, lineHeight: 1.7 }}>
            You're spending more than you earn.<br />
            <span style={{ color: C.primary, fontWeight: 700 }}>Cut dining by 10% → save ₹{Math.round(FINANCIAL_DATA.dining * 0.1).toLocaleString("en-IN")}/mo</span>
          </p>
          {/* Memory hook */}
          <p style={{ marginTop: 12, fontSize: 11, color: fState.color, opacity: 0.6, fontWeight: 600, letterSpacing: "0.05em" }}>
            {STICKY_LINE}
          </p>
          <div style={{ width: 2, height: 48, background: `${fState.color}33`, borderRadius: 1, margin: "24px auto 0" }} />
        </section>

        {/* ── Delta Feedback ── */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap",
          marginBottom: 40,
        }}>
          <span style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>
            +₹{FINANCIAL_DATA.deltas.overall.toLocaleString("en-IN")} better than last month
          </span>
          <span style={{ fontSize: 11, color: C.error, fontWeight: 600 }}>
            Dining {FINANCIAL_DATA.deltas.dining > 0 ? "up" : "down"} {Math.abs(FINANCIAL_DATA.deltas.dining)}%
          </span>
        </div>

        {/* ── Bento grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16, marginBottom: 80 }}>

          {/* Card 1 — Committed */}
          <div style={{
            gridColumn: "span 7",
            background: C.surfaceLow, borderRadius: 24,
            padding: 40, display: "flex", flexDirection: "column", justifyContent: "space-between",
            minHeight: 220, transition: "all 0.3s ease",
          }} {...cardHover}>
            <div>
              <Icon name="account_balance_wallet" size={36} color={C.onSurfaceVar} style={{ marginBottom: 20 }} />
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: "clamp(36px, 4vw, 52px)",
                letterSpacing: "-0.04em", color: C.onSurface,
              }}>
                {commitVal}% Committed
              </h3>
              <p style={{ fontSize: 12, color: C.onSurfaceVar, marginTop: 8, fontWeight: 500 }}>
                {insights.commitmentRatio}% locked — {insights.discretionaryPct}% is your battlefield
              </p>
            </div>
            <div style={{ marginTop: 40 }}>
              <div style={{ height: 2, background: C.surfaceVariant, borderRadius: 1, position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, height: "100%",
                  width: commitDone ? `${insights.commitmentRatio}%` : "0%",
                  background: C.primary,
                  boxShadow: `0 0 15px ${C.primary}80`,
                  transition: "width 1.2s ease-out",
                }} />
              </div>
              <p style={{ marginTop: 12, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVar, fontWeight: 600 }}>
                Income vs Fixed Obligations
              </p>
            </div>
          </div>

          {/* Card 2 — Dining */}
          <div style={{
            gridColumn: "span 5",
            background: C.surfaceHigh, borderRadius: 24,
            padding: 40, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", textAlign: "center",
            border: `1px solid ${C.outlineVar}1a`, minHeight: 220,
            transition: "all 0.3s ease",
          }} {...cardHover}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: `${C.primary}1a`,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 24,
            }}>
              <Icon name="restaurant" size={32} color={C.primary} />
            </div>
            <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, fontWeight: 700, marginBottom: 8 }}>
              Dining & Social
            </p>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900, fontSize: 52, letterSpacing: "-0.04em",
              marginBottom: 8,
            }}>
              ₹{dineVal.toLocaleString("en-IN")}
            </div>
            {/* Insight */}
            <p style={{ fontSize: 11, color: C.onSurfaceVar, marginBottom: 12 }}>
              {insights.diningPctOfFreedom}% of your freedom goes to food
            </p>
            <div style={{
              background: `${fState.color}1a`, color: fState.color,
              padding: "4px 14px", borderRadius: 20,
              fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em",
              marginBottom: 12,
            }}>
              {fState.badge}
            </div>
            {/* Tension → Relief */}
            <p style={{ fontSize: 11, color: C.onSurfaceVar, lineHeight: 1.5, maxWidth: 200 }}>
              Drop 2 meals out →{" "}
              <span style={{ color: C.primary, fontWeight: 700 }}>save ₹840</span>
            </p>
          </div>

          {/* Card 3 — Ghosting subs */}
          <div style={{
            gridColumn: "span 12",
            background: "#000", borderRadius: 24,
            padding: "36px 40px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", flexWrap: "wrap", gap: 24,
            border: `1px solid ${C.outlineVar}0d`,
            transition: "all 0.3s ease",
          }} {...cardHover}>
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 16,
                background: "rgba(38,38,38,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${C.outlineVar}26`,
              }}>
                <Icon name="mist" size={44} color={C.tertiary} />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: "-0.03em" }}>
                  {FINANCIAL_DATA.unusedSubs} Subs Ghosting
                </h3>
                <p style={{ color: C.onSurfaceVar, marginTop: 4, fontSize: 14 }}>Unused for 60+ days</p>
                <p style={{ color: C.error, marginTop: 6, fontSize: 12, fontWeight: 600 }}>
                  ₹{insights.subWaste.toLocaleString("en-IN")}/yr being burned
                </p>
                {/* Tension → Relief */}
                <p style={{ color: C.onSurfaceVar, marginTop: 4, fontSize: 11 }}>
                  Cancel all 3 →{" "}
                  <span style={{ color: C.primary, fontWeight: 700 }}>
                    recover ₹{FINANCIAL_DATA.subCostPerMonth.toLocaleString("en-IN")}/mo
                  </span>
                </p>
              </div>
            </div>
            <button style={{
              padding: "0 36px", height: 56,
              background: C.surfaceVariant, color: C.onSurface,
              border: "none", borderRadius: 10,
              fontFamily: "'Manrope', sans-serif", fontWeight: 700,
              fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em",
              display: "flex", alignItems: "center", gap: 10,
              transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHighest; e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = `0 0 16px ${C.primary}33`; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.surfaceVariant; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1.03)"}
            >
              Cancel Now
              <Icon name="arrow_forward" size={18} color="inherit" />
            </button>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => onTabChange("Insights")}
            style={{
              padding: "0 48px", height: 72,
              background: C.primary, color: C.onPrimary,
              border: "none", borderRadius: 10,
              fontFamily: "'Manrope', sans-serif", fontWeight: 900,
              fontSize: 14, textTransform: "uppercase", letterSpacing: "0.2em",
              boxShadow: `0 0 40px ${C.primary}33`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = `0 0 48px ${C.primary}55`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 0 40px ${C.primary}33`; }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1.04)"}
          >
            See Your Future →
          </button>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 3 — INSIGHTS / PROJECTIONS
// ═══════════════════════════════════════════════════════════════════════════

function InsightsScreen() {
  const scenarios = [
    {
      label: "Scenario 01", title: "Static Path",
      desc: "Maintaining current baseline with no further optimizations.",
      value: "₹1.18Cr", color: C.error, icon: "trending_flat",
    },
    {
      label: "Scenario 02", title: "Adaptive Path",
      desc: "Dynamic rebalancing and tax-loss harvesting applied monthly.",
      value: "₹4.04Cr", color: C.tertiary, icon: "trending_up",
    },
    {
      label: "Scenario 03 — Recommended", title: "Mastery Path",
      desc: "Maximum efficiency with consistent SIP and debt reduction.",
      value: "₹9.97Cr", color: C.primary, icon: "auto_awesome",
      featured: true,
    },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, position: "relative" }}>
      <GlowBlobs />
      <main className="fade-in" style={{
        position: "relative", zIndex: 1,
        padding: "104px 32px 120px",
        maxWidth: 1280, margin: "0 auto",
      }}>
        {/* Hero */}
        <section style={{ marginBottom: 64 }}>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900, fontSize: "clamp(40px, 6vw, 72px)",
            letterSpacing: "-0.04em", marginBottom: 16,
          }}>
            Your Future Self
          </h1>
          <p style={{ color: C.onSurfaceVar, fontSize: 16, maxWidth: 540, lineHeight: 1.6 }}>
            A predictive view of your financial trajectory based on your current velocity.
          </p>
          {/* Memory hook */}
          <p style={{ marginTop: 16, fontSize: 11, color: getFinancialState(FINANCIAL_DATA).color, opacity: 0.6, fontWeight: 600, letterSpacing: "0.05em" }}>
            {STICKY_LINE}
          </p>
        </section>

        {/* Scenario cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 80 }}>
          {scenarios.map(s => (
            <div key={s.title} style={{
              background: s.featured ? "#000" : C.surfaceLow,
              border: `1px solid ${s.featured ? C.primary + "1a" : C.outlineVar + "1a"}`,
              borderRadius: 16, padding: 40,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              minHeight: 420, position: "relative", overflow: "hidden",
              transition: "all 0.4s ease",
            }}
              onMouseEnter={e => { if (!s.featured) e.currentTarget.style.background = C.surfaceContainer; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 16px 48px rgba(0,0,0,0.4)`; }}
              onMouseLeave={e => { if (!s.featured) e.currentTarget.style.background = C.surfaceLow; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {s.featured && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(135deg, ${C.primary}0d, transparent)`,
                  pointerEvents: "none",
                }} />
              )}
              <div style={{ position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: s.color, display: "block", marginBottom: 24 }}>
                  {s.label}
                </span>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ color: C.onSurfaceVar, fontSize: 13, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "auto" }}>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: s.featured ? 60 : 48,
                  letterSpacing: "-0.04em",
                  color: s.color,
                  marginBottom: 8,
                  textShadow: s.featured ? `0 0 40px ${s.color}66` : "none",
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: C.onSurfaceVar }}>Projected at retirement</div>
              </div>
              {/* Icon watermark */}
              <div style={{
                position: "absolute", bottom: "-10%", right: "-10%",
                opacity: 0.1, pointerEvents: "none",
              }}>
                <Icon name={s.icon} size={200} color={s.color} />
              </div>
            </div>
          ))}
        </div>

        {/* Comparison bars */}
        <section style={{
          background: C.surfaceLow, borderRadius: 16, padding: 48, marginBottom: 64,
        }}>
          <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 40 }}>
            Cumulative Contrast
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 48, alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
              {[
                { label: "Static vs Mastery", badge: "+ 845% Variance", badgeColor: C.error, leftPct: 12, leftColor: C.error },
                { label: "Adaptive vs Mastery", badge: "+ 147% Variance", badgeColor: C.tertiary, leftPct: 40, leftColor: C.tertiary },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.onSurfaceVar }}>{row.label}</span>
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: row.badgeColor, fontWeight: 700 }}>{row.badge}</span>
                  </div>
                  <div style={{ height: 6, background: C.surfaceHighest, borderRadius: 3, overflow: "hidden", display: "flex" }}>
                    <div style={{ height: "100%", width: `${row.leftPct}%`, background: row.leftColor }} />
                    <div style={{ height: "100%", flex: 1, background: C.primary }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ maxWidth: 260, textAlign: "right" }}>
              <p style={{
                color: C.onSurfaceVar, lineHeight: 1.7, fontStyle: "italic", fontSize: 13,
                borderRight: `2px solid ${C.primary}`, paddingRight: 20,
              }}>
                "The difference between a static life and a mastered future is consistent, disciplined execution — month after month."
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button style={{
            padding: "0 80px", height: 72,
            background: C.primary, color: C.onPrimary,
            border: "none", borderRadius: 10,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900, fontSize: 18,
            boxShadow: `0 0 40px ${C.primary}33`,
            display: "flex", alignItems: "center", gap: 20,
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = `0 0 48px ${C.primary}55`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 0 40px ${C.primary}33`; }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1.04)"}
          >
            Optimise My Future
            <Icon name="arrow_forward" size={22} color={C.onPrimary} />
          </button>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 4 — MIRROR (Self-Reflection)
// ═══════════════════════════════════════════════════════════════════════════

function MirrorScreen() {
  const insights = getDerivedInsights(FINANCIAL_DATA);
  const fState = getFinancialState(FINANCIAL_DATA);
  const { value: scoreVal, done: scoreDone } = useCountUp(insights.healthScore, 1800);

  const scoreColor = insights.healthScore >= 60 ? C.primary : insights.healthScore >= 40 ? C.warning : C.error;

  // Final verdict based on data
  const finalVerdict = FINANCIAL_DATA.overspent > 0
    ? "You earn well. You spend emotionally. You save inconsistently."
    : "You're 2 habits away from financial independence.";

  const cardHover = {
    onMouseEnter: e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 16px 48px rgba(0,0,0,0.4)`; },
    onMouseLeave: e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; },
  };

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, position: "relative" }}>
      <GlowBlobs />
      <main className="fade-in" style={{
        position: "relative", zIndex: 1,
        padding: "104px 32px 140px",
        maxWidth: 960, margin: "0 auto",
      }}>

        {/* Final Verdict */}
        <section style={{ textAlign: "center", marginBottom: 64 }}>
          <Icon name="blur_on" size={48} color={C.primary} style={{ marginBottom: 24 }} />
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900, fontSize: "clamp(32px, 5vw, 52px)",
            letterSpacing: "-0.04em", lineHeight: 1.1,
            marginBottom: 24, color: C.onSurface,
          }}>
            The Mirror Speaks
          </h1>
          <p style={{
            fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 600,
            color: C.onSurfaceVar, lineHeight: 1.6, maxWidth: 560, margin: "0 auto",
            fontStyle: "italic",
          }}>
            "{finalVerdict}"
          </p>
          {/* Memory hook */}
          <p style={{ marginTop: 20, fontSize: 11, color: fState.color, opacity: 0.6, fontWeight: 600, letterSpacing: "0.05em" }}>
            {STICKY_LINE}
          </p>
        </section>

        {/* Health Score Dial */}
        <section style={{ display: "flex", justifyContent: "center", marginBottom: 64 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 200, height: 200, borderRadius: "50%",
              background: `conic-gradient(${scoreColor} ${scoreVal * 3.6}deg, ${C.surfaceHighest} ${scoreVal * 3.6}deg)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto",
              boxShadow: scoreDone ? `0 0 40px ${scoreColor}33` : "none",
              transition: "box-shadow 0.5s",
            }}>
              <div style={{
                width: 164, height: 164, borderRadius: "50%",
                background: C.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column",
              }}>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900, fontSize: 56, letterSpacing: "-0.04em",
                  color: scoreColor,
                  animation: scoreDone ? "heroBreath 3s ease-in-out infinite" : "none",
                }}>
                  {scoreVal}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginTop: 4 }}>
                  Mirror Score
                </span>
              </div>
            </div>
            <p style={{
              marginTop: 20, fontSize: 15, fontWeight: 700,
              color: scoreColor,
            }}>
              {insights.verdict}
            </p>
          </div>
        </section>

        {/* Bento Grid — Derived Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 64 }}>

          {/* Commitment Ratio */}
          <div style={{
            background: C.surfaceLow, borderRadius: 20, padding: 32,
            transition: "all 0.3s ease",
          }} {...cardHover}>
            <Icon name="lock" size={24} color={C.onSurfaceVar} style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginBottom: 8 }}>
              Commitment Ratio
            </p>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 40, letterSpacing: "-0.04em", color: C.onSurface }}>
              {insights.commitmentRatio}%
            </div>
            <p style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 8 }}>
              {insights.discretionaryPct}% is yours to control
            </p>
          </div>

          {/* Discretionary Freedom */}
          <div style={{
            background: C.surfaceLow, borderRadius: 20, padding: 32,
            transition: "all 0.3s ease",
          }} {...cardHover}>
            <Icon name="open_with" size={24} color={C.primary} style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginBottom: 8 }}>
              Discretionary Freedom
            </p>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 40, letterSpacing: "-0.04em", color: C.primary }}>
              ₹{(FINANCIAL_DATA.income - FINANCIAL_DATA.totalFixed).toLocaleString("en-IN")}
            </div>
            <p style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 8 }}>
              Monthly battlefield
            </p>
          </div>

          {/* Savings Gap */}
          <div style={{
            background: C.surfaceLow, borderRadius: 20, padding: 32,
            transition: "all 0.3s ease",
          }} {...cardHover}>
            <Icon name="trending_down" size={24} color={insights.savingsGap < 0 ? C.error : C.primary} style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginBottom: 8 }}>
              Savings Gap
            </p>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 40,
              letterSpacing: "-0.04em",
              color: insights.savingsGap < 0 ? C.error : C.primary,
            }}>
              ₹{Math.abs(insights.savingsGap).toLocaleString("en-IN")}
            </div>
            <p style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 8 }}>
              {insights.savingsGap < 0 ? "Short of your target" : "Above your target"}
            </p>
          </div>

          {/* Subscription Waste */}
          <div style={{
            background: C.surfaceLow, borderRadius: 20, padding: 32,
            transition: "all 0.3s ease",
          }} {...cardHover}>
            <Icon name="local_fire_department" size={24} color={C.error} style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfaceVar, marginBottom: 8 }}>
              Subscription Waste
            </p>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 40, letterSpacing: "-0.04em", color: C.error }}>
              ₹{insights.subWaste.toLocaleString("en-IN")}
            </div>
            <p style={{ fontSize: 11, color: C.onSurfaceVar, marginTop: 8 }}>
              Per year, going nowhere
            </p>
          </div>
        </div>

        {/* Reinforcing line */}
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 2, background: `${C.primary}33`, borderRadius: 1, margin: "0 auto 24px" }} />
          <p style={{
            fontSize: 13, color: C.onSurfaceVar, fontStyle: "italic", lineHeight: 1.7,
            maxWidth: 400, margin: "0 auto",
          }}>
            The mirror doesn't judge. It reflects. What you do next is your choice.
          </p>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const [screen, setScreen] = useState("onboarding"); // "onboarding" | "app"
  const [activeTab, setActiveTab] = useState("Home");

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (screen !== "app") setScreen("app");
  };

  return (
    <>
      {/* Inject global CSS once */}
      <style>{GLOBAL_CSS}</style>

      {screen === "onboarding" ? (
        <OnboardingScreen onComplete={() => setScreen("app")} />
      ) : (
        <div>
          <TopBar activeTab={activeTab} onTabChange={handleTabChange} />

          {activeTab === "Home" && <HomeScreen onTabChange={handleTabChange} />}
          {activeTab === "Insights" && <InsightsScreen />}
          {activeTab === "Mirror" && <MirrorScreen />}

          <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      )}
    </>
  );
}