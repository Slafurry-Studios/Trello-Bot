import axios from "axios";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

export { getMorningGreeting };