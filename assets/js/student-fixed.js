const STUDENT_SUPABASE_URL = "https://crnlfpuipepolflqcwuo.supabase.co";
const STUDENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bW_x_9cHxqhuxkYdZ-g4kQ_3UAukGRV";
const STUDENT_SESSION_KEY = "rasheed_student_session_v1";
const PORTAL_SESSION_KEY = "rasheed_portal_session_v1";

function getPortalSession(){
  try{return JSON.parse(localStorage.getItem(PORTAL_SESSION_KEY)||"null");}catch{return null;}
}
function isAdminPreview(){
  const p=getPortalSession();
  return Boolean(p?.is_admin_preview && p?.role==="student");
}

function studentEsc(value){
  return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function getStudentSession(){
  try{return JSON.parse(localStorage.getItem(STUDENT_SESSION_KEY) || "null");}catch{return null;}
}
function setStudentSession(session){ localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session)); }
function clearStudentSession(){ localStorage.removeItem(STUDENT_SESSION_KEY); }

async function studentRefreshSession(session){
  if(!session?.refresh_token) return null;
  const res = await fetch(`${STUDENT_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
    method:"POST",
    headers:{"apikey":STUDENT_SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({refresh_token:session.refresh_token})
  });
  if(!res.ok) return null;
  const next = await res.json();
  setStudentSession(next);
  return next;
}

async function studentApi(path, options={}, retry=true){
  let session = getStudentSession();
  if(!session?.access_token) throw new Error("NO_STUDENT_SESSION");
  const headers = {
    "apikey":STUDENT_SUPABASE_PUBLISHABLE_KEY,
    "Authorization":`Bearer ${session.access_token}`,
    "Content-Type":"application/json",
    ...(options.headers || {})
  };
  let res = await fetch(`${STUDENT_SUPABASE_URL}${path}`, {...options, headers});
  if(res.status === 401 && retry){
    session = await studentRefreshSession(session);
    if(!session) throw new Error("STUDENT_SESSION_EXPIRED");
    res = await fetch(`${STUDENT_SUPABASE_URL}${path}`,{
      ...options,
      headers:{...headers,"Authorization":`Bearer ${session.access_token}`}
    });
  }
  return res;
}

async function requireStudent(){
  const session=getStudentSession();
  if(!session?.access_token){
    window.location.replace("../login.html");
    return false;
  }
  if(isAdminPreview()) return true;

  const res=await studentApi("/rest/v1/student_accounts?select=student_id&limit=1").catch(()=>null);
  if(!res || res.status===401){
    clearStudentSession();
    window.location.replace("../login.html?expired=1");
    return false;
  }
  if(!res.ok) return false;
  const rows=await res.json();
  if(!rows.length){
    clearStudentSession();
    window.location.replace("../login.html?unauthorized=1");
    return false;
  }
  return true;
}

function validMeetUrl(value){
  try{
    const u = new URL(String(value || "").trim());
    return u.protocol === "https:" && u.hostname === "meet.google.com";
  }catch{return false;}
}
function meetOpenUrl(url){
  if(!validMeetUrl(url)) return "";
  const ua = navigator.userAgent || "";
  if(!/Android|iPhone|iPad|iPod/i.test(ua)) return url;
  const encoded = encodeURIComponent(url);
  return `https://meet.app.goo.gl/?link=${encoded}&apn=com.google.android.apps.tachyon&ibi=com.google.Tachyon&efr=1&ifl=${encoded}`;
}
function formatArabicDate(value){
  if(!value) return "—";
  const [y,m,d] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(y,m-1,d));
}
function lessonState(r){
  const status = r.status || "scheduled";
  if(status === "cancelled") return "cancelled";
  if(["completed","absent"].includes(status)) return "finished";
  const start = new Date(`${r.lesson_date}T${String(r.start_time).slice(0,5)}:00`);
  const end = new Date(`${r.lesson_date}T${String(r.end_time).slice(0,5)}:00`);
  const now = new Date();
  if(now < start) return "upcoming";
  if(now <= end) return "current";
  return "finished";
}
function canEnterLesson(r, meetUrl){
  if((r.status || "scheduled") !== "scheduled" || !validMeetUrl(meetUrl)) return false;
  const end = new Date(`${r.lesson_date}T${String(r.end_time).slice(0,5)}:00`);
  return new Date() <= end;
}
function startOfWeek(date){
  const d = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  const offset = (d.getDay()+1)%7;
  d.setDate(d.getDate()-offset);
  return d;
}
function endOfWeek(date){ const d=startOfWeek(date); d.setDate(d.getDate()+6); return d; }

