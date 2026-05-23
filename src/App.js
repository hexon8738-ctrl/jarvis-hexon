import { useState, useEffect, useRef, useCallback } from "react";

// ════════════════════════════════════════════════════════════
//  COLOR SYSTEM — Eye-friendly, warm dark theme
// ════════════════════════════════════════════════════════════
const C = {
  // Backgrounds
  bg:        "#0d1117",   // main bg — deep charcoal (not pure black)
  bgCard:    "#161b22",   // card bg
  bgInput:   "#1c2128",   // input bg
  bgHover:   "#21262d",   // hover state
  bgAccent:  "#1a2332",   // subtle blue tint card

  // Borders
  border:    "#30363d",   // standard border
  borderHi:  "#58a6ff",   // highlighted border

  // Text — high contrast, warm
  textPrimary:   "#e6edf3",   // main text — warm white
  textSecondary: "#8b949e",   // secondary — readable grey
  textMuted:     "#484f58",   // muted — for timestamps etc
  textLink:      "#58a6ff",   // links/accents

  // Accent colors — warm & distinct
  gold:    "#d4a843",   // premium gold — headings, JARVIS name
  goldDim: "#a07830",   // dim gold
  cyan:    "#39d0d8",   // cyan — active states
  green:   "#3fb950",   // success / completed
  yellow:  "#e3b341",   // warning / pending
  red:     "#f85149",   // danger / high priority
  purple:  "#bc8cff",   // meetings / special

  // Gradients
  gradHeader: "linear-gradient(180deg, #161b22 0%, #0d1117 100%)",
  gradUser:   "linear-gradient(135deg, #1f3d5c 0%, #1a3a5c 100%)",
  gradBot:    "linear-gradient(135deg, #161b22 0%, #1c2128 100%)",
  gradGold:   "linear-gradient(135deg, #2a1f0d 0%, #1f1700 100%)",
};

// ════════════════════════════════════════════════════════════
//  AI PROVIDERS
// ════════════════════════════════════════════════════════════
const PROVIDERS = {
  gemini: {
    name: "Google Gemini", badge: "FREE", badgeColor: C.green,
    models: [
      { id: "gemini-2.0-flash",  label: "Gemini 2.0 Flash (Free)" },
      { id: "gemini-1.5-flash",  label: "Gemini 1.5 Flash (Free)" },
      { id: "gemini-1.5-pro",    label: "Gemini 1.5 Pro (Free tier)" },
    ],
    keyPlaceholder: "AIza...", keyLink: "https://aistudio.google.com/app/apikey",
    keyLabel: "Get FREE key → aistudio.google.com",
  },
  groq: {
    name: "Groq (Ultra Fast)", badge: "FREE", badgeColor: C.green,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Free)" },
      { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B Instant (Free)" },
      { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B (Free)" },
    ],
    keyPlaceholder: "gsk_...", keyLink: "https://console.groq.com/keys",
    keyLabel: "Get FREE key → console.groq.com",
  },
  claude: {
    name: "Anthropic Claude", badge: "PAID", badgeColor: C.yellow,
    models: [
      { id: "claude-sonnet-4-20250514",  label: "Claude Sonnet 4 (Best)" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku (Cheaper)" },
    ],
    keyPlaceholder: "sk-ant-...", keyLink: "https://console.anthropic.com/",
    keyLabel: "Get key → console.anthropic.com",
  },
  openai: {
    name: "OpenAI GPT", badge: "PAID", badgeColor: C.yellow,
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Affordable)" },
      { id: "gpt-4o",      label: "GPT-4o (Best)" },
    ],
    keyPlaceholder: "sk-...", keyLink: "https://platform.openai.com/api-keys",
    keyLabel: "Get key → platform.openai.com",
  },
};

