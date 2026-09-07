# WARMA RT 05/021 - Versi Supabase

Versi ini memakai **Supabase sebagai database online bersama**, sehingga data dapat dipakai dari HP warga maupun HP pengurus/admin. LocalStorage tidak lagi menjadi database aplikasi.

## Modul yang sudah terhubung
- Akun/login Supabase Auth
- Pendaftaran warga otomatis membuat profil + data warga
- Lupa / Reset Password melalui email
- Data Warga
- Iuran bulanan
- Nominal iuran
- Arisan
- Pemasukan & pengeluaran
- Laporan/saldo
- Pengumuman
- Pengajuan surat
- Kegiatan
- Sinkronisasi realtime antar perangkat
- Row Level Security (RLS) untuk membatasi aksi admin

## Setup Supabase
1. Buat project baru di Supabase.
2. Buka **SQL Editor**.
3. Jalankan seluruh isi `supabase_schema.sql`.
4. Buka **Project Settings > API** dan salin Project URL + anon/publishable key.
5. Isi `supabase-config.js`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. Di **Authentication > URL Configuration**, set **Site URL** ke alamat GitHub Pages WARMA. Tambahkan alamat yang sama ke Redirect URLs bila diperlukan.
7. Deploy file WARMA ke GitHub Pages.
8. Daftar satu akun untuk pengurus.
9. Jadikan akun tersebut admin melalui SQL:

```sql
update public.profiles
set role='admin'
where email='EMAIL_ADMIN_KAMU';
```

## Keamanan
- Jangan pernah memasukkan `service_role` key ke `supabase-config.js`.
- Pendaftaran publik selalu menjadi role `warga`.
- Hak admin diberikan dari database, bukan dari form pendaftaran.
- Password ditangani Supabase Auth dan tidak disimpan oleh aplikasi.

## Catatan
Data lama dari LocalStorage versi sebelumnya **tidak otomatis dipindahkan** karena struktur ID/akun berbeda. Jika data lama berisi data penting, lakukan migrasi setelah database baru aktif agar tidak terjadi duplikasi.

## Kontak aktif & Reset via WhatsApp
Pendaftaran sekarang **mewajibkan email dan nomor WhatsApp aktif**. Email dipakai untuk reset password standar melalui Supabase Auth. Nomor WhatsApp disimpan dalam format Indonesia dan dibuat unik agar satu nomor tidak terhubung ke beberapa akun.

### Reset via WhatsApp (opsional)
Tombol **Reset Password via WhatsApp** sudah tersedia di halaman login. Agar benar-benar mengirim link reset otomatis, pasang Edge Function berikut:

```text
supabase/functions/send-wa-reset/index.ts
```

Function menggunakan Twilio WhatsApp dan membutuhkan secret di Supabase:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WARMA_SITE_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
```

`SUPABASE_SERVICE_ROLE_KEY` **hanya boleh disimpan sebagai Secret Edge Function, jangan dimasukkan ke JavaScript/GitHub**.

Setelah deploy function, isi `WA_RECOVERY_FUNCTION_URL` di `supabase-config.js` dengan:

```text
https://PROJECT_REF.supabase.co/functions/v1/send-wa-reset
```

Twilio/WhatsApp dapat mensyaratkan sender dan template WhatsApp yang sudah disetujui untuk pengiriman produksi. Jika belum ingin memakai provider berbayar, gunakan reset via email yang sudah tersedia.

## Verifikasi WhatsApp OTP saat pendaftaran

Versi ini menambahkan OTP WhatsApp sebelum akun warga dibuat. Implementasi memakai **Twilio Verify** melalui Supabase Edge Function agar token rahasia tidak pernah masuk ke browser/GitHub.

### 1. Buat Twilio Verify Service
Buat Verify Service di Twilio dan aktifkan WhatsApp sebagai channel verifikasi. Catat `Account SID`, `Auth Token`, dan `Verify Service SID`.

### 2. Deploy Edge Function
Folder:

`supabase/functions/wa-otp/index.ts`

Set secret di Supabase Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

Deploy function `wa-otp`, lalu URL-nya biasanya:

`https://PROJECT_REF.supabase.co/functions/v1/wa-otp`

### 3. Isi supabase-config.js

```js
const WA_OTP_FUNCTION_URL = "https://PROJECT_REF.supabase.co/functions/v1/wa-otp";
```

### 4. Alur pendaftaran

1. Warga mengisi nama, email, password, dan nomor WhatsApp.
2. WARMA mengirim OTP ke WhatsApp.
3. Warga memasukkan OTP.
4. Setelah OTP `approved`, WARMA membuat akun Supabase Auth.
5. Trigger database membuat profil warga dan menyimpan nomor WhatsApp.

Jangan taruh `TWILIO_AUTH_TOKEN` atau `SUPABASE_SERVICE_ROLE_KEY` di `supabase-config.js`, HTML, JavaScript browser, atau GitHub.


## Alur akun WARMA

- Pendaftaran: nama + email aktif + WhatsApp aktif.
- WhatsApp diverifikasi dengan OTP sebelum akun dibuat.
- Email dikonfirmasi melalui Supabase Auth jika Email Confirmation diaktifkan.
- Login menggunakan email + password.
- Lupa password tersedia melalui email.
- Reset melalui WhatsApp menggunakan Edge Function/provider WhatsApp; password tidak pernah dikirim melalui WhatsApp.

## Logo

Logo RT 05/RW 021 dipertahankan di `assets/logo-rt05.png` dan ditampilkan pada halaman login serta header aplikasi. Jangan menghapus atau memindahkan file tersebut.

## Supabase Auth

Di Supabase Dashboard → Authentication → Providers → Email, aktifkan Email provider dan Email Confirmations sesuai kebutuhan. Atur Site URL/Redirect URL ke alamat deployment WARMA agar link konfirmasi dan reset kembali ke aplikasi.

## Checklist sebelum dipakai warga
- [ ] Email Confirmation Supabase aktif.
- [ ] Site URL dan Redirect URL sudah benar.
- [ ] `SUPABASE_URL` dan anon/publishable key sudah diisi.
- [ ] `WA_OTP_FUNCTION_URL` sudah mengarah ke Edge Function OTP.
- [ ] Secret Twilio hanya dipasang di Supabase Edge Functions.
- [ ] `WA_RECOVERY_FUNCTION_URL` sudah diisi jika reset WhatsApp ingin digunakan.
- [ ] Akun pengurus sudah diubah menjadi `admin` melalui SQL.
- [ ] Uji daftar: email baru + nomor WhatsApp baru + OTP benar.
- [ ] Uji OTP salah/kedaluwarsa.
- [ ] Uji konfirmasi email.
- [ ] Uji login dari HP lain.
- [ ] Uji reset password email dan WhatsApp.

### Catatan keamanan
Jangan mengaktifkan akses database tanpa RLS. Jangan menaruh service-role key, Auth Token Twilio, Account SID rahasia, atau kredensial provider di browser/GitHub. Data kontak warga dibatasi oleh RLS: warga biasa hanya dapat melihat profil/data warganya sendiri, sedangkan pengurus/admin dapat mengelola data operasional sesuai kebijakan.
