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

async function buildMorningEmbed({ boardId, listId, persona, lang } = {}) {
  const trelloParams = {
    apiKey: TRELLO_API_KEY,
    token: TRELLO_TOKEN,
    boardId: boardId || TRELLO_BOARD_ID,
    listId: listId || TRELLO_LIST_ID || undefined,
  };

  const [cards, lists] = await Promise.all([
    getCards(trelloParams),
    getLists(trelloParams),
  ]);

  const listNameById = Object.fromEntries(lists.map((l) => [l.id, l.name]));
  const timezone = CRON_TIMEZONE || "Asia/Jakarta";
  const { dueToday, overdue, inProgress } = categorizeCards(cards, timezone);

  const fields = [];

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

  console.log(
    `Trello morning report: board=${TRELLO_BOARD_ID} list=${TRELLO_LIST_ID || "all"} ` +
      `timezone=${timezone} overdue=${overdue.length} dueToday=${dueToday.length} inProgress=${inProgress.length}`
  );

  // Kirim angka aktual ke Gemini biar tone-nya otomatis berubah (galak kalau ada overdue)
  const greeting = await getMorningGreeting({
    apiKey: GEMINI_API_KEY,
    dueTodayCount: dueToday.length,
    overdueCount: overdue.length,
    inProgressCount: inProgress.length,
    lang: lang || REMINDER_LANG || "id",
    persona,
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
  // Coba baca BOARD_TARGETS untuk mengirim laporan ke beberapa board/target
  let boardTargets = null;
  if (process.env.BOARD_TARGETS) {
    try {
      boardTargets = JSON.parse(process.env.BOARD_TARGETS);
    } catch (e) {
      console.error("Invalid BOARD_TARGETS JSON:", e.message);
      boardTargets = null;
    }
  }

  if (boardTargets && Object.keys(boardTargets).length > 0) {
    // Kalau TARGET_BOARD_ID diisi (biasanya dari input manual "Run workflow"),
    // cuma proses board itu aja — biar testing 1 divisi nggak nge-spam divisi lain.
    const targetBoardId = process.env.TARGET_BOARD_ID?.trim();
    const entries = targetBoardId
      ? Object.entries(boardTargets).filter(([boardId]) => boardId === targetBoardId)
      : Object.entries(boardTargets);

    if (targetBoardId && entries.length === 0) {
      console.error(
        `TARGET_BOARD_ID="${targetBoardId}" tidak ditemukan di BOARD_TARGETS. Tidak ada yang dikirim.`
      );
      return;
    }

    for (const [boardId, target] of entries) {
      try {
        const embed = await buildMorningEmbed({
          boardId,
          listId: target.listId,
          persona: target.persona,
          lang: target.lang,
        });
        const url = target.url || DISCORD_WEBHOOK_URL;
        if (!url) {
          console.warn(`Tidak ada webhook target untuk board ${boardId}; dilewatkan.`);
          continue;
        }

        await axios.post(url, { embeds: [embed] });
        console.log(`Laporan pagi untuk board ${boardId} terkirim ke ${url}`);
      } catch (err) {
        console.error(`Gagal kirim laporan pagi untuk board ${boardId}:`, err.response?.data || err.message);
      }
    }
  } else {
    // Fallback: perilaku lama (single webhook + single board dari env)
    try {
      const embed = await buildMorningEmbed();
      await axios.post(DISCORD_WEBHOOK_URL, { embeds: [embed] });
      console.log("Laporan pagi terkirim:", new Date().toISOString());
    } catch (err) {
      console.error("Gagal kirim laporan pagi:", err.response?.data || err.message);
    }
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