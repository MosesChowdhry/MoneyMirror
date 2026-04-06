import React, { useState } from "react";

/* ---------------- ENGINE ---------------- */

const num = (v) => Number(v) || 0;

function calc(data) {
  const income = num(data.income.salary) + num(data.income.other);

  const fixed =
    num(data.fixed.rent) +
    num(data.fixed.utilities) +
    num(data.fixed.emi);

  const lifestyle =
    num(data.lifestyle.dining) +
    num(data.lifestyle.transport) +
    num(data.lifestyle.shopping) +
    num(data.lifestyle.entertainment);

  const subs = data.subscriptions.reduce(
    (sum, s) => sum + num(s.amount),
    0
  );

  const spend = fixed + lifestyle + subs;
  const remaining = income - spend;

  let state = "STABLE";
  if (remaining < 0) state = "BLEEDING";
  else if (remaining < income * 0.2) state = "TIGHT";

  return { income, fixed, lifestyle, subs, spend, remaining, state };
}

/* ---------------- UI COMPONENTS (OUTSIDE APP) ---------------- */

const Field = React.memo(({ label, value, onChange }) => {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: "#aaa" }}>{label}</div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #333",
          background: "#111",
          color: "#fff",
        }}
      />
    </div>
  );
});

/* ---------------- SCREENS ---------------- */

function Home({ r, setScreen }) {
  return (
    <>
      <h1>₹{r.remaining}</h1>
      <p>{r.state}</p>

      <div onClick={() => setScreen("income")}>Income ₹{r.income}</div>
      <div onClick={() => setScreen("fixed")}>Fixed ₹{r.fixed}</div>
      <div onClick={() => setScreen("lifestyle")}>Lifestyle ₹{r.lifestyle}</div>
      <div onClick={() => setScreen("subs")}>Subs ₹{r.subs}</div>
    </>
  );
}

function Income({ data, update, setScreen }) {
  return (
    <>
      <button onClick={() => setScreen("home")}>← Back</button>
      <h2>Income</h2>

      <Field
        label="Salary"
        value={data.income.salary}
        onChange={(e) => update("income", "salary", e.target.value)}
      />

      <Field
        label="Other"
        value={data.income.other}
        onChange={(e) => update("income", "other", e.target.value)}
      />
    </>
  );
}

function Fixed({ data, update, setScreen }) {
  return (
    <>
      <button onClick={() => setScreen("home")}>← Back</button>
      <h2>Fixed</h2>

      <Field
        label="Rent"
        value={data.fixed.rent}
        onChange={(e) => update("fixed", "rent", e.target.value)}
      />

      <Field
        label="Utilities"
        value={data.fixed.utilities}
        onChange={(e) => update("fixed", "utilities", e.target.value)}
      />

      <Field
        label="EMI"
        value={data.fixed.emi}
        onChange={(e) => update("fixed", "emi", e.target.value)}
      />
    </>
  );
}

function Lifestyle({ data, update, setScreen }) {
  return (
    <>
      <button onClick={() => setScreen("home")}>← Back</button>
      <h2>Lifestyle</h2>

      {Object.entries(data.lifestyle).map(([k, v]) => (
        <Field
          key={k}
          label={k}
          value={v}
          onChange={(e) => update("lifestyle", k, e.target.value)}
        />
      ))}
    </>
  );
}

function Subs({ data, updateSub, addSub, setScreen }) {
  return (
    <>
      <button onClick={() => setScreen("home")}>← Back</button>
      <h2>Subscriptions</h2>

      <button onClick={addSub}>+ Add</button>

      {data.subscriptions.map((s) => (
        <div key={s.id}>
          <Field
            label="Name"
            value={s.name}
            onChange={(e) => updateSub(s.id, "name", e.target.value)}
          />

          <Field
            label="Amount"
            value={s.amount}
            onChange={(e) => updateSub(s.id, "amount", e.target.value)}
          />
        </div>
      ))}
    </>
  );
}

/* ---------------- APP ---------------- */

export default function App() {
  const [screen, setScreen] = useState("home");

  const [data, setData] = useState({
    income: { salary: "", other: "" },
    fixed: { rent: "", utilities: "", emi: "" },
    lifestyle: { dining: "", transport: "", shopping: "", entertainment: "" },
    subscriptions: [],
  });

  const r = calc(data);

  const update = (section, key, value) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const addSub = () => {
    setData((p) => ({
      ...p,
      subscriptions: [...p.subscriptions, { id: Date.now(), name: "", amount: "" }],
    }));
  };

  const updateSub = (id, field, value) => {
    setData((p) => ({
      ...p,
      subscriptions: p.subscriptions.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  return (
    <div style={{ padding: 20, background: "#0f1115", minHeight: "100vh", color: "#fff" }}>
      {screen === "home" && <Home r={r} setScreen={setScreen} />}
      {screen === "income" && <Income data={data} update={update} setScreen={setScreen} />}
      {screen === "fixed" && <Fixed data={data} update={update} setScreen={setScreen} />}
      {screen === "lifestyle" && <Lifestyle data={data} update={update} setScreen={setScreen} />}
      {screen === "subs" && (
        <Subs data={data} updateSub={updateSub} addSub={addSub} setScreen={setScreen} />
      )}
    </div>
  );
}