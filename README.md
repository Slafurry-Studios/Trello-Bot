# Trello → Discord Morning Webhook

Versi lebih sederhana: nggak perlu bikin bot Discord, cukup **Webhook URL** dari channel target.

## 1. Buat Webhook Discord

1. Buka Discord, ke channel tempat kamu mau laporan pagi masuk.
2. Klik ikon gear (Edit Channel) → **Integrations** → **Webhooks** → **New Webhook**.
3. Kasih nama (misal "Trello Bot"), lalu klik **Copy Webhook URL** → ini buat `DISCORD_WEBHOOK_URL`.

## 2. Siapkan Kredensial Trello

1. Buka https://trello.com/app-key untuk dapat **API Key**.
2. Di halaman yang sama ada link buat generate **Token** (klik link "Token" → Allow) → ini `TRELLO_TOKEN`.
3. Ambil **Board ID**: buka board Trello kamu di browser, tambahkan `.json` di akhir URL (misal `https://trello.com/b/abc123/nama-board.json`), cari field `"id"` di hasilnya.
4. (Opsional) Kalau cuma mau pantau satu list tertentu, ambil List ID lewat `https://api.trello.com/1/boards/{boardId}/lists?key=...&token=...`.

## 3. (Opsional) Aktifin Pesan Semangat dari Gemini

1. Buka https://aistudio.google.com/apikey (login pakai akun Google).
2. Klik **Create API Key** → copy → ini buat `GEMINI_API_KEY`.
3. Gratis untuk pemakaian ringan kayak gini (jauh di bawah limit free tier).
4. Kalau kamu skip langkah ini (biarin `GEMINI_API_KEY` kosong), bot tetap jalan normal — cuma pesan semangatnya pakai kalimat statis, bukan generate dari AI.

## 4. Install & Jalankan

```bash
npm install
cp .env.example .env
# isi semua value di .env
npm start
```

Script ini akan tetap jalan di background dan otomatis ngirim laporan sesuai jadwal cron.

## 5. Testing Manual (kirim sekarang juga)

```bash
node index.js --now
```

Ini langsung kirim laporan sekali tanpa nunggu jadwal, cocok buat ngecek konfigurasi bener atau nggak.

## 6. Ubah Jadwal

Atur `CRON_SCHEDULE` di `.env` (format cron: `menit jam tanggal bulan hari`):
- `0 7 * * *` → tiap hari jam 07:00
- `30 6 * * 1-5` → jam 06:30 tapi cuma hari kerja (Senin–Jumat)

`CRON_TIMEZONE` default `Asia/Jakarta` (WIB) — ganti sesuai zona waktu kamu.

## 7. Cara Menjalankannya Terus-Menerus

Karena ini cuma script Node biasa (bukan bot yang connect ke Discord Gateway), ada beberapa pilihan hosting yang lebih fleksibel dibanding versi bot penuh:

- **VPS + pm2**: `pm2 start index.js --name trello-webhook`
- **Cron job OS-level**: skip bagian `node-cron` di kode, tinggal jalankan `node index.js --now` lewat crontab server (`0 7 * * * cd /path/proyek && node index.js --now`) — nggak perlu proses yang nyala 24 jam.
- **GitHub Actions scheduled workflow**: bikin `.yml` dengan trigger `schedule`, jalanin `node index.js --now` — gratis dan nggak perlu server sama sekali.
- **Railway / Render**: deploy sebagai "worker" yang jalan terus.

Opsi **GitHub Actions** biasanya paling praktis buat kasus kayak gini karena nggak perlu maintain server sama sekali.

## 8. Setup GitHub Actions (rekomendasi — gratis, nggak perlu server/HP nyala)

File workflow-nya sudah disiapkan di `.github/workflows/trello-morning.yml`. Langkahnya:

1. **Buat repository baru** di GitHub (boleh private, nggak masalah), lalu push semua file folder ini ke repo tersebut:
   ```bash
   git init
   git add .
   git commit -m "setup trello discord webhook"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA_REPO.git
   git push -u origin main
   ```

2. **Tambahkan Secrets** (kredensial rahasia, jangan pernah taruh langsung di kode):
   - Buka repo di GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Tambahkan satu-satu:
     - `DISCORD_WEBHOOK_URL`
     - `TRELLO_API_KEY`
     - `TRELLO_TOKEN`
     - `TRELLO_BOARD_ID`
     - `TRELLO_LIST_ID` (boleh kosong kalau nggak dipakai)
     - `GEMINI_API_KEY` (opsional, kosongkan kalau nggak dipakai)

3. **Cek jadwalnya** di `.github/workflows/trello-morning.yml` — defaultnya `0 0 * * *` (00:00 UTC = 07:00 WIB). GitHub Actions cron **selalu pakai UTC**, jadi kalau mau jam lain, hitung dulu selisihnya ke WIB (WIB = UTC+7). Contoh: mau jam 06:30 WIB → tulis `30 23 * * *` (23:30 UTC hari sebelumnya).

4. **Testing manual**: buka tab **Actions** di repo GitHub kamu → pilih workflow "Trello Morning Report" → klik **Run workflow** buat trigger langsung tanpa nunggu jadwal.

5. Setelah itu, GitHub otomatis jalanin workflow ini tiap hari sesuai jadwal — nggak perlu ada device kamu yang nyala sama sekali.

> Catatan: GitHub Actions scheduled workflow kadang bisa telat beberapa menit dari jadwal persis (karena antrian server GitHub), tapi biasanya masih cukup akurat buat kebutuhan laporan pagi.
