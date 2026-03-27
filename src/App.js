import { useState, useEffect, useRef } from "react";

/* ---------- COLORS ---------- */
const C = {
  bg: "#0e0e0e",
  surface: "#131313",
  surface2: "#1a1919",
  primary: "#3fff8b",
  onPrimary: "#005d2c",
  text: "#ffffff",
  sub: "#adaaaa",
};

/* ---------- HELPERS ---------- */
const format = (n) => "₹" + (n || 0).toLocaleString("en-IN");
const toNumber = (v) => Number(String(v).replace(/\D/g, "")) || 0;

/* ---------- INPUT FIELD ---------- */
function MoneyInput({ value, onChange }) {
  return (
    <input
      value={value || ""}
      onChange={(e) => onChange(toNumber(e.target.value))}
      style={{
        fontSize: 28,
        background: "transparent",
        border: "none",
        outline: "none",
        color: C.primary,
        width: "100%",
        textAlign: "right",
      }}
    />
  );
}

/* ---------- ONBOARDING ---------- */
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);

  const [data, setData] = useState({
    income: 0,
    fixed: { rent: 0, transport: 0, insurance: 0, debt: 0 },
    lifestyle: { dining: 0, shopping: 0, travel: 0, subscriptions: 0 },
    savings: 20000,
  });

  const refs = useRef([])

  const next = () => {
  const nextStep = Math.min(step + 1, 4);
  setStep(nextStep);

  requestAnimationFrame(() => {
    const el = refs.current[nextStep - 1];

    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  });

  if (nextStep === 4) {
    localStorage.setItem("moneyData", JSON.stringify(data));
    onComplete();
  }
};
console.log("DATA:", data);
  return (
    <div style={{
      background: C.bg,
      color: C.text,
      padding: "80px 24px",
      maxWidth: 700,
      margin: "0 auto",
    }}>

      {/* STEP 1 */}
      <section ref={ el => refs.current[0] =el} style={{ marginBottom: 120 }}>
        <h1 style={{ fontSize: 36, marginBottom: 20 }}>
          What enters each month?
        </h1>

        <input
          value= {data.income || ""}
          onChange={(e) =>
            setData({ ...data, income: toNumber(e.target.value) })
          }
          style={{
            fontSize: 64,
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.primary,
            width: "100%",
            textAlign: "center",
          }}
        />
      </section>

      {/* STEP 2 */}
        <section ref={el => refs.current[1]= el} style={{ marginBottom: 120, opacity: step>= 2 ? 1 : 0, pointerEvents: step >= 2? "auto" : "none"}}>
          <h2 style={{ marginBottom: 20 }}>Fixed Expenses</h2>

          {Object.entries(data.fixed).map(([k, v]) => (
            <div key={k} style={{
              background: C.surface,
              padding: 20,
              borderRadius: 12,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
            }}>
              <span style={{ textTransform: "capitalize" }}>{k}</span>
              <MoneyInput
                value={v}
                onChange={(val) =>
                  setData({
                    ...data,
                    fixed: { ...data.fixed, [k]: val },
                  })
                }
              />
            </div>
          ))}
        </section>
      

      {/* STEP 3 */}
      {step >= 3 && (
        <section ref={el => refs.current[2]= el} style={{ marginBottom: 120, opacity: step > 3 ? 2 : 1, pointerEvents: step >= 3 ? "auto" : "none" }}>
          <h2 style={{ marginBottom: 20 }}>Lifestyle</h2>

          {Object.entries(data.lifestyle).map(([k, v]) => (
            <div key={k} style={{
              background: C.surface,
              padding: 20,
              borderRadius: 12,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
            }}>
              <span style={{ textTransform: "capitalize" }}>{k}</span>
              <MoneyInput
                value={v}
                onChange={(val) =>
                  setData({
                    ...data,
                    lifestyle: { ...data.lifestyle, [k]: val },
                  })
                }
              />
            </div>
          ))}
        </section>
      )}

      {/* STEP 4 */}
      {step >= 4 && (
        <section ref={el => refs.current[3]= el} style={{ marginBottom: 120, opacity: step > 4 ? 3 : 2, pointerEvents: step >= 3 ? "auto" : "none"  }}>
          <h2 style={{ marginBottom: 20 }}>Savings Goal</h2>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h1 style={{ fontSize: 48, color: C.primary }}>
              {format(data.savings)}
            </h1>
          </div>

          <input
            type="range"
            min="0"
            max="200000"
            value={data.savings}
            onChange={(e) =>
              setData({ ...data, savings: Number(e.target.value) })
            }
            style={{ width: "100%" }}
          />
        </section>
      )}

      {/* CTA */}
      <button
        onClick={next}
        disabled={step ===1 && data.income === 0}
  
        style={{
          opacity: step === 1 && data.income === 0 ? 0.4 : 1,
          width: "100%",
          height: 64,
          background: C.primary,
          color: C.onPrimary,
          borderRadius: 10,
          fontWeight: 800,
          letterSpacing: "0.1em",
        }}
      >
        {step === 4 ? "SHOW ME THE TRUTH" : "CONTINUE →"}
      </button>
    </div>
  );
}

/* ---------- HOME ---------- */
function Home() {
  const [data, setData] = useState(null);

  useEffect(() => {
  const stored = localStorage.getItem("moneyData");
  console.log("STORED DATA:", stored); // 👈 ADD THIS

  if (stored) {
    setData(JSON.parse(stored));
  }
}, []);

  if (!data?.fixed || !data?.lifestyle) {
    return 
    <div style= {{ color: "white", padding: 40 }}> Corrupted data</div>
  };


  const totalFixed = Object.values(data.fixed).reduce((a, b) => a + b, 0);
  const totalLifestyle = Object.values(data.lifestyle).reduce((a, b) => a + b, 0);
  const total = totalFixed + totalLifestyle + data.savings;

  const remaining = data.income - total;
  const percent = data.income > 0 ? Math.round((total / data.income) * 100): 0;

  const biggest =
    Object.entries({ ...data.fixed, ...data.lifestyle })
      .sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{ padding: 40, color: "white", background: "#0e0e0e", minHeight: "100vh",}}>
      <h1 style={{ fontSize: 48 }}>{percent}% Utilized</h1>
      <h2>Remaining: {format(remaining)}</h2>
      <h3>Biggest: {biggest?.[0]}</h3>
    </div>
  );
}

/* ---------- APP ---------- */
export default function App() {
  const [done, setDone] = useState(false);

  return (
  <div style={{ background: "#0e0e0e", minHeight: "100vh" }}>
    {done ? (
      <Home />
    ) : (
      <Onboarding onComplete={() => setDone(true)} />
    )}
  </div>
);
}