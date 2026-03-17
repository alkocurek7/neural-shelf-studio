import { useState, useEffect, useRef, useCallback } from "react";

const RAINBOW = ["#e8443a","#e87c3a","#d4a843","#5ab07a","#3a8fd4","#6f5bd4","#b05aa0","#d45a8f","#4abcb0","#8b6d4f"];
const C = {
  bg:"#faf8f5", surface:"#ffffff", text:"#1a1615", muted:"#7a7068",
  border:"#ece7e1", accent:"#3a8fd4", warm:"#f5f1ec", err:"#8C3A1A", errBg:"#FFE5D9",
  tags:{
    pink:{bg:"#FFD6E0",text:"#8C3050",border:"#FFB3C6",glow:"#FFB3C640"},
    coral:{bg:"#FFE5D9",text:"#8C3A1A",border:"#FFCAB8",glow:"#FFCAB840"},
    yellow:{bg:"#FFF3C4",text:"#6B5000",border:"#FFE060",glow:"#FFE06040"},
    mint:{bg:"#D4F5E9",text:"#1A6040",border:"#90E0BF",glow:"#90E0BF40"},
    sky:{bg:"#D6EEFF",text:"#1A4870",border:"#90C8FF",glow:"#90C8FF40"},
    lavender:{bg:"#EAE0FF",text:"#4A308A",border:"#C4AAFF",glow:"#C4AAFF40"},
    teal:{bg:"#C8F0EE",text:"#1A5F5D",border:"#80D8D4",glow:"#80D8D440"},
    peach:{bg:"#FFE8D0",text:"#7A3A10",border:"#FFBF88",glow:"#FFBF8840"},
    sage:{bg:"#DDF0D4",text:"#286010",border:"#A8D898",glow:"#A8D89840"},
    rose:{bg:"#FFD9E8",text:"#7A1040",border:"#FFB0CF",glow:"#FFB0CF40"},
  }
};
const CK = Object.keys(C.tags);
const tc = (color) => C.tags[color] || C.tags.sky;
const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

/* ── Prompts (updated: compress don't abstract + source_snippets) ── */
const SYS = `You are a cognitive pattern analyst for the Neural Shelf methodology. Extract recurring cognitive and emotional patterns from text.
Respond ONLY with valid JSON. No markdown, no backticks, no preamble.
{"title":"short title","subtitle":"brief context","description":"one sentence telling user what to click first","nodes":[{"id":1,"label":"2-4 word lowercase","color":"pink","x":50,"y":30,"weight":3,"sessions":3,"source_snippets":["exact short phrase from the text that anchored this pattern","another phrase"]}],"connections":[[1,2]],"insight":"one non-obvious pattern sentence"}

LABELING RULE — compress, don't abstract:
- GOOD: "I don't trust my voice" — compressed from the person's own words
- BAD: "epistemic uncertainty" — abstracted into clinical language
- GOOD: "stuck between options" — how they said it
- BAD: "decision paralysis" — how a therapist would say it
Always use the person's actual phrasing, shortened. Never replace their words with professional terminology.

Rules: 6-14 nodes. x/y 10-90 spread out. weight 1-5. 8-20 connections. source_snippets: 1-3 short exact phrases from the input that anchored this pattern.`;

const MERGE_SYS = `You have an EXISTING cognitive map and NEW text. Analyze what's new, what strengthened, and what shifted.
Respond ONLY with valid JSON. No markdown, no backticks, no preamble.
{"updated_nodes":[{"id":1,"label":"name","color":"pink","x":50,"y":30,"weight":3,"sessions":5,"is_new":false,"shift":"strengthened","source_snippets":["phrase from new text"]}],"connections":[[1,2]],"insight":"what changed","changelog":"specific: added N patterns, strengthened X"}

LABELING RULE — compress, don't abstract. Use the person's actual phrasing, shortened. Never replace their words with professional terminology.

shift field must be one of: "new" (didn't exist before), "strengthened" (appeared again, increase weight/sessions), "stable" (unchanged), "faded" (was strong before but absent from new text — decrease weight by 1).
Keep existing IDs when strengthening. New nodes get IDs after highest existing. Preserve+add connections.`;

const COMBINE_SYS = `You have TWO cognitive maps to merge. Overlap merges, unique stays, new cross-connections form.
Respond ONLY with valid JSON. No markdown, no backticks, no preamble.
{"title":"combined title","subtitle":"context","description":"what to click first","updated_nodes":[{"id":1,"label":"name","color":"pink","x":50,"y":30,"weight":3,"sessions":5,"from_map":"a or b or both","source_snippets":[]}],"connections":[[1,2]],"insight":"what emerges","changelog":"what merged"}
LABELING RULE — compress, don't abstract. Merge similar patterns into single stronger nodes. Create NEW connections between maps.`;

const STRUCTURE_SYS = `You are building structured output from a cognitive pattern map. Respond ONLY with valid JSON. No markdown, no backticks, no preamble.`;

const NARRATIVE_PROMPT = `Given this cognitive map, write a 2-3 paragraph narrative summary in second person ("You keep returning to..."). Describe the major patterns, key connections, and any tensions or growth edges. Warm, clear prose — not clinical, not vague.
Respond with JSON: {"narrative":"the full 2-3 paragraph text"}`;

