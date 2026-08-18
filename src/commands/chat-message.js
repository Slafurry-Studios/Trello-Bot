import "dotenv/config";
import axios from "axios";
import { getChatMessage } from "../lib/gemini-chat.js";

const {
  DISCORD_WEBHOOK_URL,
  GEMINI_API_KEY,
  REMINDER_LANG,
} = process.env;

async function main() {
  const rawText = process.argv.slice(2).join(" ");

  if (!rawText) {
    console.error("Usage: node src/commands/chat-message.js <message text>");
    process.exit(1);
  }

  const message = await getChatMessage({
    apiKey: GEMINI_API_KEY,
    rawText,
    lang: REMINDER_LANG || "id",
  });

  const embed = {
    title: "💬 Informasi Penting",
    color: 0x5865f2,
    description: message,
    timestamp: new Date().toISOString(),
  };

  await axios.post(DISCORD_WEBHOOK_URL, {
    embeds: [embed],
  });

  console.log("Pesan chat dikirim.");
}

main().catch((err) => {
  console.error("Gagal kirim chat message:", err.response?.data || err.message);
  process.exit(1);
});
