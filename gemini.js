import axios from "axios";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";
  
const FALLBACK = {
  id: {
    normal: "Semangat pagi! Yuk selesaikan tugas hari ini satu-satu. 💪",
    angry: "WOI ada tugas yang overdue tuh, jangan cuma diliatin doang! 😤",
  },
  en: {
    normal: "Good morning! Let's knock out today's tasks one by one. 💪",
    angry: "Hey, you've got overdue tasks sitting there — stop scrolling and go fix it! 😤",
  },
};

/**
 * Minta Gemini generate 1 kalimat pembuka pagi.
 * Tone berubah otomatis: santai kalau semua aman, "marah-marah" ala bercanda kalau ada tugas overdue.
 * Kalau gagal (API key kosong/error), fallback ke pesan statis biar laporan tetap terkirim.
 */
async function getMorningGreeting({ apiKey, dueTodayCount = 0, overdueCount = 0, lang = "id" }) {
  const isAngry = overdueCount > 0;
  const langLabel = lang === "en" ? "English" : "Bahasa Indonesia";
  const fallback = (isAngry ? FALLBACK[lang]?.angry : FALLBACK[lang]?.normal) || FALLBACK.id.normal;

  if (!apiKey) {
    return fallback;
  }

  const toneInstruction = isAngry
    ? `Nadanya "marah-marah" tapi lucu/receh, kayak lagi ngomel ke temen sendiri karena telat ngerjain tugas — bukan marah beneran, tetap terasa peduli dan menghibur, boleh pakai emoji kesal (😤🔥). Sindir dikit tapi tetap sayang.`
    : `Nadanya hangat, santai, dan nggak berlebihan.`;

  const context = isAngry
    ? `Konteks: ada ${overdueCount} tugas yang OVERDUE (telat banget)${
        dueTodayCount > 0 ? ` dan ${dueTodayCount} tugas deadline hari ini` : ""
      }.`
    : dueTodayCount > 0
    ? `Konteks: ada ${dueTodayCount} tugas deadline hari ini, tidak ada yang overdue.`
    : `Konteks: tidak ada tugas mendesak hari ini.`;

  const prompt = `Buatkan 1 kalimat pembuka pesan pagi dalam ${langLabel}, singkat (maks 25 kata), cocok jadi pembuka pesan kerja tim di Discord. ${toneInstruction} ${context} Jangan pakai tanda kutip, langsung kalimatnya saja, tanpa penjelasan tambahan.`;

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || fallback;
  } catch (err) {
    console.error("Gagal generate pesan Gemini:", err.response?.data || err.message);
    return fallback;
  }
}

export { getMorningGreeting, getReviewMessage };

/**
 * Generate 1-2 kalimat pengumuman kalau ada kartu yang siap direview.
 * Fallback ke pesan statis kalau API key kosong/error.
 */
async function getReviewMessage({ apiKey, cardName, listName, labels = [], lang = "id" }) {
  const langLabel = lang === "en" ? "English" : "Bahasa Indonesia";
  const labelText = labels.length > 0 ? ` (role: ${labels.join(", ")})` : "";
  const fallback =
    lang === "en"
      ? `The card "${cardName}" is ready for review — all checklist items are done!`
      : `Kartu "${cardName}" udah siap direview nih! ✅`;

  if (!apiKey) return fallback;

  const prompt = `Buatkan 1-2 kalimat pengumuman singkat dalam ${langLabel} buat pesan Discord tim, isinya kasih tau bahwa kartu Trello berjudul "${cardName}"${labelText} sudah pindah ke list "${listName}" dan semua checklist-nya sudah selesai dicentang, jadi siap untuk direview. Nadanya positif dan santai, boleh pakai emoji secukupnya. Jangan pakai tanda kutip, langsung kalimatnya saja.`;

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { "Content-Type": "application/json" } }
    );
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || fallback;
  } catch (err) {
    console.error("Gagal generate pesan review dari Gemini:", err.response?.data || err.message);
    return fallback;
  }
}