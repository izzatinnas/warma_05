import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const normalizePhone = (value: string) => {
  let v = String(value || "").trim().replace(/[^0-9+]/g, "");
  if (v.startsWith("+62")) v = "0" + v.slice(3);
  else if (v.startsWith("62")) v = "0" + v.slice(2);
  return v;
};

const toWhatsAppE164 = (phone: string) => `whatsapp:+62${phone.replace(/^0/, "")}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const generic = { ok: true, message: "Jika nomor WhatsApp terdaftar, instruksi reset sudah dikirim." };
  try {
    const { phone } = await req.json();
    const normalized = normalizePhone(phone);
    if (!/^08[1-9][0-9]{7,11}$/.test(normalized)) {
      return new Response(JSON.stringify(generic), { status: 200, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit sederhana: maksimal 1 permintaan / nomor / 10 menit.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("recovery_requests")
      .select("id")
      .eq("phone_normalized", normalized)
      .gte("requested_at", tenMinutesAgo)
      .limit(1);
    if (recent?.length) return new Response(JSON.stringify(generic), { status: 200, headers: cors });

    const { data: person } = await supabase
      .from("profiles")
      .select("email,nama,hp_normalized")
      .eq("hp_normalized", normalized)
      .maybeSingle();

    await supabase.from("recovery_requests").insert({ phone_normalized: normalized });

    // Jangan membocorkan apakah nomor terdaftar.
    if (!person?.email) return new Response(JSON.stringify(generic), { status: 200, headers: cors });

    const redirectTo = Deno.env.get("WARMA_SITE_URL") || Deno.env.get("SUPABASE_URL")!;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: person.email,
      options: { redirectTo }
    });
    if (linkError || !linkData?.properties?.action_link) throw linkError || new Error("Recovery link gagal dibuat");

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
    if (!sid || !token || !from) throw new Error("Provider WhatsApp belum dikonfigurasi");

    const body = new URLSearchParams({
      From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
      To: toWhatsAppE164(normalized),
      Body: `WARMA RT 05/021\nHalo ${person.nama || "Warga"}, ini link reset password Anda:\n${linkData.properties.action_link}\nLink bersifat pribadi. Jangan bagikan kepada orang lain.`
    });

    const auth = btoa(`${sid}:${token}`);
    const twilio = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!twilio.ok) throw new Error(`WhatsApp provider error: ${await twilio.text()}`);

    return new Response(JSON.stringify(generic), { status: 200, headers: cors });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: true, message: "Jika nomor WhatsApp terdaftar, instruksi reset sudah dikirim." }), { status: 200, headers: cors });
  }
});