// ════════════════════════════════════════════════════════════
//  AI CALL
// ════════════════════════════════════════════════════════════
async function callAI(provider, model, apiKey, systemPrompt, userMessage, history = []) {
  if (!apiKey) throw new Error("No API key set for " + PROVIDERS[provider].name);

  if (provider === "gemini") {
    const contents = [];
    history.slice(-10).forEach(h => contents.push({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] }));
    contents.push({ role: "user", parts: [{ text: userMessage }] });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { maxOutputTokens: 1200, temperature: 0.7 } }),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
  }
  if (provider === "groq") {
    const messages = [{ role: "system", content: systemPrompt }, ...history.slice(-10), { role: "user", content: userMessage }];
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.7 }),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    return d.choices?.[0]?.message?.content || "No response";
  }
  if (provider === "claude") {
    const messages = [...history.slice(-10), { role: "user", content: userMessage }];
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model, max_tokens: 1200, system: systemPrompt, messages }),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    return d.content?.map(b => b.text || "").join("") || "No response";
  }
  if (provider === "openai") {
    const messages = [{ role: "system", content: systemPrompt }, ...history.slice(-10), { role: "user", content: userMessage }];
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.7 }),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    return d.choices?.[0]?.message?.content || "No response";
  }
  throw new Error("Unknown provider");
}

// ════════════════════════════════════════════════════════════
//  STORAGE
// ════════════════════════════════════════════════════════════
async function loadData(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveData(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}
function loadKeys() { try { return JSON.parse(localStorage.getItem("jarvis-keys") || "{}"); } catch { return {}; } }
function saveKeys(k) { try { localStorage.setItem("jarvis-keys", JSON.stringify(k)); } catch {} }
function loadChoice() { try { return JSON.parse(localStorage.getItem("jarvis-choice") || "null"); } catch { return null; } }
function saveChoice(c) { try { localStorage.setItem("jarvis-choice", JSON.stringify(c)); } catch {} }

// ════════════════════════════════════════════════════════════
//  SYSTEM PROMPT
// ════════════════════════════════════════════════════════════
function buildSystem(tasks, meetings) {
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const pending = tasks.filter(t => t.status !== "completed");
  const completedToday = tasks.filter(t => t.status === "completed" && (t.completedAt || "").startsWith(todayISO));
  const future = meetings.filter(m => new Date(m.datetime) >= now).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const lastMtg = meetings.filter(m => new Date(m.datetime) < now).sort((a, b) => new Date(b.datetime) - new Date(a.datetime))[0];

  return `You are JARVIS — elite AI personal assistant for the Accounts Manager at Hexon Company. Like Tony Stark's JARVIS: intelligent, precise, proactive, professional, loyal.

DATE/TIME: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}

PENDING TASKS (${pending.length}):
${pending.length ? pending.map((t, i) => `${i + 1}. [${(t.priority || "normal").toUpperCase()}] "${t.title}" | ${t.status} | Due: ${t.dueDate || "—"} | ${t.notes || ""}`).join("\n") : "None."}

COMPLETED TODAY: ${completedToday.map(t => `"${t.title}"`).join(", ") || "None yet."}

UPCOMING MEETINGS (${future.length}):
${future.map((m, i) => `${i + 1}. "${m.title}" | With: ${m.with || "—"} | ${new Date(m.datetime).toLocaleString("en-US")} | ${m.notes || ""}`).join("\n") || "None."}

LAST MEETING: ${lastMtg ? `"${lastMtg.title}" with ${lastMtg.with || "—"} on ${new Date(lastMtg.datetime).toLocaleString("en-US")}` : "No record."}

RULES:
1. Manager writes/speaks in URDU — you ALWAYS respond in ENGLISH only.
2. Detect intent: add task, complete task, update task, add meeting, briefing, progress, general Q&A.
3. Append ONE action tag when data changes needed (no action tag for pure Q&A):
   <ACTION>{"type":"ADD_TASK","payload":{"title":"...","priority":"high/normal/low","dueDate":"YYYY-MM-DD","notes":"...","status":"pending"}}</ACTION>
   <ACTION>{"type":"COMPLETE_TASK","payload":{"title":"..."}}</ACTION>
   <ACTION>{"type":"UPDATE_TASK","payload":{"title":"...","status":"in-progress","notes":"..."}}</ACTION>
   <ACTION>{"type":"ADD_MEETING","payload":{"title":"...","with":"...","datetime":"YYYY-MM-DDTHH:MM","notes":"..."}}</ACTION>
   <ACTION>{"type":"DELETE_TASK","payload":{"title":"..."}}</ACTION>
4. Address as "Sir". Tone: professional, sharp, concise.
5. Briefing format: date/time → pending tasks by priority → next meeting → completed today.
6. Proactively mention overdue tasks.`;
}

// ════════════════════════════════════════════════════════════
//  ACTION HELPERS
// ════════════════════════════════════════════════════════════
function parseAction(text) {
  const m = text.match(/<ACTION>([\s\S]*?)<\/ACTION>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
function stripAction(text) { return text.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, "").trim(); }
function applyAction(action, tasks, meetings, setTasks, setMeetings) {
  if (!action) return;
  const { type, payload } = action;
  const now = new Date().toISOString();
  if (type === "ADD_TASK") { const u = [...tasks, { id: Date.now(), ...payload, createdAt: now }]; setTasks(u); saveData("hx-tasks", u); }
  else if (type === "COMPLETE_TASK") { const u = tasks.map(t => t.title.toLowerCase().includes((payload.title || "").toLowerCase()) ? { ...t, status: "completed", completedAt: now } : t); setTasks(u); saveData("hx-tasks", u); }
  else if (type === "UPDATE_TASK") { const u = tasks.map(t => t.title.toLowerCase().includes((payload.title || "").toLowerCase()) ? { ...t, ...payload } : t); setTasks(u); saveData("hx-tasks", u); }
  else if (type === "DELETE_TASK") { const u = tasks.filter(t => !t.title.toLowerCase().includes((payload.title || "").toLowerCase())); setTasks(u); saveData("hx-tasks", u); }
  else if (type === "ADD_MEETING") { const u = [...meetings, { id: Date.now(), ...payload, createdAt: now }]; setMeetings(u); saveData("hx-meetings", u); }
}

// ════════════════════════════════════════════════════════════
//  VOICE
// ════════════════════════════════════════════════════════════
function useSpeech(onResult) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice requires Chrome browser."); return; }
    const rec = new SR();
    rec.lang = "ur-PK"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = e => onResult(e.results[0][0].transcript);
    rec.start(); recRef.current = rec;
  }, [onResult]);
  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  return { listening, start, stop };
}
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 280));
  u.lang = "en-US"; u.rate = 1.0; u.pitch = 1.0;
  window.speechSynthesis.speak(u);
}

