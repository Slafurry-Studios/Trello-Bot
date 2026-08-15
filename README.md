# Slafurry Bot — Trello → Gemini → Discord

Sistem notifikasi otomatis buat tim Slafurry Studios. Tim tetap kerja pakai Trello seperti biasa — bot ini yang ngurusin laporan & pengingat ke Discord, dengan bantuan Gemini biar pesannya kerasa natural (bukan template kaku), dan bisa dikustom **beda kepribadian per divisi**.

## Fitur

| Fitur | Trigger | File utama |
|---|---|---|
| **Laporan Pagi** | Jadwal (default 07:00 WITA tiap hari) | `src/commands/index.js` |
| **Notifikasi Siap Direview** | Event: kartu pindah ke list target + semua checklist tercentang | `src/commands/checklist-review.js` |
| **Chat Message** | Manual / dipicu dari luar | `src/commands/chat-message.js` |

Semua fitur bisa dipisah per divisi (board Trello berbeda → channel Discord berbeda → kepribadian Gemini berbeda), lewat satu konfigurasi bernama `BOARD_TARGETS`.

---

## Arsitektur Singkat

- **Laporan Pagi**: GitHub Actions jalan sendiri sesuai jadwal, nanya ke Trello API, generate pesan pakai Gemini, kirim ke Discord. Nggak butuh device kamu nyala sama sekali.
- **Notifikasi Review**: Trello nggak bisa langsung "ngomong" ke GitHub Actions, jadi butuh perantara — **Cloudflare Worker** yang nerima webhook dari Trello, lalu nge-trigger GitHub Actions buat proses lebih lanjut (cek checklist, generate pesan, kirim ke Discord).
- **Chat Message**: cuma script yang nerima teks bebas, dirapihin Gemini, dikirim ke Discord — dipicu manual atau dari workflow lain.

---

## Setup dari Nol

### 1. Install dependencies

```bash
npm install
```

### 2. Siapkan Discord Webhook

1. Di Discord, buka channel tujuan → **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook**.
2. Kasih nama & avatar sesuai divisi (opsional), copy **Webhook URL**-nya.
3. Ulangi buat tiap divisi kalau kamu mau channel terpisah per divisi.

> ⚠️ URL webhook itu setara password — siapapun yang punya bisa kirim pesan ke channel itu. Jangan taruh di kode yang di-commit publik, selalu lewat GitHub Secrets.

### 3. Siapkan Kredensial Trello

1. Buka https://trello.com/power-ups/admin, klik **New** buat bikin Power-Up (cuma buat dapetin API key, nggak perlu diisi lengkap).
2. Masuk ke Power-Up itu → tab **API key** → **Generate a new API Key**, copy.
3. Di halaman yang sama, cari link generate **Token** → klik → **Allow** → copy token-nya. Pilih expiration **"Never"** biar nggak expired tiba-tiba.
4. Ambil **Board ID**: buka board Trello di browser, lihat URL-nya — bagian setelah `/b/` (misal `trello.com/b/ndAFQbvM/nama-board` → Board ID-nya `ndAFQbvM`).

### 4. (Opsional) Siapkan Gemini API Key

1. Buka https://aistudio.google.com/apikey, login pakai akun Google.
2. **Create API Key**, copy.
3. Kalau kamu skip ini (kosongin `GEMINI_API_KEY`), semua fitur tetap jalan — cuma fallback ke pesan statis, nggak generate lewat AI.

### 5. Isi File `.env` (buat testing lokal)

```bash
cp env.example .env
```