async function loadPreviewStudents(){
  const res=await studentApi("/rest/v1/students?select=id,full_name,status&order=full_name.asc");
  if(!res.ok) throw new Error(await res.text());
  const rows=await res.json();
  const select=document.getElementById("previewStudentSelect");
  if(select){
    const keepValue = String(window.__previewStudentId || select.value || "");
    select.innerHTML=rows.map(s=>`<option value="${studentEsc(s.id)}">${studentEsc(s.full_name)}</option>`).join("");
    if(keepValue && rows.some(s=>String(s.id)===keepValue)) select.value=keepValue;
  }
  return rows;
}

async function getCurrentStudent(){
  if(isAdminPreview()){
    document.getElementById("adminPreviewBanner")?.classList.remove("hide");
    const students=await loadPreviewStudents();
    if(!students.length) throw new Error("NO_STUDENTS");
    const select=document.getElementById("previewStudentSelect");
    const wanted=String(window.__previewStudentId || select?.value || students[0].id);
    if(select) select.value=wanted;
    window.__previewStudentId=wanted;
    return students.find(s=>String(s.id)===wanted) || students[0];
  }

  const accountRes=await studentApi("/rest/v1/student_accounts?select=student_id,students(id,full_name,status)&limit=1");
  if(!accountRes.ok) throw new Error(await accountRes.text());
  const rows=await accountRes.json();
  return rows[0]?.students || null;
}

function normalizeStudentStudySelections(value){
  if(Array.isArray(value)) return value;
  if(!value) return [];
  try{const p=typeof value==="string"?JSON.parse(value):value;return Array.isArray(p)?p:[];}catch{return [];}
}
function studentSelectionItems(x){return [...(Array.isArray(x?.subjects)?x.subjects:[]),...(Array.isArray(x?.tracks)?x.tracks:[])].filter(Boolean);}
async function loadStudentEnrollmentSelections(studentId){
  const sRes=await studentApi(`/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&select=id,registration_id&limit=1`);
  if(!sRes.ok) return [];
  const rows=await sRes.json(); const registrationId=rows[0]?.registration_id;
  if(!registrationId) return [];
  const rRes=await studentApi(`/rest/v1/registrations?id=eq.${encodeURIComponent(registrationId)}&select=study_selections&limit=1`);
  if(!rRes.ok) return [];
  const rr=await rRes.json(); return normalizeStudentStudySelections(rr[0]?.study_selections);
}
function renderRegisteredStudies(rows){
  const box=document.getElementById("registeredStudiesList"); if(!box)return;
  if(!rows?.length){box.innerHTML='<div class="empty">لا توجد اختيارات تسجيل مرتبطة بهذا الطالب حتى الآن.</div>';return;}
  box.innerHTML=rows.map(x=>{const meta=[x.system,x.stage,x.grade,x.branch].filter(Boolean),items=studentSelectionItems(x);return `<article class="registered-study-card"><div class="registered-study-title">${studentEsc(x.title||x.key||"برنامج تعليمي")}</div>${meta.length?`<div class="registered-study-meta">${meta.map(studentEsc).join(" ← ")}</div>`:""}${items.length?`<div class="registered-study-items">${items.map(i=>`<span>${studentEsc(i)}</span>`).join("")}</div>`:""}</article>`;}).join("");
}
function registeredStudyNames(rows){return [...new Set((rows||[]).flatMap(studentSelectionItems))];}