// ════════════════════════════════════════════════════════════
//  SETTINGS MODAL
// ════════════════════════════════════════════════════════════
function SettingsModal({ onClose, onSave }) {
  const [keys, setKeys] = useState(loadKeys());
  const [choice, setChoice] = useState(loadChoice() || { provider: "gemini", model: "gemini-2.0-flash" });
  const [show, setShow] = useState({});

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "min(95vw,540px)", maxHeight: "88vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, letterSpacing: ".02em" }}>⚙ AI Settings</div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>Configure your AI provider & API keys</div>
          </div>
          <button onClick={onClose} style={{ background: C.bgHover, border: `1px solid ${C.border}`, color: C.textSecondary, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Security note */}
        <div style={{ background: "#0d2818", border: `1px solid #1a4a2a`, borderRadius: 10, padding: "10px 14px", marginBottom: 22, fontSize: 12, color: "#4ade80", lineHeight: 1.6 }}>
          🔒 <strong>Keys stay in YOUR browser only.</strong> Never sent to any server — go directly to AI provider's API.
        </div>

        {/* Provider Select */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.textSecondary, letterSpacing: ".08em", marginBottom: 10, textTransform: "uppercase" }}>Active Provider</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Object.entries(PROVIDERS).map(([id, p]) => (
              <button key={id} onClick={() => setChoice({ provider: id, model: p.models[0].id })} style={{
                padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left", border: `1px solid ${choice.provider === id ? C.gold : C.border}`,
                background: choice.provider === id ? C.gradGold : C.bgInput, transition: "all .15s"
              }}>
                <div style={{ fontSize: 13, color: choice.provider === id ? C.gold : C.textSecondary, fontWeight: 600 }}>{p.name}</div>
                <span style={{ fontSize: 10, color: p.badgeColor, marginTop: 2, display: "block" }}>● {p.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model Select */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.textSecondary, letterSpacing: ".08em", marginBottom: 10, textTransform: "uppercase" }}>Model — {PROVIDERS[choice.provider].name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {PROVIDERS[choice.provider].models.map(m => (
              <button key={m.id} onClick={() => setChoice(c => ({ ...c, model: m.id }))} style={{
                padding: "9px 14px", borderRadius: 9, cursor: "pointer", textAlign: "left", fontSize: 13,
                background: choice.model === m.id ? C.bgAccent : C.bgInput,
                border: `1px solid ${choice.model === m.id ? C.cyan : C.border}`,
                color: choice.model === m.id ? C.cyan : C.textSecondary
              }}>{m.label}</button>
            ))}
          </div>
        </div>

        {/* API Keys */}
        <div style={{ fontSize: 11, color: C.textSecondary, letterSpacing: ".08em", marginBottom: 12, textTransform: "uppercase" }}>API Keys</div>
        {Object.entries(PROVIDERS).map(([id, p]) => (
          <div key={id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: choice.provider === id ? C.gold : C.textSecondary, fontWeight: 600 }}>{p.name}</span>
                {choice.provider === id && <span style={{ fontSize: 9, background: C.gold + "22", color: C.gold, padding: "1px 7px", borderRadius: 4 }}>ACTIVE</span>}
                {keys[id] && <span style={{ fontSize: 9, background: C.green + "22", color: C.green, padding: "1px 7px", borderRadius: 4 }}>✓ SET</span>}
              </div>
              <a href={p.keyLink} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: C.green, textDecoration: "none" }}>{p.keyLabel} ↗</a>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type={show[id] ? "text" : "password"} placeholder={p.keyPlaceholder} value={keys[id] || ""}
                onChange={e => setKeys(k => ({ ...k, [id]: e.target.value }))}
                style={{ flex: 1, background: C.bg, border: `1px solid ${keys[id] ? C.green + "66" : C.border}`, borderRadius: 8, padding: "9px 12px", color: C.textPrimary, fontSize: 13, fontFamily: "monospace" }}
              />
              <button onClick={() => setShow(s => ({ ...s, [id]: !s[id] }))} style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 12px", color: C.textSecondary, cursor: "pointer" }}>{show[id] ? "🙈" : "👁"}</button>
              {keys[id] && <button onClick={() => setKeys(k => ({ ...k, [id]: "" }))} style={{ background: "#2d0a0a", border: "1px solid #5a1d1d", borderRadius: 8, padding: "0 10px", color: C.red, cursor: "pointer", fontSize: 13 }}>✕</button>}
            </div>
          </div>
        ))}

        <button onClick={() => { saveKeys(keys); saveChoice(choice); onSave(keys, choice); onClose(); }} style={{
          width: "100%", marginTop: 6, padding: "13px", borderRadius: 10,
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
          border: "none", color: "#0d1117", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: ".04em"
        }}>Save & Activate</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PRIORITY & STATUS COLORS
