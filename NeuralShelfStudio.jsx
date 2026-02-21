import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ── Seed data (your existing indexes) ──
const SEED_BOOKS = [{"id":"1771615793254","title":"Is that a Fish in your Ear?","author":"David Bellos","dewey":"418","tags":["language"],"letterRange":"A-C","created":"2026-02-20T19:29:53.254Z","letters":{"A":{"words":["abstract thought","alphabet","analogy-based substitutions","animal language","anisomorphism","asymmetrical language regime","axioms"]},"L":{"words":["linguistic behavior"]},"B":{"words":["bilingualism","book reviews","book trade"]},"C":{"words":["category term","code switching","code breakers","color terms","computer aided translation (cat)","concrete languages","conference interpreting","contact language","context","cultural substitution","cuneiform script"]}},"links":[],"images":[]},{"id":"1771610913951","title":"Reader Come Home","author":"Maryanne Wolf","dewey":"418.401","tags":["reading","technology","brain","digital reading"],"letterRange":"A, B, M, N, P","created":"2026-02-20T18:08:33.951Z","letters":{"A":{"words":["analogy + inference","arcia/tl","ai","attention","asd"]},"B":{"words":["biliteracy","books/print media","reading brain"]},"M":{"words":["memory","mirror neurons","morphemes","multitasking","music"]},"N":{"words":["novelty bias"]},"P":{"words":["perspective taking"]}},"links":[{"from":"reading brain","to":"memory"}],"images":[]},{"id":"1771609681946","title":"In Praise of Failure","author":"Costica Bradatan","dewey":"158.1","tags":["failure","philosophy","psychology","humility"],"letterRange":"A-T, Y, S","created":"2026-02-20T17:48:01.946Z","letters":{"A":{"words":["alienation","apokatastasis"]},"C":{"words":["clumsiness","conspiracy theories"]},"D":{"words":["demiurge","democracy","differentiation"]},"F":{"words":["flawlessness"]},"G":{"words":["gandhi"]},"H":{"words":["humility"]},"M":{"words":["meaning"]},"N":{"words":["nihilism","nothingness"]},"P":{"words":["power","predestination"]},"R":{"words":["revolution"]},"S":{"words":["self-assertion","stoicism","storytelling"]},"T":{"words":["transhumanism"]}},"links":[{"from":"democracy","to":"humility"}],"images":[]},{"id":"1771607517277","title":"Visual Thinking","author":"Temple Grandin","dewey":"152.14","tags":["thinking","visual intelligence","neurodivergence"],"letterRange":"A, N, C, E","created":"2026-02-20T17:11:57.277Z","letters":{"A":{"words":["abstract thinking","adhd","ancestors","animal behavior","animal science","animal(s)","apprenticeships","architects","ai","artists","asperger's syndrome","automation","autism","algebra","(associational thinking)"]},"B":{"words":["broca's area","brain (animal)","bees","brain (human)"]},"C":{"words":["career(s)","cattle handling","chess","childhood education","children","cognitive neuroscience","collaborations","complementary minds","computers","creativity","community college","covid-19","career + technical education (cte)"]},"E":{"words":["educational system"]},"V":{"words":["visual thinking"]},"H":{"words":["human-animal relationship","homeschooling","home economics"]},"P":{"words":["people with autism","public schools"]},"N":{"words":["neurodiverse people","neurodiversity"]},"S":{"words":["speech","special education"]},"M":{"words":["mentors"]},"J":{"words":["jobs"]},"I":{"words":["internships"]},"T":{"words":["technology industry","torrence tests of creative thinking (ttct)"]}},"links":[{"from":"abstract thinking","to":"algebra"},{"from":"autism","to":"neurodiversity"},{"from":"children","to":"educational system"},{"from":"career(s)","to":"jobs"},{"from":"jobs","to":"internships"},{"from":"jobs","to":"apprenticeships"},{"from":"visual thinking","to":"(associational thinking)"},{"from":"creativity","to":"torrence tests of creative thinking (ttct)"}],"images":[]}];

// ── Constants ──
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COLORS = ["#FF6B6B","#FF8C42","#F9C74F","#6BCB77","#4D96FF","#9B5DE5","#FF6B9D","#48CAE4","#F4845F","#90BE6D","#C77DFF","#FFD93D"];