Isi minimal buat mulai testing satu divisi:
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx
TRELLO_API_KEY=xxxxx
TRELLO_TOKEN=xxxxx
TRELLO_BOARD_ID=ndAFQbvM
GEMINI_API_KEY=xxxxx
REMINDER_LANG=id
CRON_SCHEDULE=0 7 * * *
CRON_TIMEZONE=Asia/Makassar
```

Testing laporan pagi secara lokal:
```bash
node src/commands/index.js --now
```

---

## Setup Multi-Divisi (`BOARD_TARGETS`)

Kalau studio kamu punya beberapa divisi (Programming, Art, Writing, dll), tiap divisi bisa punya **board Trello sendiri**, **channel Discord sendiri**, dan **kepribadian bot sendiri** — tanpa perlu bikin repo/workflow terpisah.

Isi `BOARD_TARGETS` (di `.env` lokal, atau di GitHub Secrets buat production) dengan JSON:

```json
{
  "ndAFQbvM": {
    "type": "github",
    "url": "https://discord.com/api/webhooks/xxx-programming",
    "persona": "Nerd yang gemar bercanda pakai istilah programming (bug, commit, deploy), to the point, sedikit sarkas tapi tetap suportif."
  },
  "abCdEfGh": {
    "type": "github",
    "url": "https://discord.com/api/webhooks/xxx-art",
    "persona": "Ekspresif dan artistik, suka pakai analogi warna/visual, hangat, banyak emoji seni."
  }
}
```

**Penjelasan tiap field:**
- **Key** (`"ndAFQbvM"`) = Board ID Trello divisi tersebut.
- **`url`** = webhook Discord tujuan buat divisi ini (dipakai laporan pagi & notifikasi review).
- **`persona`** = deskripsi bebas soal gimana Gemini harus "berkepribadian" buat divisi ini. Makin spesifik makin bagus hasilnya (contoh di atas cukup representatif).
- **`type`** = **khusus dipakai Cloudflare Worker**, buat nentuin gimana Worker neruskan event kartu. **Selalu pakai `"github"`** kecuali kamu punya kebutuhan advanced di luar sistem ini (lihat catatan di `env.example`).
- **`listId`** (opsional) = kalau laporan pagi divisi ini mau fokus ke 1 list Trello aja, bukan seluruh board.

Kalau board tertentu **nggak ada** di `BOARD_TARGETS`, sistem fallback ke `DISCORD_WEBHOOK_URL` + `TRELLO_BOARD_ID` tunggal dan kepribadian default (santai generik).

---

## Deploy ke Production (GitHub Actions)

### 1. Push repo ke GitHub

```bash
git init
git add .
git commit -m "setup slafurry bot"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA_REPO.git
git push -u origin main
```

### 2. Isi GitHub Secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Tambahin:

| Secret | Wajib? | Keterangan |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | Ya (fallback) | Dipakai kalau board nggak ada di `BOARD_TARGETS` |
| `TRELLO_API_KEY` | Ya | |
| `TRELLO_TOKEN` | Ya | |
| `TRELLO_BOARD_ID` | Ya (fallback) | |
| `TRELLO_LIST_ID` | Opsional | |
| `GEMINI_API_KEY` | Opsional | Kosongkan = fallback ke pesan statis |
| `REMINDER_LANG` | Opsional | `id` atau `en`, default `id` |
| `BOARD_TARGETS` | Opsional | JSON multi-divisi (lihat bagian di atas) |

### 3. Cek Jadwal Laporan Pagi

Di `.github/workflows/trello-morning.yml`, defaultnya `0 23 * * *` (23:00 UTC = 07:00 WITA). GitHub Actions cron **selalu pakai UTC** — kalau mau jam lain, hitung dulu: **jam WITA − 8 = jam UTC**.

### 4. Testing Manual — PENTING, baca ini dulu

Tiap workflow di tab **Actions** punya cara testing yang beda:

- **Trello Morning Report**: kalau kamu klik **Run workflow** **tanpa** ngisi input `board_id`, dia bakal kirim ke **SEMUA divisi sekaligus** (sama kayak behaviour jadwal pagi otomatis — ini emang disengaja). Kalau cuma mau testing 1 divisi doang tanpa nge-spam channel lain, isi input `board_id` dengan Board ID divisi yang mau ditest aja.
- **Trello Card Review Notify**: klik **Run workflow**, isi input `card_id` dengan ID kartu Trello yang mau ditest — cuma proses 1 kartu itu, nggak akan nyentuh kartu/board lain.
- **Chat Message**: klik **Run workflow**, isi `message` (teks bebas) dan `lang` — selalu 1 pesan sekali kirim, dari awal desainnya emang begitu.

---

## Setup Notifikasi Review (Trello → Cloudflare Worker → GitHub Actions)

Fitur ini butuh 1 komponen tambahan karena GitHub Actions nggak bisa nerima webhook langsung dari luar.

### 1. Bikin GitHub Personal Access Token

1. https://github.com/settings/tokens → **Generate new token**.
2. Fine-grained: pilih repo target, scope **"Contents: Read and write"**. Classic: centang scope **`repo`**.
3. Copy token-nya.

### 2. Deploy Cloudflare Worker

```bash
npm install -g wrangler
wrangler login
cd cloudflare-worker
```

Edit `wrangler.toml`, isi:
```toml
[vars]
GITHUB_OWNER = "username_atau_org_kamu"
GITHUB_REPO = "nama_repo_kamu"
TARGET_LIST_NAME = "In Review"
```

Set token sebagai secret (jangan taruh di file):
```bash
wrangler secret put GITHUB_TOKEN
```

Kalau kamu pakai multi-divisi, set juga `BOARD_TARGETS` sebagai secret di Worker (isinya sama persis kayak yang di GitHub Secrets):
```bash
wrangler secret put BOARD_TARGETS
```

Deploy:
```bash
wrangler deploy
```

Catat URL publik yang muncul, formatnya kira-kira:
```
https://trello-review-webhook.<username-kamu>.workers.dev
```

### 3. Daftarin Webhook ke Trello

Buat **tiap board** yang mau dipantau (bisa lebih dari satu kalau multi-divisi):

```bash
curl -X POST "https://api.trello.com/1/webhooks" \
  -d "key=TRELLO_API_KEY" \
  -d "token=TRELLO_TOKEN" \
  -d "callbackURL=https://trello-review-webhook.<username-kamu>.workers.dev" \
  -d "idModel=BOARD_ID_DIVISI_INI" \
  -d "description=Review notify webhook"
