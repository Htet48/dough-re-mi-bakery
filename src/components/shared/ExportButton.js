// src/components/shared/ExportButton.js
// Reusable export button — local download OR Google Drive
import React, { useState } from "react";
import toast from "react-hot-toast";
import { uploadToDrive, rowsToCSV } from "../../utils/driveExport";

export default function ExportButton({
  rows,           // array of row objects to export
  filename,       // e.g. "QB_Sales_2026-04-28.csv"
  label = "Export CSV",
  style = {},
}) {
  const [showMenu, setShowMenu]   = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!rows || rows.length === 0) return null;

  // ── Local download (same as current exportCSV) ──────────
  const downloadLocal = () => {
    setShowMenu(false);
    const BOM  = '\uFEFF';
    const headers = Object.keys(rows[0]).join(',');
    const body    = rows.map(r =>
      Object.values(r).map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([BOM + headers + '\n' + body], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded: ${filename}`);
  };

  // ── Upload to Google Drive ──────────────────────────────
  const uploadDrive = async () => {
    setShowMenu(false);
    setUploading(true);
    try {
      const csv = rowsToCSV(rows);
      const url = await uploadToDrive(csv, filename);
      toast.success(
        <div>
          <div style={{fontWeight:600}}>Saved to Google Drive!</div>
          <div style={{fontSize:12,marginTop:4}}>Folder: QB_Reports</div>
          <a href={url} target="_blank" rel="noreferrer"
            style={{color:'#1D9E75',fontSize:12,display:'block',marginTop:4}}>
            Open in Drive →
          </a>
        </div>,
        { duration: 6000 }
      );
    } catch (e) {
      if (e.message?.includes('popup')) {
        toast.error('Please allow the Google sign-in popup and try again.');
      } else if (e.message?.includes('not initialized')) {
        toast.error('Google Drive not configured. Check API keys in .env file.');
      } else {
        toast.error('Drive upload failed: ' + e.message);
      }
    } finally { setUploading(false); }
  };

  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      {/* Main button */}
      <div style={{ display:'flex', ...style }}>
        <button
          style={B.mainBtn}
          onClick={downloadLocal}
          disabled={uploading}
        >
          {uploading ? '⏳ Uploading…' : `⬇ ${label}`}
        </button>
        <button
          style={B.chevronBtn}
          onClick={() => setShowMenu(v => !v)}
          disabled={uploading}
          title="More export options"
        >
          ▾
        </button>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          <div style={B.backdrop} onClick={() => setShowMenu(false)}/>
          <div style={B.menu}>
            <button style={B.menuItem} onClick={downloadLocal}>
              <span style={{fontSize:16}}>💾</span>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>Download to device</div>
                <div style={{fontSize:11,color:'#888',marginTop:1}}>Saves to your Downloads folder</div>
              </div>
            </button>
            <div style={B.divider}/>
            <button style={B.menuItem} onClick={uploadDrive}>
              <span style={{fontSize:16}}>☁️</span>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>Save to Google Drive</div>
                <div style={{fontSize:11,color:'#888',marginTop:1}}>
                  Signs in → saves to QB_Reports folder
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const B = {
  mainBtn:    { background:'#C9A84C', color:'#fff', border:'none', borderRadius:'8px 0 0 8px', padding:'9px 14px', cursor:'pointer', fontSize:13, fontWeight:600 },
  chevronBtn: { background:'#B0832E', color:'#fff', border:'none', borderLeft:'1px solid rgba(255,255,255,0.3)', borderRadius:'0 8px 8px 0', padding:'9px 10px', cursor:'pointer', fontSize:12 },
  backdrop:   { position:'fixed', inset:0, zIndex:99 },
  menu:       { position:'absolute', top:'calc(100% + 6px)', right:0, background:'#fff', borderRadius:12, boxShadow:'0 8px 28px rgba(0,0,0,0.15)', border:'1px solid #F0E0CC', zIndex:100, minWidth:230, overflow:'hidden' },
  menuItem:   { display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px 16px', background:'none', border:'none', cursor:'pointer', textAlign:'left', color:'#333' },
  divider:    { height:1, background:'#F5E8D8', margin:'0 12px' },
};
