(()=>{
 const state={people:[],accounts:[],users:[],audit:[]}; const $=id=>document.getElementById(id); let currentPersonId=null;
 async function req(path,opt={}){const r=await api(path,opt);if(!r.ok){const t=await r.text();const e=new Error(t||`HTTP ${r.status}`);e.status=r.status;throw e;}if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null;}
 const accountFor=id=>state.accounts.find(a=>a.person_id===id); const escv=v=>esc(v??'');
 const AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
 const AR_DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
 function pad2(n){return String(n).padStart(2,'0');}
 function fmtDate(v){
  if(!v)return '—';
  const d=new Date(v);if(Number.isNaN(d.getTime()))return '—';
  const day=AR_DAYS[d.getDay()],date=pad2(d.getDate()),month=AR_MONTHS[d.getMonth()],year=String(d.getFullYear());
  let h=d.getHours(),period=h>=12?'مساءً':'صباحًا';h=h%12||12;
  // نبني التاريخ يدويًا بالأرقام الإنجليزية، ثم نزيل أي علامات اتجاه خفية.
  return `${day} ${date} ${month} ${year} - ${pad2(h)}:${pad2(d.getMinutes())} ${period}`.replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g,'');
 }
 function fmtDateHtml(v){
  if(!v)return '—';
  const d=new Date(v);if(Number.isNaN(d.getTime()))return '—';
  const day=AR_DAYS[d.getDay()],date=pad2(d.getDate()),month=AR_MONTHS[d.getMonth()],year=String(d.getFullYear());
  let h=d.getHours(),period=h>=12?'مساءً':'صباحًا';h=h%12||12;
  const time=`${pad2(h)}:${pad2(d.getMinutes())}`;
  return `<span class="audit-date"><span class="audit-date-main">${escv(day)}، ${escv(date)} ${escv(month)} ${escv(year)}</span><span class="audit-time-line"><span class="audit-time-number" dir="ltr">${escv(time)}</span> ${escv(period)}</span></span>`;
 }
 function statusLabel(s){return ({active:'نشط',inactive:'غير نشط',archived:'مؤرشف',pending:'بانتظار التفعيل',suspended:'موقوف',locked:'مقفل',closed:'مغلق'})[s]||s||'—';}

 function formatDateOnly(v){
  if(!v)return '';
  const parts=String(v).slice(0,10).split('-');
  if(parts.length!==3)return '';
  return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
 }
 function syncDateControl(nativeId,displayId){
  const native=$(nativeId),display=$(displayId);if(!native||!display)return;display.value=formatDateOnly(native.value);
 }
 function openNativeDate(native){
  if(!native)return;
  try{if(typeof native.showPicker==='function')native.showPicker();else native.click();}catch(_){native.focus();native.click();}
 }
 function actionLabel(a){return ({account_created:'إنشاء حساب',account_updated:'تعديل حساب',password_reset:'إعادة تعيين كلمة المرور',account_linked:'ربط حساب دخول',account_unlinked:'إلغاء ربط حساب'})[a]||a;}
 function browserLabel(ua){if(!ua)return 'غير متاح';if(/Edg\//.test(ua))return 'Microsoft Edge';if(/Chrome\//.test(ua))return 'Google Chrome';if(/Firefox\//.test(ua))return 'Mozilla Firefox';if(/Safari\//.test(ua))return 'Safari';return 'متصفح آخر';}
 function renderAudit(){const q=($('auditSearch')?.value||'').trim().toLowerCase(),action=$('auditAction')?.value||'',from=$('auditFrom')?.value||'',to=$('auditTo')?.value||'';const rows=state.audit.filter(x=>{const hay=[x.person_name,x.performed_by_email,x.username,actionLabel(x.action)].join(' ').toLowerCase();const day=(x.created_at||'').slice(0,10);return (!q||hay.includes(q))&&(!action||x.action===action)&&(!from||day>=from)&&(!to||day<=to)});$('auditList').innerHTML=rows.length?rows.map(x=>`<article class="audit-row"><div class="audit-head"><div><div class="audit-title">${escv(actionLabel(x.action))}</div><div class="meta">${escv(x.person_name||'شخص غير معروف')} · ${fmtDateHtml(x.created_at)}</div></div><span class="audit-status ${x.result_status==='failed'?'failed':''}">${x.result_status==='failed'?'فشل':'نجاح'}</span></div><div class="audit-details meta"><span>منفذ العملية: ${escv(x.performed_by_email||'غير معروف')}</span><span>اسم المستخدم: ${escv(x.username||'—')}</span><span>الجهاز/المتصفح: ${escv(browserLabel(x.user_agent))}</span><span>عنوان IP: ${escv(x.client_ip||'غير متاح')}</span></div><div class="actions" style="margin-top:10px"><button class="btn btn-secondary" data-audit-id="${x.id}">عرض التفاصيل</button></div></article>`).join(''):'<div class="empty">لا توجد عمليات مطابقة.</div>';}
 function userFor(id){return state.users.find(u=>u.id===id);} function userEmail(id){return userFor(id)?.email||'غير مرتبط';}
 function initials(p){return (p.full_name_ar||p.full_name_en||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('');}
 function avatar(p){return p.photo_url?`<span class="avatar"><img src="${escv(p.photo_url)}" alt=""></span>`:`<span class="avatar">${escv(initials(p))}</span>`;}
 function slugify(v){return (v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'').slice(0,40);}
 function suggestedUsername(p,mode){if(mode==='person_code')return (p.person_code||'').toLowerCase();if(mode==='email')return (p.email||'').toLowerCase();if(mode==='auto'){const base=slugify(p.full_name_en);return base||((p.person_code||'').toLowerCase());}return '';}
 function lastSignIn(a){const u=a?.auth_user_id?userFor(a.auth_user_id):null;return u?.last_sign_in_at?fmtDate(u.last_sign_in_at):'لم يسجل الدخول بعد';}
 function render(){const q=($('peopleSearch')?.value||'').trim().toLowerCase();const rows=state.people.filter(p=>{const a=accountFor(p.id);return [p.person_code,p.full_name_ar,p.full_name_en,p.national_id,p.mobile,p.email,a?.username].join(' ').toLowerCase().includes(q)});
  $('peopleList').innerHTML=rows.length?rows.map(p=>{const a=accountFor(p.id);return `<article class="person-card"><div class="person-head"><div class="person-main">${avatar(p)}<div><h3 class="person-name">${escv(p.full_name_ar)}</h3><div class="person-code">${escv(p.person_code||'—')}</div><div class="meta">${escv(p.full_name_en||'')}<br>الجنسية: ${escv(p.nationality||'—')} · الهوية: ${escv(p.national_id||'—')}<br>الجوال: ${escv(p.mobile||'—')} · البريد: ${escv(p.email||'—')}</div></div></div><span class="badge ${escv(p.status)}">${escv(statusLabel(p.status))}</span></div><div class="account-summary">${a?`<div class="badges"><span class="badge ${escv(a.account_status)}">الحساب: ${escv(statusLabel(a.account_status))}</span>${a.username?`<span class="badge">@${escv(a.username)}</span>`:''}</div><div class="meta">آخر دخول: ${escv(lastSignIn(a))}</div>`:`<div class="empty-account">لا يوجد حساب دخول</div>`}</div><div class="actions" style="margin-top:12px"><button class="btn btn-secondary" data-edit-person="${p.id}">تعديل البطاقة</button><button class="btn btn-primary" data-account-person="${p.id}">${a?'إدارة الحساب':'إنشاء حساب'}</button></div></article>`}).join(''):'<div class="empty">لا توجد نتائج.</div>';
  const withAccounts=state.people.filter(p=>accountFor(p.id));$('accountsList').innerHTML=withAccounts.length?withAccounts.map(p=>{const a=accountFor(p.id),u=a?.auth_user_id?userFor(a.auth_user_id):null;return `<article class="person-card"><div class="person-main">${avatar(p)}<div><h3 class="person-name">${escv(p.full_name_ar)}</h3><div class="person-code">${escv(p.person_code||'—')}</div></div></div><div class="meta" style="margin-top:10px">اسم المستخدم: ${escv(a?.username||'—')}<br>البريد المرتبط: ${escv(a?.auth_user_id?userEmail(a.auth_user_id):'—')}<br>آخر دخول: ${escv(u?.last_sign_in_at?fmtDate(u.last_sign_in_at):'لم يسجل الدخول بعد')}<br>آخر إعادة تعيين: ${escv(a?.last_password_reset_at?fmtDate(a.last_password_reset_at):'—')}</div><div class="badges"><span class="badge ${escv(a?.account_status)}">${escv(statusLabel(a?.account_status))}</span></div><div class="actions" style="margin-top:12px"><button class="btn btn-primary" data-account-person="${p.id}">إدارة الحساب</button></div></article>`}).join(''):'<div class="empty">لا توجد حسابات منشأة بعد.</div>';
  renderAudit();
 }
 function fillUsers(){$('authUserSelect').innerHTML='<option value="">— بدون حساب حاليًا —</option>'+state.users.map(u=>`<option value="${u.id}">${escv(u.email||u.id)}</option>`).join('');}
 async function load(){if(!await requireAdmin())return;try{const [people,accounts,users,audit]=await Promise.all([req('/rest/v1/people?select=*&order=created_at.desc'),req('/rest/v1/person_accounts?select=*&order=created_at.desc'),req('/rest/v1/rpc/list_identity_users',{method:'POST',body:'{}'}),req('/rest/v1/rpc/list_account_audit_logs',{method:'POST',body:'{}'})]);Object.assign(state,{people,accounts,users,audit});fillUsers();render();}catch(e){console.error(e);if(e.status===404||String(e.message).includes('PGRST'))$('setupNotice').classList.remove('hide');else{$('loadError').textContent='تعذر تحميل الأشخاص والحسابات.';$('loadError').classList.remove('hide');}}}
 function openPerson(id){const f=$('personForm');f.reset();$('personError').classList.add('hide');const p=state.people.find(x=>x.id===id);$('personDialogTitle').textContent=p?'تعديل بطاقة الشخص':'إضافة شخص';if(p)Object.keys(p).forEach(k=>{if(f.elements[k]&&p[k]!=null)f.elements[k].value=p[k]});syncDateControl('birthDateNative','birthDateDisplay');$('personDialog').showModal();}
 async function savePerson(e){e.preventDefault();const f=e.currentTarget,d=Object.fromEntries(new FormData(f)),id=d.id;delete d.id;['full_name_en','national_id','nationality','birth_date','mobile','whatsapp','email','photo_url','address','notes'].forEach(k=>{if(!d[k])d[k]=null});try{if(id)await req(`/rest/v1/people?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({...d,updated_at:new Date().toISOString()})});else await req('/rest/v1/people',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(d)});$('personDialog').close();await load();}catch(err){console.error(err);$('personError').textContent='تعذر الحفظ. تحقق من عدم تكرار رقم الهوية.';$('personError').classList.remove('hide');}}
 function applyUsernameMode(){const p=state.people.find(x=>x.id===currentPersonId),mode=$('usernameMode').value;if(!p||mode==='manual')return;const v=suggestedUsername(p,mode);if(v)$('accountForm').elements.username.value=v;}
 function openAccount(personId){currentPersonId=personId;const f=$('accountForm');f.reset();f.elements.person_id.value=personId;const a=accountFor(personId);$('usernameMode').value=a?.username?'manual':'auto';if(a){f.elements.username.value=a.username||'';f.elements.auth_user_id.value=a.auth_user_id||'';f.elements.account_status.value=a.account_status;f.elements.must_change_password.value=String(a.must_change_password);}else{f.elements.account_status.value='pending';f.elements.must_change_password.value='true';applyUsernameMode();}$('accountError').classList.add('hide');$('accountDialog').showModal();}
 function generatePassword(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';let out='';const arr=new Uint32Array(14);if(window.crypto?.getRandomValues)crypto.getRandomValues(arr);else for(let i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*100000);arr.forEach(n=>out+=chars[n%chars.length]);$('newPassword').value=out;return out;}
 window.rasheedGeneratePassword=function(e){e?.preventDefault?.();generatePassword();return false;}
 function showMessage(message,type='success'){
  let box=document.getElementById('peopleToast');
  if(!box){box=document.createElement('div');box.id='peopleToast';box.style.cssText='position:fixed;left:24px;bottom:24px;z-index:99999;padding:12px 18px;border-radius:12px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.18);transition:.2s;max-width:340px';document.body.appendChild(box);}
  box.textContent=message;box.style.background=type==='error'?'#b42318':'#08765f';box.style.color='#fff';box.style.opacity='1';box.style.transform='translateY(0)';
  clearTimeout(box._timer);box._timer=setTimeout(()=>{box.style.opacity='0';box.style.transform='translateY(8px)';},2200);
 }
 async function copyPassword(){
  const input=$('newPassword'),v=(input?.value||'').trim();
  if(!v){showMessage('أنشئ كلمة مرور أولًا.','error');return false;}
  let copied=false;
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(v);copied=true;}}catch(e){console.warn('Clipboard API failed',e);}
  if(!copied){
    try{input.focus();input.select();input.setSelectionRange(0,input.value.length);copied=!!document.execCommand('copy');}catch(e){console.warn('Fallback copy failed',e);}
  }
  if(!copied){
    try{window.prompt('انسخ كلمة المرور التالية:',v);copied=true;}catch(e){}
  }
  showMessage(copied?'تم نسخ كلمة المرور.':'تعذر النسخ؛ انسخها يدويًا. ',copied?'success':'error');
  return false;
 }
 window.rasheedCopyPassword=function(e){e?.preventDefault?.();copyPassword();return false;};
 async function saveAccount(e){
  e.preventDefault();
  const f=e.currentTarget,submit=$('saveAccountBtn')||f.querySelector('button[type="submit"]');
  const form=Object.fromEntries(new FormData(f));
  const payload={
    p_person_id:form.person_id,
    p_username:(form.username||'').trim().toLowerCase(),
    p_auth_user_id:form.auth_user_id||null,
    p_account_status:form.account_status||'pending',
    p_must_change_password:form.must_change_password==='true',
    p_new_password:(form.new_password||'').trim()||null,
    p_user_agent:navigator.userAgent||null
  };
  $('accountError').classList.add('hide');
  if(!payload.p_username){$('accountError').textContent='اكتب اسم المستخدم أو أنشئه تلقائيًا.';$('accountError').classList.remove('hide');return;}
  if(!/^[a-z0-9._@-]+$/.test(payload.p_username)){$('accountError').textContent='اسم المستخدم يجب أن يكون بالإنجليزية، ويمكن أن يحتوي على أرقام ونقطة وشرطة فقط.';$('accountError').classList.remove('hide');return;}
  if(payload.p_new_password&&payload.p_new_password.length<8){$('accountError').textContent='كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف.';$('accountError').classList.remove('hide');return;}
  const originalText=submit.textContent;submit.disabled=true;submit.textContent='جاري الحفظ...';
  try{
    const result=await req('/rest/v1/rpc/save_person_account',{method:'POST',body:JSON.stringify(payload)});
    $('accountDialog').close();
    showMessage(result?.password_applied===false&&payload.p_new_password?'تم حفظ الحساب. لم تُطبق كلمة المرور لأنه غير مرتبط بحساب دخول.':'تم حفظ الحساب بنجاح.');
    await load();
  }catch(err){
    console.error('save_person_account failed',err);
    const raw=String(err.message||'');let msg='تعذر حفظ الحساب.';
    if(raw.includes('username already exists')||raw.includes('duplicate')||raw.includes('unique'))msg='اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.';
    else if(raw.includes('not authorized'))msg='ليس لديك صلاحية حفظ الحساب.';
    else if(raw.includes('invalid account status'))msg='حالة الحساب غير صحيحة.';
    else if(raw) msg+=' '+raw.replace(/\n/g,' ').slice(0,220);
    $('accountError').textContent=msg;$('accountError').classList.remove('hide');
  }finally{submit.disabled=false;submit.textContent=originalText;}
 }

 function openAudit(id){const x=state.audit.find(a=>a.id===id);if(!x)return;const details=x.details||{};$('auditDetails').innerHTML=`<div class="detail-grid"><div class="detail-item"><b>العملية</b>${escv(actionLabel(x.action))}</div><div class="detail-item"><b>النتيجة</b>${x.result_status==='failed'?'فشل':'نجاح'}</div><div class="detail-item"><b>الشخص المستهدف</b>${escv(x.person_name||'—')}</div><div class="detail-item"><b>منفذ العملية</b>${escv(x.performed_by_email||'—')}</div><div class="detail-item"><b>التاريخ والوقت</b>${fmtDateHtml(x.created_at)}</div><div class="detail-item"><b>الجهاز والمتصفح</b>${escv(browserLabel(x.user_agent))}</div><div class="detail-item"><b>عنوان IP</b>${escv(x.client_ip||'غير متاح')}</div><div class="detail-item"><b>اسم المستخدم</b>${escv(x.username||'—')}</div></div><h3>تفاصيل التغيير</h3><pre class="json-box">${escv(JSON.stringify(details,null,2))}</pre>`;$('auditDialog').showModal();}
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab,.tab-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab).classList.add('active')}));
  $('addPersonBtn').addEventListener('click',()=>openPerson());$('peopleSearch').addEventListener('input',render);
  ['auditSearch','auditAction'].forEach(id=>$(id)?.addEventListener(id==='auditSearch'?'input':'change',renderAudit));
  ['auditFrom','auditTo'].forEach(id=>$(id)?.addEventListener('change',()=>{syncDateControl(id,id+'Display');renderAudit();}));
  $('birthDateNative')?.addEventListener('change',()=>syncDateControl('birthDateNative','birthDateDisplay'));
  document.querySelectorAll('[data-date-open]').forEach(btn=>btn.addEventListener('click',()=>openNativeDate($(btn.dataset.dateOpen))));
  $('clearAuditFilters')?.addEventListener('click',()=>{['auditSearch','auditAction','auditFrom','auditTo'].forEach(id=>$(id).value='');syncDateControl('auditFrom','auditFromDisplay');syncDateControl('auditTo','auditToDisplay');renderAudit();});
  $('personForm').addEventListener('submit',savePerson);$('accountForm').addEventListener('submit',saveAccount);$('usernameMode').addEventListener('change',applyUsernameMode);
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  document.addEventListener('click',e=>{const ep=e.target.closest('[data-edit-person]');if(ep)openPerson(ep.dataset.editPerson);const ac=e.target.closest('[data-account-person]');if(ac)openAccount(ac.dataset.accountPerson);const au=e.target.closest('[data-audit-id]');if(au)openAudit(au.dataset.auditId)});
  syncDateControl('auditFrom','auditFromDisplay');syncDateControl('auditTo','auditToDisplay');syncDateControl('birthDateNative','birthDateDisplay');load();
 });
})();
