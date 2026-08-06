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
 * Minta Gemini generate 1 kalimat pembuka laporan pagi.
 * Tone berubah otomatis berdasarkan kondisi board.
 * Kalau gagal (API key kosong/error), fallback ke pesan statis.
 */
async function getMorningGreeting({
  apiKey,
  dueTodayCount = 0,
  overdueCount = 0,
  inProgressCount = 0,
  lang = "id",
}) {
  const localeConfig = {
    id: {
      language: "Bahasa Indonesia",
      fallback: {
        normal: "Semangat pagi! Yuk selesaikan tugas hari ini satu-satu. 💪",
        angry: "WOI ada tugas yang overdue tuh, jangan cuma diliatin doang! 😤",
      },
    },
    en: {
      language: "English",
      fallback: {
        normal: "Good morning! Let's knock out today's tasks one by one. 💪",
        angry: "Hey, you've got overdue tasks waiting—let's get them sorted! 😤",
      },
    },
  };

  const locale = localeConfig[lang] ?? localeConfig.id;

  const fallback =
    overdueCount > 0
      ? locale.fallback.angry
      : locale.fallback.normal;

  if (!apiKey) return fallback;

  const prompt = `
Kamu adalah Slafurry Bot, asisten internal tim game development Slafurry Studios.

Tulis seluruh jawaban menggunakan ${locale.language}.

Kondisi board hari ini:
- Tugas overdue: ${overdueCount}
- Deadline hari ini: ${dueTodayCount}
- Sedang dikerjakan: ${inProgressCount}

Kepribadian:
- Santai.
- Seperti rekan satu tim.
- Positif.
- Tidak formal.
- Kadang receh.
- Tidak pernah menyebut bahwa kamu AI atau chatbot.

Aturan:
- Tulis HANYA SATU kalimat.
- Maksimal 25 kata.
- Variasikan gaya bahasa setiap kali.
- Jangan mengarang jumlah tugas.
- Jangan mengulang angka lebih dari yang diberikan.
- Kalau ada overdue, boleh sedikit "ngomel" dengan nada bercanda, tapi tetap memberi semangat.
- Kalau tidak ada overdue, terdengar optimis dan menyenangkan.
- Bila tidak ada deadline maupun overdue, fokus memberi semangat untuk memulai hari.
- Gunakan maksimal 2 emoji.
- Jangan gunakan markdown atau tanda kutip.

Keluarkan HANYA kalimat pembukanya.
`;

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 1.2,
          topP: 0.9,
          maxOutputTokens: 50,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return text || fallback;
  } catch (err) {
    console.error(
      "Gagal generate pesan Gemini:",
      err.response?.data || err.message
    );
    return fallback;
  }
}

export { getMorningGreeting, getReviewMessage };

/**
 * Generate 1-2 kalimat pengumuman kalau ada kartu yang siap direview.
 * Fallback ke pesan statis kalau API key kosong/error.
 */
/**
 * Generate 1-2 kalimat pengumuman kalau ada kartu yang siap direview.
 * Fallback ke pesan statis kalau API key kosong/error.
 */
async function getReviewMessage({
  apiKey,
  cardName,
  cardDescription = "",
  listName,
  labels = [],
  lang = "id",
}) {
  const localeConfig = {
    id: {
      language: "Bahasa Indonesia",
      style:
        "Santai, akrab, dan seperti rekan satu tim yang sedang ngobrol di Discord.",
      fallback: `${cardName} udah siap direview nih! 👀`,
    },
    en: {
      language: "English",
      style:
        "Friendly and casual, like a teammate chatting on Discord.",
      fallback: `${cardName} is ready for review! 👀`,
    },
  };

  const locale = localeConfig[lang] ?? localeConfig.id;

  if (!apiKey) return locale.fallback;

  const labelText =
    labels.length > 0 ? labels.join(", ") : "Tidak ada";

  const prompt = `
Kamu adalah Slafurry Bot, bot Discord internal untuk tim game development Slafurry Studios.

Tulis seluruh jawaban menggunakan ${locale.language}.

Kepribadian:
- ${locale.style}
- Positif.
- Kadang boleh sedikit bercanda.
- Tidak formal.
- Tidak pernah menyebut bahwa kamu AI, chatbot, atau bot.
- Jangan menjelaskan proses berpikirmu.

Informasi kartu:
- Nama: ${cardName}
- Deskripsi: ${cardDescription || "(Tidak ada deskripsi)"}
- Label: ${labelText}
- List: ${listName}

Tugas:
Umumkan bahwa kartu tersebut sudah siap direview.

Aturan:
- Panjang 1-2 kalimat saja.
- Maksimal sekitar 45 kata.
- Bereaksi terhadap nama atau deskripsi kartu bila memungkinkan.
- Kalau kartunya terlihat besar atau penting, boleh terdengar lebih antusias.
- Kalau nama kartunya unik atau lucu, boleh kasih candaan ringan.
- Jangan mengarang detail teknis yang tidak ada.
- Jangan hanya mengulang nama kartu.
- Variasikan gaya bahasa setiap kali.
- Gunakan maksimal 2 emoji.
- Tutup dengan ajakan singkat agar tim mulai review.
- Jangan gunakan markdown, bullet list, ataupun tanda kutip.

Keluarkan HANYA isi pesannya.
`;

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 1.2,
          topP: 0.9,
          maxOutputTokens: 80,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return text || locale.fallback;
  } catch (err) {
    console.error(
      "Gagal generate pesan review dari Gemini:",
      err.response?.data || err.message
    );
    return locale.fallback;
  }
}