function deweyColor(dewey) {
  const d = String(dewey || "").trim()[0];
  return {"0":"#4D96FF","1":"#9B5DE5","2":"#F4845F","3":"#FF6B9D","4":"#48CAE4","5":"#6BCB77","6":"#FF8C42","7":"#FFD93D","8":"#FF6B6B","9":"#90BE6D"}[d] || "#A09890";
}

function wordColor(word) {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

// ── Main Component ──
export default function NeuralShelfStudio() {
  const [books, setBooks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState(null);
  const [view, setView]                 = useState("library");
  const [activeBookId, setActiveBookId] = useState(null);
  const [activeLetter, setActiveLetter] = useState(null);
  const [wordInput, setWordInput]       = useState("");
  const [searchQuery, setSearchQuery]   = useState("");

  // Admin
  const [adminSecret, setAdminSecret]     = useState(() => sessionStorage.getItem("ns-admin") || "");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminInput, setAdminInput]       = useState("");
  const [adminError, setAdminError]       = useState("");
  const isAdmin = adminSecret !== "";

  // Add/edit form
  const [newTitle, setNewTitle]   = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newDewey, setNewDewey]   = useState("");
  const [newTags, setNewTags]     = useState("");

  // Session note
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput]     = useState("");

  // Image upload
  const [imgRange, setImgRange] = useState("");
  const [imgNote, setImgNote]   = useState("");
  const fileRef = useRef(null);
  const saveTimer = useRef(null);
  const isFirstLoad = useRef(true);

  // ── Load books from API ──
  useEffect(() => {
    fetch("/api/books")
      .then(r => r.json())
      .then(({ books: b }) => { setBooks(b || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Auto-save when admin and books change ──
  useEffect(() => {
    if (!isAdmin || loading) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      setSaveError(null);
      fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
        body: JSON.stringify({ books }),
      })
        .then(r => r.json())
        .then(d => { setSaving(false); if (d.error) setSaveError(d.error); })
        .catch(() => { setSaving(false); setSaveError("Save failed"); });
    }, 1500);
  }, [books, isAdmin, loading]);

  // ── Admin login ──
  function tryAdminLogin() {
    setAdminError("");
    fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": adminInput },
      body: JSON.stringify({ books }),
    })
      .then(r => {
        if (r.ok) {
          sessionStorage.setItem("ns-admin", adminInput);
          setAdminSecret(adminInput);
          setShowAdminLogin(false);
          setAdminInput("");
          isFirstLoad.current = false;
        } else {
          setAdminError("Incorrect secret");
        }
      })
      .catch(() => setAdminError("Could not connect"));
  }

  function adminLogout() {
    sessionStorage.removeItem("ns-admin");
    setAdminSecret("");
  }

  // ── Import seed data ──
  function importSeedData() {
    setBooks(SEED_BOOKS);
    isFirstLoad.current = false;
  }

  const activeBook = books.find(b => b.id === activeBookId) || null;

  // ── Book actions ──
  function addBook() {
    if (!newTitle.trim()) return;
    const book = {
      id: Date.now().toString(),
      title: newTitle.trim(), author: newAuthor.trim(),
      dewey: newDewey.trim(),
      tags: newTags.split(",").map(t => t.trim()).filter(Boolean),
      sessionNote: "", created: new Date().toISOString(),
      letters: {}, images: [], links: [],
    };
    setBooks(prev => [book, ...prev]);
    setNewTitle(""); setNewAuthor(""); setNewDewey(""); setNewTags("");
    setActiveBookId(book.id); setView("book"); setActiveLetter(null); setEditingNote(false);
  }

  function toggleLetter(letter) {
    setActiveLetter(prev => prev === letter ? null : letter);
    setWordInput("");
  }

  function addWord() {
    if (!activeBook || !activeLetter || !wordInput.trim()) return;
    setBooks(prev => prev.map(b => {
      if (b.id !== activeBookId) return b;
      const letters = { ...b.letters };
      if (!letters[activeLetter]) letters[activeLetter] = { words: [] };
      const words = [...letters[activeLetter].words];
      wordInput.split(",").forEach(w => {
        const t = w.trim().toLowerCase();
        if (t && !words.includes(t)) words.push(t);
      });
      letters[activeLetter] = { ...letters[activeLetter], words };
      return { ...b, letters };
    }));
    setWordInput("");
  }

  function removeWord(letter, word) {
    setBooks(prev => prev.map(b => {
      if (b.id !== activeBookId) return b;
      const letters = { ...b.letters };
      if (!letters[letter]) return b;
      const words = letters[letter].words.filter(w => w !== word);
      if (words.length === 0) delete letters[letter];
      else letters[letter] = { ...letters[letter], words };
      return { ...b, letters };
    }));
  }

  function saveNote() {
    setBooks(prev => prev.map(b => b.id === activeBookId ? { ...b, sessionNote: noteInput } : b));
    setEditingNote(false);
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = { id: Date.now().toString(), dataUrl: ev.target.result, letterRange: imgRange || "A-Z", note: imgNote };
      setBooks(prev => prev.map(b => b.id === activeBookId ? { ...b, images: [...(b.images || []), img] } : b));
      setImgRange(""); setImgNote("");
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsDataURL(file);
  }

  function removeImage(imgId) {
    setBooks(prev => prev.map(b => b.id === activeBookId ? { ...b, images: (b.images || []).filter(i => i.id !== imgId) } : b));
  }

  function deleteBook(id) {
    setBooks(prev => prev.filter(b => b.id !== id));
    if (activeBookId === id) { setView("library"); setActiveBookId(null); setActiveLetter(null); }
  }

  // ── Patterns ──
  const patterns = useMemo(() => {
    const wordMap = {};
    books.forEach(b => Object.entries(b.letters || {}).forEach(([letter, data]) => {
      (data.words || []).forEach(word => {
        if (!wordMap[word]) wordMap[word] = [];
        wordMap[word].push({ bookId: b.id, bookTitle: b.title, letter });
      });
    }));
    const crossBook = Object.entries(wordMap)
      .filter(([_, a]) => new Set(a.map(x => x.bookId)).size >= 2)
      .sort((a, b) => new Set(b[1].map(x => x.bookId)).size - new Set(a[1].map(x => x.bookId)).size);
    const allWords = Object.entries(wordMap).sort((a, b) => b[1].length - a[1].length);
    return { crossBook, allWords, totalWords: Object.keys(wordMap).length };
  }, [books]);

  const bookStats = useCallback((book) => {
    const lk = Object.keys(book.letters || {});
    return { letters: lk.length, words: lk.reduce((s, l) => s + (book.letters[l].words?.length || 0), 0) };
  }, []);

  const filteredBooks = searchQuery
    ? books.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.author || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : books;

  // Derived
  const bookColor = activeBook ? deweyColor(activeBook.dewey) : "#A09890";
  const bookImages = activeBook ? (activeBook.images || []) : [];
  const bookLetterEntries = activeBook ? Object.entries(activeBook.letters || {}).sort() : [];
  const activeLetterColor = activeLetter ? COLORS[LETTERS.indexOf(activeLetter) % COLORS.length] : "#A09890";
  const activeWords = (activeBook && activeLetter) ? (activeBook.letters[activeLetter]?.words || []) : [];

  if (loading) return (
    <div style={{ ...S.root, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={S.muted}>Loading your shelf...</span>
    </div>
  );

  return (
    <div style={S.root}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ height: 4, background: "linear-gradient(90deg, #FF6B6B, #FF8C42, #F9C74F, #6BCB77, #4D96FF, #9B5DE5, #FF6B9D, #48CAE4, #C77DFF, #FFD93D)" }} />

      {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={S.logo} onClick={() => { setView("library"); setActiveBookId(null); setActiveLetter(null); }}>
            Neural Shelf
          </h1>
          <span style={S.logoSub}>indexing studio</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saving && <span style={{ ...S.muted, fontSize: 11 }}>saving...</span>}
          {saveError && <span style={{ fontSize: 11, color: "#FF6B6B" }}>save failed</span>}
          {view !== "patterns" && books.length > 0 && (
            <button onClick={() => setView("patterns")} style={S.ghostBtn}>Patterns</button>
          )}
          {view !== "library" && (
            <button onClick={() => { setView("library"); setActiveBookId(null); setActiveLetter(null); }} style={S.ghostBtn}>Library</button>
          )}
          {isAdmin && (
            <button onClick={() => setView("add")} style={S.primaryBtn}>+ Add Book</button>
          )}
          <button
            onClick={() => isAdmin ? adminLogout() : setShowAdminLogin(true)}
            style={{ ...S.ghostBtn, padding: "6px 10px", fontSize: 14 }}
            title={isAdmin ? "Exit edit mode" : "Edit mode"}
          >
            {isAdmin ? "🔓" : "🔒"}
          </button>
        </div>
      </div>

      {/* ── ADMIN LOGIN MODAL ── */}
      {showAdminLogin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ ...S.card, width: 320, margin: 0 }}>
            <h2 style={{ ...S.cardTitle, marginBottom: 8 }}>Enter edit mode</h2>
            <p style={{ ...S.muted, fontSize: 12, marginBottom: 14 }}>Enter your admin secret to add and edit indexes.</p>
            <input
              style={S.input} type="password" placeholder="Admin secret"
              value={adminInput} onChange={e => setAdminInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && tryAdminLogin()} autoFocus
            />
            {adminError && <p style={{ color: "#FF6B6B", fontSize: 12, marginTop: 6 }}>{adminError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={tryAdminLogin} style={S.primaryBtn}>Enter</button>
              <button onClick={() => { setShowAdminLogin(false); setAdminInput(""); setAdminError(""); }} style={S.ghostBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD BOOK ── */}
      {view === "add" && isAdmin && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>Add to your shelf</h2>
            <input style={S.input} placeholder="Title *" value={newTitle}
              onChange={e => setNewTitle(e.target.value)} autoFocus
              onKeyDown={e => e.key === "Enter" && document.getElementById("ns-author")?.focus()} />
            <input id="ns-author" style={{ ...S.input, marginTop: 8 }} placeholder="Author"
              value={newAuthor} onChange={e => setNewAuthor(e.target.value)} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input style={{ ...S.input, flex: "0 0 150px" }} placeholder="Dewey (e.g. 612.8)"
                value={newDewey} onChange={e => setNewDewey(e.target.value)} />
              <input style={{ ...S.input, flex: 1 }} placeholder="Tags, comma-separated"
                value={newTags} onChange={e => setNewTags(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addBook()} />
            </div>
            {newDewey.trim() && <p style={{ ...S.label, color: deweyColor(newDewey), marginTop: 8 }}>Dewey class {newDewey.trim()[0]}xx</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={addBook} style={S.primaryBtn} disabled={!newTitle.trim()}>Add to library</button>
              <button onClick={() => setView("library")} style={S.ghostBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIBRARY ── */}
      {view === "library" && (
        <div style={S.content}>
          {/* Import prompt — only shows when admin and DB was empty */}
          {isAdmin && books.length === 0 && (
            <div style={{ ...S.card, borderLeft: "3px solid #F9C74F", marginBottom: 16 }}>
              <p style={{ ...S.cardTitle, marginBottom: 6 }}>Import your saved indexes?</p>
              <p style={{ ...S.muted, fontSize: 13, marginBottom: 12 }}>Your 4 books from before are ready to import.</p>
              <button onClick={importSeedData} style={S.primaryBtn}>Import indexes</button>
            </div>
          )}

          {books.length > 0 && (
            <input style={{ ...S.input, marginBottom: 16 }} placeholder="Search titles, authors, or tags..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          )}

          {filteredBooks.length === 0 && books.length === 0 && !isAdmin && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
              <p style={{ ...S.muted, fontSize: 15 }}>No indexes yet.</p>
            </div>
          )}

          {filteredBooks.length === 0 && books.length > 0 && (
            <p style={{ ...S.muted, textAlign: "center", padding: 20 }}>No matches for that search.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredBooks.map(book => {
              const stats = bookStats(book);
              const color = deweyColor(book.dewey);
              return (
                <div key={book.id}
                  onClick={() => { setActiveBookId(book.id); setView("book"); setActiveLetter(null); setEditingNote(false); }}
                  style={S.bookRow}
                >
                  <div style={{ width: 5, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, padding: "12px 12px 12px 14px" }}>
                    {book.dewey && <p style={{ ...S.label, color, marginBottom: 3 }}>{book.dewey}</p>}
                    <div style={S.bookTitle}>{book.title}</div>
                    {book.author && <div style={S.bookAuthor}>{book.author}</div>}
                    {(book.tags || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {book.tags.map(tag => (
                          <span key={tag} style={{ ...S.tagPill, color, borderColor: color }}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {book.sessionNote ? (
                      <p style={{ ...S.muted, fontSize: 11, marginTop: 5, fontStyle: "italic" }}>
                        {book.sessionNote.slice(0, 80)}{book.sessionNote.length > 80 ? "..." : ""}
                      </p>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, padding: "12px 14px", justifyContent: "center", flexShrink: 0 }}>
                    {stats.words > 0 && <span style={S.stat}>{stats.words} terms</span>}
                    {stats.letters > 0 && <span style={S.stat}>{stats.letters} letters</span>}
                    {(book.images || []).length > 0 && <span style={S.stat}>{book.images.length} img</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BOOK DETAIL ── */}
      {view === "book" && activeBook && (
        <div style={S.content}>
          <div style={{ marginBottom: 22, borderLeft: "4px solid " + bookColor, paddingLeft: 14 }}>
            {activeBook.dewey && <p style={{ ...S.label, color: bookColor, marginBottom: 4 }}>{activeBook.dewey}</p>}
            <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A", margin: "0 0 4px 0" }}>
              {activeBook.title}
            </h2>
            {activeBook.author && <p style={{ ...S.muted, margin: 0 }}>{activeBook.author}</p>}
            {(activeBook.tags || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                {activeBook.tags.map(tag => (
                  <span key={tag} style={{ ...S.tagPill, color: bookColor, borderColor: bookColor }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Session note */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={S.label}>Session notes</p>
              {isAdmin && !editingNote && (
                <button onClick={() => { setEditingNote(true); setNoteInput(activeBook.sessionNote || ""); }}
                  style={{ ...S.ghostBtn, padding: "3px 10px", fontSize: 11 }}>
                  {activeBook.sessionNote ? "Edit" : "Add note"}
                </button>
              )}
            </div>
            {editingNote && isAdmin ? (
              <div>
                <textarea style={{ ...S.input, minHeight: 64, resize: "vertical", lineHeight: 1.5 }}
                  placeholder="e.g. A-C only, good but dense, return later to finish..."
                  value={noteInput} onChange={e => setNoteInput(e.target.value)} autoFocus />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={saveNote} style={S.primaryBtn}>Save</button>
                  <button onClick={() => setEditingNote(false)} style={S.ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <p style={{ ...S.muted, fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>
                {activeBook.sessionNote || "No session notes yet."}
              </p>
            )}
          </div>

          {/* Letter grid */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ ...S.label, marginBottom: 8 }}>Letters indexed</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {LETTERS.map(letter => {
                const hasData = (activeBook.letters[letter]?.words?.length || 0) > 0;
                const isActive = activeLetter === letter;
                const lc = COLORS[LETTERS.indexOf(letter) % COLORS.length];
                return (
                  <button key={letter}
                    onClick={() => isAdmin ? toggleLetter(letter) : (hasData && toggleLetter(letter))}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700,
                      cursor: (isAdmin || hasData) ? "pointer" : "default",
                      border: "none", transition: "all 0.12s",
                      background: isActive ? lc : hasData ? lc + "33" : "#F5F3EE",
                      color: isActive ? "#FFF" : hasData ? lc : "#C0B8A8",
                      boxShadow: isActive ? "0 2px 10px " + lc + "55" : "none",
                    }}>
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active letter */}
          {activeLetter && (
            <div style={{ ...S.card, borderLeft: "3px solid " + activeLetterColor, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 34, fontWeight: 700, color: activeLetterColor, lineHeight: 1 }}>
                  {activeLetter}
                </span>
                <span style={S.label}>{activeWords.length} terms</span>
              </div>
              {isAdmin && (
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  <input style={{ ...S.input, flex: 1 }} placeholder="Add term or comma-separated terms..."
                    value={wordInput} onChange={e => setWordInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addWord()} autoFocus />
                  <button onClick={addWord} style={{ ...S.primaryBtn, background: activeLetterColor }} disabled={!wordInput.trim()}>
                    Add
                  </button>
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {activeWords.map(word => {
                  const shared = books.some(b => b.id !== activeBookId && Object.values(b.letters || {}).some(l => l.words?.includes(word)));
                  const wc = wordColor(word);
                  return (
                    <span key={word} title={shared ? "Appears in other books" : ""} style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: shared ? 600 : 400,
                      padding: "5px 12px", borderRadius: 20,
                      background: shared ? wc : "transparent",
                      color: shared ? "#FFF" : wc,
                      border: "2px solid " + wc,
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}>
                      {shared && <span style={{ fontSize: 9 }}>&#x1F517;</span>}
                      {word}
                      {isAdmin && (
                        <span onClick={() => removeWord(activeLetter, word)}
                          style={{ cursor: "pointer", opacity: 0.5, fontSize: 14, lineHeight: 1, marginLeft: 2 }}>
                          &times;
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
              {activeWords.length === 0 && <p style={{ ...S.muted, fontSize: 12, fontStyle: "italic" }}>No terms yet.</p>}
            </div>
          )}

          {/* All words */}
          {!activeLetter && bookLetterEntries.length > 0 && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <p style={{ ...S.label, marginBottom: 10 }}>All captured terms</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {bookLetterEntries.map(([letter, data]) =>
                  (data.words || []).map(word => {
                    const shared = books.some(b => b.id !== activeBookId && Object.values(b.letters || {}).some(l => l.words?.includes(word)));
                    const wc = wordColor(word);
                    return (
                      <span key={letter + word} style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: shared ? 600 : 400,
                        padding: "4px 10px", borderRadius: 18,
                        background: shared ? wc : "transparent",
                        color: shared ? "#FFF" : wc,
                        border: "1.5px solid " + wc,
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        <span style={{ fontSize: 9, opacity: 0.55, fontWeight: 700 }}>{letter}</span>
                        {shared && <span style={{ fontSize: 9 }}>&#x1F517;</span>}
                        {word}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Images */}
          <div style={S.card}>
            <p style={{ ...S.label, marginBottom: 12 }}>Index images</p>
            {isAdmin && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <input style={{ ...S.input, flex: "0 0 130px" }} placeholder="Letters (e.g. A-C)"
                  value={imgRange} onChange={e => setImgRange(e.target.value)} />
                <input style={{ ...S.input, flex: 1, minWidth: 120 }} placeholder="Note (optional)"
                  value={imgNote} onChange={e => setImgNote(e.target.value)} />
                <button onClick={() => fileRef.current && fileRef.current.click()} style={S.ghostBtn}>Upload image</button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
              </div>
            )}
            {bookImages.length === 0 && (
              <p style={{ ...S.muted, fontSize: 12, fontStyle: "italic" }}>
                {isAdmin ? "No images yet. Upload photos of your handwritten index pages." : "No index images."}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bookImages.map(img => (
                <div key={img.id} style={{ border: "1px solid #EEEAE2", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#FAFAF8", borderBottom: "1px solid #EEEAE2" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ ...S.label, color: bookColor }}>{img.letterRange}</span>
                      {img.note && <span style={{ ...S.muted, fontSize: 11, fontStyle: "italic" }}>{img.note}</span>}
                    </div>
                    {isAdmin && (
                      <button onClick={() => removeImage(img.id)} style={{ ...S.ghostBtn, padding: "2px 8px", fontSize: 11, color: "#C0A0A0" }}>
                        Remove
                      </button>
                    )}
                  </div>
                  <img src={img.dataUrl} alt="index" style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "contain", background: "#F9F9F7" }} />
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <button onClick={() => { if (window.confirm("Remove this book from your library?")) deleteBook(activeBook.id); }}
              style={{ ...S.ghostBtn, color: "#C0A0A0", marginTop: 20, fontSize: 11 }}>
              Remove this book
            </button>
          )}
        </div>
      )}

      {/* ── PATTERNS ── */}
      {view === "patterns" && (
        <div style={S.content}>
          <h2 style={{ ...S.cardTitle, fontSize: 20, marginBottom: 20 }}>Patterns</h2>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { n: books.length, label: "Books", c: COLORS[4] },
              { n: patterns.totalWords, label: "Unique terms", c: COLORS[5] },
              { n: patterns.crossBook.length, label: "Cross-book", c: COLORS[2] },
            ].map((s, i) => (
              <div key={i} style={{ background: "#FAFAF8", border: "1px solid #EEEAE2", borderRadius: 12, padding: "14px 18px", flex: "1 1 80px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 26, fontWeight: 700, color: s.c }}>{s.n}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#8B8580", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {patterns.crossBook.length > 0 && (
            <div style={{ ...S.card, marginBottom: 12 }}>
              <p style={{ ...S.label, marginBottom: 14 }}>Terms appearing across books</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {patterns.crossBook.map(([word, appearances]) => {
                  const uniqueBooks = [...new Set(appearances.map(a => a.bookTitle))];
                  const wc = wordColor(word);
                  return (
                    <div key={word} style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, padding: "5px 14px", borderRadius: 20, background: wc, color: "#FFF", flexShrink: 0 }}>
                        {word}
                      </span>
                      <div style={{ paddingTop: 5 }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#8B8580" }}>{uniqueBooks.join(" · ")}</span>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#C0B8A8", marginLeft: 6 }}>{uniqueBooks.length} books</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {patterns.crossBook.length === 0 && books.length >= 2 && (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={S.muted}>No overlapping terms yet. Keep indexing - connections will surface.</p>
            </div>
          )}
          {books.length < 2 && (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={S.muted}>Index 2+ books to start seeing cross-book patterns.</p>
            </div>
          )}

          {patterns.allWords.length > 0 && (
            <div style={{ ...S.card, marginTop: 12 }}>
              <p style={{ ...S.label, marginBottom: 12 }}>All terms by frequency</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {patterns.allWords.slice(0, 80).map(([word, appearances]) => {
                  const freq = appearances.length;
                  const isMulti = new Set(appearances.map(a => a.bookId)).size > 1;
                  const wc = wordColor(word);
                  return (
                    <span key={word} style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: freq > 3 ? 16 : freq > 1 ? 13 : 11,
                      fontWeight: freq > 2 ? 700 : 400,
                      padding: "4px 11px", borderRadius: 18,
                      background: isMulti ? wc : "transparent",
                      color: isMulti ? "#FFF" : wc,
                      border: "1.5px solid " + wc,
                    }}>{word}</span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 48 }} />
    </div>
  );
}

const S = {
  root: { width: "100vw", minHeight: "100vh", background: "#FDFCFA", fontFamily: "'DM Sans', sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #EEEAE2", flexWrap: "wrap", gap: 10 },
  logo: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0, cursor: "pointer" },
  logoSub: { fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A09890", fontWeight: 400 },
  content: { maxWidth: 660, margin: "0 auto", padding: "24px 20px" },
  card: { background: "#FAFAF8", border: "1px solid #EEEAE2", borderRadius: 12, padding: "16px 18px", marginBottom: 12 },
  cardTitle: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 17, fontWeight: 600, color: "#1A1A1A", margin: "0 0 14px 0" },
  input: { fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1A1A", background: "#FFF", border: "1px solid #E0DCD4", borderRadius: 8, padding: "9px 14px", width: "100%", outline: "none", boxSizing: "border-box", lineHeight: 1.4 },
  label: { fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 },
  muted: { fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#A09890", margin: 0 },
  primaryBtn: { fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#FFF", background: "#1A1A1A", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", whiteSpace: "nowrap" },
  ghostBtn: { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#8B8580", background: "transparent", border: "1px solid #E0DCD4", borderRadius: 8, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" },
  bookRow: { display: "flex", alignItems: "stretch", borderRadius: 10, background: "#FAFAF8", border: "1px solid #EEEAE2", cursor: "pointer", overflow: "hidden" },
  bookTitle: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A" },
  bookAuthor: { fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A09890", marginTop: 2 },
  tagPill: { fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, padding: "2px 9px", borderRadius: 12, border: "1.5px solid", background: "transparent" },
  stat: { fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#C0B8A8" },
};