async function loadStudentPortal(){
  const ok = await requireStudent(); if(!ok) return;

  const settingsRes=await studentApi("/rest/v1/academy_settings?setting_key=eq.academy_meet_url&select=setting_value&limit=1");
  if(!settingsRes.ok) throw new Error(await settingsRes.text());
  const settingsRows=await settingsRes.json();

  const student=await getCurrentStudent();
  if(!student) throw new Error("NO_STUDENT_PROFILE");
  window.__currentPortalStudentId=student.id;
  const registeredSelections=await loadStudentEnrollmentSelections(student.id).catch(()=>[]);
  renderRegisteredStudies(registeredSelections);
  loadStudentMaterials(student.id).catch(console.error);
  loadAssignmentsAndExams(student.id).catch(console.error);

  const meetUrl = settingsRows[0]?.setting_value || "";
  document.getElementById("studentWelcome").textContent = `السلام عليكم، ${student.full_name} 🌿`;

  const linksRes = await studentApi(`/rest/v1/lesson_students?student_id=eq.${encodeURIComponent(student.id)}&select=lesson_id`);
  if(!linksRes.ok) throw new Error(await linksRes.text());
  const links = await linksRes.json();
  const ids = links.map(x=>x.lesson_id);

  if(!ids.length){
    renderStudentSubjects([], registeredSelections);
    renderStudentLessons([], meetUrl);
    return;
  }

  const lessonRes = await studentApi(`/rest/v1/lessons?id=in.(${ids.join(",")})&select=id,teacher_id,track_id,lesson_date,start_time,end_time,status&order=lesson_date.asc,start_time.asc`);
  if(!lessonRes.ok) throw new Error(await lessonRes.text());
  const lessons = await lessonRes.json();

  const teacherIds = [...new Set(lessons.map(x=>x.teacher_id).filter(Boolean))];
  const trackIds = [...new Set(lessons.map(x=>x.track_id).filter(Boolean))];

  const [teachersRes, tracksRes] = await Promise.all([
    teacherIds.length ? studentApi(`/rest/v1/teachers?id=in.(${teacherIds.join(",")})&select=id,full_name`) : Promise.resolve({ok:true,json:async()=>[]}),
    trackIds.length ? studentApi(`/rest/v1/academy_tracks?id=in.(${trackIds.join(",")})&select=id,name_ar`) : Promise.resolve({ok:true,json:async()=>[]})
  ]);
  if(!teachersRes.ok) throw new Error(await teachersRes.text());
  if(!tracksRes.ok) throw new Error(await tracksRes.text());

  const teachers = new Map((await teachersRes.json()).map(x=>[String(x.id),x.full_name]));
  const tracks = new Map((await tracksRes.json()).map(x=>[String(x.id),x.name_ar]));
  lessons.forEach(r=>{
    r.teacher_name = teachers.get(String(r.teacher_id)) || "—";
    r.track_name = tracks.get(String(r.track_id)) || "غير محدد";
  });

  renderStudentSubjects(lessons, registeredSelections);
  renderStudentLessons(lessons, meetUrl);
}

function renderStudentSubjects(lessons, registeredSelections=[]){
  const lessonNames=lessons.filter(x=>x.track_id).map(x=>x.track_name).filter(Boolean);
  const unique=[...new Set([...registeredStudyNames(registeredSelections),...lessonNames])];
  window.__studentSubjectsCount=unique.length;
  const count=document.getElementById("subjectsCount"); if(count) count.textContent=unique.length;
  const box=document.getElementById("subjectsList");
  if(box) box.innerHTML=unique.length?unique.map(name=>`<div class="card"><div class="icon">📚</div><h3>${studentEsc(name)}</h3></div>`).join(""):'<div class="empty">لا توجد مواد أو مسارات مرتبطة بحسابك حتى الآن.</div>';
  updateStudentDashboardCounts();
}

