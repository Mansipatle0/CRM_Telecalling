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

/*
ManagerDashboard.jsx
- Single-file Manager / Telecaller dashboard
- Pass `token` prop (Bearer token string). If not provided, requests are sent without auth header for dev mode.
- Adjust API_BASE if your backend runs on different host/port.
*/

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000"; // change if needed
const authCfg = (token) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {});

const COLORS = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#b07aa1"];

function safeArray(resp) {
  // normalizes axios response formats like { data: { data: [...] } } or { data: [...] }
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (resp.data && Array.isArray(resp.data)) return resp.data;
  if (resp.data && resp.data.data && Array.isArray(resp.data.data)) return resp.data.data;
  return [];
}

export default function ManagerDashboard({ token, onLogout }) {
  // core data
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]); // array
  const [calls, setCalls] = useState([]); // array
  const [campaigns, setCampaigns] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // ui state
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scoreFilter, setScoreFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // modals
  const [showCallModal, setShowCallModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [callForm, setCallForm] = useState({ duration: 0, outcome: "", notes: "" });
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);

  // theme
  const [darkMode, setDarkMode] = useState(false);

  // refs
  const notificationTimer = useRef(null);

  // ---------------- API helpers ----------------
  const GET = (path) => axios.get(`${API_BASE}${path}`, authCfg(token)).catch((e) => ({ data: null }));
  const POST = (path, body, cfg) => axios.post(`${API_BASE}${path}`, body, { ...authCfg(token), ...(cfg || {}) }).catch(() => ({ data: null }));
  const PUT = (path, body) => axios.put(`${API_BASE}${path}`, body, authCfg(token)).catch(() => ({ data: null }));
  const PATCH = (path, body) => axios.patch(`${API_BASE}${path}`, body, authCfg(token)).catch(() => ({ data: null }));

  // ---------------- Fetch functions ----------------
  async function fetchAll() {
    setLoading(true);
    try {
      const [
        usersRes,
        leadsRes,
        callsRes,
        campaignsRes,
        workflowsRes,
        plansRes,
        auditRes,
      ] = await Promise.all([
        GET("/api/users"),
        GET("/api/leads"),
        GET("/api/callsLogs").catch(() => GET("/api/calls")), // fallback endpoints
        GET("/api/campaigns"),
        GET("/api/workflows"),
        GET("/api/plans"),
        GET("/api/audit"),
      ]);

      setUsers(safeArray(usersRes));
      setLeads(safeArray(leadsRes));
      setCalls(safeArray(callsRes));
      setCampaigns(safeArray(campaignsRes));
      setWorkflows(safeArray(workflowsRes));
      setPlans(safeArray(plansRes));
      setAuditLogs(safeArray(auditRes));

      // get notifications simplified from audit or a separate endpoint (try /api/notifications)
      const notRes = await GET("/api/notifications");
      if (notRes && notRes.data) {
        setNotifications(safeArray(notRes));
      } else {
        // fallback: create notifications from recent audit logs
        setNotifications((auditRes && safeArray(auditRes).slice(0, 6).map(a => ({
          id: a.id || Math.random(),
          message: `${a.action} ${a.entity} ${a.entity_id || ""}`,
          timestamp: a.created_at || new Date().toISOString(),
          type: "info"
        }))) || []);
      }
    } catch (err) {
      console.error("fetchAll error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();

    // simulate periodic notification polling
    notificationTimer.current = setInterval(async () => {
      try {
        // try reading server notifications if endpoint exists
        const res = await GET("/api/notifications");
        if (res && res.data) {
          setNotifications(prev => {
            const arr = safeArray(res);
            // add new ones on top (avoid duplicates by id)
            const existingIds = new Set(prev.map(n => n.id));
            const newOnes = arr.filter(n => !existingIds.has(n.id));
            return [...newOnes, ...prev].slice(0, 8);
          });
        } else {
          // otherwise, produce small local informative notification occasionally
          if (Math.random() > 0.85) {
            const note = { id: Date.now(), message: "New lead assigned", timestamp: new Date().toISOString(), type: "info" };
            setNotifications(prev => [note, ...prev].slice(0, 8));
          }
        }
      } catch (e) {
        // ignore
      }
    }, 30000);

    return () => clearInterval(notificationTimer.current);
    // eslint-disable-next-line
  }, []);

  // ---------------- Utilities & derived data ----------------
  const filteredLeads = useMemo(() => {
    let arr = Array.isArray(leads) ? [...leads] : [];
    const q = (searchTerm || "").trim().toLowerCase();
    if (q) {
      arr = arr.filter(l => ((l.name || "") + " " + (l.email || "") + " " + (l.phone || "")).toLowerCase().includes(q));
    }
    if (statusFilter) arr = arr.filter(l => (l.status || "").toLowerCase() === statusFilter.toLowerCase());
    if (scoreFilter) {
      if (scoreFilter === "high") arr = arr.filter(l => (l.score || 0) >= 80);
      if (scoreFilter === "medium") arr = arr.filter(l => (l.score || 0) >= 50 && (l.score || 0) < 80);
      if (scoreFilter === "low") arr = arr.filter(l => (l.score || 0) < 50);
    }
    return arr;
  }, [leads, searchTerm, statusFilter, scoreFilter]);

  const pagedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage]);

  function totalPages(dataArr) {
    const len = (Array.isArray(dataArr) ? dataArr.length : 0);
    return Math.max(1, Math.ceil(len / itemsPerPage));
  }

  // Charts data
  const leadsByStatus = useMemo(() => {
    const map = {};
    (Array.isArray(leads) ? leads : []).forEach(l => map[l.status || "unknown"] = (map[l.status || "unknown"] || 0) + 1);
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const weeklyPerformance = useMemo(() => {
    // simple aggregation from calls (last 7 days)
    const map = {};
    (Array.isArray(calls) ? calls : []).forEach(c => {
      const d = (c.call_time || c.created_at || c.dateTime || new Date()).slice ? (c.call_time || c.created_at || c.dateTime || new Date()).slice(0, 10) : new Date().toISOString().slice(0,10);
      map[d] = (map[d] || 0) + 1;
    });
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last7.push({ day: key, calls: map[key] || 0, converted: 0 });
    }
    return last7;
  }, [calls]);

  // ---------------- Actions ----------------
  async function updateLeadStatus(leadId, newStatus) {
    try {
      // Update backend (PUT with allowed fields)
      await PUT(`/api/leads/${leadId}`, { status: newStatus }).catch(() => null);
      // Refresh client
      setLeads(prev => prev.map(l => l.id === leadId || l._id === leadId ? { ...l, status: newStatus, lastContacted: new Date().toISOString() } : l));
    } catch (e) {
      console.error("updateLeadStatus", e);
    }
  }

  async function logCall(lead, payload) {
    try {
      // payload: { duration, outcome, notes }
      await POST("/api/calls", {
        lead_id: lead.id || lead._id,
        user_id: null,
        duration: payload.duration,
        outcome: payload.outcome,
        notes: payload.notes,
        lead_name: lead.name,
      });
      // optimistic UI
      setCalls(prev => [{ id: `local-${Date.now()}`, leadName: lead.name, dateTime: new Date().toISOString(), duration: payload.duration, outcome: payload.outcome, notes: payload.notes }, ...prev]);
    } catch (e) {
      console.error("logCall", e);
    }
  }

  function exportLeadsCSV(rows = leads) {
    try {
      const arr = Array.isArray(rows) ? rows : [];
      const headers = ["Name", "Email", "Phone", "Status", "Score", "Created At", "Last Contacted"];
      const csv = [
        headers.join(","),
        ...arr.map(r => [
          `"${(r.name || "")}"`,
          `"${(r.email || "")}"`,
          `"${(r.phone || "")}"`,
          `"${(r.status || "")}"`,
          `"${(r.score || "")}"`,
          `"${(r.created_at || r.createdAt || "").slice ? (r.created_at || r.createdAt || "").slice(0,10) : ""}"`,
          `"${(r.lastContacted || r.last_contacted || "").slice ? (r.lastContacted || r.last_contacted || "").slice(0,10) : ""}"`
        ].join(","))
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("exportLeadsCSV", e);
    }
  }

  // Call modal submit
  async function handleCallSubmit() {
    if (!selectedLead) return;
    await logCall(selectedLead, callForm);
    // update lead metadata locally
    setLeads(prev => prev.map(l => (l.id === selectedLead.id || l._id === selectedLead._id) ? ({ ...l, lastContacted: new Date().toISOString(), notes: (l.notes || "") + "\n" + callForm.notes }) : l));
    setShowCallModal(false);
    setCallForm({ duration: 0, outcome: "", notes: "" });
    setNotifications(prev => [{ id: Date.now(), message: `Call logged for ${selectedLead.name}`, timestamp: new Date().toISOString(), type: "success" }, ...prev].slice(0,8));
  }

  // quick dial stub (calls backend outbound)
  async function quickDial(phone) {
    try {
      await POST("/api/call/outbound", { to: phone, from: null });
      setNotifications(prev => [{ id: Date.now(), message: `Dialing ${phone}`, timestamp: new Date().toISOString(), type: "info" }, ...prev].slice(0,8));
    } catch {
      setNotifications(prev => [{ id: Date.now(), message: `Failed to dial ${phone}`, timestamp: new Date().toISOString(), type: "error" }, ...prev].slice(0,8));
    }
  }

  // ---------------- small helpers ----------------
  const formatDuration = (secs) => {
    if (!secs && secs !== 0) return "-";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  // ---------------- Render ----------------
  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "Inter, system-ui, sans-serif", background: darkMode ? "#071029" : "#f8fafc", color: darkMode ? "#e6eef6" : "#111827" }}>
      {/* SIDEBAR */}
      <div style={{ width: 260, padding: 18, background: darkMode ? "#071029" : "#0f172a", color: "#fff", boxSizing: "border-box" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>M</div>
          <div>
            <div style={{ fontWeight: 700 }}>Manager Dashboard</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Telecalling CRM</div>
          </div>
        </div>

        <nav style={{ display: "grid", gap: 6 }}>
          {["dashboard", "leads", "calls", "scripts", "reports"].map(tab => (
            <div key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
              style={{
                padding: 10,
                borderRadius: 6,
                cursor: "pointer",
                background: activeTab === tab ? "#06b6d4" : "transparent",
                color: activeTab === tab ? "#032024" : "#cbd5e1",
                fontWeight: 600
              }}
            >
              {tab === "dashboard" && "📊 Dashboard"}
              {tab === "leads" && "📋 Leads"}
              {tab === "calls" && "📞 Call Logs"}
              {tab === "scripts" && "📝 Scripts"}
              {tab === "reports" && "📈 Reports"}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: 18 }}>
          <input placeholder="Search leads..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: darkMode ? "#021023" : "#fff", color: darkMode ? "#e6eef6" : "#111827" }} />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button onClick={() => setDarkMode(!darkMode)} style={{ flex: 1, padding: 8, borderRadius: 6 }}>{darkMode ? "Light" : "Dark"}</button>
          <button onClick={() => onLogout && onLogout()} style={{ flex: 1, padding: 8, borderRadius: 6, background: "#ef4444", color: "#fff" }}>Logout</button>
        </div>

        <div style={{ marginTop: 18 }}>
          <strong style={{ color: "#cbd5e1" }}>Notifications</strong>
          <div style={{ marginTop: 8, color: "#94a3b8" }}>
            {notifications.length === 0 ? <div>No notifications</div> : notifications.slice(0,5).map(n => (
              <div key={n.id} style={{ fontSize: 13, marginBottom: 6 }}>
                <div>{n.message}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{new Date(n.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Manager Dashboard</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={fetchAll} style={{ padding: "8px 12px", borderRadius: 8, background: "#06b6d4", color: "#032024", border: "none" }}>Refresh</button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotifications(s => !s)} style={{ padding: "8px 12px", borderRadius: 8 }}>🔔 {notifications.length > 0 && <span style={{ marginLeft: 6, fontWeight: 700 }}>{notifications.length}</span>}</button>
            </div>
          </div>
        </div>

        {loading && <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: darkMode ? "#021023" : "#fff" }}>Loading data...</div>}

        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
              <div style={{ padding: 12, borderRadius: 8, background: darkMode ? "#021023" : "#fff" }}>
                <small>Total Leads</small>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{Array.isArray(leads) ? leads.length : 0}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: darkMode ? "#021023" : "#fff" }}>
                <small>Pending Follow-ups</small>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{Array.isArray(leads) ? leads.filter(l => ["pending","follow-up","contacted","new"].includes((l.status || "").toLowerCase())).length : 0}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: darkMode ? "#021023" : "#fff" }}>
                <small>Converted</small>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{Array.isArray(leads) ? leads.filter(l => ["converted","won","closed"].includes((l.status || "").toLowerCase())).length : 0}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: darkMode ? "#021023" : "#fff" }}>
                <small>Today's Calls</small>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{Array.isArray(calls) ? calls.filter(c => (new Date(c.call_time || c.created_at || c.dateTime || Date.now())).toDateString() === new Date().toDateString()).length : 0}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ padding: 12, borderRadius: 8, background: darkMode ? "#021023" : "#fff" }}>
                <h4 style={{ marginTop: 0 }}>Leads by Status</h4>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={leadsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {leadsByStatus.map((entry, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: darkMode ? "#021023" : "#fff" }}>
                <h4 style={{ marginTop: 0 }}>Weekly Performance</h4>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tickFormatter={d => d.slice(5)} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="calls" fill={"#06b6d4"} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 8, background: darkMode ? "#021023" : "#fff" }}>
                <h3 style={{ marginTop: 0 }}>Top Leads (priority)</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                      <th>Name</th><th>Status</th><th>Score</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(leads) ? leads.filter(l => (l.score || 0) >= 80).slice(0, 6) : []).map(l => (
                      <tr key={l.id || l._id} style={{ borderBottom: "1px dashed #e5e7eb" }}>
                        <td style={{ padding: 8 }}>{l.name}</td>
                        <td>{l.status}</td>
                        <td><strong style={{ color: l.score >= 80 ? "#10b981" : "#f59e0b" }}>{l.score}</strong></td>
                        <td>
                          <button onClick={() => { setSelectedLead(l); setShowCallModal(true); }} style={{ marginRight: 8 }}>Log Call</button>
                          <button onClick={() => quickDial(l.phone)}>Quick Dial</button>
                        </td>
                      </tr>
                    ))}
                    {(!Array.isArray(leads) || leads.filter(l => (l.score || 0) >= 80).length === 0) && <tr><td colSpan={4} style={{ padding: 8, color: "#6b7280" }}>No high priority leads</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* LEADS TAB */}
        {activeTab === "leads" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: 8, borderRadius: 6 }}>
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="converted">Converted</option>
                <option value="not interested">Not Interested</option>
              </select>

              <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)} style={{ padding: 8, borderRadius: 6 }}>
                <option value="">All Scores</option>
                <option value="high">High (80+)</option>
                <option value="medium">Medium (50-79)</option>
                <option value="low">Low (&lt;50)</option>
              </select>

              <button onClick={() => exportLeadsCSV(filteredLeads)} style={{ padding: "8px 12px", borderRadius: 6 }}>Export CSV</button>
            </div>

            <div style={{ background: darkMode ? "#021023" : "#fff", borderRadius: 8, padding: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Score</th><th>Last Contacted</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLeads.map(l => (
                    <tr key={l.id || l._id} style={{ borderBottom: "1px dashed #e5e7eb" }}>
                      <td style={{ padding: 8 }}>{l.name}</td>
                      <td>{l.email}</td>
                      <td>{l.phone}</td>
                      <td>
                        <select value={l.status || ""} onChange={(e) => updateLeadStatus(l.id || l._id, e.target.value)}>
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="interested">Interested</option>
                          <option value="converted">Converted</option>
                          <option value="not interested">Not Interested</option>
                        </select>
                      </td>
                      <td>{l.score || "-"}</td>
                      <td>{l.lastContacted ? (new Date(l.lastContacted).toLocaleString()) : "Never"}</td>
                      <td>
                        <button onClick={() => { setSelectedLead(l); setShowCallModal(true); }} style={{ marginRight: 8 }}>Log Call</button>
                        <button onClick={() => quickDial(l.phone)}>Call</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8 }}>
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</button>
                <div style={{ padding: "8px 12px", borderRadius: 6, background: darkMode ? "#021029" : "#fff" }}>{`Page ${currentPage} of ${totalPages(filteredLeads)}`}</div>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages(filteredLeads)))} disabled={currentPage === totalPages(filteredLeads)}>Next</button>
              </div>
            </div>
          </>
        )}

        {/* CALLS TAB */}
        {activeTab === "calls" && (
          <div style={{ background: darkMode ? "#021023" : "#fff", borderRadius: 8, padding: 12 }}>
            <h3>Call Logs</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th>Lead</th><th>Date & Time</th><th>Duration</th><th>Outcome</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(calls) ? calls : []).map(c => (
                  <tr key={c.id || c._id} style={{ borderBottom: "1px dashed #e5e7eb" }}>
                    <td style={{ padding: 8 }}>{c.leadName || c.lead_name || "-"}</td>
                    <td>{(c.call_time || c.created_at || c.dateTime) ? new Date(c.call_time || c.created_at || c.dateTime).toLocaleString() : "-"}</td>
                    <td>{formatDuration(c.duration || 0)}</td>
                    <td>{c.outcome || "-"}</td>
                    <td>{c.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SCRIPTS TAB */}
        {activeTab === "scripts" && (
          <div style={{ background: darkMode ? "#021023" : "#fff", borderRadius: 8, padding: 12 }}>
            <h3>Call Scripts</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {/* Example scripts — manager usually keeps scripts in backend; if not present, show fallback */}
              {workflows && workflows.length > 0 ? workflows.map(w => (
                <div key={w.id} style={{ padding: 12, borderRadius: 8, background: darkMode ? "#07112b" : "#f8fafc" }}>
                  <h4 style={{ marginTop: 0 }}>{w.name}</h4>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>{w.action || JSON.stringify(w.params || {})}</div>
                </div>
              )) : (
                // fallback example scripts
                [{ id: "s1", title: "Initial Contact", content: "Hello, this is ..." }, { id: "s2", title: "Follow-up", content: "Hi, following up..." }].map(s => (
                  <div key={s.id} style={{ padding: 12, borderRadius: 8, background: darkMode ? "#07112b" : "#f8fafc" }}>
                    <h4 style={{ marginTop: 0 }}>{s.title}</h4>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{s.content}</div>
                    <div style={{ marginTop: 8 }}>
                      <button onClick={() => { setSelectedScript(s); setShowScriptModal(true); }}>View</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <div style={{ background: darkMode ? "#021023" : "#fff", borderRadius: 8, padding: 12 }}>
            <h3>Reports</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 8 }}>
                <strong>Conversion Rate</strong>
                <div style={{ fontSize: 18, marginTop: 6 }}>
                  {Array.isArray(leads) && leads.length ? `${Math.round((leads.filter(l => ["converted","won","closed"].includes((l.status||"").toLowerCase())).length / leads.length) * 100)}%` : "0%"}
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: 8 }}>
                <strong>Avg. Response Time</strong>
                <div style={{ fontSize: 18, marginTop: 6 }}>2.3 days</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8 }}>
                <strong>Leads Contacted</strong>
                <div style={{ fontSize: 18, marginTop: 6 }}>{Array.isArray(leads) ? leads.filter(l => ["contacted","interested","converted"].includes((l.status||"").toLowerCase())).length : 0}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8 }}>
                <strong>Total Call Duration</strong>
                <div style={{ fontSize: 18, marginTop: 6 }}>{Math.floor((Array.isArray(calls) ? calls.reduce((t, c) => t + (c.duration || 0), 0) : 0) / 60)} minutes</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button onClick={() => exportLeadsCSV(leads)}>Export All Leads (CSV)</button>
            </div>
          </div>
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

              {/* Actions Column */}
              <td style={{ padding: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {/* Edit */}
                <button
                  onClick={() => { setModalType("user_edit"); setEditItem(u); setModalOpen(true); }}
                  title="Edit User"
                  style={{
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  ✏️
                </button>

                {/* Suspend / Unsuspend */}
                <button
                  onClick={() => toggleSuspendUser(u.id, !u.suspended)}
                  title={u.suspended ? "Unsuspend User" : "Suspend User"}
                  style={{
                    background: u.suspended ? "#10b981" : "#f59e0b",
                    color: "#fff",
                    border: "none",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  {u.suspended ? "✅" : "⛔"}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteUser(u.id)}
                  title="Delete User"
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  🗑️
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

        {/* CALL MODAL */}
        {showCallModal && selectedLead && (
          <div style={{
            position: "fixed", left: 0, top: 0, right: 0, bottom: 0,
            display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,0.6)"
          }}>
            <div style={{ width: 520, background: darkMode ? "#021023" : "#fff", padding: 18, borderRadius: 8 }}>
              <h3>Log Call — {selectedLead.name}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                <label>Duration (seconds)</label>
                <input type="number" value={callForm.duration} onChange={e => setCallForm(f => ({ ...f, duration: parseInt(e.target.value || 0) }))} />

                <label>Outcome</label>
                <select value={callForm.outcome} onChange={e => setCallForm(f => ({ ...f, outcome: e.target.value }))}>
                  <option value="">Select outcome</option>
                  <option value="Connected">Connected</option>
                  <option value="Voicemail">Voicemail</option>
                  <option value="Busy">Busy</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Interested">Interested</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Follow-up">Follow-up Required</option>
                </select>

                <label>Notes</label>
                <textarea value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))} rows={4} />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowCallModal(false); setSelectedLead(null); }}>Cancel</button>
                  <button onClick={handleCallSubmit} style={{ background: "#06b6d4", color: "#032024" }}>Log Call</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCRIPT MODAL */}
        {showScriptModal && selectedScript && (
          <div style={{
            position: "fixed", left: 0, top: 0, right: 0, bottom: 0,
            display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,0.6)"
          }}>
            <div style={{ width: 520, background: darkMode ? "#021023" : "#fff", padding: 18, borderRadius: 8 }}>
              <h3>{selectedScript.title || selectedScript.name}</h3>
              <div style={{ whiteSpace: "pre-wrap", color: "#111827" }}>{selectedScript.content || selectedScript.action || JSON.stringify(selectedScript.params || {}, null, 2)}</div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button onClick={() => { setShowScriptModal(false); setSelectedScript(null); }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