/* ── Demos ── */
const DEMOS = [
  { id:"demo-a",label:"Alexis's Map",subtitle:"14 months of AI conversations",
    description:"Click any tag to see what it connects to. Size = how often it appeared.",
    nodes:[{id:1,label:"autonomy",color:"mint",x:48,y:20,sessions:12},{id:2,label:"voice recovery",color:"coral",x:72,y:16,sessions:18},{id:3,label:"index mining",color:"teal",x:28,y:38,sessions:10},{id:4,label:"threshold moment",color:"yellow",x:57,y:36,sessions:22},{id:5,label:"fear of visibility",color:"rose",x:80,y:40,sessions:8},{id:6,label:"self-trust building",color:"mint",x:43,y:56,sessions:14},{id:7,label:"methodology building",color:"lavender",x:18,y:60,sessions:11},{id:8,label:"epistemic safety",color:"sky",x:63,y:60,sessions:7},{id:9,label:"play as process",color:"pink",x:83,y:58,sessions:5},{id:10,label:"curiosity spike",color:"peach",x:34,y:76,sessions:9},{id:11,label:"cognitive shift",color:"lavender",x:56,y:78,sessions:16},{id:12,label:"library as anchor",color:"teal",x:20,y:82,sessions:6},{id:13,label:"recombination",color:"sage",x:75,y:76,sessions:5},{id:14,label:"non-linear learning",color:"sky",x:40,y:88,sessions:10}],
    connections:[[1,6],[1,3],[2,5],[2,4],[4,6],[4,11],[6,8],[7,3],[7,12],[11,13],[10,14],[8,9],[5,9],[2,11]],
    timeline:[{date:"Oct 2024",label:"started documenting",color:"#FFE060"},{date:"Jan 2025",label:"first threshold moment",color:"#90E0BF"},{date:"May 2025",label:"voice came back",color:"#FFCAB8"},{date:"Oct 2025",label:"methodology named",color:"#C4AAFF"},{date:"Mar 2026",label:"Neural Shelf launched",color:"#FFB3C6"}],
    sources:["1,300+ sessions"]},
  { id:"demo-b",label:"A Reader's Map",subtitle:"6 months of book conversations",
    description:"Click 'meaning-making' — notice how it connects to almost everything.",
    nodes:[{id:1,label:"meaning-making",color:"yellow",x:50,y:30,sessions:20},{id:2,label:"slow reading",color:"teal",x:22,y:22,sessions:7},{id:3,label:"annotation habit",color:"mint",x:75,y:20,sessions:5},{id:4,label:"author voice",color:"lavender",x:80,y:46,sessions:11},{id:5,label:"losing my own view",color:"rose",x:24,y:50,sessions:15},{id:6,label:"rereading urge",color:"peach",x:62,y:56,sessions:6},{id:7,label:"fiction vs nonfiction",color:"sky",x:16,y:68,sessions:5},{id:8,label:"reading as escape",color:"coral",x:42,y:72,sessions:10},{id:9,label:"book as mirror",color:"pink",x:68,y:72,sessions:13},{id:10,label:"knowledge gaps",color:"sage",x:84,y:62,sessions:8},{id:11,label:"curiosity fatigue",color:"rose",x:34,y:84,sessions:5},{id:12,label:"synthesis urge",color:"lavender",x:62,y:84,sessions:9}],
    connections:[[1,5],[1,9],[1,4],[1,6],[2,5],[3,4],[4,9],[5,8],[6,9],[7,8],[8,11],[9,12],[10,12],[10,1]],sources:["Book transcripts"]},
  { id:"demo-c",label:"First Session",subtitle:"After just 1 upload",
    description:"Sparse but already honest. Every map starts here. ✦ = user-named tag.",
    nodes:[{id:1,label:"uncertainty about AI",color:"rose",x:40,y:26,sessions:1},{id:2,label:"wanting to understand",color:"sky",x:68,y:24,sessions:1},{id:3,label:"first question",color:"yellow",x:53,y:48,sessions:1},{id:4,label:"surprise at response",color:"mint",x:26,y:56,sessions:1},{id:5,label:"I named this one",color:"peach",x:72,y:58,sessions:1,userAdded:true},{id:6,label:"something shifted",color:"lavender",x:47,y:74,sessions:1}],
    connections:[[1,3],[2,3],[3,4],[3,6],[4,6]],sources:["Single upload"]}
];

/* ── Storage ── */
const store = {
  async load() {
    try { const r = await window.storage.list("nsmap:", true); if (!r?.keys?.length) return [];
      const out = []; for (const k of r.keys) { try { const r2 = await window.storage.get(k, true); if (r2?.value) out.push(JSON.parse(r2.value)); } catch {} }
      return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch { return []; }
  },
  async save(map) { try { await window.storage.set(`nsmap:${map.id}`, JSON.stringify({ ...map, updatedAt: Date.now() }), true); return true; } catch { return false; } },
  async remove(id) { try { await window.storage.delete(`nsmap:${id}`, true); return true; } catch { return false; } }
};

/* ── API ── */
async function callAI(system, userMsg, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system, messages: [{ role: "user", content: userMsg }] })
      });
      if (!r.ok) throw new Error(`API error ${r.status}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      const raw = d.content?.map(x => x.text || "").join("") || "";
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (e) { if (i === retries) throw new Error(e.message || "Failed. Try again."); }
  }
}

// Updated: preserves source_snippets and shift field
const mkNodes = (p) => (p.nodes || p.updated_nodes || []).map((n, i) => ({
  id: n.id || i + 1, label: n.label || "unnamed", color: CK.includes(n.color) ? n.color : CK[i % CK.length],
  x: Math.max(8, Math.min(92, n.x || 20 + (i * 55 / 12))), y: Math.max(8, Math.min(92, n.y || 15 + ((i % 4) * 22))),
  sessions: n.sessions || n.weight || 1, userAdded: n.userAdded || false,
  is_new: n.is_new || n.shift === "new" || false,
  shift: n.shift || null, // "new" | "strengthened" | "stable" | "faded" | null
  from_map: n.from_map || null,
  source_snippets: n.source_snippets || [], // anchoring phrases from input
}));

function chunkText(text, maxChars = 13000) {
  if (text.length <= maxChars) return [text];
  const chunks = []; let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const lb = text.lastIndexOf("\n\n", end);
      if (lb > start + maxChars * 0.5) end = lb;
      else { const lp = text.lastIndexOf(". ", end); if (lp > start + maxChars * 0.5) end = lp + 1; }
    }
    chunks.push(text.slice(start, end)); start = end;
  }
  return chunks;
}

function generateSVG(map) {
  const W = 600, H = 380;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:#f5f1ec;font-family:Georgia,serif">`;
  (map.connections || []).forEach(([a, b]) => {
    const na = map.nodes.find(n => n.id === a), nb = map.nodes.find(n => n.id === b);
    if (na && nb) svg += `<line x1="${(na.x/100)*W}" y1="${(na.y/100)*H}" x2="${(nb.x/100)*W}" y2="${(nb.y/100)*H}" stroke="#D0C8BC" stroke-width="0.8" stroke-dasharray="3 4" opacity="0.4"/>`;
  });
  map.nodes.forEach(n => {
    const x = (n.x / 100) * W, y = (n.y / 100) * H, c = tc(n.color);
    const lw = Math.max(n.label.length * 5.8 + 22, 58);
    svg += `<rect x="${x-lw/2}" y="${y-10}" width="${lw}" height="21" rx="10.5" fill="${c.bg}" stroke="${c.border}" stroke-width="1"/>`;
    svg += `<text x="${x}" y="${y+4}" text-anchor="middle" font-size="9.5" fill="${c.text}">${n.label}</text>`;
  });
  svg += `</svg>`;
  return svg;
}