function renderStudentLessons(lessons, meetUrl){
  window.__studentLessons = lessons;
  window.__studentMeetUrl = meetUrl;
  const now = new Date();
  const upcoming = lessons.filter(r=>{
    const end = new Date(`${r.lesson_date}T${String(r.end_time).slice(0,5)}:00`);
    return end >= now && (r.status || "scheduled") === "scheduled";
  });
  window.__studentUpcomingLessonsCount=upcoming.length;
  const upcomingCountEl=document.getElementById("upcomingLessonsCount"); if(upcomingCountEl) upcomingCountEl.textContent=upcoming.length;
  updateStudentDashboardCounts();

  const next = upcoming[0];
  const nextBox = document.getElementById("nextLessonContent");
  if(!next) nextBox.innerHTML = "لا توجد حصة قادمة الآن.";
  else{
    const url = canEnterLesson(next, meetUrl) ? meetOpenUrl(meetUrl) : "";
    nextBox.innerHTML = `<div class="lesson-row">
      <div>
        <span class="track-chip">${studentEsc(next.track_name)}</span>
        <h3 style="margin:8px 0 4px">${studentEsc(next.teacher_name)}</h3>
        <div class="lesson-meta"><span>${studentEsc(formatArabicDate(next.lesson_date))}</span><span>${studentEsc(String(next.start_time).slice(0,5))} - ${studentEsc(String(next.end_time).slice(0,5))}</span></div>
      </div>
      <a class="join-btn ${url?"":"disabled"}" href="${url?studentEsc(url):"#"}" target="_blank" rel="noopener">دخول الحصة</a>
    </div>`;
  }
  renderStudentLessonList();
}

function renderStudentLessonList(){
  const lessons = window.__studentLessons || [];
  const meetUrl = window.__studentMeetUrl || "";
  const view = document.getElementById("studentLessonView")?.value || "upcoming";
  const now = new Date();
  const a = startOfWeek(now), b = endOfWeek(now);

  const rows = lessons.filter(r=>{
    const date = new Date(`${r.lesson_date}T00:00:00`);
    const end = new Date(`${r.lesson_date}T${String(r.end_time).slice(0,5)}:00`);
    if(view === "today") return date.toDateString() === new Date(now.getFullYear(),now.getMonth(),now.getDate()).toDateString();
    if(view === "week") return date >= a && date <= b;
    if(view === "upcoming") return end >= now && (r.status || "scheduled") === "scheduled";
    return true;
  });

  const box = document.getElementById("studentLessonsList");
  box.innerHTML = rows.length ? rows.map(r=>{
    const state = lessonState(r);
    const url = canEnterLesson(r, meetUrl) ? meetOpenUrl(meetUrl) : "";
    const statusText = ({scheduled:"مجدولة",completed:"مكتملة",cancelled:"ملغاة",absent:"غياب"})[r.status || "scheduled"];
    return `<div class="lesson-card ${state}">
      <div class="lesson-row">
        <div>
          <span class="track-chip">${studentEsc(r.track_name)}</span>
          <h3 style="margin:8px 0 4px">${studentEsc(r.teacher_name)}</h3>
          <div class="lesson-meta">
            <span>${studentEsc(formatArabicDate(r.lesson_date))}</span>
            <span>${studentEsc(String(r.start_time).slice(0,5))} - ${studentEsc(String(r.end_time).slice(0,5))}</span>
            <span>${studentEsc(statusText)}</span>
          </div>
        </div>
        <a class="join-btn ${url?"":"disabled"}" href="${url?studentEsc(url):"#"}" target="_blank" rel="noopener">دخول الحصة</a>
      </div>
    </div>`;
  }).join("") : '<div class="empty">لا توجد حصص في هذا العرض.</div>';
}

