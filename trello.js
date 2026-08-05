import axios from "axios";

const BASE_URL = "https://api.trello.com/1";

/**
 * Ambil semua kartu dari board (atau dari satu list spesifik kalau listId diisi)
 */
async function getCards({ apiKey, token, boardId, listId }) {
  const url = listId
    ? `${BASE_URL}/lists/${listId}/cards`
    : `${BASE_URL}/boards/${boardId}/cards`;

  const { data } = await axios.get(url, {
    params: {
      key: apiKey,
      token: token,
      fields: "name,due,dueComplete,shortUrl,idList",
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
 * Filter kartu: yang deadline-nya hari ini, dan yang udah lewat deadline (overdue)
 */
function splitCardsByDueDate(cards) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const dueToday = [];
  const overdue = [];

  for (const card of cards) {
    if (!card.due || card.dueComplete) continue;
    const dueDate = new Date(card.due);

    if (dueDate < startOfToday) {
      overdue.push(card);
    } else if (dueDate >= startOfToday && dueDate < endOfToday) {
      dueToday.push(card);
    }
  }

  return { dueToday, overdue };
}

export { getCards, getLists, splitCardsByDueDate };