import axios from "axios";
import { getLocale, buildPersonaHeader } from "./persona.js";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

const morningFallback = {
  id: {
    normal: "Semangat pagi! Yuk selesaikan tugas hari ini satu-satu. 💪",
    angry: "WOI ada tugas yang overdue tuh, jangan cuma diliatin doang! 😤",
  },
  en: {
    normal: "Good morning! Let's knock out today's tasks one by one. 💪",
    angry: "Hey, you've got overdue tasks waiting — let's get them sorted! 😤",
  },
};

async function getMorningGreeting({
  apiKey,
  dueTodayCount = 0,
  overdueCount = 0,
  inProgressCount = 0,
  lang = "id",
  persona = null,
}) {
  const locale = getLocale(lang);
  const fallbackSet = morningFallback[lang] ?? morningFallback.id;
  const fallback = overdueCount > 0 ? fallbackSet.angry : fallbackSet.normal;

  if (!apiKey) return fallback;

  const moodHint =
    overdueCount > 0
      ? `Ada tugas overdue, jadi boleh sedikit "ngomel" — kayak temen yang gemes tapi tetep sayang, bukan marah beneran. Contoh rasa yang pas: "Woy, ada yang kelewat tuh, jangan pura-pura nggak liat 👀" atau "PR numpuk nih, sat set biar nggak jadi horor besok 😤".`
      : dueTodayCount > 0
      ? `Aman dari overdue, tapi ada deadline hari ini — nada optimis dan gercep. Contoh rasa yang pas: "Hari ini ada target yang harus kelar, gaskeun santai tapi pasti 🚀" atau "Deadline hari ini nungguin lho, cus diselesaiin".`
      : `Nggak ada yang mendesak sama sekali — nada santai, boleh sedikit iseng, tetap ngajak mulai hari dengan baik. Contoh rasa yang pas: "Langit cerah, board juga cerah, nikmatin dulu deh 🌤️" atau "Kosong tugas urgent hari ini, jangan kebablasan rebahan ya".`;

  // Kepribadian bot diambil dari persona.js (sumber yang sama dengan card review),
  // biar Slafurry Bot kedengaran sebagai karakter yang sama di morning reminder
  // maupun notifikasi review — bukan dua "kepribadian" yang berbeda-beda.
  const personaHeader = buildPersonaHeader({ persona, locale });

  const prompt = `
${personaHeader}

Kondisi board hari ini:
- Tugas overdue: ${overdueCount}
- Deadline hari ini: ${dueTodayCount}
- Sedang dikerjakan: ${inProgressCount}

Rasa/nada yang diharapkan: ${moodHint}

Aturan:
- Tulis HANYA SATU kalimat, maksimal 25 kata.
- Jangan mengarang atau membulatkan jumlah tugas — pakai angka yang diberikan apa adanya.
- ${locale.avoid}
- Gunakan maksimal 2 emoji, taruh di posisi yang natural (bukan cuma nempel di akhir kalimat terus).
- Jangan gunakan markdown atau tanda kutip.

Keluarkan HANYA kalimat pembukanya, tanpa embel-embel lain.
`.trim();

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.2, topP: 0.9, maxOutputTokens: 60 },
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