document.addEventListener("DOMContentLoaded",()=>{
  const loginForm = document.getElementById("studentLoginForm");
  if(loginForm){
    const params = new URLSearchParams(location.search);
    if(params.get("expired")) {
      const box=document.getElementById("studentLoginError");
      box.textContent="انتهت الجلسة. سجّل الدخول مرة أخرى."; box.classList.remove("hide");
    }
    if(params.get("unauthorized")) {
      const box=document.getElementById("studentLoginError");
      box.textContent="هذا الحساب غير مرتبط بطالب في الأكاديمية."; box.classList.remove("hide");
    }

    loginForm.addEventListener("submit",async e=>{
      e.preventDefault();
      const btn=document.getElementById("studentLoginBtn");
      const err=document.getElementById("studentLoginError");
      btn.disabled=true; btn.textContent="جارٍ الدخول..."; err.classList.add("hide");
      try{
        const res=await fetch(`${STUDENT_SUPABASE_URL}/auth/v1/token?grant_type=password`,{
          method:"POST",
          headers:{"apikey":STUDENT_SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
          body:JSON.stringify({
            email:document.getElementById("email").value.trim(),
            password:document.getElementById("password").value
          })
        });
        if(!res.ok) throw new Error(await res.text());
        const session=await res.json();
        setStudentSession(session);
        const check=await studentApi("/rest/v1/student_accounts?select=student_id&limit=1");
        const rows=check.ok?await check.json():[];
        if(!rows.length){
          clearStudentSession();
          err.textContent="الحساب صحيح لكنه غير مرتبط بطالب في الأكاديمية.";
          err.classList.remove("hide");
          return;
        }
        window.location.href="dashboard.html";
      }catch(error){
        console.error(error);
        err.textContent="تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.";
        err.classList.remove("hide");
      }finally{btn.disabled=false;btn.textContent="دخول الطالب";}
    });
  }

  document.querySelector("[data-student-logout]")?.addEventListener("click",()=>{
    clearStudentSession();
    window.location.replace("login.html");
  });

  if(document.getElementById("studentLessonsList")){
    loadStudentPortal().catch(err=>{
      console.error(err);
      document.getElementById("studentLoadError")?.classList.remove("hide");
    });
    document.getElementById("studentLessonView")?.addEventListener("change",renderStudentLessonList);
    document.getElementById("previewStudentSelect")?.addEventListener("change",(e)=>{
      window.__previewStudentId=String(e.currentTarget.value || "");
      loadStudentPortal().catch(err=>{
        console.error(err);
        document.getElementById("studentLoadError")?.classList.remove("hide");
      });
    });
  }
});

let studentAssignmentsCache=[];
let studentExamsCache=[];

function portalDateTime(v){
  if(!v) return "—";
  try{return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v));}
  catch{return v;}
}
function assignmentState(row){
  if(row.submission?.submitted_at) return "submitted";
  if(row.due_at && new Date(row.due_at)<new Date()) return "late";
  return "open";
}
function assignmentStateLabel(s){return s==="submitted"?"تم التسليم":s==="late"?"متأخر":"متاح";}
function assignmentCard(row){
  const state=assignmentState(row);
  const canSubmit=state!=="late" || row.allow_late_submission;
  const grade=row.submission?.grade;
  return `<article class="panel" style="margin:0">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><strong>${studentEsc(row.title||"واجب")}</strong><div class="muted">${studentEsc(row.track||"")}</div></div>
      <span class="badge">${assignmentStateLabel(state)}</span>
    </div>
    <p>${studentEsc(row.description||"")}</p>
    <div class="muted">تاريخ الإنشاء: ${portalDateTime(row.created_at)} · التسليم: ${portalDateTime(row.due_at)}</div>
    ${grade!==null && grade!==undefined ? `<div style="margin-top:8px"><strong>الدرجة: ${studentEsc(grade)}${row.max_grade?` / ${studentEsc(row.max_grade)}`:""}</strong></div>`:""}
    ${row.attachment_url?`<div style="margin-top:8px"><a class="btn btn-secondary" href="${studentEsc(row.attachment_url)}" target="_blank" rel="noopener">مرفق الواجب</a></div>`:""}
    ${state==="submitted"
      ? `<div style="margin-top:10px">تم التسليم في ${portalDateTime(row.submission.submitted_at)}</div>`
      : canSubmit
        ? `<form class="studentSubmissionForm" data-assignment-id="${studentEsc(row.id)}" style="margin-top:12px">
             <label>رابط المرفق أو الملف</label>
             <input name="attachment_url" type="url" placeholder="https://..." required>
             <button class="btn btn-primary" type="submit" style="margin-top:8px">تسليم الواجب</button>
           </form>`
        : `<div style="margin-top:10px;color:#a12d2d"><strong>انتهى موعد التسليم.</strong> يحتاج المعلم إلى تمديد المهلة للسماح بالتسليم.</div>`}
  </article>`;
}
function examCard(row){
  const result=row.result||null;
  return `<article class="panel" style="margin:0">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><strong>${studentEsc(row.title||"اختبار")}</strong><div class="muted">${studentEsc(row.track||"")}</div></div>
      <span class="badge">${row.due_at && new Date(row.due_at)<new Date()?"مغلق":"قادم/متاح"}</span>
    </div>
    <p>${studentEsc(row.description||"")}</p>
    <div class="muted">تاريخ الإنشاء: ${portalDateTime(row.created_at)} · الإغلاق: ${portalDateTime(row.due_at)}</div>
    ${row.attachment_url?`<div style="margin-top:8px"><a class="btn btn-secondary" href="${studentEsc(row.attachment_url)}" target="_blank" rel="noopener">مرفق الاختبار</a></div>`:""}
    ${result?`<div style="margin-top:10px"><strong>الدرجة: ${studentEsc(result.grade)}${row.max_grade?` / ${studentEsc(row.max_grade)}`:""}</strong>${result.feedback?`<div class="muted">ملاحظة المعلم: ${studentEsc(result.feedback)}</div>`:""}</div>`:`<div class="muted" style="margin-top:10px">لم تُعلن الدرجة بعد.</div>`}
  </article>`;
}
async function loadAssignmentsAndExams(studentId){
  const [aRes,eRes]=await Promise.all([
    studentApi(`/rest/v1/assignments?select=id,title,description,track,created_at,due_at,max_grade,attachment_url,allow_late_submission,assignment_submissions(id,submitted_at,attachment_url,grade,feedback)&student_id=eq.${encodeURIComponent(studentId)}&order=due_at.asc`),
    studentApi(`/rest/v1/exams?select=id,title,description,track,created_at,due_at,max_grade,attachment_url,exam_results(id,grade,feedback,published_at)&student_id=eq.${encodeURIComponent(studentId)}&order=due_at.asc`)
  ]);
  if(aRes.ok){
    const rows=await aRes.json();
    studentAssignmentsCache=rows.map(x=>({...x,submission:Array.isArray(x.assignment_submissions)?x.assignment_submissions[0]:null}));
  }else studentAssignmentsCache=[];
  if(eRes.ok){
    const rows=await eRes.json();
    studentExamsCache=rows.map(x=>({...x,result:Array.isArray(x.exam_results)?x.exam_results[0]:null}));
  }else studentExamsCache=[];
  renderAssignments();
  renderExams();
}
function renderAssignments(){
  setTimeout(()=>{updateStudentDashboardCounts();refreshStudentNotifications();},0);
  const filter=document.getElementById("assignmentFilter")?.value||"all";
  const rows=studentAssignmentsCache.filter(r=>filter==="all"||assignmentState(r)===filter);
  const list=document.getElementById("assignmentsList"), empty=document.getElementById("assignmentsEmpty");
  if(list) list.innerHTML=rows.map(assignmentCard).join("");
  empty?.classList.toggle("hide",rows.length>0);
  document.querySelectorAll(".studentSubmissionForm").forEach(form=>form.addEventListener("submit",submitAssignment));
}
function renderExams(){
  setTimeout(()=>{updateStudentDashboardCounts();refreshStudentNotifications();},0);
  const list=document.getElementById("examsList"), empty=document.getElementById("examsEmpty");
  if(list) list.innerHTML=studentExamsCache.map(examCard).join("");
  empty?.classList.toggle("hide",studentExamsCache.length>0);
}
async function submitAssignment(e){
  e.preventDefault();
  const form=e.currentTarget, assignmentId=form.dataset.assignmentId;
  const assignment=studentAssignmentsCache.find(x=>String(x.id)===String(assignmentId));
  if(!assignment) return;
  const portalStudentId=window.__currentPortalStudentId;
  if(!portalStudentId) return;
  const attachment_url=new FormData(form).get("attachment_url");
  const res=await studentApi("/rest/v1/assignment_submissions",{
    method:"POST",
    headers:{"Prefer":"return=representation"},
    body:JSON.stringify({assignment_id:Number(assignmentId),student_id:Number(portalStudentId),attachment_url,submitted_at:new Date().toISOString()})
  });
  if(!res.ok){alert("تعذر تسليم الواجب.");return;}
  await loadAssignmentsAndExams(portalStudentId);
}
document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("assignmentFilter")?.addEventListener("change",renderAssignments);
});


