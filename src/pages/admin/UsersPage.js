// src/pages/admin/UsersPage.js
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../services/firebase";
import { getAllUsers, createUser, updateUser, deleteUser, getAllCars } from "../../services/firestoreService";

export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [cars, setCars]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]  = useState(null);
  const [form, setForm] = useState({
    name:"", username:"", email:"", password:"", role:"salesperson", carId:""
  });

  const load = async () => {
    const [u, c] = await Promise.all([getAllUsers(), getAllCars()]);
    setUsers(u); setCars(c); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name:"", username:"", email:"", password:"", role:"salesperson", carId:"" });
    setShowForm(true);
  };
  const openEdit = (u) => {
    setEditing(u.id);
    setForm({ name:u.name||"", username:u.username||"", email:u.email||"",
              password:"", role:u.role||"salesperson", carId:u.carId||"" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim())     { toast.error("Name is required"); return; }
    if (!form.username.trim()) { toast.error("Username is required"); return; }
    // Validate username — no spaces, lowercase only
    if (!/^[a-z0-9_.-]+$/.test(form.username.toLowerCase())) {
      toast.error("Username: letters, numbers, _ . - only (no spaces)"); return;
    }
    try {
      if (editing) {
        await updateUser(editing, {
          name: form.name,
          username: form.username.toLowerCase().trim(),
          role: form.role,
          carId: form.carId,
          email: form.email,
        });
        toast.success("User updated!");
      } else {
        if (!form.email)    { toast.error("Email is required"); return; }
        if (!form.password) { toast.error("Password is required"); return; }
        // Check min password length
        if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await createUser(cred.user.uid, {
          name:     form.name,
          username: form.username.toLowerCase().trim(),
          email:    form.email,
          role:     form.role,
          carId:    form.carId,
        });
        toast.success(`User "${form.name}" created! They can login with username: ${form.username}`);
      }
      setShowForm(false); load();
    } catch(e) {
      if (e.code === "auth/email-already-in-use") toast.error("Email already in use");
      else toast.error(e.message);
    }
  };

  const handleResetPassword = async (u) => {
    if (!u.email) { toast.error(`No email for ${u.name}`); return; }
    if (!window.confirm(`Send password reset email to:\n${u.email}\n\n${u.name} will receive a link to set a new password.`)) return;
    try {
      await sendPasswordResetEmail(auth, u.email);
      toast.success(`✅ Reset email sent to ${u.name} (${u.email})`, { duration:6000 });
    } catch(e) {
      toast.error("Failed: " + e.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"?`)) return;
    await deleteUser(id); toast.success("Deleted"); load();
  };

  const carName    = (id) => cars.find(c=>c.id===id)?.name || "—";
  const roleColor  = (r)  => r==="admin" ? "#A67C3A" : "#2D7A4F";
  const roleBg     = (r)  => r==="admin" ? "#FAF7F2" : "#F0F7F2";
  const F = form;
  const set = (k) => (e) => setForm(prev => ({...prev, [k]: e.target.value}));

  return (
    <div>
      <div style={S.header}>
        <h2 style={S.h2}>Users</h2>
        <button style={S.addBtn} onClick={openNew}>+ Add User</button>
      </div>

      {showForm && (
        <div style={S.modalBg}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>{editing ? "Edit User" : "Add New User"}</h3>

            <label style={S.label}>Full Name *</label>
            <input style={S.input} placeholder="e.g. Grace" value={F.name} onChange={set("name")} />

            <label style={S.label}>Username * <span style={S.hint}>(used to login)</span></label>
            <input style={S.input} placeholder="e.g. grace01 (no spaces)"
              value={F.username} onChange={set("username")}
              autoCapitalize="none" autoCorrect="off" />

            {!editing && <>
              <label style={S.label}>Email *</label>
              <input style={S.input} type="email" placeholder="email@example.com"
                value={F.email} onChange={set("email")} />
              <label style={S.label}>Password * <span style={S.hint}>(min 6 characters)</span></label>
              <input style={S.input} type="password" placeholder="min 6 characters"
                value={F.password} onChange={set("password")} />
            </>}

            <label style={S.label}>Role</label>
            <select style={S.input} value={F.role} onChange={set("role")}>
              <option value="salesperson">Salesperson</option>
              <option value="admin">Admin</option>
            </select>

            {F.role === "salesperson" && <>
              <label style={S.label}>Assigned Car</label>
              <select style={S.input} value={F.carId} onChange={set("carId")}>
                <option value="">— No car assigned —</option>
                {cars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>}

            {/* Login info preview */}
            {!editing && F.username && (
              <div style={S.loginPreview}>
                <b>Login info for {F.name}:</b><br />
                Username: <code>{F.username.toLowerCase()}</code><br />
                Password: <code>{F.password ? "•".repeat(F.password.length) : "—"}</code>
              </div>
            )}

            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={()=>setShowForm(false)}>Cancel</button>
              <button style={S.saveBtn} onClick={handleSave}>
                {editing ? "Update" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p style={{color:"#6B6B6B"}}>Loading…</p> : (
        <div style={S.tableCard}>
          <table style={S.table}>
            <thead><tr style={S.thead}>
              <th style={S.th}>Name</th>
              <th style={S.th}>Username</th>
              <th style={S.th}>Email</th>
              <th style={S.th}>Role</th>
              <th style={S.th}>Car</th>
              <th style={S.th}>Actions</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={S.tr}>
                  <td style={S.td}><b>{u.name}</b></td>
                  <td style={S.td}>
                    <code style={S.usernameTag}>{u.username || "—"}</code>
                  </td>
                  <td style={S.td}>{u.email}</td>
                  <td style={S.td}>
                    <span style={{...S.badge, background:roleBg(u.role), color:roleColor(u.role)}}>
                      {u.role}
                    </span>
                  </td>
                  <td style={S.td}>{carName(u.carId)}</td>
                  <td style={S.td}>
                    <button style={S.editBtn}  onClick={()=>openEdit(u)}>✏️ Edit</button>
                    <button style={S.resetBtn} onClick={()=>handleResetPassword(u)} title="Send password reset email">🔑</button>
                    <button style={S.delBtn}   onClick={()=>handleDelete(u.id,u.name)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const S = {
  header:      {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20},
  h2:          {margin:0,fontSize:22,fontWeight:700,color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  addBtn:      {background:"#1A1A2E",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontSize:14,fontWeight:600},
  tableCard:   {background:"#fff",borderRadius:8,padding:20,border:"1px solid #E5DDD0",overflowX:"auto"},
  table:       {width:"100%",borderCollapse:"collapse"},
  thead:       {background:"#1A1A2E"},
  th:          {padding:"10px 14px",textAlign:"left",fontSize:12,fontWeight:700,color:"#C9A84C",borderBottom:"2px solid #E8D5C0"},
  tr:          {borderBottom:"1px solid #F5E8D8"},
  td:          {padding:"10px 14px",fontSize:13},
  badge:       {padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600},
  usernameTag: {background:"#F1EFE8",padding:"2px 8px",borderRadius:6,fontSize:12,color:"#1A1A2E"},
  editBtn:     {background:"#FAF7F2",border:"1px solid #C8973A",color:"#1A1A2E",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,marginRight:6},
  delBtn:      {background:"#FEE2E2",border:"none",color:"#DC2626",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12},
  modalBg:     {position:"fixed",inset:0,background:"rgba(26,26,46,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200},
  modal:       {background:"#fff",borderRadius:8,padding:32,width:440,boxShadow:"0 16px 48px rgba(0,0,0,0.2)",maxHeight:"90vh",overflowY:"auto"},
  modalTitle:  {margin:"0 0 16px",fontSize:18,fontWeight:700,color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  label:       {display:"block",fontSize:13,fontWeight:600,color:"#1A1A2E",marginBottom:5,marginTop:12},
  hint:        {fontWeight:400,color:"#C4B5A5",fontSize:11},
  input:       {width:"100%",padding:"10px 14px",border:"1.5px solid #E8D5C0",borderRadius:6,fontSize:14,boxSizing:"border-box",background:"#FAF7F2",outline:"none"},
  loginPreview:{background:"#F0F7F2",border:"1px solid #5DCAA5",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#2D7A4F",marginTop:12,lineHeight:1.7},
  modalBtns:   {display:"flex",gap:10,marginTop:24,justifyContent:"flex-end"},
  cancelBtn:   {background:"#F5F5F5",border:"none",borderRadius:8,padding:"10px 18px",cursor:"pointer",fontSize:14},
  saveBtn:     {background:"#1A1A2E",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontSize:14,fontWeight:600},
};
