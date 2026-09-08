/* WARMA RT 05/021 - Supabase Edition
 * Semua data aplikasi dibaca/ditulis ke Supabase. LocalStorage hanya dipakai
 * untuk cache ringan seperti halaman terakhir, bukan sebagai database.
 */
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("id-ID", {style:"currency", currency:"IDR", maximumFractionDigits:0}).format(Number(n)||0);
const today = () => new Date().toISOString().slice(0,10);
const normalizePhone = value => {
  let v = String(value || "").trim().replace(/[^0-9+]/g, "");
  if (v.startsWith("+62")) v = "0" + v.slice(3);
  else if (v.startsWith("62")) v = "0" + v.slice(2);
  return v;
};
const isValidWhatsApp = value => /^08[1-9][0-9]{7,11}$/.test(normalizePhone(value));
const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const db = window.WARMA_SUPABASE;
const sb = (db?.url && db?.key && window.supabase) ? window.supabase.createClient(db.url, db.key) : null;
let profile = null;
let data = {warga:[], iuran:[], arisan:[], trx:[], ann:[], letters:[], kegiatan:[], profiles:[], nominal:10000};
function escapeHtml(v="") {
  return String(v).replace(/[&<>'"]/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "'":"&#39;",
    '"':"&quot;"
  }[c]));
}

function msg(text, type="ok") {
  const el=$("appMessage");
  if(!el) return;
  el.textContent=text;
  el.className=`panel app-message ${type}`;
  el.classList.remove("hidden");
  clearTimeout(msg.timer);
  msg.timer=setTimeout(()=>el.classList.add("hidden"),5000);
}

function errorMessage(err) {
  console.error(err);
  return err?.message || "Terjadi kesalahan.";
}

function requireAdmin(){
  if(profile?.role!=="admin"){
    alert("Menu ini hanya untuk Admin/Pengurus RT.");
    return false;
  }
  return true;
}

function isAdmin(){
  return profile?.role === "admin";
}

