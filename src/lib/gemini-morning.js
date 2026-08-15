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

  // Cuma jelasin situasi & seberapa "tinggi" intensitasnya — SENGAJA tidak dikasih
  // contoh kalimat literal, biar kepribadian di personaHeader yang sepenuhnya
  // nentuin gaya & pilihan katanya (persis kayak "Cara bereaksi" di gemini-review.js).
  // Kalau dikasih contoh kalimat fix, Gemini cenderung niru contohnya dan
  // persona custom yang lebih tajam/sarkas jadi ketahan, nggak keluar maksimal.
  const moodHint =
    overdueCount > 0
      ? `Ada tugas yang overdue — ini situasi paling "serius" hari ini, jadi tunjukkan level reaksi paling tinggi sesuai kepribadian di atas (kalau personanya sarkas/pedas, boleh sepedas itu; kalau lembut, boleh tetap lembut tapi tegas). Jangan ditahan-tahan, harus terasa lebih intens dibanding situasi due-today atau situasi aman.`
      : dueTodayCount > 0
      ? `Nggak ada overdue, tapi ada deadline hari ini — reaksi level menengah: lebih terdorong/mendesak dibanding situasi aman, tapi jangan setajam situasi overdue.`
      : `Nggak ada yang mendesak sama sekali — reaksi level paling santai, tetap ngajak mulai hari dengan baik sesuai kepribadian di atas.`;

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
