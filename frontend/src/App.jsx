import React, {useState} from 'react';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import TelecallerDashboard from './pages/TelecallerDashboard';

export default function App(){
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [showSignup, setShowSignup] = useState(false);
  const onLogin = (t)=>{ localStorage.setItem('token', t); setToken(t); };
  const onLogout = ()=>{ localStorage.removeItem('token'); setToken(null); };
  if(!token){
    return showSignup ? <Signup onLogin={onLogin} onToggle={()=>setShowSignup(false)} /> : <Login onLogin={onLogin} onToggle={()=>setShowSignup(true)} />;
  }
  const payload = JSON.parse(atob(token.split('.')[1]));
  const role = payload.role;
  if(role === 'admin') return <AdminDashboard token={token} onLogout={onLogout} />;
  if(role === 'manager') return <ManagerDashboard token={token} onLogout={onLogout} />;
  return <TelecallerDashboard token={token} onLogout={onLogout} />;
}
