/**
 * Cloudflare Worker — penerima webhook Trello.
 *
 * Trello butuh URL publik buat ngirim event pas ada perubahan di board.
 * Worker ini yang jadi alamat itu. Tugasnya:
 * 1. Jawab "OK" ke request HEAD (Trello ngecek URL ini hidup pas registrasi webhook).
 * 2. Terima POST event dari Trello, filter: cuma proses kalau kartu dipindah ke list
 *    target (default "In Review").
 * 3. Kalau cocok, trigger GitHub Actions lewat repository_dispatch API, kirim ID
 *    kartunya. GitHub Actions yang nanti ngecek checklist & kirim ke Discord.
 *
 * Env vars yang perlu di-set di Cloudflare (Settings -> Variables and Secrets):
 * - GITHUB_TOKEN     : Personal Access Token dengan scope "repo" (buat trigger dispatch)
 * - GITHUB_OWNER     : username/organisasi GitHub, misal "Slafurry-Studios"
 * - GITHUB_REPO      : nama repo, misal "Trello-Bot"
 * - TARGET_LIST_NAME : nama list Trello yang jadi trigger, default "In Review"
 */

export default {
  async fetch(request, env) {
    // Trello ngirim HEAD request pas kamu daftarin webhook, buat mastiin URL-nya hidup.
    if (request.method === "HEAD") {
      return new Response(null, { status: 200 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const action = body?.action;
    const targetListName = env.TARGET_LIST_NAME || "In Review";

    // Cuma peduli sama event "kartu dipindah ke list lain"
    const isCardMove = action?.type === "updateCard" && action?.data?.listAfter;
    const movedToTarget =
      isCardMove &&
      action.data.listAfter.name?.toLowerCase() === targetListName.toLowerCase();

    if (!movedToTarget) {
      // Bukan event yang relevan, jawab OK aja biar Trello nggak retry terus
      return new Response("Ignored (not a move to target list)", { status: 200 });
    }

    const cardId = action.data.card.id;

    // Trigger GitHub Actions lewat repository_dispatch
    const ghResponse = await fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "trello-review-webhook",
        },
        body: JSON.stringify({
          event_type: "trello-card-review",
          client_payload: { cardId },
        }),
      }
    );

    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      console.error("Gagal trigger GitHub Actions:", ghResponse.status, errText);
      return new Response("Failed to trigger GitHub Actions", { status: 502 });
    }

    return new Response("Triggered", { status: 200 });
  },
};