/* ── Canvas with shift indicators ── */
function Canvas({ map, activeNode, setActiveNode, editable, onMove, reducedMotion }) {
  const W = 600, H = 380, drag = useRef(null), svgEl = useRef(null);
  const getXY = (e) => e.touches?.length ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
  const startDrag = (e, n) => { if (!editable) return; e.stopPropagation(); if (e.cancelable) e.preventDefault(); const { x, y } = getXY(e); drag.current = { id: n.id, sx: x, sy: y, ox: n.x, oy: n.y }; };
  const moveDrag = useCallback((e) => {
    if (!drag.current || !svgEl.current) return;
    const { x, y } = e.touches?.length ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    const rect = svgEl.current.getBoundingClientRect();
    onMove?.(drag.current.id, Math.max(8, Math.min(92, drag.current.ox + ((x - drag.current.sx) / rect.width) * 100)), Math.max(8, Math.min(92, drag.current.oy + ((y - drag.current.sy) / rect.height) * 100)));
  }, [onMove]);
  const endDrag = useCallback(() => { drag.current = null; }, []);
  useEffect(() => {
    if (!editable) return;
    window.addEventListener("mousemove", moveDrag); window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", moveDrag, { passive: false }); window.addEventListener("touchend", endDrag);
    return () => { window.removeEventListener("mousemove", moveDrag); window.removeEventListener("mouseup", endDrag); window.removeEventListener("touchmove", moveDrag); window.removeEventListener("touchend", endDrag); };
  }, [editable, moveDrag, endDrag]);
  const trans = reducedMotion ? "none" : "all 0.25s";

  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "63%", borderRadius: 14, overflow: "hidden", background: C.warm, border: `1px solid ${C.border}`, touchAction: editable ? "none" : "auto" }}
      role="img" aria-label={`Cognitive map: ${map.nodes.length} patterns, ${(map.connections||[]).length} connections`}>
      <svg ref={svgEl} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <radialGradient id="g1" cx="75%" cy="15%" r="40%"><stop offset="0%" stopColor="#FFD6E0" stopOpacity="0.1" /><stop offset="100%" stopColor="#FFD6E0" stopOpacity="0" /></radialGradient>
          <radialGradient id="g2" cx="15%" cy="80%" r="35%"><stop offset="0%" stopColor="#D4F5E9" stopOpacity="0.1" /><stop offset="100%" stopColor="#D4F5E9" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#g1)" /><rect width={W} height={H} fill="url(#g2)" />
        {(map.connections || []).map(([a, b], i) => {
          const na = map.nodes.find(n => n.id === a), nb = map.nodes.find(n => n.id === b);
          if (!na || !nb) return null;
          const act = activeNode === a || activeNode === b;
          return <line key={i} x1={(na.x / 100) * W} y1={(na.y / 100) * H} x2={(nb.x / 100) * W} y2={(nb.y / 100) * H}
            stroke={act ? "#8C7A5A" : "#D0C8BC"} strokeWidth={act ? 1.8 : 0.8} strokeDasharray={act ? "none" : "3 4"} opacity={act ? 0.85 : 0.4} style={{ transition: trans }} />;
        })}
        {map.nodes.map(n => {
          const x = (n.x / 100) * W, y = (n.y / 100) * H, c = tc(n.color);
          const lw = Math.max(n.label.length * 5.8 + 22, 58), act = activeNode === n.id;
          const isFaded = n.shift === "faded";
          const isNew = n.shift === "new" || n.is_new;
          const isStrengthened = n.shift === "strengthened";
          const nodeOpacity = isFaded ? 0.45 : 1;

          return (<g key={n.id} tabIndex={0} role="button" aria-label={`${n.label}, ${n.sessions} sessions${isNew ? ", new" : ""}${isStrengthened ? ", strengthened" : ""}${isFaded ? ", fading" : ""}`} aria-pressed={act}
            style={{ cursor: editable ? "grab" : "pointer", outline: "none", opacity: nodeOpacity }}
            onClick={() => !drag.current && setActiveNode(act ? null : n.id)}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && setActiveNode(act ? null : n.id)}
            onMouseDown={e => startDrag(e, n)} onTouchStart={e => startDrag(e, n)}>
            {act && <ellipse cx={x} cy={y} rx={lw / 2 + 10} ry={16} fill={c.glow} />}
            {/* Strengthened: double border ring */}
            {isStrengthened && <rect x={x - lw / 2 - 3} y={y - 13} width={lw + 6} height={27} rx={13.5} fill="none" stroke={c.border} strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />}
            <rect x={x - lw / 2} y={y - 10} width={lw} height={21} rx={10.5} fill={act ? c.bg : c.bg + "CC"} stroke={c.border} strokeWidth={act ? 2 : 1}
              style={{ transition: trans, filter: act ? `drop-shadow(0 2px 8px ${c.border})` : "none" }} />
            {n.userAdded && <text x={x - lw / 2 + 7} y={y + 4} fontSize="8" fill={c.text} opacity="0.7" style={{ pointerEvents: "none" }}>✦</text>}
            <text x={x + (n.userAdded ? 3 : 0)} y={y + 4} textAnchor="middle" fontSize={act ? "10.5" : "9.5"}
              fontFamily="'Source Serif 4','DM Serif Display',Georgia,serif" fill={c.text} fontWeight={act ? "600" : "400"}
              style={{ transition: trans, pointerEvents: "none" }}>{n.label}</text>
            {(n.sessions || 0) > 1 && <circle cx={x + lw / 2 - 3} cy={y - 10} r={3.5} fill={c.border} />}
            {/* NEW indicator dot */}
            {isNew && <circle cx={x - lw / 2 + 3} cy={y - 10} r={3} fill={RAINBOW[3]} />}
          </g>);
        })}
      </svg>
    </div>
  );
}

