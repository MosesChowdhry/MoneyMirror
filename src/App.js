import React, { useState, useEffect } from "react";

/* ================= DEFAULT DATA ================= */

const defaultData = {
  income: 0,
  fixed: { rent: 0 },
  lifestyle: {
    dining: 0,
    subscriptions: [],
  },
  savings: 0,
};

/* ================= SAFE STORAGE ================= */

function getData() {
  try {
    const d = JSON.parse(localStorage.getItem("mm_data"));

    return {
      income: Number(d?.income) || 0,
      fixed: {
        rent: Number(d?.fixed?.rent) || 0,
      },
      lifestyle: {
        dining: Number(d?.lifestyle?.dining) || 0,
        subscriptions: Array.isArray(d?.lifestyle?.subscriptions)
          ? d.lifestyle.subscriptions
          : [],
      },
      savings: Number(d?.savings) || 0,
    };
  } catch {
    return defaultData;
  }
}

function saveData(data) {
  localStorage.setItem("mm_data", JSON.stringify(data));
}

/* ================= ENGINE ================= */

function calculate(data) {
  const income = Number(data.income) || 0;
  const fixedTotal = Number(data.fixed.rent) || 0;

  const dining = Number(data.lifestyle.dining) || 0;
  const subs = data.lifestyle.subscriptions || [];

  const subTotal = subs.reduce((a, s) => a + Number(s.cost || 0), 0);
  const lifestyleTotal = dining + subTotal;

  const savings = Number(data.savings) || 0;
  const total = fixedTotal + lifestyleTotal + savings;
  const remaining = income - total;

  const burnRate = income ? total / income : 0;
  const disposable = income - fixedTotal;
  const lifestylePressure = disposable ? lifestyleTotal / disposable : 0;
  const savingsRate = income ? savings / income : 0;

  let stress = 0;
  if (burnRate > 1) stress += 40;
  if (fixedTotal / income > 0.5) stress += 20;
  if (lifestylePressure > 0.6) stress += 20;
  if (savingsRate < 0.1) stress += 20;

  const dailySpend = total / 30 || 1;
  const daysLeft = remaining > 0 ? Math.floor(remaining / dailySpend) : 0;
  const yearlyLeak = Math.max(0, -remaining) * 12;

  return {
    dining,
    subTotal,
    remaining,
    stress,
    daysLeft,
    yearlyLeak,
  };
}

/* ================= SETUP ================= */

function Setup({ onDone }) {
  const [data, setData] = useState(defaultData);

  return (
    <div style={{ padding: 40 }}>
      <h2>MoneyMirror Setup</h2>

      <input
        placeholder="Income"
        value={data.income}
        onChange={(e) =>
          setData({ ...data, income: Number(e.target.value) })
        }
      />

      <input
        placeholder="Rent"
        value={data.fixed.rent}
        onChange={(e) =>
          setData({
            ...data,
            fixed: { ...data.fixed, rent: Number(e.target.value) },
          })
        }
      />

      <input
        placeholder="Dining"
        value={data.lifestyle.dining}
        onChange={(e) =>
          setData({
            ...data,
            lifestyle: {
              ...data.lifestyle,
              dining: Number(e.target.value),
            },
          })
        }
      />

      <input
        placeholder="Savings"
        value={data.savings}
        onChange={(e) =>
          setData({ ...data, savings: Number(e.target.value) })
        }
      />

      <button onClick={() => onDone(data)}>Continue</button>
    </div>
  );
}

/* ================= HOME ================= */

function Home({ data, setScreen }) {
  const d = calculate(data);

  const state =
    d.stress > 60
      ? { label: "BLEEDING", color: "red" }
      : d.stress > 30
      ? { label: "PRESSURE", color: "orange" }
      : { label: "STABLE", color: "green" };

  return (
    <div style={{ padding: 30, background: "#0e0e0e", color: "white", minHeight: "100vh" }}>
      <h1 style={{ color: state.color }}>
        ₹{Math.max(0, -d.remaining)} {state.label}
      </h1>

      <p>Days Left: {d.daysLeft}</p>
      <p>Annual Leak: ₹{d.yearlyLeak}</p>

      <hr />

      <h3>Lifestyle</h3>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={card} onClick={() => setScreen("dining")}>
          🍽 Dining — ₹{d.dining}
        </div>

        <div style={card} onClick={() => setScreen("subs")}>
          📺 Subscriptions — ₹{d.subTotal}
        </div>
      </div>
    </div>
  );
}

/* ================= DINING ================= */

function Dining({ data, setData, goBack }) {
  const dining = data.lifestyle.dining || 0;

  return (
    <div style={{ padding: 30 }}>
      <button onClick={goBack}>← Back</button>

      <h2>Dining</h2>
      <p>₹{dining}</p>

      <button
        onClick={() => {
          const newVal = Math.round(dining * 0.8);
          setData((prev) => ({
            ...prev,
            lifestyle: { ...prev.lifestyle, dining: newVal },
          }));
        }}
      >
        Cut 20% → Save ₹{Math.round(dining * 0.2)}
      </button>
    </div>
  );
}

/* ================= SUBSCRIPTIONS ================= */

function Subscriptions({ data, setData, goBack }) {
  const subs = data.lifestyle?.subscriptions || [];

  const remove = (name) => {
    setData((prev) => ({
      ...prev,
      lifestyle: {
        ...prev.lifestyle,
        subscriptions: prev.lifestyle.subscriptions.filter(
          (s) => s.name !== name
        ),
      },
    }));
  };

  return (
    <div style={{ padding: 30 }}>
      <button onClick={goBack}>← Back</button>

      <h2>Subscriptions</h2>

      {subs.length === 0 && <p>No subscriptions yet</p>}

      {subs.map((s) => (
        <div key={s.name}>
          {s.name} ₹{s.cost} | renews in {s.renewal}d
          <button onClick={() => remove(s.name)}>Cancel</button>
        </div>
      ))}

      <button
        onClick={() => {
          const name = prompt("Name?");
          if (!name) return;

          const cost = Number(prompt("Cost?")) || 0;
          const renewal = Number(prompt("Days to renewal?")) || 0;

          setData((prev) => ({
            ...prev,
            lifestyle: {
              ...prev.lifestyle,
              subscriptions: [
                ...(prev.lifestyle.subscriptions || []),
                { name, cost, renewal, lastUsed: 0 },
              ],
            },
          }));
        }}
      >
        + Add Subscription
      </button>
    </div>
  );
}

/* ================= CARD ================= */

const card = {
  padding: 20,
  background: "#1a1a1a",
  borderRadius: 12,
  cursor: "pointer",
};

/* ================= ROOT ================= */

export default function App() {
  const [data, setData] = useState(getData());
  const [screen, setScreen] = useState(!data.income ? "setup" : "home");

  useEffect(() => {
    saveData(data);
  }, [data]);

  if (screen === "setup")
    return <Setup onDone={(d) => { setData(d); setScreen("home"); }} />;

  if (screen === "dining")
    return <Dining data={data} setData={setData} goBack={() => setScreen("home")} />;

  if (screen === "subs")
    return <Subscriptions data={data} setData={setData} goBack={() => setScreen("home")} />;

  return <Home data={data} setScreen={setScreen} />;
}