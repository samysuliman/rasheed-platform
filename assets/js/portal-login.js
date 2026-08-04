const PORTAL_SUPABASE_URL="https://crnlfpuipepolflqcwuo.supabase.co";
const PORTAL_SUPABASE_KEY="sb_publishable_bW_x_9cHxqhuxkYdZ-g4kQ_3UAukGRV";
const ADMIN_SESSION_KEY="rasheed_admin_session_v1";
const STUDENT_SESSION_KEY="rasheed_student_session_v1";
const PORTAL_SESSION_KEY="rasheed_portal_session_v1";

function saveSession(key,session){localStorage.setItem(key,JSON.stringify(session));}
function clearPortalSessions(){
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem(STUDENT_SESSION_KEY);
  localStorage.removeItem(PORTAL_SESSION_KEY);
}
async function authFetch(path,session){
  return fetch(`${PORTAL_SUPABASE_URL}${path}`,{
    headers:{
      "apikey":PORTAL_SUPABASE_KEY,
      "Authorization":`Bearer ${session.access_token}`,
      "Content-Type":"application/json"
    }
  });
}
async function checkAdmin(session){
  const res=await authFetch("/rest/v1/registrations?select=id&limit=1",session);
  return res.ok;
}
async function checkStudent(session){
  const res=await authFetch("/rest/v1/student_accounts?select=student_id&limit=1",session);
  if(!res.ok) return false;
  const rows=await res.json();
  return rows.length>0;
}
async function checkRoleTable(session,role){
  const table=role==="teacher"?"teacher_accounts":"parent_accounts";
  const res=await authFetch(`/rest/v1/${table}?select=id&limit=1`,session);
  if(!res.ok) return false;
  const rows=await res.json();
  return rows.length>0;
}
function roleName(role){return ({student:"طالب",teacher:"معلم",parent:"ولي أمر",admin:"مدير"})[role]||role;}
function targetFor(role){
  return ({student:"student/dashboard.html",teacher:"teacher/dashboard.html",parent:"parent/dashboard.html",admin:"admin/dashboard.html"})[role];
}
function storePortalSession(session,role,isAdminPreview){
  const portal={
    role,
    is_admin_preview:Boolean(isAdminPreview),
    user:session.user,
    access_token:session.access_token,
    refresh_token:session.refresh_token,
    expires_at:session.expires_at
  };
  saveSession(PORTAL_SESSION_KEY,portal);
}

document.addEventListener("DOMContentLoaded",()=>{
  const form=document.getElementById("unifiedLoginForm");
  if(!form) return;

  const params=new URLSearchParams(location.search);
  if(params.get("expired")){
    const box=document.getElementById("loginError");
    box.textContent="انتهت الجلسة. سجّل الدخول مرة أخرى.";
    box.classList.remove("hide");
  }

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const role=form.querySelector('input[name="loginRole"]:checked')?.value||"student";
    const identifier=document.getElementById("email").value.trim();
    let email=identifier;
    const password=document.getElementById("password").value;
    const box=document.getElementById("loginError");
    const btn=document.getElementById("unifiedLoginBtn");
    box.classList.add("hide");
    btn.disabled=true; btn.textContent="جارٍ التحقق...";

    try{
      clearPortalSessions();

      if(!identifier.includes("@")){
        const rr=await fetch(`${PORTAL_SUPABASE_URL}/rest/v1/rpc/resolve_login_email`,{method:"POST",headers:{"apikey":PORTAL_SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({p_identifier:identifier})});
        if(rr.ok){email=await rr.json();}
        if(!email) throw new Error("LOGIN_FAILED");
      }

      const res=await fetch(`${PORTAL_SUPABASE_URL}/auth/v1/token?grant_type=password`,{
        method:"POST",
        headers:{"apikey":PORTAL_SUPABASE_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({email,password})
      });
      if(!res.ok) throw new Error("LOGIN_FAILED");
      const session=await res.json();

      const statusRes=await authFetch("/rest/v1/rpc/current_account_status",session);
      if(statusRes.ok){const accountStatus=await statusRes.json();if(["suspended","locked","closed"].includes(accountStatus)){box.textContent="هذا الحساب موقوف أو مغلق. راجع إدارة المدرسة.";box.classList.remove("hide");return;}}

      // نتحقق أولًا هل الحساب مدير. المدير يستطيع معاينة أي بوابة بنفس بياناته.
      const isAdmin=await checkAdmin(session);

      if(role==="admin"){
        if(!isAdmin){
          box.textContent="بيانات الدخول صحيحة، لكن هذا الحساب غير مخوّل كمدير.";
          box.classList.remove("hide");
          return;
        }
        saveSession(ADMIN_SESSION_KEY,session);
        storePortalSession(session,"admin",false);
        location.href=targetFor("admin");
        return;
      }

      if(isAdmin){
        // وضع معاينة المدير: نفس الحساب، لكن الواجهة تتصرف كالدور المختار.
        saveSession(ADMIN_SESSION_KEY,session);
        saveSession(STUDENT_SESSION_KEY,session); // تستخدمه بوابة الطالب للوصول ببيانات المدير.
        storePortalSession(session,role,true);
        location.href=targetFor(role);
        return;
      }

      // المستخدم الحقيقي غير المدير يجب أن يكون مرتبطًا بالدور المختار.
      let allowed=false;
      if(role==="student") allowed=await checkStudent(session);
      else allowed=await checkRoleTable(session,role);

      if(!allowed){
        box.textContent=`بيانات الدخول صحيحة، لكن هذا الحساب غير مخوّل للدخول بصفة ${roleName(role)}.`;
        box.classList.remove("hide");
        return;
      }

      if(role==="student") saveSession(STUDENT_SESSION_KEY,session);
      storePortalSession(session,role,false);
      location.href=targetFor(role);

    }catch(err){
      console.error(err);
      box.textContent="تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.";
      box.classList.remove("hide");
    }finally{
      btn.disabled=false; btn.textContent="تسجيل الدخول";
    }
  });
});