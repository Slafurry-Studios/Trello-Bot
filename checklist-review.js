import "dotenv/config";
import axios from "axios";
import { getCard } from "./trello.js";
import { getReviewMessage } from "./gemini.js";

const { DISCORD_WEBHOOK_URL, TRELLO_API_KEY, TRELLO_TOKEN, GEMINI_API_KEY, REMINDER_LANG } =
  process.env;

async function main() {
  const cardId = process.argv[2];
  if (!cardId) {
    console.error("Usage: node checklist-review.js <cardId>");
    process.exit(1);
  }

  const trelloParams = { apiKey: TRELLO_API_KEY, token: TRELLO_TOKEN };

  const card = await getCard(cardId, trelloParams);
  console.log(`Kartu: ${card.name}`);
  console.log(`Due Complete: ${card.dueComplete}`);

  if (!card.dueComplete) {
    console.log("Card belum di-Mark complete — notifikasi TIDAK dikirim.");
    return;
  }

  console.log("Card sudah di-Mark complete — kirim notifikasi ke Discord...");

  const labelNames = (card.labels || []).map((l) => l.name).filter(Boolean);

  const message = await getReviewMessage({
    apiKey: GEMINI_API_KEY,
    cardName: card.name,
    listName: "In Review",
    labels: labelNames,
    lang: REMINDER_LANG || "id",
  });

  const embed = {
    title: "✅ Siap Direview!",
    color: 0x2ecc71,
    description: message,
    fields: [
      {
        name: "Kartu",
        value: `[${card.name}](${card.shortUrl})${labelNames.length > 0 ? "\n" + labelNames.map((l) => `\`${l}\``).join(" ") : ""
          }`,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  await axios.post(DISCORD_WEBHOOK_URL, { embeds: [embed] });
  console.log("Notifikasi terkirim.");
}

main().catch((err) => {
  console.error("Gagal proses review notify:", err.response?.data || err.message);
  process.exit(1);
});