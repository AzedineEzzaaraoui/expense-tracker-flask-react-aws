import { useState, useEffect } from "react";
import "./index.css";

// ─── API URL depuis variable d'environnement ─────────────────────────────────
// En local  : définir VITE_API_URL=http://localhost:8080 avant de lancer vite
// En production S3 : définir VITE_API_URL sur l'URL publique du backend ou utiliser le fallback
const DEFAULT_BACKEND_URL = "http://35.170.79.161:8080";
const API_URL = import.meta.env.VITE_API_URL || DEFAULT_BACKEND_URL;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatAmount = (amount) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(amount);

const CATEGORIES = ["Alimentation", "Transport", "Logement", "Santé", "Loisirs", "Autre"];

const CAT_CONFIG = {
  "Alimentation": { icon: "🍔", color: "#10b981" },
  "Transport":    { icon: "🚗", color: "#3b82f6" },
  "Logement":     { icon: "🏠", color: "#8b5cf6" },
  "Santé":        { icon: "🏥", color: "#ef4444" },
  "Loisirs":      { icon: "🎮", color: "#f59e0b" },
  "Autre":        { icon: "💳", color: "#6b7280" },
};

// ─── API client — aligné avec Flask backend ──────────────────────────────────
const api = {
  // GET /transaction → { result: [...], count: N }
  getAll: () =>
    fetch(`${API_URL}/transaction`).then((r) => r.json()),

  // POST /transaction → body: { amount, desc, category }
  // Backend accepte : amount (float), desc (string), category (string)
  add: (amount, desc, category) =>
    fetch(`${API_URL}/transaction`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ amount: parseFloat(amount), desc, category }),
    }).then((r) => r.json()),

  // DELETE /transaction/<id>
  deleteOne: (id) =>
    fetch(`${API_URL}/transaction/${id}`, { method: "DELETE" }).then((r) => r.json()),

  // DELETE /transaction
  deleteAll: () =>
    fetch(`${API_URL}/transaction`, { method: "DELETE" }).then((r) => r.json()),
};