```

### 4. Testing End-to-End

1. Buka kartu di board yang udah didaftarin webhook-nya.
2. Tambahin checklist, centang semua item.
3. Pindahin kartu ke list target (default `"In Review"` — samain sama `TARGET_LIST_NAME` di `wrangler.toml`).
4. Cek tab **Actions** GitHub — harusnya muncul run baru dari **"Trello Card Review Notify"** dalam beberapa detik.
5. Cek Discord — notifikasi "✅ Siap Direview!" harusnya muncul, dengan kepribadian sesuai divisi board itu (kalau kamu udah set `persona` di `BOARD_TARGETS`).

**Kalau nggak muncul**, cek satu-satu:
- `wrangler tail` (jalanin pas kamu pindahin kartu, buat lihat log Worker real-time)
- Nama list di Trello harus **persis sama** (case-insensitive boleh beda) sama `TARGET_LIST_NAME`
- Kalau pakai `BOARD_TARGETS`, pastiin field `"type"` di board itu diisi `"github"` — kalau `"webhook"`, Worker bakal skip GitHub/Gemini sepenuhnya dan langsung forward payload mentah Trello, jadi nggak akan ada pesan yang natural
- Cek log run di GitHub Actions — kalau run-nya jalan tapi nggak ada notifikasi, kemungkinan checklist belum 100% tercentang (itu emang sengaja, notifikasi cuma kirim kalau semua checklist selesai)

---

## Cara Kerja Fitur "Sedang Dikerjakan" & Label

- **Overdue / Deadline Hari Ini**: berdasarkan field **Due Date** di kartu Trello.
- **Sedang Dikerjakan**: berdasarkan field **Start Date** yang udah lewat tapi belum due. Kartu tanpa Start Date nggak akan pernah masuk kategori ini.
- **Label** ditampilkan apa adanya di tiap baris kartu — banyak tim (termasuk Slafurry) pakai label buat nandain **role/orang yang di-assign**, bukan kategori tugas. Tinggal rename label di board Trello sesuai role, otomatis kepakai di laporan.
- **Tugas selesai**: centang **"Mark due date complete"** di kartu (bukan cuma mindahin ke list "Done") — itu yang bikin kartu hilang dari semua kategori laporan.

## Catatan Lain

- Kartu **tanpa checklist sama sekali** dianggap "selesai" (nggak ada yang perlu dicek), jadi tetap kirim notifikasi review begitu masuk list target.
- Kartu yang keluar-masuk list target berkali-kali akan trigger notifikasi berkali-kali juga (nggak ada pengecekan "udah pernah dikirim"). Kalau mau dicegah, bisa ditambah penyimpanan status pakai Cloudflare KV — kasih tau kalau perlu.
