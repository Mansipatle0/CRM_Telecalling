// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

/**
 * AdminDashboard.jsx — Full-featured Premium CRM frontend (single file)
 *
 * Notes:
 * - No dummy data seeded here (per your request). Frontend fetches from API endpoints.
 * - Provide `token` prop (Bearer). If token absent, requests are sent without Authorization header.
 * - Configure API base via VITE_API_URL in .env, or pass API_BASE const below.
 *
 * Required endpoints (backend `index.js` should provide these):
 * AUTH / session
 * GET  /api/users
 * POST /api/users
 * PUT  /api/users/:id
 * DELETE /api/users/:id
 * PATCH /api/users/:id (e.g., suspend/targets)
 *
 * Leads:
 * GET  /api/leads
 * POST /api/leads
 * PUT  /api/leads/:id
 * DELETE /api/leads/:id
 * POST /api/leads/import
 * POST /api/leads/merge  { keepId, mergeIds }
 *
 * Calls:
 * GET  /api/calls
 * POST /api/calls
 * POST /api/calls/recording  (multipart)
 * POST /api/call/outbound      (initiate outbound via Twilio/Exotel)
 *
 * Campaigns:
 * GET  /api/campaigns
 * POST /api/campaigns
 * GET  /api/campaigns/:id/stats
 *
 * Workflows/Automation:
 * GET  /api/workflows
 * POST /api/workflows
 * POST /api/workflows/trigger  (simulate)
 *
 * Analytics:
 * GET /api/analytics/overview
 * GET /api/analytics/funnel
 * GET /api/analytics/forecast
 *
 * Integrations:
 * POST /api/integrations/twilio/test
 * POST /api/integrations/whatsapp/test
 *
 * Billing:
 * GET /api/plans
 * POST /api/invoices
 *
 * Audit:
 * GET /api/audit
 *
 * Replace API paths in backend to match these if needed.
 */

const API = import.meta.env.VITE_API_URL || ""; // set in .env: VITE_API_URL=http://localhost:3000
const authHeaders = (token) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {});

const COLORS = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#b07aa1"];

