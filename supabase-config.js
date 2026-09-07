/*
 * WARMA - KONFIGURASI SUPABASE
 *
 * Isi dua nilai di bawah dengan Project URL dan anon/publishable key dari
 * Supabase -> Project Settings -> API.
 * JANGAN pernah menaruh service_role key di file ini atau GitHub.
 */
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

// Isi setelah Edge Function WhatsApp dipasang. Contoh:
// https://PROJECT.supabase.co/functions/v1/send-wa-reset
const WA_RECOVERY_FUNCTION_URL = "";

// URL Edge Function OTP WhatsApp saat pendaftaran.
const WA_OTP_FUNCTION_URL = "";

window.WARMA_SUPABASE = { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, waRecoveryFunctionUrl: WA_RECOVERY_FUNCTION_URL, waOtpFunctionUrl: WA_OTP_FUNCTION_URL };
