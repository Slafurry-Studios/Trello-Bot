import "dotenv/config";
import axios from "axios";
import cron from "node-cron";
import { getCards, getLists, splitCardsByDueDate } from "./trello.js";
import { getMorningGreeting } from "./gemini.js";

const {
  DISCORD_WEBHOOK_URL,
  TRELLO_API_KEY,
  TRELLO_TOKEN,
  TRELLO_BOARD_ID,
  TRELLO_LIST_ID,
  GEMINI_API_KEY,
  CRON_SCHEDULE,
  CRON_TIMEZONE,
} = process.env;

async function buildMorningEmbed() {
  const trelloParams = {
    apiKey: TRELLO_API_KEY,
    token: TRELLO_TOKEN,
    boardId: TRELLO_BOARD_ID,
    listId: TRELLO_LIST_ID || undefined,
  };

  const [cards, lists] = await Promise.all([
    getCards(trelloParams),
    getLists(trelloParams),
  ]);

  const listNameById = Object.fromEntries(lists.map((l) => [l.id, l.name]));
  const { dueToday, overdue } = splitCardsByDueDate(cards);

  const fields = [];

  if (dueToday.length > 0) {
    fields.push({
      name: `🔔 Deadline Hari Ini (${dueToday.length})`,
      value: dueToday
        .map((c) => `• [${c.name}](${c.shortUrl}) — _${listNameById[c.idList] || "?"}_`)
        .join("\n"),
    });
  }

  if (overdue.length > 0) {
    fields.push({
      name: `⚠️ Overdue (${overdue.length})`,
      value: overdue
        .map((c) => `• [${c.name}](${c.shortUrl}) — _${listNameById[c.idList] || "?"}_`)
        .join("\n"),
    });
  }

  // Konteks singkat buat prompt Gemini, biar pesannya nyambung sama kondisi hari ini
  const cardSummary =
    dueToday.length === 0 && overdue.length === 0
      ? "tidak ada tugas mendesak hari ini"
      : `ada ${dueToday.length} tugas deadline hari ini${
          overdue.length > 0 ? ` dan ${overdue.length} tugas yang overdue` : ""
        }`;

  const greeting = await getMorningGreeting({ apiKey: GEMINI_API_KEY, cardSummary });

  const baseDescription =
    fields.length === 0 ? "Tidak ada kartu yang deadline hari ini. Aman! 🎉" : undefined;

  return {
    title: "☀️ Selamat Pagi!",
    color: 0x0079bf,
    description: [greeting, baseDescription].filter(Boolean).join("\n\n"),
    fields,
    timestamp: new Date().toISOString(),
  };
}

async function sendMorningReport() {
  try {
    const embed = await buildMorningEmbed();
    await axios.post(DISCORD_WEBHOOK_URL, { embeds: [embed] });
    console.log("Laporan pagi terkirim:", new Date().toISOString());
  } catch (err) {
    console.error("Gagal kirim laporan pagi:", err.response?.data || err.message);
  }
}

// Kalau dijalankan dengan `node index.js --now`, langsung kirim sekali (buat testing)
if (process.argv.includes("--now")) {
  sendMorningReport().then(() => process.exit(0));
} else {
  const schedule = CRON_SCHEDULE || "0 7 * * *";
  cron.schedule(schedule, sendMorningReport, {
    timezone: CRON_TIMEZONE || "Asia/Jakarta",
  });
  console.log(`Terjadwal dengan cron "${schedule}" (${CRON_TIMEZONE || "Asia/Jakarta"})`);
  console.log("Script jalan terus di background, menunggu jadwal...");
}