export default function AdminDashboard({ token, onLogout }) {
  // Core data
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [calls, setCalls] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [analytics, setAnalytics] = useState({ overview: null, funnel: null, forecast: null });

  // UI state
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [editItem, setEditItem] = useState(null);

  // filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // alerts
  const [alerts, setAlerts] = useState([]);

  // branding & theme
  const [company, setCompany] = useState({ name: "MyCRM", color: "#0ea5a4", logoUrl: "" });
  const [darkMode, setDarkMode] = useState(false);

  // file refs
  const fileRef = useRef();
  const recordingRef = useRef();

  // quick helper for API calls
  const apiGet = (path) => axios.get(`${API}${path}`, authHeaders(token));
  const apiPost = (path, body, cfg) => axios.post(`${API}${path}`, body, { ...authHeaders(token), ...(cfg || {}) });
  const apiPut = (path, body) => axios.put(`${API}${path}`, body, authHeaders(token));
  const apiDelete = (path) => axios.delete(`${API}${path}`, authHeaders(token));
  const apiPatch = (path, body) => axios.patch(`${API}${path}`, body, authHeaders(token));

  // initial fetch
  useEffect(() => {
    fetchAll();
    // apply theme
    document.documentElement.style.setProperty("--crm-accent", company.color);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--crm-accent", company.color);
  }, [company.color]);

  async function fetchAll() {
    setLoading(true);
    try {
      const requests = [
        apiGet("/api/users").catch(() => ({ data: [] })),
        apiGet("/api/leads").catch(() => ({ data: [] })),
        apiGet("/api/calls").catch(() => ({ data: [] })),
        apiGet("/api/campaigns").catch(() => ({ data: [] })),
        apiGet("/api/workflows").catch(() => ({ data: [] })),
        apiGet("/api/plans").catch(() => ({ data: [] })),
        apiGet("/api/audit").catch(() => ({ data: [] })),
        apiGet("/api/analytics/overview").catch(() => ({ data: null })),
        apiGet("/api/analytics/funnel").catch(() => ({ data: null })),
        apiGet("/api/analytics/forecast").catch(() => ({ data: null })),
      ];
      const [
        uRes, lRes, cRes, campRes, wfRes, pRes, aRes, ovRes, fuRes, fcRes,
      ] = await Promise.all(requests);
      console.log("📦 Full Leads Response:", lRes);
      console.log("📦 Leads Response Data:", lRes.data);

      setUsers(uRes.data?.data || []); 
      setLeads(lRes.data?.data || []);
      setCalls(cRes.data?.data || []);
      setCampaigns(campRes.data?.data || []);
      setWorkflows(wfRes.data || []);
      setPlans(pRes.data || []);
      setAuditLogs(aRes.data || []);
      setAnalytics({ overview: ovRes.data || null, funnel: fuRes.data || null, forecast: fcRes.data || null });

      generateAlerts(lRes.data?.data || [], cRes.data?.data || []);

    } catch (err) {
      console.error("fetchAll error", err);
    } finally {
      setLoading(false);
    }
  }

    // ✅ Send campaign email
  const sendCampaignEmail = async (campaignId) => {
    try {
      const res = await axios.post(
        `http://localhost:4000/api/campaigns/${campaignId}/email`,
        {
          recipients: [{ email: "receiver@gmail.com" }], // test email
          subject: "CRM Campaign Test",
          message: "This is a live test email from your CRM dashboard!"
        }
      );

      alert(`✅ Email sent successfully to ${res.data.sent || 1} recipient(s)!`);
      fetchAll(); // refresh data so 'sent' count updates
    } catch (err) {
      console.error("❌ Email send failed:", err);
      alert("Failed to send email. Check console for details.");
    }
  };

  // Alerts based on next_follow_up and statuses
  function generateAlerts(leadsArr = [], callsArr = []) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todaysFollowups = (leadsArr.filter((l) => l.next_follow_up === today)).length;
    const pending = (leadsArr.filter((l) => ["pending", "follow-up"].includes((l.status || "").toLowerCase()))).length;
    const missed = (leadsArr.filter((l) => l.next_follow_up && new Date(l.next_follow_up) < now)).length;
    const arr = [];
    if (todaysFollowups) arr.push(`📅 ${todaysFollowups} follow-ups for today`);
    if (pending) arr.push(`⏳ ${pending} pending items`);
    if (missed) arr.push(`⚠️ ${missed} missed follow-ups`);
    setAlerts(arr);
  }

  // ---------------- CRUD handlers ----------------
  async function createUser(data) {
    await apiPost("/api/users", data);
    await fetchAll();
  }
  async function updateUser(id, data) {
    await apiPut(`/api/users/${id}`, data);
    await fetchAll();
  }
  async function deleteUser(id) {
    if (!confirm("Delete user?")) return;
    await apiDelete(`/api/users/${id}`);
    await fetchAll();
  }
  async function toggleSuspendUser(id, suspended) {
    await apiPatch(`/api/users/${id}`, { suspended: !!suspended });
    await fetchAll();
  }
  async function setTarget(userId, target) {
    await apiPatch(`/api/users/${userId}`, { daily_target: target });
    await fetchAll();
  }

  async function createLead(data) {
    // compute simple score if not present — backend should do this too
    if (!data.score) data.score = computeScore(data);
    await apiPost("/api/leads", data).catch(e => { throw e; });
    await fetchAll();
  }
  async function updateLead(id, data) {
    await apiPut(`/api/leads/${id}`, data);
    await fetchAll();
  }
  async function deleteLead(id) {
    if (!confirm("Delete lead?")) return;
    await apiDelete(`/api/leads/${id}`);
    await fetchAll();
  }
  async function importLeads(arrayOfLeads) {
    await apiPost("/api/leads/import", { leads: arrayOfLeads });
    await fetchAll();
  }
  async function mergeLeads(keepId, mergeIds) {
    if (!keepId || !mergeIds || mergeIds.length === 0) return alert("Provide keepId and mergeIds");
    await apiPost("/api/leads/merge", { keepId, mergeIds });
    await fetchAll();
  }

  async function createCall(payload) {
    await apiPost("/api/calls", payload);
    await fetchAll();
  }
  async function uploadCallRecording(leadId, userId, file) {
    const fd = new FormData();
    fd.append("recording", file);
    fd.append("leadId", leadId);
    fd.append("userId", userId);
    await apiPost("/api/calls/recording", fd, { headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "multipart/form-data" } });
    await fetchAll();
  }
  async function outboundCall(to, from) {
    await apiPost("/api/call/outbound", { to, from });
  }

  async function createCampaign(data) {
    await apiPost("/api/campaigns", data);
    await fetchAll();
  }
  async function createWorkflow(data) {
    await apiPost("/api/workflows", data);
    await fetchAll();
  }
  async function triggerWorkflow(id) {
    await apiPost("/api/workflows/trigger", { id });
  }

  // ---------------- Scoring / AI placeholders ----------------
  function computeScore(lead) {
    let score = 0;
    if (lead.email) score += 10;
    if (lead.phone) score += 20;
    if ((lead.source || "").toLowerCase() === "website") score += 5;
    if ((lead.type || "").toLowerCase() === "insurance") score += 8;
    return score + Math.floor(Math.random() * 10);
  }
  async function requestAiRecommendation(lead) {
    // backend should provide /api/ai/recommend or /api/ai/score
    try {
      const res = await apiPost("/api/ai/score", lead);
      return res.data;
    } catch (e) {
      // fallback: local suggestion
      return { score: computeScore(lead), suggestion: "Call within 24h; set follow-up" };
    }
  }

  // ---------------- Exports / Imports ----------------
  function exportLeadsExcel(rows = leads) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  function exportLeadsPDF(rows = leads) {
    const doc = new jsPDF();
    doc.setFontSize(10);
    let y = 12;
    doc.text(`${company.name} - Leads Export`, 10, 10);
    rows.slice(0, 200).forEach((r, i) => {
      doc.text(`${i + 1}. ${r.name || "-"} | ${r.phone || "-"} | ${r.status || "-"}`, 10, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 12; }
    });
    doc.save(`leads_export_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ---------------- Filters / Pagination ----------------
  const filteredLeads = useMemo(() => {
    let data = [...leads];
    const q = (searchTerm || "").trim().toLowerCase();
    if (q) {
      data = data.filter((it) => (it.name || "").toLowerCase().includes(q) || (it.phone || "").toLowerCase().includes(q) || (it.email || "").toLowerCase().includes(q));
    }
    if (filterStatus) data = data.filter((l) => (l.status || "").toLowerCase() === filterStatus.toLowerCase());
    if (filterType) data = data.filter((l) => (l.type || "").toLowerCase() === filterType.toLowerCase());
    if (filterUser) data = data.filter((l) => String(l.assigned_to || "") === String(filterUser));
    if (dateFrom) data = data.filter((l) => l.created_at && (new Date(l.created_at) >= new Date(dateFrom)));
    if (dateTo) data = data.filter((l) => l.created_at && (new Date(l.created_at) <= new Date(dateTo)));
    return data;
  }, [leads, searchTerm, filterStatus, filterType, filterUser, dateFrom, dateTo]);

  const paginated = (arr) => {
    const start = (currentPage - 1) * itemsPerPage;
    return arr.slice(start, start + itemsPerPage);
  };

  // ---------------- Analytics derived data ----------------
  const leadsBySource = useMemo(() => {
    const map = {};
    leads.forEach((l) => { const s = l.source || "unknown"; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const funnel = useMemo(() => {
    // if backend provides funnel in analytics.funnel, use it
    if (analytics.funnel && analytics.funnel.stages) return analytics.funnel;
    const stages = ["new", "contacted", "qualified", "won"];
    const counts = stages.map((s) => leads.filter((l) => (l.status || "").toLowerCase() === s).length);
    return { stages, counts };
  }, [leads, analytics]);

  const dailyCallSummary = useMemo(() => {
    const map = {};
    calls.forEach((c) => {
      const d = (c.date || c.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count })).sort((a, b) => b.date.localeCompare(a.date));
  }, [calls]);

  const conversionsByUser = useMemo(() => {
    const map = {};
    users.forEach((u) => (map[u.id] = { name: u.name, converted: 0, total: 0 }));
    leads.forEach((l) => {
      const uid = l.assigned_to;
      if (!map[uid]) map[uid] = { name: uid || "Unassigned", converted: 0, total: 0 };
      map[uid].total += 1;
      if (["converted", "closed", "won"].includes((l.status || "").toLowerCase())) map[uid].converted += 1;
    });
    return Object.values(map).map((v) => ({ name: v.name, converted: v.converted, total: v.total }));
  }, [users, leads]);

  const topPerformers = useMemo(() => {
    return [...conversionsByUser].sort((a, b) => (b.converted || 0) - (a.converted || 0)).slice(0, 5);
  }, [conversionsByUser]);

  // ---------------- Utilities ----------------
  function findDuplicates() {
    const map = {};
    leads.forEach((l) => {
      const key = ((l.phone || "") + "|" + (l.email || "")).trim();
      if (!key) return;
      map[key] = map[key] || [];
      map[key].push(l);
    });
    return Object.entries(map).filter(([, vals]) => vals.length > 1).map(([k, vals]) => ({ key: k, values: vals }));
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        await importLeads(json);
        alert("Import succeeded");
      } catch (err) {
        console.error(err);
        alert("Import failed");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function simulateCall(lead) {
    if (!confirm(`Simulate call to ${lead.name} (${lead.phone})?`)) return;
    await createCall({ lead_id: lead.id, user_id: users[0]?.id, duration: Math.floor(Math.random() * 300), outcome: "simulated" });
    alert("Call simulated");
  }

  // ---------------- Render ----------------
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", background: darkMode ? "#0b1220" : "#f8fafc", color: darkMode ? "#e6eef6" : "#111827" }}>
      {/* Sidebar */}
      <div style={{ width: 240, background: darkMode ? "#071029" : "#0f172a", color: "#fff", padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: company.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{(company.name || "C")[0]}</div>
          <div>
            <h3 style={{ margin: 0 }}>{company.name}</h3>
            <small style={{ opacity: 0.9 }}>{users.length} users • {leads.length} leads</small>
          </div>
        </div>

        <nav style={{ marginTop: 18, display: "grid", gap: 6 }}>
          {["dashboard", "users", "leads", "calls", "campaigns", "automation", "integrations", "team", "billing", "settings", "audit"].map((tab) => (
            <div key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
              style={{
                padding: 10,
                borderRadius: 6,
                cursor: "pointer",
                background: activeTab === tab ? company.color : "transparent",
                color: activeTab === tab ? "#fff" : "#cbd5e1",
              }}>
              {tab === "dashboard" && "📊 Dashboard"}
              {tab === "users" && "👥 Users"}
              {tab === "leads" && "📞 Leads"}
              {tab === "calls" && "📁 Call Logs"}
              {tab === "campaigns" && "📣 Campaigns"}
              {tab === "automation" && "⚡ Automation"}
              {tab === "integrations" && "🔗 Integrations"}
              {tab === "team" && "👥 Team"}
              {tab === "billing" && "💳 Billing"}
              {tab === "settings" && "⚙️ Settings"}
              {tab === "audit" && "🕵️ Audit"}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: 16 }}>
          <input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #e2e8f0" }} />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button onClick={() => setDarkMode(!darkMode)} style={{ padding: 8, borderRadius: 6, background: darkMode ? "#111827" : "#fff", color: darkMode ? "#fff" : "#111827" }}>{darkMode ? "Light" : "Dark"}</button>
          <button onClick={() => { if (onLogout) onLogout(); }} style={{ padding: 8, borderRadius: 6, background: "#ef4444", color: "#fff" }}>Logout</button>
        </div>

        <div style={{ marginTop: 18, color: "#cbd5e1" }}>
          <strong>Alerts</strong>
          <ul>
            {alerts.length === 0 ? <li style={{ color: "#94a3b8" }}>No alerts</li> : alerts.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Admin Dashboard</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={fetchAll} style={{ padding: 8, borderRadius: 6, background: company.color, color: "#fff", border: "none" }}>Refresh</button>
            <button onClick={() => exportLeadsExcel()} style={{ padding: 8, borderRadius: 6 }}>Export XLSX</button>
            <button onClick={() => exportLeadsPDF()} style={{ padding: 8, borderRadius: 6 }}>Export PDF</button>
          </div>
        </div>

        {loading && <div style={{ padding: 12, background: darkMode ? "#071029" : "#fff", borderRadius: 8 }}>Loading...</div>}

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
              <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13 }}>Total Leads</h3>
                <p style={{ fontSize: 22, marginTop: 6 }}>{leads.length}</p>
              </div>
              <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13 }}>Today's follow-ups</h3>
                <p style={{ fontSize: 22, marginTop: 6 }}>{leads.filter(l => l.next_follow_up === (new Date().toISOString().slice(0, 10))).length}</p>
              </div>
              <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13 }}>Pending Calls</h3>
                <p style={{ fontSize: 22, marginTop: 6 }}>{leads.filter(l => ["pending", "follow-up"].includes((l.status || "").toLowerCase())).length}</p>
              </div>
              <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13 }}>Conversions</h3>
                <p style={{ fontSize: 22, marginTop: 6 }}>{leads.filter(l => ["converted", "closed", "won"].includes((l.status || "").toLowerCase())).length}</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
                <h3 style={{ marginTop: 0 }}>Funnel</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funnel.stages.map((s, i) => ({ stage: funnel.stages[i], value: funnel.counts[i] }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill={company.color} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
                <h3 style={{ marginTop: 0 }}>Forecast (next days)</h3>
                {analytics.forecast ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={(analytics.forecast.series || []).slice(0, 14).map(i => ({ date: i.date, value: i.value }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: "#6b7280" }}>Forecast endpoint missing: GET /api/analytics/forecast</div>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
                <h3>Leads by Source</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={leadsBySource} dataKey="value" nameKey="name" outerRadius={80} label>
                      {leadsBySource.map((entry, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
                <h3>Recent Calls (summary)</h3>
                <ul>
                  {dailyCallSummary.slice(0, 7).map((s, i) => <li key={i}>{s.date}: {s.count} calls</li>)}
                </ul>
              </div>
            </div>
          </>
        )}

       {/* USERS */}
{activeTab === "users" && (
  <div
    style={{
      background: darkMode ? "linear-gradient(145deg, #071029, #0b1226)" : "linear-gradient(145deg, #f9fafb, #ffffff)",
      padding: "16px",
      borderRadius: "12px",
      boxShadow: darkMode ? "0 4px 15px rgba(0,0,0,0.3)" : "0 4px 10px rgba(0,0,0,0.05)",
      transition: "all 0.3s",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
      <h3 style={{ color: darkMode ? "#fff" : "#111827", margin: 0, fontSize: "1.2rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
        👥 Users
      </h3>
      <button
        onClick={() => { setModalType("user_create"); setEditItem(null); setModalOpen(true); }}
        style={{
          background: "linear-gradient(90deg, #2563eb, #3b82f6)",
          color: "#fff",
          border: "none",
          padding: "8px 16px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 500,
          transition: "all 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
        onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
      >
        + Add User
      </button>
    </div>

    <div style={{ overflowX: "auto", borderRadius: "12px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: darkMode ? "#1e293b" : "#f1f5f9" }}>
          <tr>
            {["Name", "Email", "Role", "Target", "Actions"].map(header => (
              <th key={header} style={{ padding: "10px", fontWeight: 600, color: darkMode ? "#e2e8f0" : "#374151", borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated(users).map((u, index) => (
            <tr
              key={u.id}
              style={{
                background: index % 2 === 0 ? (darkMode ? "#111827" : "#fff") : (darkMode ? "#1e293b" : "#f9fafb"),
                borderBottom: "1px solid #e5e7eb",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#1c2a4a" : "#e0f2fe"}
              onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? (darkMode ? "#111827" : "#fff") : (darkMode ? "#1e293b" : "#f9fafb")}
            >
              <td style={{ padding: "10px" }}>{u.name}</td>
              <td style={{ padding: "10px" }}>{u.email}</td>
              <td style={{ padding: "10px" }}>{u.role}</td>
              <td style={{ padding: "10px" }}>{u.daily_target || "-"}</td>

              {/* Actions Column (text buttons for cleaner UI) */}
              <td style={{ padding: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  onClick={() => { setModalType("user_edit"); setEditItem(u); setModalOpen(true); }}
                  title="Edit User"
                  style={{
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    transition: "all 0.12s"
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => toggleSuspendUser(u.id, !u.suspended)}
                  title={u.suspended ? "Unsuspend User" : "Suspend User"}
                  style={{
                    background: u.suspended ? "#10b981" : "#f59e0b",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    transition: "all 0.12s",
                  }}
                >
                  {u.suspended ? "Unsuspend" : "Suspend"}
                </button>

                <button
                  onClick={() => deleteUser(u.id)}
                  title="Delete User"
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    transition: "all 0.12s"
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Pagination */}
    <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
      {Array.from({ length: Math.max(1, Math.ceil(users.length / itemsPerPage)) }).map((_, i) => (
        <button
          key={i}
          onClick={() => setCurrentPage(i + 1)}
          style={{
            background: currentPage === i + 1 ? "#2563eb" : darkMode ? "#1e293b" : "#f3f4f6",
            color: currentPage === i + 1 ? "#fff" : darkMode ? "#e2e8f0" : "#111827",
            border: "none",
            padding: "6px 10px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  </div>
)}

       {/* LEADS */}
{activeTab === "leads" && (
  <div
    style={{
      background: darkMode
        ? "linear-gradient(145deg, #0b1226, #1e1e2a)"
        : "linear-gradient(145deg, #f9fafb, #ffffff)",
      padding: "24px",
      borderRadius: "12px",
      boxShadow: darkMode
        ? "0 4px 15px rgba(0,0,0,0.3)"
        : "0 4px 10px rgba(0,0,0,0.05)",
      transition: "all 0.3s",
    }}
  >
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
      <h2 style={{ color: darkMode ? "#fff" : "#111827", margin: 0, fontSize: "1.3rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
        📋 Leads Management
      </h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {/* Add Lead */}
        <button
          onClick={() => { setModalType("lead_create"); setEditItem(null); setModalOpen(true); }}
          style={{
            background: "linear-gradient(90deg, #2563eb, #3b82f6)",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 500,
            transition: "all 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          + Add Lead
        </button>

        {/* Import */}
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            background: darkMode ? "#1e293b" : "#f3f4f6",
            color: darkMode ? "#e2e8f0" : "#111827",
            border: "1px solid #d1d5db",
            padding: "8px 14px",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          📥 Import
        </button>
        <input
          ref={fileRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileImport}
          accept=".csv,.xlsx,.xls"
        />

        {/* Export */}
        <button onClick={() => exportLeadsExcel()}
          style={{
            background: darkMode ? "#1e293b" : "#f3f4f6",
            color: darkMode ? "#e2e8f0" : "#111827",
            border: "1px solid #d1d5db",
            padding: "8px 14px",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          📄 Excel
        </button>

        <button onClick={() => exportLeadsPDF()}
          style={{
            background: darkMode ? "#1e293b" : "#f3f4f6",
            color: darkMode ? "#e2e8f0" : "#111827",
            border: "1px solid #d1d5db",
            padding: "8px 14px",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          📄 PDF
        </button>

        {/* Find Duplicates */}
        <button
          onClick={async () => {
            const d = findDuplicates();
            if (!d.length) return alert("No duplicates found");
            setModalType("merge");
            setEditItem({ candidates: d });
            setModalOpen(true);
          }}
          style={{
            background: "#f97316",
            color: "#fff",
            border: "none",
            padding: "8px 14px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          🔍 Find Duplicates
        </button>
      </div>
    </div>

    {/* Filters */}
    <div style={{
      background: darkMode ? "#1e293b" : "#f3f4f6",
      padding: "14px",
      borderRadius: "12px",
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      marginBottom: "16px",
      alignItems: "center",
      boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.05)",
    }}>
      <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }}>
        <option value="">All Status</option>
        <option value="new">New</option>
        <option value="follow-up">Follow-up</option>
        <option value="pending">Pending</option>
        <option value="contacted">Contacted</option>
        <option value="qualified">Qualified</option>
      </select>

      <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }}>
        <option value="">All Type</option>
        <option value="insurance">Insurance</option>
        <option value="hiring">Hiring</option>
        <option value="real estate">Real Estate</option>
      </select>

      <select value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setCurrentPage(1); }}
        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }}>
        <option value="">All Agents</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>

      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }}
      />
    </div>

    {/* Table */}
    <div style={{ overflowX: "auto", borderRadius: "12px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: darkMode ? "#1e293b" : "#f9fafb", textAlign: "left", fontSize: "0.9rem" }}>
          <tr>
            {["Name", "Phone", "Type", "Score", "Status", "Assigned", "Next Follow", "Actions"].map(header => (
              <th key={header} style={{
                padding: "10px",
                fontWeight: 600,
                color: darkMode ? "#e2e8f0" : "#374151",
                borderBottom: "1px solid #e5e7eb",
              }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated(filteredLeads).map((l, index) => (
            <tr key={l.id}
              style={{
                background: index % 2 === 0 ? (darkMode ? "#111827" : "#fff") : (darkMode ? "#1e293b" : "#f9fafb"),
                borderBottom: "1px solid #e5e7eb",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#1c2a4a" : "#e0f2fe"}
              onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? (darkMode ? "#111827" : "#fff") : (darkMode ? "#1e293b" : "#f9fafb")}
            >
              <td style={{ padding: "10px" }}>{l.name}</td>
              <td style={{ padding: "10px" }}>{l.phone}</td>
              <td style={{ padding: "10px" }}>{l.type}</td>
              <td style={{ padding: "10px" }}>{l.score || "-"}</td>
              <td style={{ padding: "10px" }}>
                <span style={{
                  backgroundColor: {
                    "new": "#3b82f6",
                    "follow-up": "#10b981",
                    "pending": "#facc15",
                    "contacted": "#6366f1",
                    "qualified": "#14b8a6"
                  }[l.status] || "#6b7280",
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                }}>
                  {l.status}
                </span>
              </td>
              <td style={{ padding: "10px" }}>{users.find(u => u.id === l.assigned_to)?.name || "Unassigned"}</td>
              <td style={{ padding: "10px" }}>{l.next_follow_up || "-"}</td>

              {/* Actions Column (text buttons for clear UI) */}
              <td style={{ padding: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  onClick={() => { setModalType("lead_edit"); setEditItem(l); setModalOpen(true); }}
                  title="Edit Lead"
                  style={{
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    transition: "all 0.12s"
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => { setModalType("assign"); setEditItem(l); setModalOpen(true); }}
                  title="Assign Lead"
                  style={{
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    transition: "all 0.12s"
                  }}
                >
                  Assign
                </button>

                <button
                  onClick={() => { setModalType("notes"); setEditItem(l); setModalOpen(true); }}
                  title="Add/View Notes"
                  style={{
                    background: "#f59e0b",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    transition: "all 0.12s"
                  }}
                >
                  Notes
                </button>

                <button
                  onClick={() => simulateCall(l)}
                  title="Call Lead"
                  style={{
                    background: "#6366f1",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    transition: "all 0.12s"
                  }}
                >
                  Call
                </button>

                <button
                  onClick={() => deleteLead(l.id)}
                  title="Delete Lead"
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    transition: "all 0.12s"
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Pagination */}
    <div style={{ marginTop: "12px", display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
      {Array.from({ length: Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage)) }).map((_, i) => (
        <button
          key={i}
          onClick={() => setCurrentPage(i + 1)}
          style={{
            background: currentPage === i + 1 ? "#2563eb" : darkMode ? "#1e293b" : "#f3f4f6",
            color: currentPage === i + 1 ? "#fff" : darkMode ? "#e2e8f0" : "#111827",
            border: "none",
            padding: "6px 10px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  </div>
)}



        {/* CALLS */}
        {activeTab === "calls" && (
          <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
            <h3>Call Logs</h3>
            <div style={{ marginBottom: 8 }}>
              <button onClick={() => { setModalType("call_create"); setEditItem(null); setModalOpen(true); }}>+ Add Call</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f1f5f9" }}>
                <tr>
                  <th style={{ padding: 8 }}>Lead</th>
                  <th style={{ padding: 8 }}>Agent</th>
                  <th style={{ padding: 8 }}>Outcome</th>
                  <th style={{ padding: 8 }}>Duration</th>
                  <th style={{ padding: 8 }}>Quality</th>
                  <th style={{ padding: 8 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {paginated(calls).map(c => (
                  <tr key={c.id}>
                    <td style={{ padding: 8 }}>{leads.find(l => l.id === c.lead_id)?.name || c.lead_name || "-"}</td>
                    <td style={{ padding: 8 }}>{users.find(u => u.id === c.user_id)?.name || c.user_name || "-"}</td>
                    <td style={{ padding: 8 }}>{c.outcome || c.result}</td>
                    <td style={{ padding: 8 }}>{c.duration || "-"}</td>
                    <td style={{ padding: 8 }}>{Math.round((c.quality || 0) * 100)}%</td>
                    <td style={{ padding: 8 }}>{(c.created_at || "").slice(0, 19).replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

       {/* CAMPAIGNS */}
{activeTab === "campaigns" && (
  <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
    <h3>Campaigns</h3>

    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => {
          setModalType("campaign_create");
          setEditItem(null);
          setModalOpen(true);
        }}
      >
        + New Campaign
      </button>
    </div>

    {/* Loading state */}
    {loading && <p>Loading campaigns...</p>}

    {/* Empty state */}
    {!loading && (!campaigns || campaigns.length === 0) && (
      <p style={{ color: "#6b7280" }}>No campaigns found.</p>
    )}

    {/* Campaigns table */}
    {!loading && campaigns && campaigns.length > 0 && (
      <table className="w-full border border-gray-300 border-collapse text-sm">
  <thead className="bg-gray-100">
    <tr>
      <th className="border border-gray-300 p-2 text-left">Name</th>
      <th className="border border-gray-300 p-2 text-left">Channel</th>
      <th className="border border-gray-300 p-2 text-left">Budget</th>
      <th className="border border-gray-300 p-2 text-left">Sent</th>
      <th className="border border-gray-300 p-2 text-left">Open</th>
      <th className="border border-gray-300 p-2 text-left">Action</th>
    </tr>
  </thead>

  <tbody>
    {campaigns.map((c) => (
      <tr key={c.id} className="hover:bg-gray-50">
        <td className="border border-gray-300 p-2">{c.name}</td>
        <td className="border border-gray-300 p-2">{c.channel}</td>
        <td className="border border-gray-300 p-2">{c.budget}</td>
        <td className="border border-gray-300 p-2">{c.sent || 0}</td>
        <td className="border border-gray-300 p-2">{c.opened || 0}</td>
        <td className="border border-gray-300 p-2 text-center">
          <button
            onClick={() => sendCampaignEmail(c.id)}
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            📧 Send Email
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>

    )}
  </div>
)}


  {/* AUTOMATION */}
        {activeTab === "automation" && (
          <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
            <h3>Automation & Workflows</h3>
            <div style={{ marginBottom: 8 }}>
              <button onClick={() => { setModalType("workflow_create"); setEditItem(null); setModalOpen(true); }}>+ New Workflow</button>
            </div>
            <ul>
              {workflows.map(w => (
                <li key={w.id} style={{ marginBottom: 6 }}>
                  <strong>{w.name}</strong> — <em>{w.when}</em> → <strong>{w.action}</strong> {w.enabled ? "(enabled)" : "(disabled)"}
                  <div style={{ display: "inline-block", marginLeft: 8 }}>
                    <button onClick={() => triggerWorkflow(w.id)}>Trigger</button>
                    <button onClick={async () => { await apiPatch(`/api/workflows/${w.id}`, { enabled: !w.enabled }); fetchAll(); }}>{w.enabled ? "Disable" : "Enable"}</button>
                  </div>
                </li>
              ))}
            </ul>
            <p style={{ color: "#6b7280" }}>Note: backend cron or scheduler required to run rules automatically (e.g., node-cron, bull). Frontend can create and manually trigger rules.</p>
          </div>
        )}

        {/* INTEGRATIONS */}
{activeTab === "integrations" && (
  <div style={{
    background: darkMode ? "#071029" : "#fff",
    padding: 24,
    borderRadius: 12,
    maxWidth: 700,
    margin: "0 auto",
    boxShadow: darkMode ? "0 6px 20px rgba(0,0,0,0.5)" : "0 4px 15px rgba(0,0,0,0.1)"
  }}>
    <h3 style={{ marginBottom: 16 }}>Integrations</h3>

    <div style={{
      display: "grid",
      gap: 16,
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))"
    }}>
      {/* Telephony */}
      <div style={{
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${darkMode ? "#1e293b" : "#e6eef6"}`,
        background: darkMode ? "#0b1226" : "#f9fafb",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8
      }}>
        <h4 style={{ marginBottom: 8 }}>📞 Telephony (Twilio / Exotel)</h4>
        <p style={{ color: darkMode ? "#cbd5e1" : "#374151" }}>
          Configure API keys in backend. Use the test button to validate connectivity.
        </p>
        <button
          onClick={async () => {
            try {
              await apiPost("/api/integrations/twilio/test", {});
              alert("✅ Twilio test triggered (server)");
            } catch (e) {
              alert("❌ Twilio test failed; check backend");
            }
          }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: company.color || "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
            transition: "all 0.2s"
          }}
        >
          Test Telephony
        </button>
      </div>

      {/* WhatsApp */}
      <div style={{
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${darkMode ? "#1e293b" : "#e6eef6"}`,
        background: darkMode ? "#0b1226" : "#f9fafb",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}>
        <h4 style={{ marginBottom: 8 }}>💬 WhatsApp</h4>
        <p style={{ color: darkMode ? "#cbd5e1" : "#374151" }}>
          Test WhatsApp integration using backend endpoint.
        </p>
        <button
          onClick={async () => {
            try {
              await apiPost("/api/integrations/whatsapp/test", { to: "" });
              alert("✅ WhatsApp test successful");
            } catch (e) {
              alert("❌ WhatsApp test failed");
            }
          }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: company.color || "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          Test WhatsApp
        </button>
      </div>

      {/* Google / Calendar / Gmail */}
      <div style={{
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${darkMode ? "#1e293b" : "#e6eef6"}`,
        background: darkMode ? "#0b1226" : "#f9fafb",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}>
        <h4 style={{ marginBottom: 8 }}>📧 Google / Calendar / Gmail</h4>
        <p style={{ color: darkMode ? "#cbd5e1" : "#374151" }}>
          OAuth flows must be implemented in backend. Frontend can open authentication links when provided by backend.
        </p>
        <button
          onClick={() => alert("Open Google OAuth flow (mock)")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: company.color || "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          Authenticate
        </button>
      </div>
    </div>
  </div>
)}


        {/* TEAM TAB */}
{activeTab === "team" && (
  <div style={{ background: darkMode ? "#072829ff" : "#fff", padding: 16, borderRadius: 12 }}>
    <h3 style={{ marginBottom: 16 }}>Team & Performance</h3>

    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={conversionsByUser} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <XAxis dataKey="name" stroke={darkMode ? "#e2e8f0" : "#111827"} />
        <YAxis stroke={darkMode ? "#e2e8f0" : "#111827"} />
        <Tooltip />
        <Legend />
        <Bar dataKey="total" name="Calls" fill="#2563eb" />
        <Bar dataKey="converted" name="Converted" fill="#16a34a" />
      </BarChart>
    </ResponsiveContainer>

    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
      <thead style={{ background: "#f1f5f9" }}>
        <tr>
          <th style={{ padding: 8 }}>Agent</th>
          <th style={{ padding: 8 }}>Calls</th>
          <th style={{ padding: 8 }}>Converted</th>
          <th style={{ padding: 8 }}>Target</th>
        </tr>
      </thead>
      <tbody>
        {conversionsByUser.map((p, idx) => (
          <tr key={idx}>
            <td style={{ padding: 8 }}>{p.name}</td>
            <td style={{ padding: 8 }}>{p.total}</td>
            <td style={{ padding: 8 }}>{p.converted}</td>
            <td style={{ padding: 8 }}>{users.find(u => u.name === p.name)?.daily_target || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <p style={{ marginTop: 8, color: "#6b7280" }}>
      Attendance tracking & shift reports require login-time recording (backend). Use /api/attendance to store daily marks.
    </p>
  </div>
)}


        {/* BILLING */}
        {activeTab === "billing" && (
          <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
            <h3>Billing & Plans</h3>
            <div style={{ display: "flex", gap: 12 }}>
              {plans.map((p) => (
                <div key={p.id} style={{ padding: 12, border: "1px solid #e6eef6", borderRadius: 8 }}>
                  <h4>{p.name}</h4>
                  <div>Price: ${p.price}/mo</div>
                  <div>Features: {(p.features || []).join(", ")}</div>
                  <button onClick={async () => {
                    try {
                      await apiPost("/api/invoices", { planId: p.id });
                      alert("Invoice created (server)");
                    } catch (e) { alert("Invoice creation failed"); }
                  }}>Create Invoice</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
{activeTab === "settings" && (
  <div style={{
    background: darkMode ? "#071029" : "#fff",
    padding: 24,
    borderRadius: 12,
    maxWidth: 700,
    margin: "0 auto",
    boxShadow: darkMode ? "0 6px 20px rgba(0,0,0,0.5)" : "0 4px 15px rgba(0,0,0,0.1)"
  }}>
    <h3 style={{ marginBottom: 16 }}>Branding & Security</h3>

    {/* Branding */}
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Company Name</label>
        <input
          value={company.name}
          onChange={(e) => setCompany((s) => ({ ...s, name: e.target.value }))}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            outline: "none",
            background: darkMode ? "#1e293b" : "#f9fafb",
            color: darkMode ? "#e2e8f0" : "#111827",
            transition: "all 0.2s"
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Accent Color</label>
        <input
          type="color"
          value={company.color}
          onChange={(e) => setCompany((s) => ({ ...s, color: e.target.value }))}
          style={{ width: 60, height: 36, border: "none", cursor: "pointer" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Logo URL</label>
        <input
          value={company.logoUrl}
          onChange={(e) => setCompany((s) => ({ ...s, logoUrl: e.target.value }))}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            outline: "none",
            background: darkMode ? "#1e293b" : "#f9fafb",
            color: darkMode ? "#e2e8f0" : "#111827",
            transition: "all 0.2s"
          }}
        />
      </div>

      {/* Branding Preview */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
        padding: 12,
        border: "1px dashed #9ca3af",
        borderRadius: 8,
        background: darkMode ? "#0b1226" : "#f9fafb"
      }}>
        {company.logoUrl && <img src={company.logoUrl} alt="logo" style={{ height: 50, borderRadius: 8 }} />}
        <span style={{ fontWeight: 600, fontSize: 18, color: company.color || "#2563eb" }}>
          {company.name || "Company Name"}
        </span>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => alert("Save branding via backend /api/settings (not implemented here)")}
          style={{
            padding: "10px 20px",
            background: company.color || "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 500,
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          Save Branding
        </button>
      </div>
    </div>

    {/* Security */}
    <div style={{ borderTop: "1px solid #d1d5db", paddingTop: 16 }}>
      <h4 style={{ marginBottom: 8 }}>Security</h4>
      <p style={{ color: darkMode ? "#cbd5e1" : "#374151" }}>
        Enable 2FA and OAuth via backend. Frontend supports redirect flows provided by backend.
        <br />
        Example endpoints: <code>/api/auth/2fa</code>, <code>/api/auth/oauth</code>
      </p>
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => alert("Test security endpoints (mock)")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: darkMode ? "#2563eb" : "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer"
          }}
        >
          Test Security
        </button>
      </div>
    </div>
  </div>
)}


        {/* AUDIT */}
        {activeTab === "audit" && (
          <div style={{ background: darkMode ? "#071029" : "#fff", padding: 12, borderRadius: 8 }}>
            <h3>Audit Logs</h3>
            <div style={{ marginBottom: 8 }}>
              <button onClick={async () => { const res = await apiGet("/api/audit"); setAuditLogs(res.data || []); }}>Refresh</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f1f5f9" }}><tr><th style={{ padding: 8 }}>Entity</th><th style={{ padding: 8 }}>Action</th><th style={{ padding: 8 }}>By</th><th style={{ padding: 8 }}>When</th><th style={{ padding: 8 }}>Details</th></tr></thead>
              <tbody>
                {auditLogs.map(a => (<tr key={a.id}><td style={{ padding: 8 }}>{a.entity}</td><td style={{ padding: 8 }}>{a.action}</td><td style={{ padding: 8 }}>{a.performedBy || a.by}</td><td style={{ padding: 8 }}>{(a.createdAt || a.at || "").slice(0, 19).replace("T", " ")}</td><td style={{ padding: 8 }}>{a.details}</td></tr>))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal area */}
      {modalOpen && (
        <div class Name="modal"style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ width: 760, maxWidth: "95%", background: darkMode ? "#071029" : "#fff", borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>
              {modalType === "user_create" && "Create User"}
              {modalType === "user_edit" && "Edit User"}
              {modalType === "lead_create" && "Create Lead"}
              {modalType === "lead_edit" && "Edit Lead"}
              {modalType === "assign" && "Assign Lead"}
              {modalType === "notes" && "Add Note"}
              {modalType === "merge" && "Merge Duplicates"}
              {modalType === "call_create" && "Add Call"}
              {modalType === "campaign_create" && "Create Campaign"}
              {modalType === "workflow_create" && "Create Workflow"}
            </h3>

            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
             {/* USER CREATE/EDIT */}
{(modalType === "user_create" || modalType === "user_edit") && (
  <form
    onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());

      // Convert daily_target to number if provided
      if (payload.daily_target) payload.daily_target = Number(payload.daily_target);

      // Set default password when creating a new user
      if (modalType === "user_create") {
        payload.password = payload.password || "default123"; // default password
        await createUser(payload);
      } else {
        await updateUser(editItem.id, payload);
      }
      setModalOpen(false);
    }}
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      padding: "16px",
      background: darkMode ? "#0b1226" : "#fff",
      borderRadius: "12px",
      boxShadow: darkMode
        ? "0 6px 20px rgba(0,0,0,0.5)"
        : "0 4px 15px rgba(0,0,0,0.1)",
      width: "100%",
      maxWidth: "500px",
    }}
  >
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      <input
        name="name"
        defaultValue={editItem?.name || ""}
        placeholder="Name"
        required
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: darkMode ? "#1e293b" : "#f9fafb",
          color: darkMode ? "#e2e8f0" : "#111827",
          outline: "none",
          transition: "all 0.2s",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
      />

      <input
        name="email"
        defaultValue={editItem?.email || ""}
        placeholder="Email"
        required
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: darkMode ? "#1e293b" : "#f9fafb",
          color: darkMode ? "#e2e8f0" : "#111827",
          outline: "none",
          transition: "all 0.2s",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
      />

      <select
        name="role"
        defaultValue={editItem?.role || "agent"}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: darkMode ? "#1e293b" : "#f9fafb",
          color: darkMode ? "#e2e8f0" : "#111827",
          outline: "none",
          transition: "all 0.2s",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
      >
        <option value="admin">Admin</option>
        <option value="manager">Manager</option>
        <option value="agent">Agent</option>
      </select>

      <input
        name="daily_target"
        defaultValue={editItem?.daily_target || ""}
        placeholder="Daily target"
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: darkMode ? "#1e293b" : "#f9fafb",
          color: darkMode ? "#e2e8f0" : "#111827",
          outline: "none",
          transition: "all 0.2s",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
      />
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
      <button
        type="button"
        onClick={() => setModalOpen(false)}
        style={{
          padding: "8px 16px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: darkMode ? "#1e293b" : "#f3f4f6",
          color: darkMode ? "#e2e8f0" : "#111827",
          cursor: "pointer",
          fontWeight: 500,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = darkMode ? "#111827" : "#e5e7eb")}
        onMouseLeave={(e) => (e.currentTarget.style.background = darkMode ? "#1e293b" : "#f3f4f6")}
      >
        Cancel
      </button>

      <button
        type="submit"
        style={{
          background: company.color || "#2563eb",
          color: "#fff",
          padding: "8px 16px",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 500,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        Save
      </button>
    </div>
  </form>
)}

              {/* LEAD CREATE / EDIT */}
{(modalType === "lead_create" || modalType === "lead_edit") && (
  <form
    onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      if (modalType === "lead_create") await createLead(payload);
      else await updateLead(editItem.id, payload);
      setModalOpen(false);
    }}
    style={{
      background: "#fff",
      padding: "24px",
      borderRadius: "12px",
      width: "600px",
      maxWidth: "90%",
      margin: "auto",
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    }}
  >
    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "600", color: "#111827" }}>
      {modalType === "lead_create" ? "Create New Lead" : `Edit Lead - ${editItem?.name}`}
    </h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
      }}
    >
      <input
        name="name"
        defaultValue={editItem?.name || ""}
        placeholder="Full Name"
        required
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
        }}
      />

      <input
        name="phone"
        defaultValue={editItem?.phone || ""}
        placeholder="Phone Number"
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
        }}
      />

      <input
        name="email"
        defaultValue={editItem?.email || ""}
        placeholder="Email Address"
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
        }}
      />

      <select
        name="type"
        defaultValue={editItem?.type || ""}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
          color: "#111827",
        }}
      >
        <option value="">Select Type</option>
        <option value="insurance">Insurance</option>
        <option value="hiring">Hiring</option>
        <option value="real estate">Real Estate</option>
      </select>

      <select
        name="status"
        defaultValue={editItem?.status || "new"}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
          color: "#111827",
        }}
      >
        <option value="new">New</option>
        <option value="follow-up">Follow-up</option>
        <option value="pending">Pending</option>
        <option value="contacted">Contacted</option>
        <option value="qualified">Qualified</option>
      </select>

      <input
        name="source"
        defaultValue={editItem?.source || ""}
        placeholder="Lead Source (e.g. Website, Referral)"
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
        }}
      />

      <input
        type="date"
        name="next_follow_up"
        defaultValue={editItem?.next_follow_up || ""}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
          color: "#111827",
        }}
      />

      <textarea
        name="remarks"
        defaultValue={editItem?.remarks || ""}
        placeholder="Remarks / Notes"
        style={{
          gridColumn: "1 / span 2",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
          minHeight: "80px",
          resize: "vertical",
        }}
      />
    </div>

    <div
      style={{
        marginTop: "12px",
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
      }}
    >
      <button
        type="button"
        onClick={() => setModalOpen(false)}
        style={{
          background: "#f3f4f6",
          color: "#111827",
          border: "none",
          padding: "8px 14px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>

      <button
        type="submit"
        style={{
          background: "#2563eb",
          color: "#fff",
          border: "none",
          padding: "8px 14px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Save Lead
      </button>
    </div>
  </form>
)}


              {/* ASSIGN */}
{modalType === "assign" && editItem && (
  <div
    style={{
      background: "#fff",
      padding: "24px",
      borderRadius: "12px",
      width: "400px",
      maxWidth: "90%",
      margin: "auto",
      boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    }}
  >
    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "600", color: "#111827" }}>
      Assign Lead
    </h2>

    <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px" }}>
      <p style={{ margin: 0 }}>
        <strong>Lead:</strong> {editItem.name}
      </p>
      {editItem.phone && (
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>
          📞 {editItem.phone}
        </p>
      )}
    </div>

    <div>
      <label
        htmlFor="assignUser"
        style={{ fontSize: "0.95rem", fontWeight: "500", color: "#374151" }}
      >
        Assign to Agent
      </label>
      <select
        id="assignUser"
        defaultValue={editItem.assigned_to || ""}
        onChange={(e) =>
          setEditItem({ ...editItem, assigned_to: e.target.value })
        }
        style={{
          marginTop: "6px",
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          fontSize: "0.95rem",
          color: "#111827",
        }}
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>

    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
        marginTop: "12px",
      }}
    >
      <button
        onClick={() => setModalOpen(false)}
        style={{
          background: "#f3f4f6",
          color: "#111827",
          border: "none",
          padding: "8px 14px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>

      <button
        onClick={async () => {
          await updateLead(editItem.id, {
            assigned_to: editItem.assigned_to,
          });
          setModalOpen(false);
        }}
        style={{
          background: "#2563eb",
          color: "#fff",
          border: "none",
          padding: "8px 14px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Assign
      </button>
    </div>
  </div>
)}


              {/* NOTES */}
              {modalType === "notes" && editItem && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const note = fd.get("note");
                  const updated = { notes: [...(editItem.notes || []), { text: note, by: "admin", at: new Date().toISOString() }] };
                  await updateLead(editItem.id, updated);
                  setModalOpen(false);
                }}>
                  <p><strong>Lead:</strong> {editItem.name}</p>
                  <textarea name="note" placeholder="Write note..." required />
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button type="submit" style={{ background: company.color, color: "#fff", padding: "8px 12px", border: "none" }}>Save Note</button>
                  </div>
                </form>
              )}

              {/* MERGE */}
              {modalType === "merge" && editItem && (
                <div>
                  <h4>Duplicate groups</h4>
                  {editItem.candidates.map((group, gi) => (
                    <div key={gi} style={{ padding: 8, border: "1px solid #e6eef6", borderRadius: 6, marginBottom: 8 }}>
                      <div><strong>Key:</strong> {group.key}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        {group.values.map((v, idx) => (
                          <div key={v.id} style={{ padding: 8, border: "1px dashed #cbd5e1", borderRadius: 6 }}>
                            <div>{v.name} • {v.phone}</div>
                            <div><button onClick={async () => {
                              const keepId = v.id;
                              const mergeIds = group.values.filter(x => x.id !== keepId).map(x => x.id);
                              await mergeLeads(keepId, mergeIds);
                              setModalOpen(false);
                            }}>Keep this (merge others)</button></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CALL CREATE */}
              {modalType === "call_create" && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const payload = Object.fromEntries(fd.entries());
                  await createCall(payload);
                  setModalOpen(false);
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <select name="lead_id" required>
                      <option value="">Select lead</option>
                      {leads.map(l => <option key={l.id} value={l.id}>{l.name} ({l.phone})</option>)}
                    </select>
                    <select name="user_id" required>
                      <option value="">Select agent</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <input name="duration" placeholder="Duration (s)" />
                    <input name="outcome" placeholder="Outcome" />
                    <textarea name="notes" placeholder="Notes" />
                    <input type="file" accept="audio/*" onChange={(ev) => { recordingRef.current = ev.target.files?.[0]; }} />
                  </div>
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button type="submit" style={{ background: company.color, color: "#fff", padding: "8px 12px", border: "none" }}>Add Call</button>
                    <button type="button" onClick={async () => {
                      if (!recordingRef.current) return alert("Select recording first");
                      const leadId = prompt("Lead ID to attach recording to?");
                      const userId = prompt("User ID?");
                      await uploadCallRecording(leadId, userId, recordingRef.current);
                      alert("Uploaded");
                    }}>Upload Recording</button>
                  </div>
                </form>
              )}

             
  
    {/* CAMPAIGN CREATE */}
              {modalType === "campaign_create" && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const payload = Object.fromEntries(fd.entries());
                  await createCampaign(payload);
                  setModalOpen(false);
                }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <input name="name" placeholder="Campaign name" required />
                    <select name="channel"><option value="Email">Email</option><option value="SMS">SMS</option><option value="Social">Social</option></select>
                    <input name="budget" placeholder="Budget" />
                    <textarea name="message" placeholder="Message content" />
                  </div>
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button type="submit" style={{ background: company.color, color: "#fff", padding: "8px 12px", border: "none" }}>Create</button>
                  </div>
                </form>
              )}

              {/* WORKFLOW CREATE */}
              {modalType === "workflow_create" && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const body = Object.fromEntries(fd.entries());
                  // params field accept JSON string
                  try {
                    if (body.params && typeof body.params === "string") body.params = JSON.parse(body.params);
                  } catch (err) { /* ignore parse */ }
                  await createWorkflow(body);
                  setModalOpen(false);
                }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <input name="name" placeholder="Rule name" required />
                    <input name="when" placeholder='Condition (e.g., lead.idle_days >= 2)' required />
                    <select name="action"><option value="send_email">Send Email</option><option value="assign">Auto Assign</option><option value="send_sms">Send SMS</option></select>
                    <textarea name="params" placeholder='JSON params e.g. {"template":"nudge_v1"}' />
                  </div>
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button type="submit" style={{ background: company.color, color: "#fff", padding: "8px 12px", border: "none" }}>Save</button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}