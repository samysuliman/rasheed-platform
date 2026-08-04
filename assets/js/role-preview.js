const PORTAL_SESSION_KEY="rasheed_portal_session_v1";
document.addEventListener("DOMContentLoaded",()=>{
  let portal=null;
  try{portal=JSON.parse(localStorage.getItem(PORTAL_SESSION_KEY)||"null");}catch{}
  if(!portal?.access_token){
    location.replace("../login.html");
    return;
  }
  if(portal.is_admin_preview){
    document.getElementById("rolePreviewBanner")?.classList.remove("hide");
  }
});