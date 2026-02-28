const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function uploadImageToSupabase(imageBase64, mediaType) {
  const ext = mediaType === "image/png" ? "png" : "jpg";
  const filename = `index-${Date.now()}.${ext}`;
  const buffer = Buffer.from(imageBase64, "base64");

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/index-images/${filename}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": mediaType,
      "Content-Length": buffer.length,
    },
    body: buffer,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Image upload failed: " + t);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/index-images/${filename}`;
  return publicUrl;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  try {
    // Upload image to Supabase Storage
    const imageUrl = await uploadImageToSupabase(imageBase64, mediaType || "image/jpeg");

    // Send to Claude for extraction
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `This is a handwritten book index page. Extract everything you can read.

Return ONLY a JSON object with this exact structure:
{
  "book": {
    "title": "book title if visible, otherwise null",
    "author": "author name if visible, otherwise null",
    "dewey": "dewey decimal number if visible, otherwise null",
    "tags": ["tag1", "tag2"]
  },
  "terms": {
    "A": ["term1", "term2"],
    "B": ["term1"]
  }
}

Rules for book metadata:
- Look for labels like "Title:", "Author:", "Auth:", "Dewey:", "DDC:", "By:" anywhere on the page
- For tags: infer 2-4 subject tags from the terms and title (e.g. "neuroscience", "brain", "memory")
- If something isn't visible or readable, use null for that field

Rules for terms:
- Lowercase all terms
- Include sub-terms and indented entries as their own items
- Skip page numbers
- If you can't confidently read a word, skip it
- Only include the letters section that actually appear on this page

Return only the JSON, nothing else.`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: err });
    }

    const data = await response.json();
    const text = data.content[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({
      terms: parsed.terms || {},
      book: parsed.book || {},
      imageUrl,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