/* =========================================================
   LOGIN / DAFTAR
   =========================================================
   Tab LOGIN/DAFTAR sengaja dipasang SEBELUM pengecekan
   koneksi Supabase. Jadi tombol Daftar tetap bisa diklik
   walaupun konfigurasi Supabase belum benar.
*/
function bindAuth(){

  document.querySelectorAll(".tab").forEach(b=>{
    b.type = "button";

    b.onclick=(e)=>{
      e.preventDefault();

      document.querySelectorAll(".tab").forEach(x=>{
        x.classList.remove("active");
      });

      b.classList.add("active");

      const isLogin = b.dataset.auth === "login";

      $("loginForm")?.classList.toggle("hidden", !isLogin);
      $("registerForm")?.classList.toggle("hidden", isLogin);
      $("updatePasswordForm")?.classList.add("hidden");
    };
  });

  const loginForm=$("loginForm");

  if(loginForm) loginForm.onsubmit=async e=>{
    e.preventDefault();

    if(!sb){
      return alert("WARMA belum terhubung ke Supabase. Periksa supabase-config.js.");
    }

    const email=$("loginEmail").value.trim().toLowerCase();
    const password=$("loginPassword").value;

    if(!email || !password){
      return alert("Email dan password wajib diisi.");
    }

    try{
      const {error}=await sb.auth.signInWithPassword({
        email,
        password
      });

      if(error){
        return alert(errorMessage(error));
      }

    }catch(err){
      alert(errorMessage(err));
    }
  };

  const registerForm=$("registerForm");

  if(registerForm) registerForm.onsubmit=async e=>{
    e.preventDefault();

    if(!sb){
      return alert("WARMA belum terhubung ke Supabase. Periksa SUPABASE_URL di supabase-config.js.");
    }

    const nama=$("regNama")?.value.trim() || "";
    const email=$("regEmail")?.value.trim().toLowerCase() || "";
    const password=$("regPassword")?.value || "";
    const hp=normalizePhone($("regHp")?.value || "");

    if(!nama || !email){
      return alert("Nama dan email wajib diisi.");
    }

    if(password.length<8){
      return alert("Password minimal 8 karakter.");
    }

    if(!isValidWhatsApp(hp)){
      return alert("Masukkan nomor WhatsApp Indonesia yang valid, contoh 081234567890.");
    }

    try{

      const {data:res,error}=await sb.auth.signUp({
        email,
        password,
        options:{
          data:{
            nama,
            hp
          },
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });

      if(error){
        return alert(errorMessage(error));
      }

      registerForm.reset();

      if(res?.session){

        alert(
          "Pendaftaran berhasil. Namun akun tetap mengikuti proses persetujuan pengurus RT."
        );

      }else{

        alert(
          "Pendaftaran berhasil. Silakan cek email untuk verifikasi akun. Setelah email diverifikasi, akun menunggu persetujuan pengurus RT."
        );

      }

      document.querySelectorAll(".tab").forEach(x=>{
        x.classList.remove("active");
      });

      const loginTab=document.querySelector('.tab[data-auth="login"]');

      if(loginTab){
        loginTab.classList.add("active");
      }

      $("loginForm")?.classList.remove("hidden");
      $("registerForm")?.classList.add("hidden");

    }catch(err){
      alert(errorMessage(err));
    }
  };

  const forgotPasswordBtn=$("forgotPasswordBtn");

  if(forgotPasswordBtn) forgotPasswordBtn.onclick=async()=>{

    if(!sb){
      return alert("WARMA belum terhubung ke Supabase. Periksa supabase-config.js.");
    }

    const email=$("loginEmail")?.value.trim().toLowerCase() || "";

    if(!email){
      return alert("Masukkan email aktif yang terdaftar.");
    }

    const redirectTo=
      window.location.origin +
      window.location.pathname;

    try{

      const {error}=await sb.auth.resetPasswordForEmail(
        email,
        {
          redirectTo
        }
      );

      if(error){
        return alert(errorMessage(error));
      }

      alert(
        "Jika email terdaftar, link reset password sudah dikirim. Periksa Inbox dan Spam."
      );

    }catch(err){
      alert(errorMessage(err));
    }
  };

  const updatePasswordForm=$("updatePasswordForm");

  if(updatePasswordForm) updatePasswordForm.onsubmit=async e=>{
    e.preventDefault();

    if(!sb){
      return alert("WARMA belum terhubung ke Supabase.");
    }

    const a=$("newPassword")?.value || "";
    const b=$("newPassword2")?.value || "";

    if(a.length<8){
      return alert("Password minimal 8 karakter.");
    }

    if(a!==b){
      return alert("Konfirmasi password tidak sama.");
    }

    const {error}=await sb.auth.updateUser({
      password:a
    });

    if(error){
      return alert(errorMessage(error));
    }

    alert("Password berhasil diubah. Silakan masuk kembali.");

    await sb.auth.signOut();
  };

  const logoutBtn=$("logoutBtn");

  if(logoutBtn){
    logoutBtn.onclick=()=>sb?.auth.signOut();
  }
}


/* Jalankan bindAuth SELALU */
bindAuth();


/* Jika Supabase belum siap, halaman login tetap ditampilkan */
if(!sb){

  $("loginPage")?.classList.remove("hidden");
  $("appPage")?.classList.add("hidden");

  const note=document.querySelector(".demo-note");

  if(note){
    note.innerHTML=
      "<b>Supabase belum terhubung.</b> Periksa URL Project dan key di <code>supabase-config.js</code>.";
  }

}else{

  boot();

}


/* =========================================================
   BOOT
   =========================================================
*/
async function boot(){

  bindNavigation();
  bindForms();
  setupIuran();

  sb.auth.onAuthStateChange(async (event, session)=>{

    if(event === "PASSWORD_RECOVERY"){
      showPasswordRecovery();
    }

    if(session?.user && event !== "PASSWORD_RECOVERY"){
      await start(session.user);
    }

    if(!session && event === "SIGNED_OUT"){
      showLogin();
    }

  });

  const {
    data:{
      session
    }
  } = await sb.auth.getSession();

  if(session){
    await start(session.user);
  }else{
    showLogin();
  }
}


/* =========================================================
   LOGIN PAGE
   =========================================================
*/
function showLogin(){

  profile=null;

  data={
    warga:[],
    iuran:[],
    arisan:[],
    trx:[],
    ann:[],
    letters:[],
    kegiatan:[],
    nominal:10000
  };

  $("loginPage")?.classList.remove("hidden");
  $("appPage")?.classList.add("hidden");
}


/* =========================================================
   PASSWORD RECOVERY
   =========================================================
*/
function showPasswordRecovery(){

  $("loginPage")?.classList.remove("hidden");
  $("appPage")?.classList.add("hidden");

  $("loginForm")?.classList.add("hidden");
  $("registerForm")?.classList.add("hidden");
  $("updatePasswordForm")?.classList.remove("hidden");
}


/* =========================================================
   NAVIGATION
   =========================================================
*/
function bindNavigation(){

  document.querySelectorAll(".nav-btn").forEach(b=>{

    b.onclick=()=>{

      if(
        b.classList.contains("admin-only") &&
        !isAdmin()
      ){
        return;
      }

      document.querySelectorAll(".nav-btn").forEach(x=>{
        x.classList.remove("active");
      });

      b.classList.add("active");

      document.querySelectorAll(".page").forEach(p=>{
        p.classList.add("hidden");
      });

      const target=$("page-"+b.dataset.page);

      if(target){
        target.classList.remove("hidden");
      }

      render();
    };

  });
}


/* =========================================================
   FORM
   =========================================================
*/
function bindForms(){

  $("toggleWargaForm").onclick=()=>{
    if(requireAdmin()){
      $("wargaForm").classList.toggle("hidden");
    }
  };

  $("wargaForm").onsubmit=async e=>{

    e.preventDefault();

    if(!requireAdmin()){
      return;
    }

    const hp=normalizePhone(
      $("wargaHp").value
    );

    if(
      hp &&
      !isValidWhatsApp(hp)
    ){
      return alert("Nomor HP/WhatsApp tidak valid.");
    }

    const row={
      nama:$("wargaNama").value.trim(),
      hp,
      alamat:$("wargaAlamat").value.trim(),
      status:$("wargaStatus").value
    };

    const {error}=await sb
      .from("warga")
      .insert(row);

    if(error){
      return alert(errorMessage(error));
    }

    e.target.reset();

    $("wargaForm").classList.add("hidden");

    await refresh();
  };


  $("searchWarga").oninput=renderWarga;


  $("saveIuranNominal").onclick=async()=>{

    if(!requireAdmin()){
      return;
    }

    const value=
      Number($("iuranNominal").value) || 0;

    const {error}=await sb
      .from("settings")
      .upsert({
        key:"iuran_nominal",
        value:String(value),
        updated_by:profile.id
      });

    if(error){
      return alert(errorMessage(error));
    }

    data.nominal=value;

    renderIuran();

    msg("Nominal iuran disimpan.");
  };


  $("iuranBulan").onchange=renderIuran;
  $("iuranTahun").onchange=renderIuran;


  $("toggleArisanForm").onclick=()=>{

    if(requireAdmin()){

      $("arisanForm").classList.toggle("hidden");

      renderArisanSelect();

    }

  };


  $("searchArisan").oninput=renderArisan;


  $("arisanForm").onsubmit=async e=>{

    e.preventDefault();

    if(!requireAdmin()){
      return;
    }

    const wargaId=
      $("arisanWarga").value || null;

    const warga=
      data.warga.find(
        x=>String(x.id)===String(wargaId)
      );

    const nama=
      warga?.nama ||
      $("arisanNamaManual").value.trim();

    if(!nama){
      return alert(
        "Pilih warga atau tulis nama peserta arisan."
      );
    }

    if(
      data.arisan.some(
        x=>x.nama.toLowerCase()===nama.toLowerCase()
      )
    ){
      return alert(
        "Peserta tersebut sudah ada di data arisan."
      );
    }

    const {
      error
    }=await sb
      .from("arisan")
      .insert({
        warga_id:warga?.id || null,
        nama,
        nominal:Number($("arisanNominal").value)||0
      });

    if(error){
      return alert(errorMessage(error));
    }

    e.target.reset();

    $("arisanForm").classList.add("hidden");

    await refresh();
  };


  $("trxTanggal").value=today();


  $("trxForm").onsubmit=async e=>{

    e.preventDefault();

    if(!requireAdmin()){
      return;
    }

    const row={
      jenis:$("trxJenis").value,
      tanggal:$("trxTanggal").value,
      kategori:$("trxKategori").value.trim(),
      nominal:Number($("trxNominal").value)||0,
      ket:$("trxKet").value.trim(),
      created_by:profile.id
    };

    if(!row.kategori){
      return alert("Kategori transaksi wajib diisi.");
    }

    if(row.nominal<=0){
      return alert("Nominal harus lebih dari 0.");
    }

    const {error}=await sb
      .from("transaksi")
      .insert(row);

    if(error){
      return alert(errorMessage(error));
    }

    e.target.reset();

    $("trxTanggal").value=today();

    await refresh();
  };


  $("annForm").onsubmit=async e=>{

    e.preventDefault();

    if(!requireAdmin()){
      return;
    }

    const row={
      title:$("annTitle").value.trim(),
      text:$("annText").value.trim(),
      created_by:profile.id
    };

    if(!row.title || !row.text){
      return alert("Judul dan isi pengumuman wajib diisi.");
    }

    const {error}=await sb
      .from("pengumuman")
      .insert(row);

    if(error){
      return alert(errorMessage(error));
    }

    e.target.reset();

    await refresh();
  };


  $("letterForm").onsubmit=async e=>{

    e.preventDefault();

    const row={
      user_id:profile.id,
      nama:profile.nama,
      type:$("letterType").value,
      note:$("letterNote").value.trim(),
      status:"Diajukan"
    };

    const {error}=await sb
      .from("surat")
      .insert(row);

    if(error){
      return alert(errorMessage(error));
    }

    e.target.reset();

    await refresh();
  };


  $("kegiatanForm").onsubmit=async e=>{

    e.preventDefault();

    if(!requireAdmin()){
      return;
    }

    const row={
      title:$("kegiatanTitle").value.trim(),
      tanggal:$("kegiatanTanggal").value,
      deskripsi:$("kegiatanDeskripsi").value.trim(),
      created_by:profile.id
    };

    const {error}=await sb
      .from("kegiatan")
      .insert(row);

    if(error){
      return alert(errorMessage(error));
    }

    e.target.reset();

    $("kegiatanTanggal").value=today();

    await refresh();
  };


  $("printBtn").onclick=()=>{
    window.print();
  };
}


/* =========================================================
   IURAN
   =========================================================
*/
function setupIuran(){

  $("iuranBulan").innerHTML=
    months.map(
      (m,i)=>
        `<option value="${i+1}">${m}</option>`
    ).join("");

  const y=new Date().getFullYear();

  $("iuranTahun").innerHTML=
    [y-1,y,y+1]
      .map(
        v=>
          `<option value="${v}" ${v===y?"selected":""}>${v}</option>`
      )
      .join("");

  $("iuranBulan").value=
    new Date().getMonth()+1;
}


function iuranPeriod(){

  return `${$("iuranTahun").value}-${String($("iuranBulan").value).padStart(2,"0")}`;

}


/* =========================================================
   START USER
   =========================================================
*/
async function start(user){

  /* Email WAJIB sudah diverifikasi */
  if(!user.email_confirmed_at){

    await sb.auth.signOut();

    return alert(
      "Email belum terverifikasi. Silakan buka link verifikasi yang dikirim ke email Anda."
    );
  }


  const {
    data:p,
    error
  }=await sb
    .from("profiles")
    .select(
      "id,nama,email,hp,role,status_akun"
    )
    .eq("id",user.id)
    .single();


  if(error){

    console.error(error);

    await sb.auth.signOut();

    return alert(
      "Data profil belum siap. Silakan hubungi pengurus RT."
    );
  }


  /* AKUN MENUNGGU PERSETUJUAN */
  if(p.status_akun === "menunggu"){

    await sb.auth.signOut();

    return alert(
      "Email sudah terverifikasi. Pendaftaran Anda sekarang menunggu persetujuan pengurus RT."
    );
  }


  /* AKUN DITOLAK */
  if(p.status_akun === "ditolak"){

    await sb.auth.signOut();

    return alert(
      "Pendaftaran Anda belum disetujui oleh pengurus RT. Silakan hubungi pengurus untuk informasi lebih lanjut."
    );
  }


  profile=p;


  $("loginPage")?.classList.add("hidden");
  $("appPage")?.classList.remove("hidden");


  if($("userBadge")){

    $("userBadge").textContent=
      `👤 ${p.nama} (${p.role})`;

  }


  document.querySelectorAll(".admin-only").forEach(x=>{

    x.classList.toggle(
      "hidden",
      !isAdmin()
    );

  });


  await refresh();

  subscribeRealtime();
}


/* =========================================================
   FETCH DATA
   =========================================================
*/
async function fetchTable(
  table,
  order="created_at",
  ascending=false
){

  let q=
    sb
      .from(table)
      .select("*");

  if(order){
    q=q.order(
      order,
      {
        ascending
      }
    );
  }

  const {
    data:d,
    error
  }=await q;

  if(error){
    throw error;
  }

  return d || [];
}


/* =========================================================
   REFRESH
   =========================================================
*/
async function refresh(){

  try{

    const [
      warga,
      iuran,
      arisan,
      trx,
      ann,
      letters,
      kegiatan,
      settings
    ]=await Promise.all([

      fetchTable(
        "warga",
        "nama",
        true
      ),

      fetchTable(
        "iuran",
        "period",
        false
      ),

      fetchTable(
        "arisan",
        "created_at",
        false
      ),

      fetchTable(
        "transaksi",
        "tanggal",
        false
      ),

      fetchTable(
        "pengumuman",
        "created_at",
        false
      ),

      fetchTable(
        "surat",
        "created_at",
        false
      ),

   fetchTable(
  "kegiatan",
  "tanggal",
  false
),

sb
  .from("profiles")
  .select("id,nama,email,hp,role,status_akun,created_at")
  .order("created_at", { ascending: false }),

sb
  .from("settings")
  .select("key,value")

    ]);


    if(settings.error){
      throw settings.error;
    }


    data={

      warga,

      iuran,

      arisan,

      trx,

      ann,

      letters:
        isAdmin()
          ? letters
          : letters.filter(
              x=>x.user_id===profile.id
            ),

      kegiatan,

      nominal:
        Number(
          (settings.data||[])
            .find(
              x=>x.key==="iuran_nominal"
            )?.value
          || 10000
        )

    };


    render();

  }catch(e){

    msg(
      errorMessage(e),
      "error"
    );

  }
}


/* =========================================================
   REALTIME
   =========================================================
*/
let realtimeStarted=false;

function subscribeRealtime(){

  if(realtimeStarted){
    return;
  }

  realtimeStarted=true;


  [
    "warga",
    "iuran",
    "arisan",
    "transaksi",
    "pengumuman",
    "surat",
    "kegiatan",
    "settings"
  ].forEach(table=>{

    sb
      .channel("warma-"+table)
      .on(
        "postgres_changes",
        {
          event:"*",
          schema:"public",
          table
        },
        ()=>refresh()
      )
      .subscribe();

  });
}


/* =========================================================
   RENDER UTAMA
   =========================================================
*/
function renderApproval(){
  if(!isAdmin()) return;

  const rows = $("approvalRows");
  if(!rows) return;

  const search = String($("approvalSearch")?.value || "").toLowerCase().trim();

  const profiles = Array.isArray(data.profiles) ? data.profiles : [];

  const waiting = profiles.filter(x => x.status_akun === "menunggu");
  const approved = profiles.filter(x => x.status_akun === "disetujui");
  const rejected = profiles.filter(x => x.status_akun === "ditolak");

  if($("approvalWaiting")) $("approvalWaiting").textContent = waiting.length;
  if($("approvalApproved")) $("approvalApproved").textContent = approved.length;
  if($("approvalRejected")) $("approvalRejected").textContent = rejected.length;

  const filtered = waiting.filter(x => {
    const text = [
      x.nama || "",
      x.email || "",
      x.hp || ""
    ].join(" ").toLowerCase();

    return !search || text.includes(search);
  });

  rows.innerHTML = filtered.length
    ? filtered.map((x,i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(x.nama || "-")}</strong></td>
        <td>${esc(x.email || "-")}</td>
        <td>${esc(x.hp || "-")}</td>
        <td><span class="badge warning">Menunggu</span></td>
        <td>
          <button
            class="btn"
            type="button"
            onclick="approveWarga('${x.id}')">
            ✅ Setujui
          </button>

          <button
            class="btn danger"
            type="button"
            onclick="rejectWarga('${x.id}')">
            ❌ Tolak
          </button>
        </td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="6" class="muted" style="text-align:center;padding:30px">
          Tidak ada warga yang menunggu persetujuan.
        </td>
      </tr>
    `;
}




function render(){

  const masuk=
    data.trx
      .filter(
        x=>x.jenis==="pemasukan"
      )
      .reduce(
        (s,x)=>s+Number(x.nominal||0),
        0
      );


  const keluar=
    data.trx
      .filter(
        x=>x.jenis==="pengeluaran"
      )
      .reduce(
        (s,x)=>s+Number(x.nominal||0),
        0
      );


  const period=iuranPeriod();


  const iuran=
    data.iuran
      .filter(
        x=>x.period===period
      )
      .reduce(
        (s,x)=>s+Number(x.nominal||0),
        0
      );


  $("dashWarga").textContent=
    data.warga.length;

  $("dashIuran").textContent=
    money(iuran);

  $("dashMasuk").textContent=
    money(masuk);

  $("dashSaldo").textContent=
    money(masuk-keluar);


  $("repMasuk").textContent=
    money(masuk);

  $("repKeluar").textContent=
    money(keluar);

  $("repSaldo").textContent=
    money(masuk-keluar);

  $("repWarga").textContent=
    data.warga.length;


  $("dashboardSummary").innerHTML=
    `<p>Total warga terdaftar: <b>${data.warga.length}</b></p>
     <p>Iuran bulan berjalan: <b>${money(iuran)}</b></p>
     <p>Saldo kas: <b>${money(masuk-keluar)}</b></p>`;


  renderWarga();
  renderIuran();
  renderArisan();
  renderTrx();
  renderAnn();
  renderLetters();
  renderKegiatan();
}


/* =========================================================
   WARGA
   =========================================================
*/
function renderWarga(){

  const q=
    $("searchWarga").value.toLowerCase();

  const arr=
    data.warga.filter(
      x=>
        (x.nama||"")
          .toLowerCase()
          .includes(q)
    );


  $("wargaRows").innerHTML=
    arr.map(
      (x,i)=>
        `<tr>
          <td>${i+1}</td>
          <td>${escapeHtml(x.nama)}</td>
          <td>${escapeHtml(x.hp||"-")}</td>
          <td>${escapeHtml(x.alamat||"-")}</td>
          <td>${escapeHtml(x.status)}</td>
          <td>
            ${
              isAdmin()
                ? `<button class="small-btn danger" onclick="delWarga('${x.id}')">Hapus</button>`
                : "-"
            }
          </td>
        </tr>`
    ).join("")
    ||
    `<tr>
      <td colspan="6">Tidak ada data.</td>
    </tr>`;
}


window.delWarga=async id=>{

  if(
    !requireAdmin() ||
    !confirm("Hapus data warga?")
  ){
    return;
  }

  const {
    error
  }=await sb
    .from("warga")
    .delete()
    .eq("id",id);

  if(error){

    alert(
      errorMessage(error)
    );

  }else{

    await refresh();

  }
};


/* =========================================================
   IURAN
   =========================================================
*/
function renderIuran(){

  $("iuranNominal").value=
    data.nominal;

  const period=iuranPeriod();


  $("iuranRows").innerHTML=
    data.warga.map(
      (x,i)=>{

        const p=
          data.iuran.find(
            z=>
              z.warga_id===x.id &&
              z.period===period
          );


        return `
          <tr>
            <td>${i+1}</td>

            <td>
              ${escapeHtml(x.nama)}
            </td>

            <td>
              ${
                p
                  ? "<b>✅ Lunas</b>"
                  : "⏳ Belum Bayar"
              }
            </td>

            <td>
              ${money(
                p?.nominal ??
                data.nominal
              )}
            </td>

            <td>
              ${
                isAdmin()
                  ?
                    `<button class="small-btn ${p?"danger":"ok"}"
                      onclick="toggleIuran('${x.id}')">
                      ${p?"Batalkan":"Tandai Lunas"}
                    </button>`
                  :
                    "-"
              }
            </td>
          </tr>
        `;

      }
    ).join("");
}


window.toggleIuran=async id=>{

  if(!requireAdmin()){
    return;
  }

  const period=iuranPeriod();


  const p=
    data.iuran.find(
      x=>
        x.warga_id===id &&
        x.period===period
    );


  let res;


  if(p){

    res=
      await sb
        .from("iuran")
        .delete()
        .eq("id",p.id);

  }else{

    res=
      await sb
        .from("iuran")
        .insert({
          warga_id:id,
          period,
          nominal:data.nominal,
          tanggal:today(),
          created_by:profile.id
        });

  }


  if(res.error){

    alert(
      errorMessage(res.error)
    );

  }else{

    await refresh();

  }
};


/* =========================================================
   ARISAN
   =========================================================
*/
function renderArisanSelect(){

  $("arisanWarga").innerHTML=
    '<option value="">Pilih warga dari Data Warga</option>' +
    data.warga
      .map(
        x=>
          `<option value="${x.id}">
            ${escapeHtml(x.nama)}
          </option>`
      )
      .join("");
}


function renderArisan(){

  renderArisanSelect();


  const q=
    $("searchArisan").value.toLowerCase();


  const arr=
    data.arisan.filter(
      x=>
        (x.nama||"")
          .toLowerCase()
          .includes(q)
    );


  const sudah=
    data.arisan.filter(
      x=>x.sudah_dapat
    );


  const belum=
    data.arisan.filter(
      x=>!x.sudah_dapat
    );


  $("arisanTotalPeserta").textContent=
    data.arisan.length;

  $("arisanSudahDapat").textContent=
    sudah.length;

  $("arisanBelumDapat").textContent=
    belum.length;

  $("arisanNominalInfo").textContent=
    money(
      data.arisan.reduce(
        (s,x)=>s+Number(x.nominal||0),
        0
      )
    );


  $("arisanRows").innerHTML=
    arr.map(
      (x,i)=>
        `<tr>

          <td>${i+1}</td>

          <td>
            <b>${escapeHtml(x.nama)}</b>
          </td>

          <td>
            ${money(x.nominal)}
          </td>

          <td>
            ${
              x.sudah_dapat
                ? "<b>🏆 Sudah Mendapat</b>"
                : "⏳ Belum Mendapat"
            }
          </td>

          <td>
            ${escapeHtml(
              x.tanggal_dapat || "-"
            )}
          </td>

          <td>
            ${
              isAdmin()
                ?
                  `<button
                    class="small-btn ${x.sudah_dapat?"danger":"ok"}"
                    onclick="toggleArisanDapat('${x.id}')">
                    ${x.sudah_dapat?"Batalkan":"Sudah Dapat"}
                  </button>

                  <button
                    class="small-btn danger"
                    onclick="delArisan('${x.id}')">
                    Hapus
                  </button>`
                :
                  "-"
            }
          </td>

        </tr>`
    ).join("")
    ||
    '<tr><td colspan="6">Belum ada peserta arisan.</td></tr>';


  $("arisanSudahList").innerHTML=
    sudah.map(
      (x,i)=>
        `<article class="info-card">

          <h3>
            ${i+1}. ${escapeHtml(x.nama)}
          </h3>

          <p>
            Nominal arisan:
            <b>${money(x.nominal)}</b>
          </p>

          <small>
            Sudah mendapat:
            ${escapeHtml(x.tanggal_dapat||"")}
          </small>

        </article>`
    ).join("")
    ||
    '<div class="empty">Belum ada peserta yang mendapat arisan.</div>';


  $("arisanBelumList").innerHTML=
    belum.map(
      (x,i)=>
        `<article class="info-card">

          <h3>
            ${i+1}. ${escapeHtml(x.nama)}
          </h3>

          <p>
            Nominal arisan:
            <b>${money(x.nominal)}</b>
          </p>

          <small>
            Status: Menunggu giliran
          </small>

        </article>`
    ).join("")
    ||
    '<div class="empty">Semua peserta sudah mendapat arisan.</div>';
}


window.toggleArisanDapat=async id=>{

  if(!requireAdmin()){
    return;
  }

  const p=
    data.arisan.find(
      x=>x.id===id
    );

  if(!p){
    return;
  }

  const {
    error
  }=await sb
    .from("arisan")
    .update({
      sudah_dapat:!p.sudah_dapat,
      tanggal_dapat:
        !p.sudah_dapat
          ? today()
          : null
    })
    .eq("id",id);


  if(error){

    alert(
      errorMessage(error)
    );

  }else{

    await refresh();

  }
};


window.delArisan=async id=>{

  if(
    !requireAdmin() ||
    !confirm(
      "Hapus peserta dari data arisan?"
    )
  ){
    return;
  }

  const {
    error
  }=await sb
    .from("arisan")
    .delete()
    .eq("id",id);


  if(error){

    alert(
      errorMessage(error)
    );

  }else{

    await refresh();

  }
};


/* =========================================================
   TRANSAKSI
   =========================================================
*/
function renderTrx(){

  $("trxRows").innerHTML=
    data.trx.map(
      x=>
        `<tr>

          <td>
            ${escapeHtml(x.tanggal)}
          </td>

          <td>
            ${
              x.jenis==="pemasukan"
                ? "📥 Pemasukan"
                : "📤 Pengeluaran"
            }
          </td>

          <td>
            ${escapeHtml(x.kategori)}
          </td>

          <td>
            ${money(x.nominal)}
          </td>

          <td>
            ${escapeHtml(x.ket||"-")}
          </td>

          <td>
            ${
              isAdmin()
                ?
                  `<button
                    class="small-btn danger"
                    onclick="delTrx('${x.id}')">
                    Hapus
                  </button>`
                :
                  "-"
            }
          </td>

        </tr>`
    ).join("")
    ||
    '<tr><td colspan="6">Belum ada transaksi.</td></tr>';
}


window.delTrx=async id=>{

  if(!requireAdmin()){
    return;
  }

  const {
    error
  }=await sb
    .from("transaksi")
    .delete()
    .eq("id",id);


  if(error){

    alert(
      errorMessage(error)
    );

  }else{

    await refresh();

  }
};


/* =========================================================
   PENGUMUMAN
   =========================================================
*/
function renderAnn(){

  $("announcementList").innerHTML=
    data.ann.map(
      x=>
        `<article class="info-card">

          <h3>
            ${escapeHtml(x.title)}
          </h3>

          <p>
            ${escapeHtml(x.text)
              .replace(/\n/g,"<br>")}
          </p>

          <small>
            ${escapeHtml(
              (x.created_at||"").slice(0,10)
            )}
          </small>

        </article>`
    ).join("")
    ||
    '<div class="empty">Belum ada pengumuman.</div>';


  $("dashboardAnnouncements").innerHTML=
    data.ann
      .slice(0,3)
      .map(
        x=>
          `<p>

            <b>
              ${escapeHtml(x.title)}
            </b>

            <br>

            <small>
              ${escapeHtml(
                (x.created_at||"").slice(0,10)
              )}
            </small>

          </p>`
      ).join("")
      ||
      "<p class='empty'>Belum ada pengumuman.</p>";
}


/* =========================================================
   SURAT
   =========================================================
*/
function renderLetters(){

  $("letterList").innerHTML=
    data.letters.map(
      x=>
        `<article class="info-card">

          <h3>
            ${escapeHtml(x.type)}
          </h3>

          <p>
            ${escapeHtml(x.note||"-")}
          </p>

          <small>
            ${escapeHtml(
              x.nama ||
              profile?.nama ||
              ""
            )}

            •
            ${escapeHtml(
              (x.created_at||"").slice(0,10)
            )}

            • Status:
            ${escapeHtml(x.status)}

          </small>

        </article>`
    ).join("")
    ||
    "<div class='empty'>Belum ada pengajuan.</div>";
}


/* =========================================================
   KEGIATAN
   =========================================================
*/
function renderKegiatan(){

  $("kegiatanList").innerHTML=
    data.kegiatan.map(
      x=>
        `<article class="info-card">

          <h3>
            ${escapeHtml(x.title)}
          </h3>

          <p>
            ${escapeHtml(
              x.deskripsi||"-"
            )}
          </p>

          <small>
            ${escapeHtml(
              x.tanggal||""
            )}
          </small>

        </article>`
    ).join("")
    ||
    '<div class="empty">Belum ada kegiatan.</div>';
}
