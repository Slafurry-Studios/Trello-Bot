import axios from "axios";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Minta Gemini generate 1 kalimat semangat pagi dalam Bahasa Indonesia.
 * Kalau gagal (API key kosong/error), fallback ke pesan statis biar laporan tetap terkirim.
 */
async function getMorningGreeting({ apiKey, cardSummary }) {
  if (!apiKey) {
    return "Semangat pagi! Yuk selesaikan tugas hari ini satu-satu. 💪";
  }

  const prompt = `Buatkan 1 kalimat penyemangat pagi dalam Bahasa Indonesia, singkat (maks 20 kata), nadanya hangat dan nggak berlebihan, cocok buat pembuka pesan kerja tim di Discord. ${
    cardSummary ? `Konteks: ${cardSummary}` : ""
  } Jangan pakai tanda kutip, langsung kalimatnya saja.`;

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || "Semangat pagi! Yuk selesaikan tugas hari ini satu-satu. 💪";
  } catch (err) {
    console.error("Gagal generate pesan Gemini:", err.response?.data || err.message);
    return "Semangat pagi! Yuk selesaikan tugas hari ini satu-satu. 💪";
  }
}

export { getMorningGreeting };