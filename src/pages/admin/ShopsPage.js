// src/pages/admin/ShopsPage.js
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  getAllCustomers, addCustomer, updateCustomer, deleteCustomer
} from "../../services/firestoreService";

/* ── SVG icons ───────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="#C9A84C" strokeWidth="1.5"/>
    <path d="M10 10l3 3" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const PhoneIcon = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
    <path d="M3 2h3l1 3-2 1a9 9 0 004 4l1-2 3 1v3a1 1 0 01-1 1C6 13 3 10 3 3a1 1 0 011-1z"
      fill="#C9A84C"/>
  </svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="#C9A84C" strokeWidth="1.4"
      strokeLinejoin="round"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4H5z"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const TableIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M1 5h14M1 9h14M6 5v9" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);
const GridIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

const EMPTY = {
  name:"", address:"", phone_no:"", assigned_discount:10, active:true,
  latitude:"", longitude:""
};

export default function ShopsPage() {
  const [shops, setShops]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [search, setSearch]         = useState("");
  const [filterDisc, setFilterDisc] = useState("All");
  const [saving, setSaving]         = useState(false);
  const [viewMode, setViewMode]     = useState("grid");

  const load = async () => {
    setLoading(true);
    const s = await getAllCustomers();
    setShops(s.sort((a,b) => a.name?.localeCompare(b.name)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (s) => {
    setEditing(s.id);
    setForm({
      name:              s.name              || "",
      address:           s.address           || "",
      phone_no:          s.phone_no          || "",
      assigned_discount: s.assigned_discount ?? 10,
      active:            s.active            !== false,
      latitude:          s.latitude          || "",
      longitude:         s.longitude         || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Shop name is required"); return; }
    setSaving(true);
    try {
      const data = {
        name:              form.name.trim(),
        address:           form.address.trim(),
        phone_no:          form.phone_no.trim(),
        assigned_discount: parseFloat(form.assigned_discount) || 0,
        active:            form.active,
        latitude:          Number(form.latitude)  || 0,
        longitude:         Number(form.longitude) || 0,
      };
      if (editing) { await updateCustomer(editing, data); toast.success("Shop updated!"); }
      else         { await addCustomer(data);              toast.success("Shop added!"); }
      setShowForm(false); load();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (s) => {
    await updateCustomer(s.id, { active: !s.active });
    toast.success(s.active ? `"${s.name}" deactivated` : `"${s.name}" activated`);
    load();
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Permanently delete "${s.name}"?`)) return;
    await deleteCustomer(s.id);
    toast.success("Shop deleted");
    load();
  };

  const set = k => e => setForm(prev => ({...prev, [k]: e.target.value}));

  const filtered = shops.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
                        s.address?.toLowerCase().includes(search.toLowerCase()) ||
                        s.phone_no?.includes(search);
    const matchDisc   = filterDisc === "All" || String(s.assigned_discount) === filterDisc;
    return matchSearch && matchDisc;
  });

  const activeCount = shops.filter(s => s.active !== false).length;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>Shops</h2>
          <p style={S.sub}>{shops.length} total · {activeCount} active · {shops.length - activeCount} inactive</p>
        </div>
        <button style={S.addBtn} onClick={openNew}>+ Add Shop</button>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <SearchIcon/>
          <input style={S.searchInput}
            placeholder="Search by name, address or phone…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button style={S.clearBtn} onClick={() => setSearch("")}>✕</button>}
        </div>
        <div style={S.filterRow}>
          {["All","10","15"].map(d => (
            <button key={d}
              style={{...S.discTab,
                background: filterDisc===d?"#1A1A2E":"#fff",
                color:      filterDisc===d?"#C9A84C":"#1A1A2E",
                border:     `1.5px solid ${filterDisc===d?"#1A1A2E":"#C9A84C"}`}}
              onClick={() => setFilterDisc(d)}>
              {d==="All" ? "All discounts" : `${d}% discount`}
            </button>
          ))}
        </div>
        <div style={S.viewToggle}>
          <button style={{...S.viewBtn,
            background:viewMode==="table"?"#1A1A2E":"#fff",
            color:viewMode==="table"?"#C9A84C":"#6B6B6B"}}
            onClick={() => setViewMode("table")}>
            <TableIcon/> Table
          </button>
          <button style={{...S.viewBtn,
            background:viewMode==="grid"?"#1A1A2E":"#fff",
            color:viewMode==="grid"?"#C9A84C":"#6B6B6B"}}
            onClick={() => setViewMode("grid")}>
            <GridIcon/> Grid
          </button>
        </div>
      </div>

      <p style={S.resultCount}>Showing {filtered.length} of {shops.length} shops</p>

      {/* Form Modal */}
      {showForm && (
        <div style={S.modalBg}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>{editing ? "Edit Shop" : "Add New Shop"}</h3>

            <label style={S.label}>Shop Name *</label>
            <input style={S.input} placeholder="e.g. 132×62 CoCo"
              value={form.name} onChange={set("name")} autoFocus />

            <label style={S.label}>Address</label>
            <input style={S.input} placeholder="e.g. 132×62"
              value={form.address} onChange={set("address")} />

            <label style={S.label}>Phone Number</label>
            <input style={S.input} placeholder="e.g. 09123456789"
              value={form.phone_no} onChange={set("phone_no")} />

            <label style={S.label}>Discount %
              <span style={{fontWeight:400,color:"#C4B5A5",fontSize:11,marginLeft:6}}>
                (decimals allowed e.g. 12.5)
              </span>
            </label>
            <div style={S.discRow}>
              {[0, 5, 10, 15, 20].map(d => (
                <button key={d} type="button"
                  style={{...S.discChip,
                    background: Number(form.assigned_discount)===d?"#1A1A2E":"#FAF7F2",
                    color:      Number(form.assigned_discount)===d?"#C9A84C":"#1A1A2E",
                    border:     `1.5px solid ${Number(form.assigned_discount)===d?"#1A1A2E":"#C9A84C"}`,
                  }}
                  onClick={() => setForm(p => ({...p, assigned_discount:d}))}>
                  {d}%
                </button>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
              <input style={{...S.input,width:"100%",padding:"10px 14px"}}
                type="number" min={0} max={100} step={0.5}
                value={form.assigned_discount}
                onChange={e => setForm(p => ({...p, assigned_discount: e.target.value}))}
                placeholder="Or type custom % e.g. 12.5" />
              <span style={{fontSize:16,fontWeight:700,color:"#1A1A2E",flexShrink:0}}>%</span>
            </div>

            <div style={S.toggleRow}>
              <span style={S.label}>Active shop</span>
              <label style={S.switch}>
                <input type="checkbox" checked={form.active}
                  onChange={e => setForm(p => ({...p, active:e.target.checked}))} />
                <span style={{...S.switchTrack, background:form.active?"#1A1A2E":"#ccc"}}>
                  <span style={{...S.switchThumb, transform:form.active?"translateX(20px)":"translateX(2px)"}} />
                </span>
              </label>
            </div>

            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={S.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing ? "Update Shop" : "Add Shop"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p style={{color:"#C4B5A5",textAlign:"center",padding:40}}>Loading shops…</p>
      ) : filtered.length === 0 ? (
        <div style={S.empty}>
          <div style={{fontSize:40,marginBottom:12,opacity:0.3}}>
            <SearchIcon/>
          </div>
          <p style={{color:"#C4B5A5"}}>No shops found for "{search}"</p>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div style={S.tableCard}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Shop Name</th>
                <th style={S.th}>Address</th>
                <th style={S.th}>Phone</th>
                <th style={{...S.th,textAlign:"center"}}>Discount</th>
                <th style={{...S.th,textAlign:"center"}}>Status</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{...S.tr, opacity:s.active===false?0.5:1}}>
                  <td style={S.td}><b>{s.name}</b></td>
                  <td style={{...S.td,color:"#6B6B6B",fontSize:12}}>{s.address||"—"}</td>
                  <td style={{...S.td,fontSize:12}}>{s.phone_no||"—"}</td>
                  <td style={{...S.td,textAlign:"center"}}>
                    <span style={{...S.discBadge,...discColor(s.assigned_discount)}}>
                      {s.assigned_discount}%
                    </span>
                  </td>
                  <td style={{...S.td,textAlign:"center"}}>
                    {s.active===false
                      ? <span style={S.inactivePill}>Inactive</span>
                      : <span style={S.activePill}>Active</span>}
                  </td>
                  <td style={S.td}>
                    <div style={{display:"flex",gap:6}}>
                      <button style={S.editBtnSm} onClick={() => openEdit(s)}>
                        <EditIcon/> Edit
                      </button>
                      <button style={{...S.toggleBtnSm,
                        background:s.active===false?"#E8F5EE":"#FEF2F2",
                        color:s.active===false?"#2D7A4F":"#A32D2D"}}
                        onClick={() => handleToggle(s)}>
                        {s.active===false ? "Enable" : "Disable"}
                      </button>
                      <button style={S.delBtnSm} onClick={() => handleDelete(s)}>
                        <TrashIcon/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW */
        <div style={S.grid}>
          {filtered.map(s => (
            <div key={s.id} style={{...S.gridCard, opacity:s.active===false?0.55:1}}>
              <div style={S.gridTop}>
                <span style={{...S.discBadge,...discColor(s.assigned_discount)}}>
                  {s.assigned_discount}%
                </span>
                {s.active===false && <span style={S.inactivePill}>Inactive</span>}
              </div>
              <div style={S.shopName}>{s.name}</div>
              <div style={S.shopAddr}>{s.address||"—"}</div>
              <div style={S.shopPhone}>
                <PhoneIcon/> {s.phone_no||"—"}
              </div>
              <div style={S.gridActions}>
                <button style={S.editBtnSm} onClick={() => openEdit(s)}>
                  <EditIcon/> Edit
                </button>
                <button style={{...S.toggleBtnSm,
                  background:s.active===false?"#E8F5EE":"#FEF2F2",
                  color:s.active===false?"#2D7A4F":"#A32D2D"}}
                  onClick={() => handleToggle(s)}>
                  {s.active===false ? "Enable" : "Disable"}
                </button>
                <button style={S.delBtnSm} onClick={() => handleDelete(s)}>
                  <TrashIcon/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Discount badge colours — all within the navy/gold/green palette */
const discColor = (d) => {
  if (d >= 15) return { background:"rgba(201,168,76,0.15)", color:"#A67C3A" };
  if (d >= 10) return { background:"rgba(201,168,76,0.08)", color:"#C9A84C" };
  if (d >  0)  return { background:"#F0F7F2", color:"#2D7A4F" };
  return { background:"#F1EFE8", color:"#6B6B6B" };
};

const S = {
  page:        { fontFamily:"'Inter',sans-serif" },
  header:      { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 },
  h2:          { margin:0, fontSize:22, fontWeight:700, color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  sub:         { margin:"4px 0 0", fontSize:13, color:"#6B6B6B" },
  addBtn:      { background:"#1A1A2E", color:"#C9A84C", border:"none", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontSize:13, fontWeight:600, flexShrink:0, letterSpacing:"0.3px" },
  /* Toolbar */
  toolbar:     { display:"flex", gap:10, marginBottom:12, flexWrap:"wrap", alignItems:"center" },
  searchWrap:  { display:"flex", alignItems:"center", gap:8, background:"#fff", border:"1px solid #E5DDD0", borderRadius:6, padding:"0 12px", flex:1, minWidth:220 },
  searchInput: { flex:1, border:"none", background:"transparent", padding:"10px 0", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif" },
  clearBtn:    { background:"none", border:"none", cursor:"pointer", color:"#C4B5A5", fontSize:14 },
  filterRow:   { display:"flex", gap:6 },
  discTab:     { borderRadius:20, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"'Inter',sans-serif" },
  viewToggle:  { display:"flex", border:"1.5px solid #C9A84C", borderRadius:8, overflow:"hidden" },
  viewBtn:     { border:"none", padding:"7px 12px", cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:5 },
  resultCount: { fontSize:12, color:"#C4B5A5", margin:"0 0 12px" },
  /* Table */
  tableCard:   { background:"#fff", borderRadius:8, overflow:"auto", border:"1px solid #E5DDD0" },
  table:       { width:"100%", borderCollapse:"collapse", minWidth:600 },
  thead:       { background:"#1A1A2E" },
  th:          { padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#C9A84C", letterSpacing:"0.6px", whiteSpace:"nowrap" },
  tr:          { borderBottom:"1px solid #F5E8D8" },
  td:          { padding:"10px 14px", fontSize:13 },
  discBadge:   { fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, display:"inline-block" },
  activePill:  { background:"#E8F5EE", color:"#2D7A4F", fontSize:11, padding:"3px 9px", borderRadius:6, fontWeight:600 },
  inactivePill:{ background:"#F1EFE8", color:"#6B6B6B",  fontSize:11, padding:"3px 9px", borderRadius:6, fontWeight:600 },
  editBtnSm:   { background:"#FAF7F2", border:"1px solid #C9A84C", color:"#1A1A2E", borderRadius:6, padding:"5px 10px", cursor:"pointer", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:4 },
  toggleBtnSm: { border:"none", borderRadius:6, padding:"5px 10px", cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:"'Inter',sans-serif" },
  delBtnSm:    { background:"#FEF2F2", border:"1px solid #FECACA", color:"#A32D2D", borderRadius:6, padding:"5px 8px", cursor:"pointer", display:"flex", alignItems:"center" },
  /* Grid */
  grid:        { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:12 },
  gridCard:    { background:"#fff", borderRadius:8, padding:16, border:"1px solid #E5DDD0", borderTop:"2px solid #C9A84C" },
  gridTop:     { display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" },
  shopName:    { fontWeight:700, fontSize:14, color:"#1A1A2E", marginBottom:3, fontFamily:"'Playfair Display',serif" },
  shopAddr:    { fontSize:11, color:"#6B6B6B", marginBottom:3 },
  shopPhone:   { fontSize:11, color:"#6B6B6B", marginBottom:10, display:"flex", alignItems:"center", gap:5 },
  gridActions: { display:"flex", gap:6, flexWrap:"wrap" },
  /* Empty */
  empty:       { textAlign:"center", marginTop:60, padding:40 },
  /* Modal */
  modalBg:     { position:"fixed", inset:0, background:"rgba(26,26,46,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 },
  modal:       { background:"#fff", borderRadius:10, padding:28, width:"100%", maxWidth:440, boxShadow:"0 16px 48px rgba(0,0,0,0.2)", maxHeight:"92vh", overflowY:"auto", borderTop:"3px solid #C9A84C" },
  modalTitle:  { margin:"0 0 18px", fontSize:18, fontWeight:700, color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  label:       { display:"block", fontSize:12, fontWeight:600, color:"#1A1A2E", marginBottom:5, marginTop:12, letterSpacing:"0.4px" },
  input:       { width:"100%", padding:"10px 14px", border:"1.5px solid #E8D5C0", borderRadius:8, fontSize:13, boxSizing:"border-box", background:"#FAF7F2", outline:"none", fontFamily:"'Inter',sans-serif" },
  discRow:     { display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" },
  discChip:    { borderRadius:20, padding:"7px 14px", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'Inter',sans-serif" },
  toggleRow:   { display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:14 },
  switch:      { position:"relative", cursor:"pointer" },
  switchTrack: { display:"block", width:44, height:24, borderRadius:8, transition:"background 0.2s", position:"relative" },
  switchThumb: { position:"absolute", top:2, width:20, height:20, background:"#fff", borderRadius:6, transition:"transform 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" },
  modalBtns:   { display:"flex", gap:10, marginTop:24 },
  cancelBtn:   { flex:1, background:"#FAF7F2", border:"1px solid #E5DDD0", borderRadius:8, padding:12, cursor:"pointer", fontSize:13, color:"#6B6B6B", fontFamily:"'Inter',sans-serif" },
  saveBtn:     { flex:2, background:"#1A1A2E", color:"#C9A84C", border:"none", borderRadius:8, padding:12, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Inter',sans-serif" },
};
