import "dotenv/config";
import axios from "axios";
import { getCard } from "../lib/trello.js";
import { getReviewMessage } from "../lib/gemini-review.js";

const {
  DISCORD_WEBHOOK_URL,
  TRELLO_API_KEY,
  TRELLO_TOKEN,
  GEMINI_API_KEY,
  REMINDER_LANG,
} = process.env;

function getBoardTargets() {
  if (!process.env.BOARD_TARGETS) return null;
  try {
    return JSON.parse(process.env.BOARD_TARGETS);
  } catch (e) {
    console.error("Invalid BOARD_TARGETS JSON:", e.message);
    return null;
  }
}

async function main() {
  const cardId = process.argv[2];

  if (!cardId) {
    console.error("Usage: node src/commands/checklist-review.js <cardId>");
    process.exit(1);
  }

  const trelloParams = {
    apiKey: TRELLO_API_KEY,
    token: TRELLO_TOKEN,
  };

  const card = await getCard(cardId, trelloParams);

  console.log(`Kartu: ${card.name} (board: ${card.idBoard})`);
  console.log("Card berada di list In Review — kirim notifikasi...");

  // Cari target divisi (webhook + persona) berdasarkan board asal kartu ini.
  // Kalau boardnya nggak terdaftar di BOARD_TARGETS, fallback ke webhook & persona default.
  const boardTargets = getBoardTargets();
  const target = boardTargets?.[card.idBoard];
  const webhookUrl = target?.url || DISCORD_WEBHOOK_URL;
  const persona = target?.persona || null;

  if (!webhookUrl) {
    console.error(`Tidak ada webhook untuk board ${card.idBoard} dan DISCORD_WEBHOOK_URL kosong.`);
    process.exit(1);
  }

  const labelNames = (card.labels || [])
    .map((label) => label.name)
    .filter(Boolean);

  const message = await getReviewMessage({
    apiKey: GEMINI_API_KEY,
    cardName: card.name,
    cardDescription: card.desc || "",
    listName: "In Review",
    labels: labelNames,
    lang: REMINDER_LANG || "id",
    persona,
  });

  const embed = {
    title: "✅ Siap Direview!",
    color: 0x2ecc71,
    description: message,
    fields: [
      {
        name: "Kartu",
        value: `[${card.name}](${card.shortUrl})${
          labelNames.length
            ? "\n" + labelNames.map((label) => `\`${label}\``).join(" ")
            : ""
        }`,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  await axios.post(webhookUrl, {
    embeds: [embed],
  });

  console.log(`Notifikasi terkirim ke ${webhookUrl}.`);
}

main().catch((err) => {
  console.error(
    "Gagal proses review notify:",
    err.response?.data || err.message
  );
  process.exit(1);
});