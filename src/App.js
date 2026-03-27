import { useState, useRef } from "react";
 //comment test 1
// ─── Colour tokens (from Stitch Tailwind config) ───────────────────────────
const C = {
  bg:             "#0e0e0e",
  surface:        "#0e0e0e",
  surfaceLow:     "#131313",
  surfaceContainer:"#1a1919",
  surfaceHigh:    "#201f1f",
  surfaceHighest: "#262626",
  surfaceVariant: "#262626",
  primary:        "#3fff8b",
  primaryDim:     "#24f07e",
  onPrimary:      "#005d2c",
  tertiary:       "#7ae6ff",
  error:          "#ff716c",
  onSurface:      "#ffffff",
  onSurfaceVar:   "#adaaaa",
  outlineVar:     "#494847",
};
 
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
    { tab: "Home",     icon: "home_max" },
    { tab: "Insights", icon: "auto_awesome" },
    { tab: "Mirror",   icon: "blur_on" },
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
  const step2Ref = useRef(null);
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [income, setIncome] = useState(0);
  return (
  <div style={{ minHeight: "100dvh", background: "#0e0e0e" }}>

    {/* MAIN CONTENT */}
    <main style={{
      padding: "140px 32px 160px",
      maxWidth: 768,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 80,
      color: "white"
    }}>

      {/* STEP 1 */}
      {step >= 1 && (
        <section style={{ textAlign: "center" }}>
          <h1>Step 1 — Income</h1>
          <p>What enters the mirror each month?</p>
          <input
          type="number" placeholder= "Enter your Monthly income"
          value={income} onChange={(e) => setIncome(Number(e.target.value))}
          style={{
            marginTop: 20,
            padding: 16,
            width: "100%",
            bordrRadius: 8,
            border:"none",
            fontSize: 16,
          }}
/>
        </section>
      )}

      {/* STEP 2 */}
      {step >= 2 && (
        <section ref={step2Ref}>
         
          <h1>Step 2 — Expenses</h1>
          <p>Define your non-negotiables</p>
        </section>
      )}

      {/* STEP 3 */}
      {step >= 3 && (
        <section>
          <h1>Step 3 — Lifestyle</h1>
          <p>Where does money go?</p>
        </section>
      )}

      {/* STEP 4 */}
      {step >= 4 && (
        <section>
          <h1>Step 4 — Savings</h1>
          <p>Set your goal</p>
        </section>
      )}

    </main>

    {/* FIXED FOOTER (WORKING VERSION) */}
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "24px 32px 32px",
        background: `linear-gradient(to top, #0e0e0e 60%, transparent)`,
      }}
    >
      <div style={{ maxWidth: 768, margin: "0 auto" }}>

        {step < totalSteps ? (
          <button
            onClick={() => {
              setStep((s) => {
                const next = Math.min(s + 1, totalSteps);

                if (next === 2) {
                  setTimeout(() => {
                    step2Ref.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }, 100);
                }

                return next;
              });
            }}
            style={{
              width: "100%",
              height: 72,
              background: "#3fff8b",
              color: "#005d2c",
              fontWeight: 800,
              fontSize: 16,
              textTransform: "uppercase",
              borderRadius: 10,
            }}
          >
            Continue →
          </button>
        ) : (
          <button onClick={onComplete}>
            SHOW ME THE TRUTH
          </button>
        )}

      </div>
    </footer>

  </div>
);
}
 
// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 2 — HOME DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
 
function HomeScreen({ onTabChange }) {
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, position: "relative" }}>
      <GlowBlobs />
      <main className="fade-in" style={{
        position: "relative", zIndex: 1,
        padding: "104px 32px 140px",
        maxWidth: 1280, margin: "0 auto",
      }}>
        {/* Hero */}
        <section style={{ textAlign: "center", marginBottom: 80 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", color: C.onSurfaceVar, marginBottom: 16 }}>
            Monthly Reflection
          </p>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            fontSize: "clamp(48px, 8vw, 88px)",
            letterSpacing: "-0.04em", lineHeight: 0.95,
            color: C.primary,
          }}>
            ₹12,450<br />OVERSPENT
          </h1>
          <div style={{ width: 2, height: 48, background: `${C.primary}33`, borderRadius: 1, margin: "24px auto 0" }} />
        </section>
 
        {/* Bento grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16, marginBottom: 80 }}>
 
          {/* Card 1 — Committed */}
          <div style={{
            gridColumn: "span 7",
            background: C.surfaceLow, borderRadius: 24,
            padding: 40, display: "flex", flexDirection: "column", justifyContent: "space-between",
            minHeight: 220, transition: "background 0.3s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceContainer}
            onMouseLeave={e => e.currentTarget.style.background = C.surfaceLow}
          >
            <div>
              <Icon name="account_balance_wallet" size={36} color={C.onSurfaceVar} style={{ marginBottom: 20 }} />
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: "clamp(36px, 4vw, 52px)",
                letterSpacing: "-0.04em", color: C.onSurface,
              }}>
                62% Committed
              </h3>
            </div>
            <div style={{ marginTop: 40 }}>
              <div style={{ height: 2, background: C.surfaceVariant, borderRadius: 1, position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, height: "100%", width: "62%",
                  background: C.primary,
                  boxShadow: `0 0 15px ${C.primary}80`,
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
          }}>
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
              marginBottom: 16,
            }}>
              ₹4,200
            </div>
            <div style={{
              background: `${C.error}1a`, color: C.error,
              padding: "4px 14px", borderRadius: 20,
              fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em",
            }}>
              High
            </div>
          </div>
 
          {/* Card 3 — Ghosting subs (full width) */}
          <div style={{
            gridColumn: "span 12",
            background: "#000", borderRadius: 24,
            padding: "36px 40px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", flexWrap: "wrap", gap: 24,
            border: `1px solid ${C.outlineVar}0d`,
          }}>
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
                  3 Subs Ghosting
                </h3>
                <p style={{ color: C.onSurfaceVar, marginTop: 4, fontSize: 14 }}>Unused for 60+ days</p>
              </div>
            </div>
            <button style={{
              padding: "0 36px", height: 56,
              background: C.surfaceVariant, color: C.onSurface,
              border: "none", borderRadius: 10,
              fontFamily: "'Manrope', sans-serif", fontWeight: 700,
              fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em",
              display: "flex", alignItems: "center", gap: 10,
              transition: "background 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.surfaceBright}
              onMouseLeave={e => e.currentTarget.style.background = C.surfaceVariant}
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
              transition: "transform 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
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
              transition: "background 0.4s",
            }}
              onMouseEnter={e => !s.featured && (e.currentTarget.style.background = C.surfaceContainer)}
              onMouseLeave={e => !s.featured && (e.currentTarget.style.background = C.surfaceLow)}
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
            transition: "transform 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
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
 
          {activeTab === "Home"     && <HomeScreen     onTabChange={handleTabChange} />}
          {activeTab === "Insights" && <InsightsScreen />}
          {activeTab === "Mirror"   && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              minHeight: "100dvh", flexDirection: "column", gap: 20,
              color: "#3fff8b", fontFamily: "'Space Grotesk', sans-serif",
            }}>
              <Icon name="blur_on" size={64} color="#3fff8b" />
              <h2 style={{ fontWeight: 900, fontSize: 32, letterSpacing: "-0.03em" }}>Mirror</h2>
              <p style={{ color: "#adaaaa", fontSize: 14 }}>Coming soon</p>
            </div>
          )}
 
          <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      )}
    </>
  );
}