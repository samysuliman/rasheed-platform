const SUPABASE_URL = "https://crnlfpuipepolflqcwuo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bW_x_9cHxqhuxkYdZ-g4kQ_3UAukGRV";

function getRegistrationSelections() {
  if (Array.isArray(window.rasheedStudySelections)) return window.rasheedStudySelections;
  try { const rows = JSON.parse(sessionStorage.getItem("rasheedStudySelections") || "[]"); return Array.isArray(rows) ? rows : []; } catch { return []; }
}
function getLegacyTrackFallback(selections) {
  const quran = selections.find(x => x?.key === "quran");
  if (quran?.tracks?.length) return quran.tracks[0];
  const first = selections[0];
  return first?.title || first?.key || null;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("academyRegistration");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const successBox = document.getElementById("registrationSuccess");
      const errorBox = document.getElementById("registrationError");
      const submit = document.getElementById("registrationSubmit");
      successBox?.classList.add("hide"); errorBox?.classList.add("hide");
      if (!form.reportValidity()) return;
      const selections = getRegistrationSelections();
      if (!selections.length) { alert("اختر البرنامج والمواد أو المسارات أولًا، ثم عد إلى صفحة التسجيل."); return; }
      const honeypot = form.querySelector('input[name="_honey"]'); if (honeypot?.value) return;
      const oldLabel = submit?.textContent || "إرسال طلب التسجيل";
      if (submit) { submit.textContent = "جارٍ إرسال الطلب..."; submit.disabled = true; submit.classList.add("submit-loading"); }
      const payload = {
        full_name: form.querySelector("#fullName")?.value.trim() || "",
        age: Number(form.querySelector("#age")?.value || 0) || null,
        country_city: form.querySelector("#country")?.value.trim() || "",
        whatsapp: form.querySelector("#whatsapp")?.value.trim() || "",
        preferred_time: form.querySelector("#time")?.value || "",
        registration_for: form.querySelector("#studentType")?.value || "",
        notes: form.querySelector("#notes")?.value.trim() || "",
        study_selections: selections, status: "new",
        track: getLegacyTrackFallback(selections), level: null
      };
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/registrations`, {method:"POST",headers:{"apikey":SUPABASE_PUBLISHABLE_KEY,"Authorization":`Bearer ${SUPABASE_PUBLISHABLE_KEY}`,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(payload)});
        if (!response.ok) { const detail = await response.text().catch(() => ""); throw new Error(`Supabase ${response.status}: ${detail}`); }
        sessionStorage.removeItem("rasheedStudySelections");
        form.querySelectorAll("input,select,textarea,button").forEach(el => { el.disabled = true; });
        successBox?.classList.remove("hide"); submit?.classList.add("hide"); successBox?.scrollIntoView({behavior:"smooth",block:"center"});
      } catch (error) { console.error("Academy registration error:", error); if (errorBox) { errorBox.textContent = "تعذر إرسال الطلب الآن. تحقق من الاتصال أو إعداد قاعدة البيانات ثم حاول مرة أخرى."; errorBox.classList.remove("hide"); } }
      finally { if (submit && !submit.classList.contains("hide")) { submit.textContent = oldLabel; submit.disabled = false; submit.classList.remove("submit-loading"); } }
    });
  }
  document.querySelectorAll("[data-demo-alert]").forEach(el => { el.addEventListener("click", e => { e.preventDefault(); alert("هذه الخاصية قيد التجهيز."); }); });
});