function VisualCanvas({ map }) {
  const W = 600, H = 380;
  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "63%", borderRadius: 14, overflow: "hidden", background: C.warm, border: `1px solid ${C.border}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {(map.connections || []).map(([a, b], i) => {
          const na = map.nodes.find(n => n.id === a), nb = map.nodes.find(n => n.id === b);
          if (!na || !nb) return null;
          return <line key={i} x1={(na.x / 100) * W} y1={(na.y / 100) * H} x2={(nb.x / 100) * W} y2={(nb.y / 100) * H} stroke="#D0C8BC" strokeWidth={1} opacity={0.5} />;
        })}
        {map.nodes.map(n => {
          const x = (n.x / 100) * W, y = (n.y / 100) * H, c = tc(n.color);
          return <circle key={n.id} cx={x} cy={y} r={6 + (n.sessions || 1) * 1.5} fill={c.bg} stroke={c.border} strokeWidth={1.5} opacity={n.shift === "faded" ? 0.4 : 0.9} />;
        })}
      </svg>
    </div>
  );
}

/* ── Input Panel (updated placeholder) ── */
function InputPanel({ onNew, onAdd, targets, busy }) {
  const [txt, setTxt] = useState(""); const [to, setTo] = useState("new"); const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(""); const [fileCount, setFileCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fr = useRef(null);
  const msgs = ["reading your text…", "finding patterns…", "tracing connections…", "mapping what recurs…", "almost there…"];
  const words = txt.trim() ? wordCount(txt) : 0;
  const willChunk = txt.length > 13000;
  const chunks = willChunk ? chunkText(txt) : null;

  const addFiles = useCallback(async (files) => {
    let added = 0;
    for (const f of files) {
      if (f.name.endsWith(".docx") || f.name.endsWith(".doc")) { setErr(`"${f.name}" is a Word file — save as .txt or .md first, or paste the text directly.`); continue; }
      if (f.name.endsWith(".pdf")) { setErr(`"${f.name}" is a PDF — paste the text content directly, or export to .txt first.`); continue; }
      try { const t = await f.text(); if (t.trim()) { setTxt(p => p ? p + "\n\n— " + f.name + " —\n\n" + t : t); added++; } }
      catch { setErr("Couldn't read " + f.name + " — try pasting the text directly."); }
    }
    setFileCount(p => p + added);
  }, []);

  const handleFileInput = useCallback(async (e) => { await addFiles(Array.from(e.target.files || [])); if (fr.current) fr.current.value = ""; }, [addFiles]);
  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }, []);
  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) await addFiles(files);
    else { const text = e.dataTransfer?.getData("text"); if (text) setTxt(p => p ? p + "\n\n" + text : text); }
  }, [addFiles]);

  const go = async () => {
    if (!txt.trim() || txt.trim().length < 80) { setErr("Paste a bit more — at least a paragraph."); return; }
    setErr(null); let i = 0; setMsg(msgs[0]);
    const iv = setInterval(() => { i = Math.min(i + 1, msgs.length - 1); setMsg(msgs[i]); }, 3200);
    try {
      if (to === "new") { if (willChunk) await onNew(chunks[0], chunks.slice(1)); else await onNew(txt); }
      else { await onAdd(to, txt); }
      setTxt(""); setFileCount(0);
    } catch (e) { setErr(e.message || "Something went wrong."); }
    finally { clearInterval(iv); setMsg(""); }
  };

  const summary = () => {
    const parts = [];
    if (fileCount > 0) parts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""}`);
    if (fileCount === 0 && txt.trim()) parts.push("pasted text");
    if (words > 0) parts.push(`~${words.toLocaleString()} words`);
    return parts.join(" · ");
  };

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      style={{ background: dragging ? C.warm : C.surface, borderRadius: 16, border: `2px ${dragging ? "dashed" : "solid"} ${dragging ? C.accent : C.border}`, padding: "24px 26px", transition: "all 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: RAINBOW[4] }} />
        <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>add content</span>
      </div>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, margin: "0 0 14px", fontFamily: "'Source Serif 4',Georgia,serif", fontStyle: "italic" }}>
        Paste anything — AI conversations, journal entries, notes, outlines, gravity wells. Unfinished, contradictory, and repetitive material works best. Drag files here or use the button below.
      </p>
      <textarea value={txt} onChange={e => { setTxt(e.target.value); setErr(null); }}
        placeholder={"Paste your text here — notes, conversations, outlines, half-finished thoughts, whatever you have.\n\nIt doesn't need to be organized. It doesn't need to be complete. Just put it in."}
        aria-label="Text input for pattern analysis"
        style={{ width: "100%", minHeight: 140, padding: "14px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.warm, color: C.text, fontSize: 13, fontFamily: "'Source Serif 4',Georgia,serif", lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
      {(txt.length > 0 || fileCount > 0) && (
        <div style={{ marginTop: 8, fontSize: 11, color: willChunk ? "#d4a843" : C.muted, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
          <span>{summary()}</span>
          {willChunk && <span style={{ fontStyle: "italic" }}>Large input — will process in {chunks.length} passes automatically</span>}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fr} type="file" accept=".txt,.md,.csv,.json,.html" multiple onChange={handleFileInput} style={{ display: "none" }} />
          <button onClick={() => fr.current?.click()} aria-label="Upload files" style={{ background: C.warm, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer", color: C.muted }}>+ add files</button>
          <span style={{ fontSize: 10, color: C.muted }}>.txt .md .csv .json .html</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={to} onChange={e => setTo(e.target.value)} aria-label="Target map" style={{ background: C.warm, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: C.text, outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%237a7068' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28 }}>
            <option value="new">→ new map</option>
            {targets.map(m => <option key={m.id} value={m.id}>→ add to: {m.label}</option>)}
          </select>
          <button onClick={go} disabled={busy} aria-busy={busy} style={{ background: busy ? C.muted : C.text, color: "#fff", border: "none", borderRadius: 20, padding: "8px 22px", fontSize: 12, cursor: busy ? "wait" : "pointer", fontWeight: 500, opacity: busy ? 0.7 : 1 }}>
            {busy ? "mapping…" : to === "new" ? "generate map" : "add to map"}</button>
        </div>
      </div>
      {busy && msg && <div role="status" style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: C.warm, fontSize: 12, color: RAINBOW[4], fontStyle: "italic", fontFamily: "'Source Serif 4',Georgia,serif" }}>{msg}</div>}
      {err && <div role="alert" style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: C.errBg, fontSize: 12, color: C.err, borderLeft: "3px solid #FFCAB8" }}>{err}</div>}
    </div>
  );
}

/* ── Structure Panel ── */
function StructurePanel({ map, onClose }) {
  const [mode, setMode] = useState(null); const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const mapDesc = JSON.stringify({ nodes: map.nodes.map(n => ({ id: n.id, label: n.label, color: n.color, sessions: n.sessions })), connections: map.connections });
  const generate = async (type) => {
    setMode(type); setResult(null); setErr(null); setBusy(true);
    try {
      if (type === "visual") { setResult({ type: "visual" }); setBusy(false); return; }
      const prompts = {
        hierarchy: `Given this cognitive map, create a HIERARCHICAL INDEX grouped by color cluster with "see also" cross-references.\nRespond with JSON: {"sections":[{"heading":"cluster name","color":"pink","entries":[{"term":"pattern","sessions":5,"see_also":["other"]}]}]}`,
        outline: `Given this cognitive map, create a LINEAR OUTLINE walking through patterns one step at a time, starting with the most foundational.\nRespond with JSON: {"title":"outline title","steps":[{"number":1,"pattern":"name","color":"pink","sessions":5,"why":"one sentence","connects_to":"next"}]}`,
        narrative: NARRATIVE_PROMPT,
      };
      const p = await callAI(STRUCTURE_SYS + "\n\n" + prompts[type], `Map data:\n${mapDesc}`);
      setResult({ type, data: p });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px 26px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: RAINBOW[5] }} /><span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>build structure from map</span></div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
        {[{ id: "hierarchy", label: "Hierarchical Index", desc: "Grouped with see-also" },{ id: "outline", label: "One Step at a Time", desc: "Linear path through" },{ id: "visual", label: "Visual Only", desc: "Shapes, no words" },{ id: "narrative", label: "Narrative Summary", desc: "Prose, second person" }].map(opt => (
          <button key={opt.id} onClick={() => generate(opt.id)} disabled={busy} aria-pressed={mode === opt.id}
            style={{ background: mode === opt.id ? C.warm : C.surface, border: `1.5px solid ${mode === opt.id ? C.accent : C.border}`, borderRadius: 12, padding: "12px 14px", cursor: busy ? "wait" : "pointer", textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 3, fontFamily: "'DM Serif Display',serif" }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{opt.desc}</div>
          </button>
        ))}
      </div>
      {busy && <div role="status" style={{ padding: "10px 14px", borderRadius: 10, background: C.warm, fontSize: 12, color: RAINBOW[5], fontStyle: "italic", fontFamily: "'Source Serif 4',Georgia,serif" }}>building structure…</div>}
      {err && <div role="alert" style={{ padding: "10px 14px", borderRadius: 10, background: C.errBg, fontSize: 12, color: C.err, borderLeft: "3px solid #FFCAB8" }}>{err}</div>}
      {result?.type === "visual" && <div><VisualCanvas map={map} /><div style={{ fontSize: 10, color: C.muted, marginTop: 8, fontStyle: "italic" }}>Circles sized by frequency. Colors show clusters. Lines show connections.</div></div>}
      {result?.type === "hierarchy" && result.data?.sections && <div>{result.data.sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: tc(sec.color).bg, border: `1.5px solid ${tc(sec.color).border}` }} /><span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 15, color: C.text }}>{sec.heading}</span></div>
          {sec.entries?.map((e, j) => (<div key={j} style={{ paddingLeft: 24, marginBottom: 5, fontSize: 13, color: C.text, lineHeight: 1.6, fontFamily: "'Source Serif 4',Georgia,serif" }}><span style={{ fontWeight: 500 }}>{e.term}</span><span style={{ color: C.muted, fontSize: 11 }}> ({e.sessions})</span>{e.see_also?.length > 0 && <div style={{ paddingLeft: 16, fontSize: 11, color: C.muted, fontStyle: "italic" }}>see also: {e.see_also.join(", ")}</div>}</div>))}</div>))}</div>}
      {result?.type === "outline" && result.data?.steps && <div>{result.data.title && <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, marginBottom: 12, color: C.text }}>{result.data.title}</div>}
        {result.data.steps.map((s, i) => (<div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}><div style={{ width: 26, height: 26, borderRadius: "50%", background: tc(s.color).bg, border: `1.5px solid ${tc(s.color).border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: tc(s.color).text, flexShrink: 0 }}>{s.number}</div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: "'Source Serif 4',Georgia,serif" }}>{s.pattern}</div><div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{s.why}</div>{s.connects_to && <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>→ {s.connects_to}</div>}</div></div>))}</div>}
      {result?.type === "narrative" && result.data?.narrative && <div style={{ fontSize: 14, color: C.text, lineHeight: 1.8, fontFamily: "'Source Serif 4',Georgia,serif", whiteSpace: "pre-wrap" }}>{result.data.narrative}</div>}
    </div>
  );
}

function ExportPanel({ map, onClose }) {
  const [copied, setCopied] = useState(null);
  const copySVG = () => { navigator.clipboard?.writeText(generateSVG(map)).then(() => { setCopied("svg"); setTimeout(() => setCopied(null), 2000); }); };
  const copyJSON = () => { navigator.clipboard?.writeText(JSON.stringify({ title: map.label, subtitle: map.subtitle, nodes: map.nodes.map(n => ({ label: n.label, color: n.color, sessions: n.sessions, x: n.x, y: n.y, source_snippets: n.source_snippets })), connections: map.connections, insight: map.insight }, null, 2)).then(() => { setCopied("json"); setTimeout(() => setCopied(null), 2000); }); };
  const downloadSVG = () => { const blob = new Blob([generateSVG(map)], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${map.label.replace(/\s+/g, "-").toLowerCase()}-map.svg`; a.click(); URL.revokeObjectURL(url); };
  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px 26px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: RAINBOW[8] }} /><span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>export & share</span></div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>×</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={downloadSVG} style={{ background: C.warm, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", cursor: "pointer", textAlign: "left", flex: "1 1 140px" }}><div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Download SVG</div><div style={{ fontSize: 10, color: C.muted }}>Image — share anywhere</div></button>
        <button onClick={copySVG} style={{ background: C.warm, border: `1px solid ${copied === "svg" ? RAINBOW[3] : C.border}`, borderRadius: 12, padding: "10px 16px", cursor: "pointer", textAlign: "left", flex: "1 1 140px" }}><div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{copied === "svg" ? "Copied!" : "Copy SVG"}</div><div style={{ fontSize: 10, color: C.muted }}>Paste into Figma, docs</div></button>
        <button onClick={copyJSON} style={{ background: C.warm, border: `1px solid ${copied === "json" ? RAINBOW[3] : C.border}`, borderRadius: 12, padding: "10px 16px", cursor: "pointer", textAlign: "left", flex: "1 1 140px" }}><div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{copied === "json" ? "Copied!" : "Copy Map Data"}</div><div style={{ fontSize: 10, color: C.muted }}>JSON with source snippets</div></button>
      </div>
    </div>
  );
}

function CombinePanel({ maps, currentMapId, onCombine, onClose, busy }) {
  const [tid, setTid] = useState(""); const others = maps.filter(m => m.id !== currentMapId);
  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px 26px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: RAINBOW[3] }} /><span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>combine with another map</span></div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      {others.length === 0 ? <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", fontFamily: "'Source Serif 4',Georgia,serif" }}>You need at least two saved maps to combine.</p> : (<>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: "0 0 12px", fontFamily: "'Source Serif 4',Georgia,serif", fontStyle: "italic" }}>Overlapping patterns merge and strengthen. Unique patterns stay. New cross-connections form.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={tid} onChange={e => setTid(e.target.value)} aria-label="Map to combine with" style={{ background: C.warm, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: C.text, outline: "none", flex: 1, minWidth: 200, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%237a7068' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28 }}>
            <option value="">choose a map…</option>
            {others.map(m => <option key={m.id} value={m.id}>{m.label} ({m.nodes.length} patterns)</option>)}
          </select>
          <button onClick={() => tid && onCombine(tid)} disabled={!tid || busy} style={{ background: !tid || busy ? C.muted : C.text, color: "#fff", border: "none", borderRadius: 20, padding: "8px 22px", fontSize: 12, cursor: !tid || busy ? "not-allowed" : "pointer", fontWeight: 500 }}>{busy ? "combining…" : "combine"}</button>
        </div>
      </>)}
    </div>
  );
}

