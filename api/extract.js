const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
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
              text: `This is a handwritten book index page. Extract every index term you can read.

Return ONLY a JSON object where keys are uppercase letters (A, B, C...) and values are arrays of the terms listed under that letter. Include the letter only if terms appear under it.

Example format:
{"A": ["abstract thought", "analogy", "attention"], "B": ["bilingualism", "brain"]}

Rules:
- Lowercase all terms
- Include sub-terms and indented entries as their own items
- If a term has a "see also" reference, include the term but not the reference page numbers
- Skip page numbers entirely
- If you can't confidently read a word, skip it
- Return only the JSON, nothing else`,
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

    // Strip any markdown fences if present
    const clean = text.replace(/```json|```/g, "").trim();
    const terms = JSON.parse(clean);

    return res.status(200).json({ terms });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