// ─── Composant principal ──────────────────────────────────────────────────────
export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [successMsg,   setSuccessMsg]   = useState("");
  const [form,         setForm]         = useState({ amount: "", desc: "", category: "Autre" });
  const [submitting,   setSubmitting]   = useState(false);
  const [confirmId,    setConfirmId]    = useState(null);
  const [activeTab,    setActiveTab]    = useState("dashboard");

  // ─── Fetch all transactions ───────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAll();
      // Backend retourne { result: [...], count: N }
      setTransactions(data.result || []);
    } catch {
      setError("Impossible de joindre l'API backend. Vérifiez que le serveur tourne sur " + API_URL);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ─── Add transaction ──────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.desc) return;
    const normalizedAmount = form.amount.toString().replace(',', '.');
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.add(normalizedAmount, form.desc, form.category);
      if (res.message && res.message.includes("succès")) {
        setForm({ amount: "", desc: "", category: "Autre" });
        showSuccess("Dépense ajoutée avec succès !");
        fetchAll();
      } else {
        setError(res.message || "Erreur lors de l'ajout.");
      }
    } catch {
      setError("Erreur lors de l'ajout de la transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete one ───────────────────────────────────────────────────────────
  const handleDeleteOne = async (id) => {
    try {
      await api.deleteOne(id);
      setConfirmId(null);
      showSuccess("Transaction supprimée.");
      fetchAll();
    } catch {
      setError("Erreur lors de la suppression.");
    }
  };

  // ─── Delete all ───────────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (!window.confirm("Supprimer toutes les transactions ?")) return;
    try {
      const res = await api.deleteAll();
      showSuccess(res.message || "Toutes les transactions supprimées.");
      fetchAll();
    } catch {
      setError("Erreur lors de la suppression.");
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // ─── Stats calculées depuis les données backend ───────────────────────────
  // Backend retourne : { id, amount, description, category, created_at }
  const total = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const avg   = transactions.length ? total / transactions.length : 0;
  const max   = transactions.length ? Math.max(...transactions.map((t) => parseFloat(t.amount || 0))) : 0;

  // ─── Styles ───────────────────────────────────────────────────────────────
  const s = {
    page:    { minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'Inter',system-ui,sans-serif" },
    header:  { background: "#1e293b", borderBottom: "1px solid #334155", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
    main:    { maxWidth: 1100, margin: "0 auto", padding: "32px 24px" },
    card:    { background: "#1e293b", borderRadius: 14, border: "1px solid #334155", overflow: "hidden", marginBottom: 20 },
    cardHdr: { padding: "18px 24px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" },
    kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 28 },
    kpi:     { background: "#1e293b", borderRadius: 14, padding: "20px 24px", border: "1px solid #334155" },
    input:   { width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "12px 16px", color: "#f1f5f9", fontSize: 14, outline: "none", boxSizing: "border-box" },
    btn:     (active) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, background: active ? "#6366f1" : "transparent", color: active ? "#fff" : "#94a3b8", fontWeight: active ? 600 : 400 }),
    submitBtn: (disabled) => ({ width: "100%", background: disabled ? "#4338ca" : "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }),
    alert:   (type) => ({ borderRadius: 10, padding: "12px 16px", marginBottom: 20, background: type === "error" ? "#fef2f2" : "#f0fdf4", border: `1px solid ${type === "error" ? "#fca5a5" : "#86efac"}`, color: type === "error" ? "#991b1b" : "#166534" }),
    txRow:   (i) => ({ display: "flex", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid #0f172a", gap: 14, background: i % 2 === 0 ? "#1e293b" : "#1a2540" }),
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💸</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#f1f5f9" }}>ExpenseTracker</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Flask API · MySQL · AWS Free Tier</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {[["dashboard","📊 Dashboard"],["transactions","📋 Transactions"],["ajouter","➕ Ajouter"]].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={s.btn(activeTab === tab)}>{label}</button>
          ))}
        </nav>
      </header>

      <main style={s.main}>

        {/* ── Alerts ── */}
        {error      && <div style={s.alert("error")}>⚠️ {error}</div>}
        {successMsg && <div style={s.alert("success")}>✅ {successMsg}</div>}

        {/* ════════════════════════════════════════════
            TAB : DASHBOARD
        ════════════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 24 }}>Vue d'ensemble</h2>

            {/* KPI cards */}
            <div style={s.kpiGrid}>
              {[
                { label: "Total dépenses",    value: formatAmount(total), icon: "💰", color: "#6366f1", sub: `${transactions.length} transactions` },
                { label: "Dépense moyenne",   value: formatAmount(avg),   icon: "📈", color: "#10b981", sub: "par transaction" },
                { label: "Plus haute",        value: formatAmount(max),   icon: "🔺", color: "#f59e0b", sub: "dépense enregistrée" },
                { label: "Transactions",      value: transactions.length, icon: "📅", color: "#8b5cf6", sub: "enregistrées" },
              ].map((k) => (
                <div key={k.label} style={s.kpi}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{k.label}</span>
                    <span style={{ fontSize: 22 }}>{k.icon}</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginBottom: 4 }}>{k.value}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Recent transactions */}
            <div style={s.card}>
              <div style={s.cardHdr}>
                <span style={{ fontWeight: 600, color: "#f1f5f9" }}>Transactions récentes</span>
                <button onClick={() => setActiveTab("transactions")} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 13 }}>Voir tout →</button>
              </div>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>⏳ Chargement depuis l'API...</div>
              ) : transactions.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <div>Aucune transaction. <button onClick={() => setActiveTab("ajouter")} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer" }}>Ajoutez-en une !</button></div>
                </div>
              ) : transactions.slice(0, 5).map((t, i) => {
                // Backend retourne : t.id, t.amount, t.description, t.category, t.created_at
                const cat = t.category || "Autre";
                const cfg = CAT_CONFIG[cat] || CAT_CONFIG["Autre"];
                return (
                  <div key={t.id} style={s.txRow(i)}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cfg.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: "#e2e8f0", fontSize: 14 }}>{t.description}</div>
                      <div style={{ marginTop: 3 }}>
                        <span style={{ background: cfg.color + "22", color: cfg.color, padding: "2px 8px", borderRadius: 20, fontSize: 11 }}>{cat}</span>
                        {t.created_at && <span style={{ color: "#64748b", fontSize: 11, marginLeft: 8 }}>{t.created_at}</span>}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: "#f87171", fontSize: 16 }}>- {formatAmount(t.amount)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB : TRANSACTIONS
        ════════════════════════════════════════════ */}
        {activeTab === "transactions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
                Toutes les transactions
                <span style={{ fontSize: 14, color: "#64748b", fontWeight: 400, marginLeft: 10 }}>({transactions.length})</span>
              </h2>
              {transactions.length > 0 && (
                <button onClick={handleDeleteAll} style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  🗑️ Tout supprimer
                </button>
              )}
            </div>
            <div style={s.card}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 140px 120px 100px", padding: "12px 20px", borderBottom: "1px solid #334155", fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                <span>ID</span><span>Description</span><span>Catégorie</span><span style={{ textAlign: "right" }}>Montant</span><span style={{ textAlign: "right" }}>Action</span>
              </div>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>⏳ Chargement...</div>
              ) : transactions.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Aucune transaction enregistrée.</div>
              ) : transactions.map((t, i) => {
                const cat = t.category || "Autre";
                const cfg = CAT_CONFIG[cat] || CAT_CONFIG["Autre"];
                return (
                  <div key={t.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 140px 120px 100px", padding: "14px 20px", borderBottom: i < transactions.length - 1 ? "1px solid #0f172a" : "none", alignItems: "center", background: i % 2 === 0 ? "#1e293b" : "#1a2540" }}>
                    <span style={{ color: "#64748b", fontSize: 13 }}>#{t.id}</span>
                    <div>
                      <div style={{ color: "#e2e8f0", fontSize: 14 }}>{t.description}</div>
                      {t.created_at && <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{t.created_at}</div>}
                    </div>
                    <span style={{ background: cfg.color + "22", color: cfg.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, display: "inline-block" }}>{cat}</span>
                    <span style={{ color: "#f87171", fontWeight: 700, textAlign: "right" }}>{formatAmount(t.amount)}</span>
                    <div style={{ textAlign: "right" }}>
                      {confirmId === t.id ? (
                        <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => handleDeleteOne(t.id)} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>Oui</button>
                          <button onClick={() => setConfirmId(null)} style={{ background: "#334155", color: "#94a3b8", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>Non</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(t.id)} style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>🗑️</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB : AJOUTER
        ════════════════════════════════════════════ */}
        {activeTab === "ajouter" && (
          <div style={{ maxWidth: 520 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 24 }}>Ajouter une dépense</h2>
            <div style={{ ...s.card, padding: 28 }}>
              <form onSubmit={handleAdd}>

                {/* Montant */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
                    Montant (MAD) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="number" step="0.01" min="0.01" placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    style={s.input}
                    required
                  />
                </div>

                {/* Description → envoyé comme "desc" au backend */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
                    Description <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text" placeholder="Ex: Courses Marjane..."
                    value={form.desc}
                    onChange={(e) => setForm({ ...form, desc: e.target.value })}
                    style={s.input}
                    maxLength={255}
                    required
                  />
                </div>

                {/* Catégorie → envoyée comme "category" au backend */}
                <div style={{ marginBottom: 28 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
                    Catégorie
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {CATEGORIES.map((cat) => {
                      const cfg = CAT_CONFIG[cat];
                      const active = form.category === cat;
                      return (
                        <button
                          key={cat} type="button"
                          onClick={() => setForm({ ...form, category: cat })}
                          style={{ padding: "7px 14px", borderRadius: 20, border: "1px solid", borderColor: active ? cfg.color : "#334155", background: active ? cfg.color + "22" : "transparent", color: active ? cfg.color : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400 }}
                        >
                          {cfg.icon} {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" disabled={submitting || !form.amount || !form.desc} style={s.submitBtn(submitting || !form.amount || !form.desc)}>
                  {submitting ? "Ajout en cours..." : "➕ Ajouter la dépense"}
                </button>
              </form>
            </div>

            {/* Résumé rapide */}
            <div style={{ ...s.card, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Résumé rapide</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 22, fontWeight: 700, color: "#6366f1" }}>{transactions.length}</div><div style={{ fontSize: 12, color: "#64748b" }}>transactions</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>{formatAmount(total)}</div><div style={{ fontSize: 12, color: "#64748b" }}>total dépensé</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{formatAmount(avg)}</div><div style={{ fontSize: 12, color: "#64748b" }}>moyenne</div></div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