const Pill = ({ children, active, onClick }) => (<button onClick={onClick} aria-pressed={active} style={{ background: active ? C.text : C.surface, color: active ? "#fff" : C.muted, border: `1px solid ${active ? C.text : C.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontWeight: active ? 500 : 400 }}>{children}</button>);

function MapCard({ m, onClick, onDelete }) {
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={e => (e.key === "Enter" || e.key === " ") && onClick()}
      style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 20px", cursor: "pointer", transition: "border-color 0.2s", position: "relative", overflow: "hidden" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.accent} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${RAINBOW.slice(0, 5).join(",")})`, position: "absolute", top: 0, left: 0, right: 0 }} />
      <h3 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, fontWeight: 400, margin: "6px 0 4px" }}>{m.label}</h3>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{m.subtitle}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {m.nodes.slice(0, 5).map(n => <span key={n.id} style={{ background: tc(n.color).bg, color: tc(n.color).text, fontSize: 9, padding: "2px 7px", borderRadius: 8, border: `1px solid ${tc(n.color).border}` }}>{n.label}</span>)}
        {m.nodes.length > 5 && <span style={{ fontSize: 9, color: C.muted }}>+{m.nodes.length - 5}</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 10, color: C.muted }}><span>{m.nodes.length} patterns</span>{m.sources && <span>{m.sources.length} source{m.sources.length !== 1 ? "s" : ""}</span>}</div>
      {onDelete && <button onClick={e => { e.stopPropagation(); if (confirm("Delete this map?")) onDelete(m.id); }} aria-label={`Delete ${m.label}`} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: C.border, fontSize: 14, cursor: "pointer", padding: "4px 8px" }} onMouseEnter={e => e.target.style.color = "#e8443a"} onMouseLeave={e => e.target.style.color = C.border}>×</button>}
    </div>
  );
}

