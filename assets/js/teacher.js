const T_SUPABASE_URL="https://qdhkhlqvrlxkzsglxeym.supabase.co";
const T_KEY="sb_publishable_vjEDfwVqYc6m3mzZECf1RQ_YQ3wBopL";
function tSession(){try{return JSON.parse(localStorage.getItem("academy_session")||localStorage.getItem("supabase.auth.token")||"null")}catch{return null}}
function tToken(){const s=tSession();return s?.access_token||s?.currentSession?.access_token||""}
async function tApi(path,opt={}){return fetch(T_SUPABASE_URL+path,{...opt,headers:{"apikey":T_KEY,"Authorization":`Bearer ${tToken()}`,"Content-Type":"application/json",...(opt.headers||{})}})}
let tStudents=[];
async function loadTeacherStudents(){
 const r=await tApi("/rest/v1/students?select=id,full_name&order=full_name.asc");
 tStudents=r.ok?await r.json():[];
 const box=document.getElementById("teacherMaterialStudents");
 if(box)box.innerHTML=tStudents.map(s=>`<label style="display:inline-flex;gap:6px;align-items:center;margin:6px 10px"><input type="checkbox" value="${s.id}"> ${s.full_name}</label>`).join("")||"لا يوجد طلاب.";
}
async function uploadTeacherMaterial(file,track){
 const safe=(file.name||"file").replace(/[^\w.\-]+/g,"_");
 const path=`${encodeURIComponent(track)}/${Date.now()}_${safe}`;
 const r=await fetch(`${T_SUPABASE_URL}/storage/v1/object/material-attachments/${path}`,{method:"POST",headers:{"apikey":T_KEY,"Authorization":`Bearer ${tToken()}`,"Content-Type":file.type||"application/octet-stream"},body:file});
 if(!r.ok)throw new Error(await r.text());
 return `${T_SUPABASE_URL}/storage/v1/object/public/material-attachments/${path}`;
}
document.addEventListener("DOMContentLoaded",async()=>{
 await loadTeacherStudents();
 document.getElementById("teacherMaterialForm")?.addEventListener("submit",async e=>{
  e.preventDefault(); const msg=document.getElementById("teacherMaterialMsg");
  const ids=[...document.querySelectorAll("#teacherMaterialStudents input:checked")].map(x=>Number(x.value));
  if(!ids.length){msg.textContent="اختر طالبًا واحدًا على الأقل.";return}
  const track=document.getElementById("teacherMaterialTrack").value,title=document.getElementById("teacherMaterialTitle").value.trim(),
  description=document.getElementById("teacherMaterialDescription").value.trim(),file=document.getElementById("teacherMaterialFile").files[0];
  try{
   msg.textContent="جارٍ الرفع...";
   const url=await uploadTeacherMaterial(file,track);
   const rows=ids.map(student_id=>({student_id,track,title,description,file_name:file.name,file_url:url,teacher_name:"المعلم"}));
   const r=await tApi("/rest/v1/material_attachments",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify(rows)});
   if(!r.ok)throw new Error(await r.text());
   msg.textContent="تم رفع المرفق بنجاح ✓"; e.target.reset();
   document.querySelectorAll("#teacherMaterialStudents input").forEach(x=>x.checked=false);
  }catch(err){console.error(err);msg.textContent="تعذر رفع المرفق."}
 });
});