import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function normalizePhone(value: string) {
  let v = String(value || '').trim().replace(/[^0-9+]/g, '')
  if (v.startsWith('+62')) return '0' + v.slice(3)
  if (v.startsWith('62')) return '0' + v.slice(2)
  return v
}
function toE164(v: string) { return '+62' + v.slice(1) }
function validPhone(v: string) { return /^08[1-9][0-9]{7,11}$/.test(v) }

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
const verifySid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')!
const admin = createClient(supabaseUrl, serviceRole)

async function twilio(path: string, params: Record<string,string>) {
  const body = new URLSearchParams(params)
  const auth = btoa(`${twilioSid}:${twilioToken}`)
  const r = await fetch(`https://verify.twilio.com/v2/Services/${verifySid}${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.message || 'Provider OTP gagal memproses permintaan.')
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method tidak diizinkan.' }, 405)
  try {
    const { action, phone, code } = await req.json()
    const normalized = normalizePhone(phone)
    if (!validPhone(normalized)) return json({ error: 'Nomor WhatsApp Indonesia tidak valid.' }, 400)

    // Jangan membocorkan apakah nomor sudah terdaftar.
    const { data: existing } = await admin.from('profiles').select('id').eq('hp_normalized', normalized).maybeSingle()
    if (action === 'send') {
      if (existing) return json({ ok: true, message: 'Jika nomor dapat digunakan, OTP telah dikirim.' })
      await twilio('/Verifications', { To: toE164(normalized), Channel: 'whatsapp' })
      return json({ ok: true, message: 'Jika nomor dapat digunakan, OTP telah dikirim.' })
    }

    if (action === 'verify') {
      if (existing) return json({ error: 'Nomor WhatsApp sudah terdaftar. Gunakan pemulihan password.' }, 409)
      if (!/^\d{4,10}$/.test(String(code || ''))) return json({ error: 'Kode OTP tidak valid.' }, 400)
      const result = await twilio('/VerificationCheck', { To: toE164(normalized), Code: String(code) })
      if (result.status !== 'approved') return json({ error: 'Kode OTP salah atau sudah kedaluwarsa.' }, 400)
      return json({ ok: true, verified: true, phone: normalized })
    }
    return json({ error: 'Action tidak dikenal.' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : 'Terjadi kesalahan server.' }, 500)
  }
})
