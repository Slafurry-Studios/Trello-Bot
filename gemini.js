import axios from "axios";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Generate a short morning greeting. Supports English ('en') and Indonesian ('id').
// If `apiKey` is missing or the API call fails, return a simple fallback message.
async function getMorningGreeting({ apiKey, cardSummary, lang = "id" }) {
  const fallback = lang === "en"
    ? "Good morning! Let's tackle today's tasks one step at a time. 💪"
    : "Semangat pagi! Yuk selesaikan tugas hari ini satu-satu. 💪";

  if (!apiKey) return fallback;

  const prompts = {
    en: `Write one short (max 20 words) warm, non-exaggerated morning encouragement sentence in English suitable as an opener for a team's Discord message. ${
      cardSummary ? `Context: ${cardSummary}` : ""
    } Do not use quotation marks; return only the sentence.`,
    id: `Buat satu kalimat penyemangat pagi singkat (maks 20 kata), hangat dan tidak berlebihan, cocok untuk pembuka pesan tim di Discord. ${
      cardSummary ? `Konteks: ${cardSummary}` : ""
    } Jangan pakai tanda kutip; kembalikan hanya kalimatnya.`,
  };

  const prompt = prompts[lang] || prompts.id;

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { "Content-Type": "application/json" } }
    );

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || fallback;
  } catch (err) {
    console.error("Failed to generate Gemini greeting:", err.response?.data || err.message);
    return fallback;
  }
}

export { getMorningGreeting };