// ════════════════════════════════════════════════════════════
const prioColor = p => p === "high" ? C.red : p === "low" ? C.green : C.yellow;
const statColor = s => s === "completed" ? C.green : s === "in-progress" ? C.cyan : C.textSecondary;
const statBg    = s => s === "completed" ? "#0d2818" : s === "in-progress" ? "#0d1f2e" : C.bgInput;

// ════════════════════════════════════════════════════════════
//  STAT CARD
// ════════════════════════════════════════════════════════════
function StatCard({ value, label, color }) {
  return (
    <div style={{ textAlign: "center", padding: "6px 14px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: C.textMuted, marginTop: 3, letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════
export default function JarvisApp() {
  const [tasks, setTasks]       = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [history, setHistory]   = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState("chat");
  const [showSettings, setShowSettings] = useState(false);
  const [keys, setKeys]         = useState(loadKeys());
  const [choice, setChoice]     = useState(loadChoice() || { provider: "gemini", model: "gemini-2.0-flash" });
  const [error, setError]       = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    (async () => {
      const t = await loadData("hx-tasks");
      const m = await loadData("hx-meetings");
      setTasks(t); setMeetings(m);
      const k = loadKeys();
      const hasKey = k[choice.provider];
      setMessages([{
        id: Date.now(), role: "assistant",
        text: hasKey
          ? `Good ${tod()}, Sir. JARVIS is online and ready.\n\n📋 Pending tasks: ${t.filter(x => x.status !== "completed").length}\n📅 Upcoming meetings: ${m.filter(x => new Date(x.datetime) >= new Date()).length}\n\nHow may I assist you today, Sir?`
          : `Good ${tod()}, Sir. JARVIS is online.\n\n⚠️ No API key configured yet.\n\nPlease tap the ⚙ Settings button (top right) and add your free Gemini or Groq API key to get started.`,
        time: fmtTime(new Date())
      }]);
    })();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  function tod() { const h = new Date().getHours(); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; }
  function fmtTime(d) { return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); }

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    setError("");
    const apiKey = keys[choice.provider];
    if (!apiKey) { setError(`No API key for ${PROVIDERS[choice.provider].name}. Open ⚙ Settings to add one.`); return; }
    const userMsg = { id: Date.now(), role: "user", text, time: fmtTime(new Date()) };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); setLoading(true);
    try {
      const raw = await callAI(choice.provider, choice.model, apiKey, buildSystem(tasks, meetings), text, history);
      const action = parseAction(raw);
      const clean = stripAction(raw);
      if (action) applyAction(action, tasks, meetings, setTasks, setMeetings);
      const aMsg = { id: Date.now() + 1, role: "assistant", text: clean, time: fmtTime(new Date()) };
      setMessages(prev => [...prev, aMsg]);
      setHistory(h => [...h, { role: "user", content: text }, { role: "assistant", content: clean }]);
      speak(clean);
    } catch (e) {
      setError(`Error: ${e.message}`);
      setMessages(prev => [...prev, { id: Date.now() + 2, role: "assistant", text: `⚠️ ${e.message}\n\nPlease check your API key in ⚙ Settings, Sir.`, time: fmtTime(new Date()) }]);
    }
    setLoading(false);
  }, [loading, tasks, meetings, history, keys, choice]);

  const { listening, start: startVoice, stop: stopVoice } = useSpeech(t => { setInput(t); sendMessage(t); });

  const pending   = tasks.filter(t => t.status !== "completed");
  const completed = tasks.filter(t => t.status === "completed");
  const upcoming  = meetings.filter(m => new Date(m.datetime) >= new Date()).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const past      = meetings.filter(m => new Date(m.datetime) < new Date()).sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  const nextMtg   = upcoming[0];
  const curP      = PROVIDERS[choice.provider];

  const TABS = [
    { id: "chat",     icon: "💬", label: "Chat" },
    { id: "tasks",    icon: "✅", label: `Tasks (${pending.length})` },
    { id: "meetings", icon: "📅", label: `Meetings (${upcoming.length})` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: C.textPrimary, display: "flex", flexDirection: "column" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        textarea, input { outline: none; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes ripple   { 0%{box-shadow:0 0 0 0 rgba(212,168,67,.35)} 70%{box-shadow:0 0 0 10px rgba(212,168,67,0)} 100%{box-shadow:0 0 0 0 rgba(212,168,67,0)} }
        @keyframes spin     { to { transform:rotate(360deg); } }
        .msg-in { animation: fadeUp .25s ease; }
        .btn-hover:hover { opacity:.85; transform:translateY(-1px); }
        .quick-chip:hover { border-color: ${C.gold} !important; color: ${C.gold} !important; }
        .tab-item:hover { color: ${C.textPrimary} !important; }
        .task-row:hover { background: ${C.bgHover} !important; }
      `}</style>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSave={(k, c) => { setKeys(k); setChoice(c); }} />}

      {/* ══════════ HEADER ══════════ */}
      <div style={{
        background: C.bgCard, borderBottom: `1px solid ${C.border}`,
        padding: "12px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 1px 8px rgba(0,0,0,.4)"
      }}>
        {/* Logo + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, #2a1f0d, #1a1300)`,
            border: `1.5px solid ${C.gold}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "ripple 3s infinite",
            fontSize: 18, fontWeight: 800, color: C.gold,
            fontFamily: "Georgia, serif", letterSpacing: "-.02em"
          }}>J</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.gold, letterSpacing: ".06em" }}>JARVIS</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Hexon Accounts Manager · Personal AI</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 8 }}>
          <StatCard value={pending.length}   label="Pending"  color={C.yellow} />
          <StatCard value={completed.length} label="Done"     color={C.green}  />
          <StatCard value={upcoming.length}  label="Meetings" color={C.purple} />
        </div>

        {/* Provider + Settings */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 9, padding: "6px 12px", fontSize: 11, textAlign: "center", cursor: "pointer"
          }} onClick={() => setShowSettings(true)}>
            <div style={{ color: C.textPrimary, fontWeight: 600 }}>{curP.name}</div>
            <div style={{ color: curP.badgeColor, fontSize: 9, marginTop: 1 }}>● {curP.badge}</div>
          </div>
          <button onClick={() => setShowSettings(true)} className="btn-hover" style={{
            background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 9,
            width: 38, height: 38, color: C.textSecondary, fontSize: 17, cursor: "pointer", transition: "all .15s"
          }}>⚙</button>
        </div>
      </div>

      {/* ══════════ NEXT MEETING BANNER ══════════ */}
      {nextMtg && (() => {
        const hrs = Math.round((new Date(nextMtg.datetime) - new Date()) / 3600000);
        const urgent = hrs <= 2;
        return (
          <div style={{
            background: urgent ? "#1a0e00" : "#0e1a12",
            borderBottom: `1px solid ${urgent ? C.yellow + "44" : C.green + "33"}`,
            padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, fontSize: 12
          }}>
            <span style={{ fontSize: 14 }}>{urgent ? "⚠️" : "📅"}</span>
            <span style={{ color: C.textSecondary }}>Next meeting:</span>
            <span style={{ color: C.textPrimary, fontWeight: 600 }}>{nextMtg.title}</span>
            {nextMtg.with && <span style={{ color: C.textSecondary }}>with {nextMtg.with}</span>}
            <span style={{ color: urgent ? C.yellow : C.green, marginLeft: "auto", fontWeight: 600 }}>
              {new Date(nextMtg.datetime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              {urgent && " — SOON"}
            </span>
          </div>
        );
      })()}

      {/* ══════════ ERROR BANNER ══════════ */}
      {error && (
        <div style={{ background: "#1a0808", borderBottom: `1px solid ${C.red}44`, padding: "9px 20px", fontSize: 12, color: "#fca5a5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* ══════════ TABS ══════════ */}
      <div style={{ background: C.bgCard, borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 20px" }}>
        {TABS.map(t => (
          <button key={t.id} className="tab-item" onClick={() => setTab(t.id)} style={{
            padding: "11px 18px", fontSize: 13, border: "none", background: "transparent", cursor: "pointer",
            color: tab === t.id ? C.gold : C.textSecondary,
            borderBottom: `2px solid ${tab === t.id ? C.gold : "transparent"}`,
            fontWeight: tab === t.id ? 600 : 400, transition: "all .15s", display: "flex", alignItems: "center", gap: 6
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          CHAT TAB
      ══════════════════════════════════════ */}
      {tab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map(msg => (
              <div key={msg.id} className="msg-in" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}>
                {msg.role === "assistant" && (
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginBottom: 2,
                    background: "linear-gradient(135deg,#2a1f0d,#1a1300)", border: `1px solid ${C.gold}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800, color: C.gold, fontFamily: "Georgia, serif"
                  }}>J</div>
                )}
                <div style={{
                  maxWidth: "74%",
                  background: msg.role === "user" ? C.gradUser : C.gradBot,
                  border: `1px solid ${msg.role === "user" ? "#1f3d5c" : C.border}`,
                  borderRadius: msg.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                  padding: "12px 16px",
                  boxShadow: msg.role === "assistant" ? "0 2px 12px rgba(0,0,0,.3)" : "none"
                }}>
                  {msg.role === "assistant" && (
                    <div style={{ fontSize: 10, color: C.gold + "bb", marginBottom: 6, fontWeight: 600, letterSpacing: ".04em" }}>
                      JARVIS · {msg.time}
                    </div>
                  )}
                  <div style={{ fontSize: 14, lineHeight: 1.75, color: msg.role === "user" ? "#a8c9ef" : C.textPrimary, whiteSpace: "pre-wrap" }}>{msg.text}</div>
                  {msg.role === "user" && <div style={{ fontSize: 10, color: "#4a7090", textAlign: "right", marginTop: 4 }}>{msg.time}</div>}
                </div>
              </div>
            ))}

            {loading && (
              <div className="msg-in" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "linear-gradient(135deg,#2a1f0d,#1a1300)", border: `1px solid ${C.gold}55`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.gold, fontFamily: "Georgia, serif", fontWeight: 800
                }}>J</div>
                <div style={{
                  background: C.gradBot, border: `1px solid ${C.border}`,
                  borderRadius: "4px 18px 18px 18px", padding: "14px 20px",
                  display: "flex", gap: 6, alignItems: "center"
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.gold, animation: `blink 1.3s ease-in-out ${i * .25}s infinite` }} />
                  ))}
                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div style={{ background: C.bgCard, borderTop: `1px solid ${C.border}`, padding: "14px 20px" }}>
            {/* Quick chips */}
            <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
              {["Today's briefing", "Pending tasks", "Upcoming meetings", "Overdue tasks"].map(q => (
                <button key={q} className="quick-chip" onClick={() => sendMessage(q)} style={{
                  background: C.bgInput, border: `1px solid ${C.border}`, color: C.textSecondary,
                  fontSize: 11, padding: "4px 12px", borderRadius: 20, cursor: "pointer", transition: "all .15s"
                }}>{q}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Urdu ya English mein likhein...  (Enter = Send)"
                rows={2}
                style={{
                  flex: 1, background: C.bgInput, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: "11px 15px", color: C.textPrimary, fontSize: 14,
                  resize: "none", lineHeight: 1.6, transition: "border-color .2s"
                }}
                onFocus={e => e.target.style.borderColor = C.gold + "88"}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              {/* Mic */}
              <button onClick={listening ? stopVoice : startVoice} style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: listening ? "#3a0808" : C.bgInput,
                border: `1px solid ${listening ? C.red : C.border}`,
                color: listening ? C.red : C.textSecondary, fontSize: 20, cursor: "pointer",
                boxShadow: listening ? `0 0 14px ${C.red}44` : "none", transition: "all .2s"
              }} title="Urdu mein bolein">{listening ? "⏹" : "🎙"}</button>
              {/* Send */}
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: input.trim() && !loading ? `linear-gradient(135deg, ${C.gold}, ${C.goldDim})` : C.bgInput,
                border: `1px solid ${input.trim() && !loading ? C.gold : C.border}`,
                color: input.trim() && !loading ? "#0d1117" : C.textMuted,
                fontSize: 18, cursor: input.trim() && !loading ? "pointer" : "default", transition: "all .2s"
              }}>➤</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TASKS TAB
      ══════════════════════════════════════ */}
      {tab === "tasks" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 18 }}>
            {tasks.length} total records — {pending.length} pending, {completed.length} completed
          </div>

          {/* Pending & In-Progress */}
          {["high", "normal", "low"].map(prio => {
            const grp = pending.filter(t => (t.priority || "normal") === prio);
            if (!grp.length) return null;
            return (
              <div key={prio} style={{ marginBottom: 22 }}>
                <div style={{
                  fontSize: 11, color: prioColor(prio), marginBottom: 9, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: ".08em",
                  display: "flex", alignItems: "center", gap: 8
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: prioColor(prio) }} />
                  {prio} priority ({grp.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {grp.map(task => (
                    <div key={task.id} className="task-row" style={{
                      background: C.bgCard, border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${prioColor(task.priority)}`,
                      borderRadius: 10, padding: "13px 16px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      transition: "background .15s"
                    }}>
                      <div style={{ flex: 1, marginRight: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: task.notes ? 4 : 0 }}>
                          <span style={{
                            fontSize: 10, background: statBg(task.status), color: statColor(task.status),
                            padding: "2px 8px", borderRadius: 5, fontWeight: 600
                          }}>{task.status}</span>
                          <span style={{ fontSize: 14, color: C.textPrimary, fontWeight: 600 }}>{task.title}</span>
                        </div>
                        {task.notes && <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 3 }}>{task.notes}</div>}
                        {task.dueDate && (
                          <div style={{ fontSize: 11, color: new Date(task.dueDate) < new Date() ? C.red : C.textMuted, marginTop: 4 }}>
                            {new Date(task.dueDate) < new Date() ? "⚠️ OVERDUE · " : "📆 Due: "}{task.dueDate}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                        <button onClick={() => {
                          const u = tasks.map(t => t.id === task.id ? { ...t, status: "completed", completedAt: new Date().toISOString() } : t);
                          setTasks(u); saveData("hx-tasks", u);
                        }} style={{
                          background: "#0d2818", border: `1px solid ${C.green}66`, color: C.green,
                          borderRadius: 8, padding: "6px 13px", fontSize: 12, cursor: "pointer", fontWeight: 600
                        }}>✓ Done</button>
                        <button onClick={() => {
                          const u = tasks.filter(t => t.id !== task.id);
                          setTasks(u); saveData("hx-tasks", u);
                        }} style={{
                          background: "#1a0808", border: `1px solid ${C.red}44`, color: C.red,
                          borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer"
                        }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Divider */}
          {completed.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, margin: "20px 0 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: C.textMuted, background: C.bg, padding: "0 10px" }}>Completed ({completed.length})</span>
            </div>
          )}
          {completed.slice().reverse().map(task => (
            <div key={task.id} style={{
              background: C.bg, border: `1px solid ${C.border}33`,
              borderRadius: 8, padding: "9px 14px",
              display: "flex", justifyContent: "space-between",
              opacity: .55, marginBottom: 5
            }}>
              <span style={{ fontSize: 13, color: C.textSecondary, textDecoration: "line-through" }}>{task.title}</span>
              <span style={{ fontSize: 11, color: C.green }}>✓ {task.completedAt?.slice(0, 10)}</span>
            </div>
          ))}

          {tasks.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ color: C.textMuted, fontSize: 14 }}>No tasks yet, Sir.</div>
              <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>Tell JARVIS in chat what needs to be done.</div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          MEETINGS TAB
      ══════════════════════════════════════ */}
      {tab === "meetings" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 18 }}>
            {meetings.length} total — {upcoming.length} upcoming
          </div>

          {upcoming.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: C.purple, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.purple }} /> Upcoming ({upcoming.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {upcoming.map((m, i) => {
                  const dt = new Date(m.datetime);
                  const hrs = Math.round((dt - new Date()) / 3600000);
                  const isNext = i === 0;
                  return (
                    <div key={m.id} style={{
                      background: isNext ? "#110e1a" : C.bgCard,
                      border: `1px solid ${isNext ? C.purple + "66" : C.border}`,
                      borderRadius: 12, padding: "15px 18px",
                      boxShadow: isNext ? `0 0 16px ${C.purple}18` : "none"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          {isNext && <div style={{ fontSize: 10, color: C.purple, fontWeight: 600, marginBottom: 5, letterSpacing: ".06em" }}>▶ NEXT MEETING</div>}
                          <div style={{ fontSize: 15, color: C.textPrimary, fontWeight: 600, marginBottom: 3 }}>{m.title}</div>
                          {m.with && <div style={{ fontSize: 12, color: C.textSecondary }}>👤 With: {m.with}</div>}
                          {m.notes && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{m.notes}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                          <div style={{ fontSize: 14, color: C.textPrimary, fontWeight: 600 }}>
                            {dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div style={{ fontSize: 11, color: hrs <= 2 ? C.red : C.textMuted, marginTop: 3 }}>
                            {hrs <= 0 ? "🔴 NOW" : hrs <= 1 ? "⚠️ < 1 hour" : `${hrs}h away`}
                          </div>
                          <button onClick={() => { const u = meetings.filter(x => x.id !== m.id); setMeetings(u); saveData("hx-meetings", u); }}
                            style={{ marginTop: 8, background: "#1a0808", border: `1px solid ${C.red}44`, color: C.red, borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0 14px", paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Past Meetings ({past.length})</div>
              </div>
              {past.map(m => (
                <div key={m.id} style={{ background: C.bg, border: `1px solid ${C.border}33`, borderRadius: 8, padding: "9px 14px", display: "flex", justifyContent: "space-between", opacity: .6, marginBottom: 5 }}>
                  <div>
                    <span style={{ fontSize: 13, color: C.textSecondary }}>{m.title}</span>
                    {m.with && <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 10 }}>w/ {m.with}</span>}
                  </div>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{new Date(m.datetime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              ))}
            </div>
          )}

          {meetings.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <div style={{ color: C.textMuted, fontSize: 14 }}>No meetings scheduled, Sir.</div>
              <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>Tell JARVIS in chat to add a meeting.</div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ STATUS BAR ══════════ */}
      <div style={{
        background: C.bgCard, borderTop: `1px solid ${C.border}`,
        padding: "6px 20px", display: "flex", gap: 16, alignItems: "center",
        fontSize: 10, color: C.textMuted
      }}>
        <span style={{ color: C.green, fontWeight: 600 }}>● Online</span>
        <span>{curP.name} · <span style={{ color: curP.badgeColor }}>{curP.badge}</span></span>
        <span>Voice: {(window.SpeechRecognition || window.webkitSpeechRecognition) ? "✓ Urdu Ready" : "Chrome only"}</span>
        <span style={{ marginLeft: "auto", color: C.textMuted }}>
          {new Date().toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