/* ── Main ── */
export default function App() {
  const [maps, setMaps] = useState([]); const [openMap, setOpenMap] = useState(null);
  const [activeNode, setActiveNode] = useState(null); const [showTL, setShowTL] = useState(false);
  const [showInsight, setShowInsight] = useState(false); const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false); const [renaming, setRenaming] = useState(null);
  const [panel, setPanel] = useState(null); const [showExamples, setShowExamples] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showWhy, setShowWhy] = useState(false); // "why is this here?" toggle

  useEffect(() => { store.load().then(setMaps); }, []);
  useEffect(() => { if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setReducedMotion(true); }, []);

  const m = openMap?.map;
  const conIds = m ? (m.connections || []).filter(([a, b]) => a === activeNode || b === activeNode).map(([a, b]) => a === activeNode ? b : a) : [];
  const selNode = m && activeNode ? m.nodes.find(n => n.id === activeNode) : null;
  const conNodes = conIds.map(id => m?.nodes.find(n => n.id === id)).filter(Boolean);
  const anim = reducedMotion ? "none" : "fadeIn 0.4s ease both";
  const togglePanel = (p) => setPanel(prev => prev === p ? null : p);

  const onNew = async (txt, extraChunks) => {
    setBusy(true);
    try {
      const p = await callAI(SYS, `Analyze this text and extract cognitive/emotional patterns:\n\n${txt.slice(0, 14000)}`);
      const nm = { id: "map-" + Date.now(), label: p.title || "Untitled", subtitle: p.subtitle || "", description: p.description || "Click any tag.", nodes: mkNodes(p), connections: p.connections || [], insight: p.insight, sources: [`Added ${new Date().toLocaleDateString()}`], createdAt: Date.now() };
      await store.save(nm);
      if (extraChunks?.length) {
        let current = nm;
        for (let i = 0; i < extraChunks.length; i++) {
          try {
            const desc = JSON.stringify({ nodes: current.nodes.map(n => ({ id: n.id, label: n.label, color: n.color, sessions: n.sessions })), connections: current.connections });
            const mp = await callAI(MERGE_SYS, `EXISTING MAP:\n${desc}\n\nNEW TEXT:\n${extraChunks[i].slice(0, 13000)}`);
            current = { ...current, nodes: mkNodes(mp), connections: mp.connections || current.connections, insight: mp.insight || current.insight, changelog: mp.changelog };
            await store.save(current);
          } catch {}
        }
        Object.assign(nm, { nodes: current.nodes, connections: current.connections, insight: current.insight, changelog: current.changelog });
      }
      setMaps(await store.load()); setOpenMap({ map: nm, isDemo: false }); setActiveNode(null); setPanel(null);
    } finally { setBusy(false); }
  };

  const onAdd = async (mapId, txt) => {
    setBusy(true);
    try {
      const ex = maps.find(x => x.id === mapId); if (!ex) throw new Error("Map not found");
      const chunks = chunkText(txt); let current = ex;
      for (const chunk of chunks) {
        const desc = JSON.stringify({ nodes: current.nodes.map(n => ({ id: n.id, label: n.label, color: n.color, sessions: n.sessions })), connections: current.connections });
        const p = await callAI(MERGE_SYS, `EXISTING MAP:\n${desc}\n\nNEW TEXT:\n${chunk.slice(0, 13000)}`);
        current = { ...current, nodes: mkNodes(p), connections: p.connections || current.connections, insight: p.insight || current.insight, changelog: p.changelog, description: p.description || current.description, sources: [...(current.sources || []), `Added ${new Date().toLocaleDateString()}`] };
      }
      await store.save(current); setMaps(await store.load()); setOpenMap({ map: current, isDemo: false }); setActiveNode(null); setPanel(null);
    } finally { setBusy(false); }
  };

  const onCombine = async (otherId) => {
    setBusy(true);
    try {
      const mapA = openMap?.map, mapB = maps.find(x => x.id === otherId);
      if (!mapA || !mapB) throw new Error("Map not found");
      const offset = Math.max(...mapA.nodes.map(n => n.id), 0) + 1;
      const dA = JSON.stringify({ nodes: mapA.nodes.map(n => ({ id: n.id, label: n.label, color: n.color, sessions: n.sessions })), connections: mapA.connections });
      const dB = JSON.stringify({ nodes: mapB.nodes.map(n => ({ id: n.id + offset, label: n.label, color: n.color, sessions: n.sessions })), connections: mapB.connections.map(([a, b]) => [a + offset, b + offset]) });
      const p = await callAI(COMBINE_SYS, `MAP A ("${mapA.label}"):\n${dA}\n\nMAP B ("${mapB.label}"):\n${dB}`);
      const combined = { id: "map-" + Date.now(), label: p.title || `${mapA.label} + ${mapB.label}`, subtitle: p.subtitle || "combined", description: p.description || "Click any tag.", nodes: mkNodes(p), connections: p.connections || [], insight: p.insight, changelog: p.changelog, sources: [...(mapA.sources || []), ...(mapB.sources || []), "Combined " + new Date().toLocaleDateString()], createdAt: Date.now() };
      await store.save(combined); setMaps(await store.load()); setOpenMap({ map: combined, isDemo: false }); setActiveNode(null); setPanel(null);
    } finally { setBusy(false); }
  };

  const onDel = async (id) => { await store.remove(id); setMaps(await store.load()); if (openMap?.map?.id === id) setOpenMap(null); };
  const onMove = useCallback((nid, x, y) => { setOpenMap(prev => prev && !prev.isDemo ? { ...prev, map: { ...prev.map, nodes: prev.map.nodes.map(n => n.id === nid ? { ...n, x, y } : n) } } : prev); }, []);
  const onRename = useCallback((nid, label) => {
    setOpenMap(prev => { if (!prev || prev.isDemo) return prev; const u = { ...prev.map, nodes: prev.map.nodes.map(n => n.id === nid ? { ...n, label } : n) }; store.save(u); return { ...prev, map: u }; });
    setMaps(prev => prev.map(mm => mm.id === openMap?.map?.id ? { ...mm, nodes: mm.nodes.map(n => n.id === nid ? { ...n, label } : n) } : mm));
    setRenaming(null);
  }, [openMap]);
  const onDelNode = useCallback((nid) => {
    setOpenMap(prev => { if (!prev || prev.isDemo) return prev; const u = { ...prev.map, nodes: prev.map.nodes.filter(n => n.id !== nid), connections: prev.map.connections.filter(([a, b]) => a !== nid && b !== nid) }; store.save(u); return { ...prev, map: u }; });
    setActiveNode(null);
  }, []);
  const saveLayout = async () => { if (openMap?.map) { await store.save(openMap.map); setMaps(await store.load()); } setEditMode(false); };
  const goHome = () => { setOpenMap(null); setActiveNode(null); setEditMode(false); setPanel(null); setShowTL(false); setShowWhy(false); };
  const viewMap = (map, isDemo = false) => { setOpenMap({ map, isDemo }); setActiveNode(null); setShowTL(false); setShowInsight(false); setEditMode(false); setPanel(null); setShowWhy(false); };

  // Shift legend items
  const hasShifts = m?.nodes.some(n => n.shift && n.shift !== "stable");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans',sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} ::selection{background:#FFE060;color:#1a1615} textarea::placeholder{color:#bbb} *:focus-visible{outline:2px solid ${C.accent};outline-offset:2px;border-radius:4px}`}</style>

      <div style={{ height: 3, background: `linear-gradient(90deg, ${RAINBOW.join(", ")})` }} />
      <header style={{ padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 900, margin: "0 auto", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={goHome} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && goHome()}>
          <div style={{ display: "flex", gap: 3 }}>{RAINBOW.slice(0, 4).map((c, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}</div>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, margin: 0, letterSpacing: "-0.3px" }}>Neural Shelf</h1>
          <span style={{ fontSize: 10, color: C.accent, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", border: `1px solid ${C.accent}40`, borderRadius: 10, padding: "2px 8px" }}>indexing studio</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} style={{ width: 14, height: 14 }} />reduce motion
          </label>
          {openMap && <Pill onClick={goHome}>← library</Pill>}
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 28px 60px" }}>
        {!openMap && (
          <div style={{ animation: anim }}>
            <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" }}>Your Maps</h2>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 20px", fontStyle: "italic", fontFamily: "'Source Serif 4',Georgia,serif" }}>
              {maps.length === 0 ? "No maps yet. Paste some text below to create your first one." : `${maps.length} map${maps.length !== 1 ? "s" : ""}. Click to explore, or add new content below.`}
            </p>
            {maps.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginBottom: 24 }}>{maps.map(mm => <MapCard key={mm.id} m={mm} onClick={() => viewMap(mm)} onDelete={onDel} />)}</div>}
            <div style={{ marginBottom: 24 }}><InputPanel onNew={onNew} onAdd={onAdd} targets={maps} busy={busy} /></div>
            <button onClick={() => setShowExamples(s => !s)} style={{ background: "none", border: `1px dashed ${C.border}`, borderRadius: 14, padding: "12px 20px", cursor: "pointer", color: C.muted, fontSize: 12, fontFamily: "'Source Serif 4',Georgia,serif", fontStyle: "italic", width: "100%", textAlign: "left" }}>
              {showExamples ? "Hide examples ↑" : "See example maps → three demos showing progression over time"}</button>
            {showExamples && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginTop: 14, animation: anim }}>{DEMOS.map(d => <MapCard key={d.id} m={d} onClick={() => viewMap(d, true)} />)}</div>}
          </div>
        )}

        {openMap && m && (
          <div style={{ animation: anim }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <div><h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, fontWeight: 400, margin: "0 0 2px" }}>{m.label}</h2><div style={{ fontSize: 11, color: C.muted }}>{m.subtitle}</div></div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {activeNode && <Pill onClick={() => { setActiveNode(null); setShowWhy(false); }}>clear ×</Pill>}
                {!openMap.isDemo && <Pill active={editMode} onClick={() => editMode ? saveLayout() : setEditMode(true)}>{editMode ? "save layout" : "edit"}</Pill>}
                {!openMap.isDemo && <Pill active={panel === "input"} onClick={() => togglePanel("input")}>+ add</Pill>}
                {!openMap.isDemo && <Pill active={panel === "combine"} onClick={() => togglePanel("combine")}>combine</Pill>}
                <Pill active={panel === "structure"} onClick={() => togglePanel("structure")}>structure</Pill>
                <Pill active={panel === "export"} onClick={() => togglePanel("export")}>export</Pill>
                {m.timeline && <Pill active={showTL} onClick={() => setShowTL(s => !s)}>timeline</Pill>}
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.muted, fontStyle: "italic", lineHeight: 1.6, margin: "0 0 14px", fontFamily: "'Source Serif 4',Georgia,serif" }}>{m.description}</p>
            {m.changelog && <div style={{ fontSize: 11, color: RAINBOW[3], background: "#D4F5E920", border: "1px solid #D4F5E960", borderRadius: 10, padding: "8px 14px", marginBottom: 14 }}>↳ {m.changelog}</div>}

            <div style={{ marginBottom: 14 }}>
              <Canvas map={m} activeNode={activeNode} setActiveNode={n => { setActiveNode(n); setShowWhy(false); }} editable={editMode && !openMap.isDemo} onMove={onMove} reducedMotion={reducedMotion} />
              {editMode && <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontStyle: "italic" }}>Drag tags to rearrange (works on touch too). Click to rename or remove.</div>}
            </div>

            {showTL && m.timeline && (
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14, display: "flex", overflowX: "auto" }}>
                {m.timeline.map((s, i) => (<div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 90 }}><div style={{ textAlign: "center", flex: 1 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, margin: "0 auto 5px", border: "2px solid white", boxShadow: `0 0 6px ${s.color}` }} /><div style={{ fontSize: 9, color: C.text, fontWeight: 600 }}>{s.date}</div><div style={{ fontSize: 9, color: C.muted, fontStyle: "italic" }}>{s.label}</div></div>{i < m.timeline.length - 1 && <div style={{ height: 1, background: C.border, flex: 0.3, alignSelf: "flex-start", marginTop: 5 }} />}</div>))}
              </div>
            )}

            {panel === "input" && !openMap.isDemo && <div style={{ marginBottom: 14 }}><InputPanel onNew={onNew} onAdd={onAdd} targets={maps} busy={busy} /></div>}
            {panel === "combine" && !openMap.isDemo && <CombinePanel maps={maps} currentMapId={m.id} onCombine={onCombine} onClose={() => setPanel(null)} busy={busy} />}
            {panel === "structure" && <StructurePanel map={m} onClose={() => setPanel(null)} />}
            {panel === "export" && <ExportPanel map={m} onClose={() => setPanel(null)} />}

            {/* Selected node detail — now with "why is this here?" */}
            {selNode && (
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "18px 22px", marginBottom: 14, borderLeft: `3px solid ${tc(selNode.color).border}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>selected pattern</div>
                    {renaming === selNode.id ? (
                      <input autoFocus defaultValue={selNode.label} aria-label="Rename pattern"
                        onBlur={e => onRename(selNode.id, e.target.value)} onKeyDown={e => e.key === "Enter" && onRename(selNode.id, e.target.value)}
                        style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: 14, border: `1.5px solid ${C.accent}`, borderRadius: 18, padding: "6px 14px", outline: "none", background: C.warm }} />
                    ) : (
                      <span onClick={() => !openMap.isDemo && setRenaming(selNode.id)} role={openMap.isDemo ? undefined : "button"} tabIndex={openMap.isDemo ? undefined : 0}
                        style={{ background: tc(selNode.color).bg, border: `1.5px solid ${tc(selNode.color).border}`, borderRadius: 18, padding: "6px 14px", fontSize: 14, color: tc(selNode.color).text, display: "inline-block", marginBottom: 8, cursor: openMap.isDemo ? "default" : "text" }}>
                        {selNode.userAdded && <span style={{ marginRight: 6, opacity: 0.7 }}>✦</span>}{selNode.label}
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: C.muted }}>
                      appeared in <strong style={{ color: C.text }}>{selNode.sessions}</strong> session{selNode.sessions !== 1 ? "s" : ""}
                      {selNode.userAdded && <span style={{ marginLeft: 8, color: C.tags.peach.text, fontStyle: "italic" }}>· you added this</span>}
                      {selNode.shift === "new" && <span style={{ marginLeft: 8, color: RAINBOW[3], fontWeight: 500 }}>· new</span>}
                      {selNode.shift === "strengthened" && <span style={{ marginLeft: 8, color: RAINBOW[4], fontWeight: 500 }}>· strengthened</span>}
                      {selNode.shift === "faded" && <span style={{ marginLeft: 8, color: C.muted, fontStyle: "italic" }}>· fading</span>}
                    </div>

                    {/* Why is this here? */}
                    {selNode.source_snippets?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => setShowWhy(s => !s)} style={{ fontSize: 10, color: C.accent, background: "none", border: `1px solid ${C.accent}40`, borderRadius: 10, padding: "3px 10px", cursor: "pointer" }}>
                          {showWhy ? "hide source" : "why is this here?"}
                        </button>
                        {showWhy && (
                          <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: C.warm, fontSize: 12, color: C.text, lineHeight: 1.6, fontFamily: "'Source Serif 4',Georgia,serif" }}>
                            <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>anchored by these phrases from your text</div>
                            {selNode.source_snippets.map((s, i) => (
                              <div key={i} style={{ marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${tc(selNode.color).border}`, fontStyle: "italic", color: C.muted }}>"{s}"</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!openMap.isDemo && editMode && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        <button onClick={() => setRenaming(selNode.id)} style={{ fontSize: 10, color: C.accent, background: "none", border: `1px solid ${C.accent}40`, borderRadius: 10, padding: "3px 10px", cursor: "pointer" }}>rename</button>
                        <button onClick={() => onDelNode(selNode.id)} style={{ fontSize: 10, color: "#e8443a", background: "none", border: "1px solid #e8443a40", borderRadius: 10, padding: "3px 10px", cursor: "pointer" }}>remove</button>
                      </div>
                    )}
                  </div>
                  {conNodes.length > 0 && (
                    <div><div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>connects to</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {conNodes.map(cn => (<span key={cn.id} onClick={() => { setActiveNode(cn.id); setShowWhy(false); }} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && setActiveNode(cn.id)}
                          style={{ background: tc(cn.color).bg, border: `1.5px solid ${tc(cn.color).border}`, borderRadius: 12, padding: "3px 10px", fontSize: 11, color: tc(cn.color).text, cursor: "pointer" }}>{cn.label}</span>))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {m.insight && (
              <div style={{ marginBottom: 14 }}>
                <Pill active={showInsight} onClick={() => setShowInsight(s => !s)}>{showInsight ? "hide insight" : "show AI insight"}</Pill>
                {showInsight && <div style={{ marginTop: 10, padding: "14px 18px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${RAINBOW[4]}`, fontSize: 13, color: C.text, lineHeight: 1.7, fontStyle: "italic", fontFamily: "'Source Serif 4',Georgia,serif" }}>{m.insight}</div>}
              </div>
            )}
            {m.sources?.length > 0 && <div style={{ fontSize: 10, color: C.muted, marginBottom: 14 }}>Sources: {m.sources.join(" · ")}</div>}

            {/* Legend — includes shift indicators when present */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 10, color: C.muted }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 20, height: 12, borderRadius: 6, background: "#D4F5E9", border: "1px solid #90E0BF" }} />color = cluster</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ display: "flex", alignItems: "flex-end", gap: 1 }}>{[5, 7, 9].map((s, i) => <div key={i} style={{ width: s, height: s, borderRadius: "50%", background: "#C4AAFF" }} />)}</div>frequency</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="20" height="7"><line x1="0" y1="3.5" x2="20" y2="3.5" stroke="#D0C8BC" strokeWidth="1" strokeDasharray="3 3" /></svg>connection</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span>✦</span> user-added</div>
              {hasShifts && <>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: RAINBOW[3] }} />new</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 14, height: 10, borderRadius: 5, border: "1px dashed #C4AAFF" }} />strengthened</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 14, height: 10, borderRadius: 5, background: "#EAE0FF", opacity: 0.4 }} />fading</div>
              </>}
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textAlign: "center", lineHeight: 1.6, fontFamily: "'Source Serif 4',Georgia,serif", fontStyle: "italic" }}>
          Neural Shelf Indexing Studio · Patterns are suggestions, not diagnoses. Your map is yours to name.
          <br />Shared storage is on — collaborators see the same maps.
        </div>
      </div>
    </div>
  );
}
