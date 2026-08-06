import axios from "axios";

const BASE_URL = "https://api.trello.com/1";

/**
 * Ambil semua kartu dari board (atau dari satu list spesifik kalau listId diisi).
 * Termasuk field start (tanggal mulai) dan labels buat ditampilin di laporan.
 */
async function getCards({ apiKey, token, boardId, listId }) {
  const url = listId
    ? `${BASE_URL}/lists/${listId}/cards`
    : `${BASE_URL}/boards/${boardId}/cards`;

  const { data } = await axios.get(url, {
    params: {
      key: apiKey,
      token: token,
      fields: "name,due,dueComplete,start,shortUrl,idList",
      // labels butuh diminta terpisah biar dapet nama & warnanya
      labels: "true",
      label_fields: "name,color",
    },
  });

  return data;
}

/**
 * Ambil nama-nama list di board, dipakai untuk mapping idList -> nama list
 */
async function getLists({ apiKey, token, boardId }) {
  const { data } = await axios.get(`${BASE_URL}/boards/${boardId}/lists`, {
    params: { key: apiKey, token: token, fields: "name" },
  });
  return data;
}

/**
 * Kelompokkan kartu jadi 3 kategori:
 * - overdue: deadline udah lewat, belum selesai
 * - dueToday: deadline hari ini
 * - inProgress: tanggal mulai (start) udah lewat, tapi belum deadline hari ini/overdue
 *   (jadi ini kartu yang emang "lagi dikerjain" berdasarkan jadwal, deadline-nya masih di masa depan)
 */
function categorizeCards(cards) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const dueToday = [];
  const overdue = [];
  const inProgress = [];

  for (const card of cards) {
    if (card.dueComplete) continue;

    const dueDate = card.due ? new Date(card.due) : null;
    const startDate = card.start ? new Date(card.start) : null;

    if (dueDate) {
      if (dueDate < startOfToday) {
        overdue.push(card);
        continue;
      }
      if (dueDate >= startOfToday && dueDate < endOfToday) {
        dueToday.push(card);
        continue;
      }
    }

    // Belum overdue/due hari ini, tapi udah mulai dikerjain (start date udah lewat)
    if (startDate && startDate <= now) {
      inProgress.push(card);
    }
  }

  return { dueToday, overdue, inProgress };
}

/**
 * Format tanggal jadi singkat & gampang dibaca, misal "6 Agu, 14:00"
 */
function formatDate(dateStr, timezone = "Asia/Jakarta") {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/**
 * Format nama kartu jadi satu baris teks, termasuk tanggal deadline, label (role), dan nama list.
 */
function formatCardLine(card, listNameById, timezone) {
  const labelText =
    card.labels && card.labels.length > 0
      ? " " + card.labels.map((l) => `\`${l.name || l.color}\``).join(" ")
      : "";
  const listName = listNameById[card.idList] || "?";

  const dueFormatted = formatDate(card.due, timezone);
  const dateText = dueFormatted ? ` — 🗓️ ${dueFormatted}` : "";

  return `• [${card.name}](${card.shortUrl}) — _${listName}_${labelText}${dateText}`;
}

export { getCards, getLists, categorizeCards, formatCardLine };