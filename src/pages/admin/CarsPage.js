// src/pages/admin/CarsPage.js
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getAllCars, addCar, updateCar, deleteCar, getAllUsers } from "../../services/firestoreService";

/* ── SVG icons ───────────────────────────────────────────── */
const CarSvg = ({ size=32 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect x="4" y="16" width="32" height="14" rx="3" fill="#C9A84C" opacity="0.12" stroke="#C9A84C" strokeWidth="1.5"/>
    <path d="M8 16l4-8h16l4 8" stroke="#C9A84C" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="11" cy="30" r="4" fill="#1A1A2E" stroke="#C9A84C" strokeWidth="1.5"/>
    <circle cx="29" cy="30" r="4" fill="#1A1A2E" stroke="#C9A84C" strokeWidth="1.5"/>
    <path d="M4 22h32" stroke="#C9A84C" strokeWidth="1" opacity="0.4"/>
  </svg>
);
const PlateIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="4" width="14" height="8" rx="1.5" stroke="#C9A84C" strokeWidth="1.3"/>
    <path d="M4 8h8M5 6v4M11 6v4" stroke="#C9A84C" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);
const DriverIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M8 1a3 3 0 100 6 3 3 0 000-6zm-5 9a5 5 0 0110 0H3z" fill="#C9A84C"/>
  </svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="#C9A84C" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4H5z"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

export default function CarsPage() {
  const [cars, setCars]         = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ name: "", plateNo: "", driverUid: "" });

  const load = async () => {
    const [c, u] = await Promise.all([getAllCars(), getAllUsers()]);
    setCars(c);
    setUsers(u.filter(u => u.role === "salesperson"));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew  = () => { setEditing(null); setForm({ name:"", plateNo:"", driverUid:"" }); setShowForm(true); };
  const openEdit = (car) => {
    setEditing(car.id);
    setForm({ name: car.name||"", plateNo: car.plateNo||"", driverUid: car.driverUid||"" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Car name is required"); return; }
    try {
      if (editing) { await updateCar(editing, form); toast.success("Car updated!"); }
      else         { await addCar(form);              toast.success("Car added!"); }
      setShowForm(false); load();
    } catch (e) { toast.error("Error: " + e.message); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await deleteCar(id);
    toast.success("Car deleted");
    load();
  };

  const driverName = (uid) => users.find(u => u.id === uid)?.name || "—";

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h2 style={S.h2}>Cars / Routes</h2>
        <button style={S.addBtn} onClick={openNew}>+ Add Car</button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={S.modalBg}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>{editing ? "Edit Car" : "Add New Car"}</h3>

            <label style={S.label}>Car Name *</label>
            <input style={S.input} placeholder="e.g. Car-1, Morning Route"
              value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />

            <label style={S.label}>Plate Number</label>
            <input style={S.input} placeholder="e.g. 1A-1234"
              value={form.plateNo} onChange={e => setForm({...form, plateNo: e.target.value})} />

            <label style={S.label}>Assigned Driver <span style={S.optional}>(optional)</span></label>
            <select style={S.input} value={form.driverUid}
              onChange={e => setForm({...form, driverUid: e.target.value})}>
              <option value="">— Not assigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={S.saveBtn} onClick={handleSave}>
                {editing ? "Update" : "Add Car"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p style={{color:"#C4B5A5",textAlign:"center",padding:40}}>Loading…</p>
      ) : cars.length === 0 ? (
        <div style={S.empty}>
          <div style={{marginBottom:12,opacity:0.4}}><CarSvg size={48}/></div>
          <p style={{color:"#C4B5A5"}}>No cars yet. Click <b>+ Add Car</b> to start.</p>
        </div>
      ) : (
        <div style={S.grid}>
          {cars.map(car => (
            <div key={car.id} style={S.carCard}>
              {/* Car icon */}
              <div style={S.carIconWrap}>
                <CarSvg size={36}/>
              </div>
              <div style={S.carName}>{car.name}</div>
              {car.plateNo && (
                <div style={S.carMeta}>
                  <PlateIcon/> {car.plateNo}
                </div>
              )}
              <div style={S.carMeta}>
                <DriverIcon/> {driverName(car.driverUid)}
              </div>
              <div style={S.carActions}>
                <button style={S.editBtn} onClick={() => openEdit(car)}>
                  <EditIcon/> Edit
                </button>
                <button style={S.delBtn} onClick={() => handleDelete(car.id, car.name)}>
                  <TrashIcon/> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  page:       { fontFamily:"'Inter',sans-serif" },
  header:     { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 },
  h2:         { margin:0, fontSize:22, fontWeight:700, color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  addBtn:     { background:"#1A1A2E", color:"#C9A84C", border:"none", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontSize:13, fontWeight:600, letterSpacing:"0.3px" },
  empty:      { textAlign:"center", marginTop:60 },
  grid:       { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:16 },
  carCard:    { background:"#fff", borderRadius:10, padding:20, border:"1px solid #E5DDD0", borderTop:"3px solid #C9A84C", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
  carIconWrap:{ width:64, height:64, borderRadius:"50%", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:4 },
  carName:    { fontWeight:700, fontSize:16, color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  carMeta:    { fontSize:12, color:"#6B6B6B", display:"flex", alignItems:"center", gap:5 },
  carActions: { display:"flex", gap:8, marginTop:10 },
  editBtn:    { background:"#FAF7F2", border:"1px solid #C9A84C", color:"#1A1A2E", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:5 },
  delBtn:     { background:"#FEF2F2", border:"1px solid #FECACA", color:"#A32D2D", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:5 },
  /* Modal */
  modalBg:    { position:"fixed", inset:0, background:"rgba(26,26,46,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 },
  modal:      { background:"#fff", borderRadius:10, padding:32, width:420, boxShadow:"0 16px 48px rgba(0,0,0,0.2)", borderTop:"3px solid #C9A84C" },
  modalTitle: { margin:"0 0 20px", fontSize:18, fontWeight:700, color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  label:      { display:"block", fontSize:12, fontWeight:600, color:"#1A1A2E", marginBottom:6, marginTop:14, letterSpacing:"0.4px" },
  optional:   { fontWeight:400, color:"#aaa", fontSize:11 },
  input:      { width:"100%", padding:"10px 14px", border:"1.5px solid #E8D5C0", borderRadius:8, fontSize:13, boxSizing:"border-box", background:"#FAF7F2", outline:"none", fontFamily:"'Inter',sans-serif" },
  modalBtns:  { display:"flex", gap:10, marginTop:24, justifyContent:"flex-end" },
  cancelBtn:  { background:"#FAF7F2", border:"1px solid #E5DDD0", borderRadius:8, padding:"10px 18px", cursor:"pointer", fontSize:13, color:"#6B6B6B", fontFamily:"'Inter',sans-serif" },
  saveBtn:    { background:"#1A1A2E", color:"#C9A84C", border:"none", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Inter',sans-serif" },
};
