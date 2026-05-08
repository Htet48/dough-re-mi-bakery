// src/pages/admin/ProductsPage.js
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  getAllProducts, addProduct, updateProduct, deleteProduct
} from "../../services/firestoreService";

const CATEGORIES = ["Cake","Bread","Pizza","Dry","Drink","Other"];

const EMPTY = { name:"", category:"Cake", barcode:"", price:"", active:true };

export default function ProductsPage() {
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [search, setSearch]       = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    const p = await getAllProducts();
    setProducts(p.sort((a,b) => a.name?.localeCompare(b.name)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null); setForm(EMPTY); setShowForm(true);
  };
  const openEdit = (p) => {
    setEditing(p.id);
    setForm({ name:p.name||"", category:p.category||"Cake",
              barcode:p.barcode||"", price:String(p.price||""), active:p.active!==false });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim())  { toast.error("Product name is required"); return; }
    if (!form.price)        { toast.error("Price is required"); return; }
    if (isNaN(Number(form.price))) { toast.error("Price must be a number"); return; }
    setSaving(true);
    try {
      const data = {
        name:     form.name.trim(),
        category: form.category,
        barcode:  form.barcode.trim(),
        price:    Number(form.price),
        active:   form.active,
      };
      if (editing) {
        await updateProduct(editing, data);
        toast.success("Product updated!");
      } else {
        await addProduct(data);
        toast.success("Product added!");
      }
      setShowForm(false); load();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (p) => {
    await updateProduct(p.id, { active: !p.active });
    toast.success(p.active ? `"${p.name}" deactivated` : `"${p.name}" activated`);
    load();
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Permanently delete "${p.name}"?\nThis cannot be undone.`)) return;
    await deleteProduct(p.id);
    toast.success("Product deleted");
    load();
  };

  const set = k => e => setForm(prev => ({...prev, [k]: e.target.value}));

  // Filter
  const cats = ["All", ...CATEGORIES];
  const filtered = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
                        p.barcode?.includes(search);
    const matchCat    = filterCat === "All" || p.category === filterCat;
    return matchSearch && matchCat;
  });
  const activeCount   = products.filter(p => p.active !== false).length;
  const inactiveCount = products.length - activeCount;

  return (
    <div>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>Products</h2>
          <p style={S.sub}>
            {products.length} total · {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <button style={S.addBtn} onClick={openNew}>+ Add Product</button>
      </div>

      {/* Search + filter bar */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="#C9A84C" strokeWidth="1.5"/>
            <path d="M10 10l3 3" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input style={S.searchInput}
            placeholder="Search by name or barcode…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button style={S.clearBtn} onClick={() => setSearch("")}>✕</button>}
        </div>
        <div style={S.catTabs}>
          {cats.map(c => (
            <button key={c}
              style={{...S.catTab, background:filterCat===c?"#1A1A2E":"#fff",
                color:filterCat===c?"#C9A84C":"#6B6B6B",borderColor:filterCat===c?"#1A1A2E":"#E5DDD0"}}
              onClick={() => setFilterCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={S.modalBg}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>{editing ? "Edit Product" : "Add New Product"}</h3>

            <label style={S.label}>Product Name *</label>
            <input style={S.input} placeholder="e.g. Banana Cake"
              value={form.name} onChange={set("name")} autoFocus />

            <label style={S.label}>Category</label>
            <select style={S.input} value={form.category} onChange={set("category")}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <label style={S.label}>Price (Ks) *</label>
            <input style={S.input} type="number" min={0} placeholder="e.g. 1000"
              value={form.price} onChange={set("price")} />

            <label style={S.label}>Barcode <span style={S.optional}>(optional)</span></label>
            <input style={S.input} placeholder="e.g. 48850140"
              value={form.barcode} onChange={set("barcode")} />

            <div style={S.toggleRow}>
              <span style={S.label}>Active (available for sale)</span>
              <label style={S.switch}>
                <input type="checkbox" checked={form.active}
                  onChange={e => setForm(p => ({...p, active:e.target.checked}))} />
                <span style={{
                  ...S.switchTrack,
                  background: form.active ? "#1A1A2E" : "#ccc"
                }}>
                  <span style={{
                    ...S.switchThumb,
                    transform: form.active ? "translateX(20px)" : "translateX(2px)"
                  }} />
                </span>
              </label>
            </div>

            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={S.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing ? "Update" : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product grid */}
      {loading ? <p style={{color:"#888"}}>Loading…</p> : (
        filtered.length === 0 ? (
          <div style={S.empty}>
            <div style={{fontSize:48}}>🔍</div>
            <p>No products found for "{search || filterCat}"</p>
          </div>
        ) : (
          <div style={S.grid}>
            {filtered.map(p => (
              <div key={p.id} style={{...S.card, opacity:p.active===false?0.55:1}}>
                {/* Category badge */}
                <div style={S.cardTop}>
                  <span style={{...S.catBadge, ...catColor(p.category)}}>
                    {p.category}
                  </span>
                  {p.active === false && (
                    <span style={S.inactiveBadge}>Inactive</span>
                  )}
                </div>

                <div style={S.productName}>{p.name}</div>
                <div style={S.productPrice}>{p.price?.toLocaleString()} Ks</div>
                {p.barcode && (
                  <div style={S.barcode}>#{p.barcode}</div>
                )}

                <div style={S.cardActions}>
                  <button style={S.editBtn} onClick={() => openEdit(p)}>Edit</button>
                  <button
                    style={{...S.toggleBtn,
                      background: p.active===false?"#E8F5EE":"#FEF2F2",
                      color:      p.active===false?"#2D7A4F":"#A32D2D"}}
                    onClick={() => handleToggle(p)}>
                    {p.active===false ? "Enable" : "Disable"}
                  </button>
                  <button style={S.delBtn} onClick={() => handleDelete(p)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

const catColor = (cat) => {
  const map = {
    Cake:  { background:"rgba(201,168,76,0.15)", color:"#A67C3A" },
    Bread: { background:"rgba(201,168,76,0.08)", color:"#C9A84C" },
    Pizza: { background:"rgba(163,45,45,0.08)",  color:"#A32D2D" },
    Dry:   { background:"#F1EFE8",               color:"#6B6B6B" },
    Drink: { background:"rgba(26,26,46,0.08)",   color:"#1A1A2E" },
    Other: { background:"#E8F5EE",               color:"#2D7A4F" },
  };
  return map[cat] || map.Other;
};

const S = {
  header:      { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:10 },
  h2:          { margin:0, fontSize:22, fontWeight:700, color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  sub:         { margin:"4px 0 0", fontSize:12, color:"#6B6B6B" },
  addBtn:      { background:"#1A1A2E", color:"#C9A84C", border:"none", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontSize:13, fontWeight:600, flexShrink:0, fontFamily:"'Inter',sans-serif", letterSpacing:"0.3px" },
  toolbar:     { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" },
  searchWrap:  { display:"flex", alignItems:"center", gap:8, background:"#fff", border:"1px solid #E5DDD0", borderRadius:6, padding:"0 12px", flex:1, minWidth:200 },
  searchInput: { flex:1, border:"none", background:"transparent", padding:"10px 0", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif" },
  clearBtn:    { background:"none", border:"none", cursor:"pointer", color:"#bbb", fontSize:13 },
  catTabs:     { display:"flex", gap:6, flexWrap:"wrap" },
  catTab:      { border:"1px solid #E5DDD0", borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"'Inter',sans-serif" },
  grid:        { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10 },
  card:        { background:"#fff", borderRadius:8, padding:14, border:"1px solid #E5DDD0", display:"flex", flexDirection:"column", gap:6, borderTop:"2px solid #C9A84C" },
  cardTop:     { display:"flex", justifyContent:"space-between", alignItems:"center" },
  catBadge:    { fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:4 },
  inactiveBadge:{ fontSize:10, background:"#F2EDE4", color:"#6B6B6B", padding:"2px 8px", borderRadius:4 },
  productName: { fontWeight:600, fontSize:14, color:"#1A1A2E", lineHeight:1.3, fontFamily:"'Playfair Display',serif" },
  productPrice:{ fontSize:17, fontWeight:700, color:"#C9A84C", fontFamily:"'Playfair Display',serif" },
  barcode:     { fontSize:10, color:"#C4B5A5", fontFamily:"monospace" },
  cardActions: { display:"flex", gap:6, marginTop:6, flexWrap:"wrap" },
  editBtn:     { flex:1, background:"#FAF7F2", border:"1px solid #E5DDD0", color:"#1A1A2E", borderRadius:5, padding:"6px 4px", cursor:"pointer", fontSize:11, fontWeight:600, textAlign:"center", fontFamily:"'Inter',sans-serif" },
  toggleBtn:   { flex:1, border:"none", borderRadius:5, padding:"6px 4px", cursor:"pointer", fontSize:11, fontWeight:600, textAlign:"center", fontFamily:"'Inter',sans-serif" },
  delBtn:      { background:"#FEE2E2", border:"none", color:"#A32D2D", borderRadius:5, padding:"6px 10px", cursor:"pointer", fontSize:11 },
  empty:       { textAlign:"center", marginTop:60, color:"#C4B5A5" },
  // Modal
  modalBg:     { position:"fixed", inset:0, background:"rgba(26,26,46,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 },
  modal:       { background:"#fff", borderRadius:10, padding:28, width:"100%", maxWidth:420, borderTop:"3px solid #C9A84C", maxHeight:"90vh", overflowY:"auto" },
  modalTitle:  { margin:"0 0 18px", fontSize:18, fontWeight:700, color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  label:       { display:"block", fontSize:13, fontWeight:600, color:"#1A1A2E", marginBottom:5, marginTop:12 },
  optional:    { fontWeight:400, color:"#aaa", fontSize:11 },
  input:       { width:"100%", padding:"10px 14px", border:"1.5px solid #E8D5C0", borderRadius:10, fontSize:14, boxSizing:"border-box", background:"#FAF7F2", outline:"none" },
  toggleRow:   { display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:14 },
  switch:      { position:"relative", cursor:"pointer" },
  switchTrack: { display:"block", width:44, height:24, borderRadius:12, transition:"background 0.2s", position:"relative" },
  switchThumb: { position:"absolute", top:2, width:20, height:20, background:"#fff", borderRadius:10, transition:"transform 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" },
  modalBtns:   { display:"flex", gap:10, marginTop:24 },
  cancelBtn:   { flex:1, background:"#F5F5F5", border:"none", borderRadius:10, padding:12, cursor:"pointer", fontSize:14 },
  saveBtn:     { flex:2, background:"#1A1A2E", color:"#C9A84C", border:"none", borderRadius:10, padding:12, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Inter',sans-serif" },
};
