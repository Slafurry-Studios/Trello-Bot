import axios from "axios";
import { getLocale, buildPersonaHeader } from "./persona.js";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

const reviewFallback = {
  id: (cardName) => `${cardName} udah siap direview nih! 👀`,
  en: (cardName) => `${cardName} is ready for review! 👀`,
};

async function getReviewMessage({
  apiKey,
  cardName,
  cardDescription = "",
  listName,
  labels = [],
  lang = "id",
  persona = null,
}) {
  const locale = getLocale(lang);
  const fallback = (reviewFallback[lang] ?? reviewFallback.id)(cardName);

  if (!apiKey) return fallback;

  const labelText = labels.length > 0 ? labels.join(", ") : "Tidak ada";
  const personaHeader = buildPersonaHeader({ persona, locale });

  const prompt = `
${personaHeader}

Informasi kartu:
- Nama: ${cardName}
- Deskripsi: ${cardDescription || "(Tidak ada deskripsi)"}
- Label/role: ${labelText}
- List saat ini: ${listName}

Tugas: umumkan bahwa kartu ini sudah siap direview.

Cara bereaksi:
- Kalau nama/deskripsi kartu kedengaran besar atau penting (misal "release", "final boss", "launch"), boleh terdengar lebih antusias/heboh dikit.
- Kalau nama kartunya unik, lucu, atau nyeleneh, kasih candaan ringan yang nyambung — jangan candaan generik yang bisa dipasang ke kartu manapun.
- Kalau deskripsinya kosong/biasa aja, cukup reaksi standar yang tetep hangat, jangan dipaksa lucu.

Aturan:
- Panjang 1-2 kalimat, maksimal sekitar 40 kata.
- Jangan mengarang detail teknis yang tidak ada di deskripsi.
- Jangan cuma mengulang nama kartu secara datar — tunjukkan ada yang "baca" isinya.
- ${locale.avoid}
- Gunakan maksimal 2 emoji.
- Tutup dengan ajakan singkat buat tim mulai review (variasikan kalimat ajakannya, jangan selalu "yuk cek" doang).
- Jangan gunakan markdown, bullet list, atau tanda kutip.

Keluarkan HANYA isi pesannya, tanpa embel-embel lain.
`.trim();

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.2, topP: 0.9, maxOutputTokens: 90 },
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || fallback;
  } catch (err) {
    console.error("Gagal generate pesan review dari Gemini:", err.response?.data || err.message);
    return fallback;
  }
}

export { getReviewMessage };
