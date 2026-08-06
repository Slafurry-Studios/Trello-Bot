import axios from "axios";

const BASE_URL = "https://api.trello.com/1";


async function getCards({ apiKey, token, boardId, listId }) {
  const url = listId
    ? `${BASE_URL}/lists/${listId}/cards`
    : `${BASE_URL}/boards/${boardId}/cards`;

  const { data } = await axios.get(url, {
    params: {
      key: apiKey,
      token: token,
      fields: "name,due,dueComplete,start,shortUrl,idList",
      labels: "true",
      label_fields: "name,color",
    },
  });

  return data;
}


async function getLists({ apiKey, token, boardId }) {
  const { data } = await axios.get(`${BASE_URL}/boards/${boardId}/lists`, {
    params: { key: apiKey, token: token, fields: "name" },
  });
  return data;
}

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

    if (startDate && startDate <= now) {
      inProgress.push(card);
    }
  }

  return { dueToday, overdue, inProgress };
}

function formatCardLine(card, listNameById) {
  const labelText =
    card.labels && card.labels.length > 0
      ? " " + card.labels.map((l) => `\`${l.name || l.color}\``).join(" ")
      : "";
  const listName = listNameById[card.idList] || "?";
  return `• [${card.name}](${card.shortUrl}) — _${listName}_${labelText}`;
}

export { getCards, getLists, categorizeCards, formatCardLine };