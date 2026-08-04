(function(){
  const root = document.getElementById('dashboardRoot');
  const loadError = document.getElementById('loadError');

  function setText(selector, value){
    document.querySelectorAll(selector).forEach(el => { el.textContent = value; });
  }
  function safeNumber(value){ return Number.isFinite(Number(value)) ? Number(value) : 0; }
  function formatDashboardDate(date = new Date()){
    const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `${days[date.getDay()]}، ${String(date.getDate()).padStart(2,'0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
  function formatTime(date = new Date()){
    let h = date.getHours();
    const period = h >= 12 ? 'مساءً' : 'صباحًا';
    h = h % 12 || 12;
    return `${String(h).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')} ${period}`;
  }
  function relativeDate(value){
    if(!value) return '—';
    const d = new Date(value); if(Number.isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff/60000);
    if(minutes < 1) return 'الآن';
    if(minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes/60);
    if(hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours/24);
    if(days < 7) return `منذ ${days} يوم`;
    return formatDashboardDate(d);
  }

  async function getRows(path){
    const res = await api(path);
    if(!res.ok) throw new Error(await res.text());
    return res.json();
  }
  async function countRows(table, filter=''){
    const url = `/rest/v1/${table}?select=id${filter ? '&'+filter : ''}`;
    const rows = await getRows(url);
    return rows.length;
  }
  async function countFirstAvailable(tableNames){
    for(const table of tableNames){
      try{return await countRows(table);}catch(e){/* try next compatible table */}
    }
    return 0;
  }

  function renderRecent(rows){
    const box = document.getElementById('recentRegistrations');
    if(!box) return;
    if(!rows.length){ box.innerHTML = '<div class="empty-dashboard">لا توجد طلبات تسجيل بعد.</div>'; return; }
    box.innerHTML = rows.slice(0,5).map(r => {
      const status = statusLabel(r.status || 'new');
      return `<a class="activity-item" href="registrations.html"><div><strong>${esc(r.full_name || 'طلب تسجيل')}</strong><small>${esc(r.country_city || 'الموقع غير محدد')} · ${esc(relativeDate(r.created_at))}</small></div><span class="badge">${esc(status)}</span></a>`;
    }).join('');
  }

  async function loadDashboard(){
    const ok = await requireAdmin();
    if(!ok) return;
    document.getElementById('dashboardDate').textContent = formatDashboardDate();
    try{
      const registrationsPromise = getRows('/rest/v1/registrations?select=id,full_name,country_city,status,created_at&order=created_at.desc&limit=50');
      const studentsPromise = countFirstAvailable(['students']);
      const teachersPromise = countFirstAvailable(['teachers','people']);
      const peoplePromise = countFirstAvailable(['people','platform_people']);
      const accountsPromise = countFirstAvailable(['people_accounts','platform_accounts','user_accounts']);

      const [registrations, students, teachers, people, accounts] = await Promise.all([
        registrationsPromise, studentsPromise, teachersPromise, peoplePromise, accountsPromise
      ]);
      const newCount = registrations.filter(r => (r.status || 'new') === 'new').length;
      const contacted = registrations.filter(r => (r.status || 'new') === 'contacted').length;
      const withoutAccount = Math.max(0, safeNumber(people) - safeNumber(accounts));

      setText('[data-dashboard-kpi="students"]', students);
      setText('[data-dashboard-kpi="teachers"]', teachers);
      setText('[data-dashboard-kpi="people"]', people);
      setText('[data-dashboard-kpi="registrations"]', registrations.length);
      setText('[data-dashboard-kpi="newRegistrations"]', newCount);
      setText('[data-attention="new"]', newCount);
      setText('[data-attention="contacted"]', contacted);
      setText('[data-attention="withoutAccount"]', withoutAccount);
      renderRecent(registrations);
      document.getElementById('dbStatus').textContent = 'متصل';
      document.getElementById('lastRefresh').textContent = formatTime();
    }catch(err){
      console.error('Dashboard load error:', err);
      loadError?.classList.remove('hide');
      document.getElementById('dbStatus').textContent = 'تعذر التحقق';
      document.getElementById('recentRegistrations').innerHTML = '<div class="empty-dashboard">تعذر تحميل أحدث الطلبات.</div>';
    }finally{
      root?.classList.remove('dashboard-loading');
    }
  }

  document.addEventListener('click', e => {
    const demo = e.target.closest('[data-demo-alert]');
    if(demo){ e.preventDefault(); alert('هذه الوحدة ضمن مرحلة لاحقة من النظام.'); }
  });
  loadDashboard();
})();