const MATERIAL_TRACKS=["التأسيس","التلاوة والتجويد","الحفظ والإتقان","الإجازة والسند","العقيدة","الفقه","الحديث","التفسير","السيرة النبوية","العربية لغير الناطقين بها"];
let studentMaterialsCache=[];
function materialDate(v){try{return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium"}).format(new Date(v));}catch{return v||"—";}}
async function loadStudentMaterials(studentId){
  const res=await studentApi(`/rest/v1/material_attachments?select=id,title,description,track,file_name,file_url,created_at,teacher_name&student_id=eq.${encodeURIComponent(studentId)}&order=created_at.desc`);
  studentMaterialsCache=res.ok?await res.json():[];
  renderStudentMaterials();
}
function renderStudentMaterials(){
  setTimeout(updateStudentDashboardCounts,0);
  const filter=document.getElementById("materialTrackFilter")?.value||"all";
  const rows=studentMaterialsCache.filter(x=>filter==="all"||x.track===filter);
  const list=document.getElementById("studentMaterialsList"), empty=document.getElementById("studentMaterialsEmpty");
  if(list) list.innerHTML=rows.map(x=>`<article class="card" style="padding:16px">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div><strong>${studentEsc(x.title||x.file_name||"مرفق")}</strong><div class="muted">${studentEsc(x.track||"")}</div></div>
      <span class="badge">${materialDate(x.created_at)}</span>
    </div>
    ${x.description?`<p>${studentEsc(x.description)}</p>`:""}
    <div class="muted">المعلم: ${studentEsc(x.teacher_name||"—")}</div>
    <div style="margin-top:10px"><a class="btn btn-primary" href="${studentEsc(x.file_url)}" target="_blank" rel="noopener">⬇ تحميل المرفق</a></div>
  </article>`).join("");
  empty?.classList.toggle("hide",rows.length>0);
  const c=document.getElementById("materialsCount"); if(c)c.textContent=studentMaterialsCache.length;
}
document.addEventListener("DOMContentLoaded",()=>document.getElementById("materialTrackFilter")?.addEventListener("change",renderStudentMaterials));


function updateStudentDashboardCounts(){
 const s=document.getElementById("subjectsCardCount"),l=document.getElementById("lessonsCardCount"),
 a=document.getElementById("assignmentsCardCount"),e=document.getElementById("examsCardCount"),m=document.getElementById("materialsCardCount");
 const subj=window.__studentSubjectsCount||0, lessons=window.__studentUpcomingLessonsCount||0;
 if(s)s.textContent=`${subj} مواد`; if(l)l.textContent=`${lessons} حصص`;
 if(a)a.textContent=`${typeof studentAssignmentsCache!=="undefined"?studentAssignmentsCache.length:0} واجبات`;
 if(e)e.textContent=`${typeof studentExamsCache!=="undefined"?studentExamsCache.length:0} اختبارات`;
 if(m)m.textContent=`${typeof studentMaterialsCache!=="undefined"?studentMaterialsCache.length:0} مرفقات`;
}
function refreshStudentNotifications(){
 const notes=[];
 if(typeof studentAssignmentsCache!=="undefined") studentAssignmentsCache.filter(x=>assignmentState(x)==="open").forEach(x=>notes.push(`📝 واجب: ${x.title}`));
 if(typeof studentExamsCache!=="undefined") studentExamsCache.filter(x=>["upcoming","open"].includes(examState(x))).forEach(x=>notes.push(`📋 اختبار: ${x.title}`));
 const c=document.getElementById("notificationCount"),list=document.getElementById("notificationList");
 if(c){c.textContent=notes.length;c.style.display=notes.length?"flex":"none"} if(list)list.innerHTML=notes.length?notes.map(n=>`<div style="padding:8px 0;border-bottom:1px solid #eee">${n}</div>`).join(""):"لا توجد تنبيهات جديدة.";
}
document.addEventListener("DOMContentLoaded",()=>{
 document.querySelectorAll(".dashboard-card").forEach(btn=>btn.addEventListener("click",()=>{
   const id=btn.dataset.panel, panel=document.getElementById(id), was=panel?.classList.contains("is-open");
   document.querySelectorAll(".student-detail-panel").forEach(x=>x.classList.remove("is-open"));
   document.querySelectorAll(".dashboard-card").forEach(x=>x.classList.remove("active"));
   if(panel&&!was){panel.classList.add("is-open");btn.classList.add("active");panel.scrollIntoView({behavior:"smooth",block:"start"});}
 }));
 const nb=document.getElementById("notificationBtn"),np=document.getElementById("notificationPopover");
 nb?.addEventListener("click",()=>np?.classList.toggle("hide"));
 const edit=document.getElementById("studentAvatarEdit"),file=document.getElementById("studentAvatarFile"),img=document.getElementById("studentAvatar");
 edit?.addEventListener("click",()=>file?.click());
 file?.addEventListener("change",()=>{const f=file.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{if(img)img.src=r.result;localStorage.setItem("student_avatar_preview",r.result)};r.readAsDataURL(f)});
 const saved=localStorage.getItem("student_avatar_preview"); if(img)img.src=saved||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' rx='50' fill='%23e8f2ed'/%3E%3Ctext x='50' y='62' text-anchor='middle' font-size='42'%3E👤%3C/text%3E%3C/svg%3E";
 updateStudentDashboardCounts();refreshStudentNotifications();
});


function applyStudentDashboardVisibility(){
  const ids=["subjects","lessons","assignmentsSection","examsSection","materials"];
  ids.forEach(id=>document.getElementById(id)?.classList.remove("is-open"));
  document.querySelectorAll(".dashboard-card").forEach(c=>c.classList.remove("active"));
}

document.addEventListener("DOMContentLoaded",()=>{
  applyStudentDashboardVisibility();

  document.getElementById("studentDashboardCards")?.addEventListener("click",(e)=>{
    const card=e.target.closest(".dashboard-card");
    if(!card) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const target=document.getElementById(card.dataset.panel);
    const wasOpen=target?.classList.contains("is-open");

    applyStudentDashboardVisibility();

    if(target && !wasOpen){
      target.classList.add("is-open");
      card.classList.add("active");
      setTimeout(()=>target.scrollIntoView({behavior:"smooth",block:"start"}),50);
    }
  }, true);

  document.getElementById("examFilter")?.addEventListener("change",()=>{
    if(typeof renderExams==="function") renderExams();
  });
});
