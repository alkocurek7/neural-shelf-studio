const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function supabase(path, method, body) {
  method = method || "GET";
  const res = await fetch(SUPABASE_URL + "/rest/v1" + path, {
    method: method,
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=minimal" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  if (method === "GET") return res.json();
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const data = await supabase("/books?select=data&order=created_at.desc");
      const books = (data || []).map(r => r.data);
      return res.status(200).json({ books });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const secret = req.headers["x-admin-secret"];
    if (!secret || secret !== ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { books } = req.body;
      await supabase("/books?id=neq.___none___", "DELETE");
      if (books && books.length > 0) {
        await supabase("/books", "POST", books.map(b => ({ id: b.id, data: b })));
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
