/**
 * Cloudflare Worker — penerima webhook Trello dengan dukungan multi-target per board.
 *
 * Perubahan utama:
 * - Bisa mengonfigurasi BOARD_TARGETS (JSON) supaya setiap board bisa memiliki target
 *   berbeda (mis. webhook eksternal atau GitHub repository_dispatch).
 * - Kalau BOARD_TARGETS tidak diset, tetap fallback ke perilaku lama (TARGET_LIST_NAME
 *   + GITHUB_* env) untuk kompatibilitas.
 *
 * Contoh BOARD_TARGETS (string JSON di environment):
 * {
 *   "<boardIdA>": { "type": "github" },
 *   "<boardIdB>": { "type": "webhook", "url": "https://example.com/your-hook" }
 * }
 *
 * Untuk "github" worker akan menggunakan env GITHUB_OWNER, GITHUB_REPO dan GITHUB_TOKEN
 * (sama seperti sebelumnya). Untuk "webhook" worker akan melakukan POST ke url yang
 * diset dengan payload sederhana { event_type, boardId, cardId, action }.
 */

export default {
  async fetch(request, env) {
    if (request.method === "HEAD") return new Response(null, { status: 200 });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400 });
    }

    const action = body?.action;
    if (!action) return new Response("No action in payload", { status: 400 });

    // Ambil board id dari payload kalau ada
    const boardId = action?.data?.board?.id || action?.data?.board?.idBoard || action?.data?.card?.idBoard;
    const cardId = action?.data?.card?.id;

    // Parse BOARD_TARGETS jika ada
    let boardTargets = null;
    if (env.BOARD_TARGETS) {
      try {
        boardTargets = JSON.parse(env.BOARD_TARGETS);
      } catch (e) {
        console.error("Invalid BOARD_TARGETS JSON:", e.message);
        // jangan gagal total: biarkan boardTargets null supaya fallback ke perilaku lama
        boardTargets = null;
      }
    }

    // Kalau event bukan updateCard->listAfter, abaikan (agar Trello nggak retry terus)
    const isCardMove = action?.type === "updateCard" && action?.data?.listAfter;
    if (!isCardMove) return new Response("Ignored (not an updateCard/listAfter)", { status: 200 });

    // Jika ada mapping khusus untuk board ini, gunakan
    if (boardId && boardTargets && boardTargets[boardId]) {
      const target = boardTargets[boardId];

      if (target.type === "webhook" && target.url) {
        try {
          const resp = await fetch(target.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "trello-review-webhook" },
            body: JSON.stringify({ event_type: "trello-card-move", boardId, cardId, action }),
          });

          if (!resp.ok) {
            const text = await resp.text();
            console.error("Forward to webhook failed:", resp.status, text);
            return new Response("Failed to forward to webhook", { status: 502 });
          }

          return new Response("Forwarded", { status: 200 });
        } catch (e) {
          console.error("Error forwarding to webhook:", e.message);
          return new Response("Failed to forward to webhook", { status: 502 });
        }
      }

      if (target.type === "github") {
        // gunakan env GITHUB_* (fallback) atau override dari target
        const owner = target.owner || env.GITHUB_OWNER;
        const repo = target.repo || env.GITHUB_REPO;
        const token = target.token || env.GITHUB_TOKEN;

        if (!owner || !repo || !token) {
          console.error("Missing GitHub config for github dispatch target", { owner, repo });
          return new Response("Missing GitHub configuration", { status: 500 });
        }

        try {
          const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
            method: "POST",
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
              "User-Agent": "trello-review-webhook",
            },
            body: JSON.stringify({ event_type: "trello-card-review", client_payload: { cardId, boardId } }),
          });

          if (!ghResp.ok) {
            const text = await ghResp.text();
            console.error("GitHub dispatch failed:", ghResp.status, text);
            return new Response("Failed to trigger GitHub Actions", { status: 502 });
          }

          return new Response("Triggered", { status: 200 });
        } catch (e) {
          console.error("Error triggering GitHub dispatch:", e.message);
          return new Response("Failed to trigger GitHub Actions", { status: 502 });
        }
      }

      // tipe target tidak dikenali
      console.error("Unknown target type for board", boardId, target);
      return new Response("Unknown target type", { status: 500 });
    }

    // Fallback ke perilaku lama: pakai TARGET_LIST_NAME + GITHUB_* env
    const targetListName = env.TARGET_LIST_NAME || "👀 In Review / Testing";
    const movedToTarget = action.data.listAfter.name?.toLowerCase() === targetListName.toLowerCase();
    if (!movedToTarget) return new Response("Ignored (not a move to target list)", { status: 200 });

    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const token = env.GITHUB_TOKEN;
    if (!owner || !repo || !token) {
      console.error("Missing GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN for fallback dispatch");
      return new Response("Missing GitHub configuration", { status: 500 });
    }

    try {
      const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "trello-review-webhook",
        },
        body: JSON.stringify({ event_type: "trello-card-review", client_payload: { cardId, boardId } }),
      });

      if (!ghResp.ok) {
        const text = await ghResp.text();
        console.error("GitHub dispatch failed:", ghResp.status, text);
        return new Response("Failed to trigger GitHub Actions", { status: 502 });
      }

      return new Response("Triggered", { status: 200 });
    } catch (e) {
      console.error("Error triggering GitHub dispatch:", e.message);
      return new Response("Failed to trigger GitHub Actions", { status: 502 });
    }
  },
};
