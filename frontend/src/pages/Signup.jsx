import React, { useState } from "react";
import axios from "axios";

export default function Signup({ onLogin, onToggle }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("telecaller");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        name,
        email,
        password,
        role,
      });
      onLogin(res.data.token);
    } catch (err) {
      alert(err?.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.auth}>
      <div style={styles.shape1}></div>
      <div style={styles.shape2}></div>

      <form onSubmit={submit} style={styles.card}>
        <h2 style={styles.title}>Sign Up</h2>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          required
          style={styles.input}
        />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          style={styles.input}
        />

        <div style={styles.passwordWrapper}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            style={{ ...styles.input, paddingRight: "40px" }}
          />
          <div onClick={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            {showPassword ? "🙈" : "👁️"}
          </div>
        </div>

        <label style={{ display: "block", marginBottom: "20px" }}>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)} style={styles.input}>
            <option value="telecaller">Telecaller</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        <button type="submit" style={{ ...styles.button, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? "Signing up..." : "Sign Up"}
        </button>

        <p style={styles.text}>
          Already have an account?{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); onToggle(); }} style={styles.link}>
            Sign In
          </a>
        </p>
      </form>
    </div>
  );
}

const styles = {
  auth: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    position: "relative",
    overflow: "hidden",
    padding: "10px",
  },
  shape1: {
    position: "absolute",
    width: "200px",
    height: "200px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.05)",
    top: "-50px",
    left: "-50px",
  },
  shape2: {
    position: "absolute",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.05)",
    bottom: "-100px",
    right: "-100px",
  },
  card: {
    background: "white",
    padding: "40px 30px",
    borderRadius: "12px",
    boxShadow: "0 15px 35px rgba(0,0,0,0.3)",
    width: "100%",
    maxWidth: "400px",
    position: "relative",
    zIndex: 1,
  },
  title: { marginBottom: "30px", textAlign: "center", color: "#333" },
  input: {
    width: "100%",
    padding: "12px 15px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "16px",
    marginBottom: "20px",
    boxSizing: "border-box",
  },
  passwordWrapper: {
    position: "relative",
    marginBottom: "20px",
  },
  eyeIcon: {
    position: "absolute",
    top: "50%",
    right: "12px",
    transform: "translateY(-50%)",
    cursor: "pointer",
    fontSize: "18px",
    userSelect: "none",
  },
  button: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
    transition: "background 0.3s",
  },
  text: { marginTop: "20px", textAlign: "center", color: "#555" },
  link: { color: "#667eea", fontWeight: "500", cursor: "pointer" },
};
