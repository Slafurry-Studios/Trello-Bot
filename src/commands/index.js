import "dotenv/config";
import axios from "axios";
import cron from "node-cron";
import { getCards, getLists, categorizeCards, formatCardLine } from "../lib/trello.js";
import { getMorningGreeting } from "../lib/gemini-morning.js";

const {
  DISCORD_WEBHOOK_URL,
  TRELLO_API_KEY,
  TRELLO_TOKEN,
  TRELLO_BOARD_ID,
  TRELLO_LIST_ID,
  GEMINI_API_KEY,
  REMINDER_LANG,
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
  const { dueToday, overdue, inProgress } = categorizeCards(cards);

  const fields = [];
  const timezone = CRON_TIMEZONE || "Asia/Jakarta";

  if (overdue.length > 0) {
    fields.push({
      name: `⚠️ Overdue (${overdue.length})`,
      value: overdue.map((c) => formatCardLine(c, listNameById, timezone)).join("\n"),
    });
  }

  if (dueToday.length > 0) {
    fields.push({
      name: `🔔 Deadline Hari Ini (${dueToday.length})`,
      value: dueToday.map((c) => formatCardLine(c, listNameById, timezone)).join("\n"),
    });
  }

  if (inProgress.length > 0) {
    fields.push({
      name: `🛠️ Sedang Dikerjakan (${inProgress.length})`,
      value: inProgress.map((c) => formatCardLine(c, listNameById, timezone)).join("\n"),
    });
  }

  // Kirim angka aktual ke Gemini biar tone-nya otomatis berubah (galak kalau ada overdue)
  const greeting = await getMorningGreeting({
    apiKey: GEMINI_API_KEY,
    dueTodayCount: dueToday.length,
    overdueCount: overdue.length,
    lang: REMINDER_LANG || "id",
  });

  const baseDescription =
    fields.length === 0 ? "Tidak ada kartu aktif hari ini. Aman! 🎉" : undefined;

  return {
    title: overdue.length > 0 ? "😤 Woy, Bangun!" : "☀️ Selamat Pagi!",
    color: overdue.length > 0 ? 0xe74c3c : 0x0079bf,
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