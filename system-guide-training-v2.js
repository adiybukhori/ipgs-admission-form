(function loadLegacyGuideTrainingV2(){
  if(window.__ipgsLegacyGuideV2Loaded)return;
  window.__ipgsLegacyGuideV2Loaded=true;
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/gh/adiybukhori/ipgs-admission-form@cdafa47/system-guide-training-v2.js';
  script.async=false;
  document.head.appendChild(script);
})();

(function enhanceAccLogin(){
  const REMEMBER_FLAG='ipgsAdminRememberMe';

  function init(){
    const passwordInput=document.getElementById('password');
    const usernameInput=document.getElementById('username');
    const loginView=document.getElementById('loginView');
    const appView=document.getElementById('appView');
    if(!passwordInput||!usernameInput||!loginView||!appView||document.getElementById('ipgsRememberMe'))return;

    const style=document.createElement('style');
    style.textContent=`
      .ipgs-password-wrap{position:relative;display:flex;align-items:center}
      .ipgs-password-wrap input{padding-right:72px!important}
      .ipgs-password-toggle{position:absolute;right:7px;border:0;background:transparent;color:var(--purple);font-size:11px;font-weight:800;padding:6px 7px;border-radius:8px}
      .ipgs-password-toggle:hover{background:var(--purpleSoft)}
      .ipgs-login-options{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-2px 0 14px;font-size:12px;color:var(--muted)}
      .ipgs-remember-label{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none}
      .ipgs-remember-label input{width:15px;height:15px;accent-color:var(--purple)}
      .ipgs-device-note{font-size:10px;color:#8a90a0}
    `;
    document.head.appendChild(style);

    const wrap=document.createElement('div');
    wrap.className='ipgs-password-wrap';
    passwordInput.parentNode.insertBefore(wrap,passwordInput);
    wrap.appendChild(passwordInput);

    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='ipgs-password-toggle';
    toggle.textContent='Show';
    toggle.setAttribute('aria-label','Show password');
    toggle.addEventListener('click',()=>{
      const showing=passwordInput.type==='text';
      passwordInput.type=showing?'password':'text';
      toggle.textContent=showing?'Show':'Hide';
      toggle.setAttribute('aria-label',showing?'Show password':'Hide password');
      passwordInput.focus();
    });
    wrap.appendChild(toggle);

    const options=document.createElement('div');
    options.className='ipgs-login-options';
    options.innerHTML='<label class="ipgs-remember-label"><input id="ipgsRememberMe" type="checkbox"> Remember me</label><span class="ipgs-device-note">Uses browser password manager</span>';
    const field=wrap.closest('.field');
    field?.insertAdjacentElement('afterend',options);

    const remember=document.getElementById('ipgsRememberMe');
    remember.checked=localStorage.getItem(REMEMBER_FLAG)==='1';

    const originalLogin=window.login;
    if(typeof originalLogin==='function'){
      window.login=function(){
        const shouldRemember=Boolean(remember.checked);
        const typedPassword=String(passwordInput.value||'');
        const typedUser=String(usernameInput.value||'ipgs');
        originalLogin();
        let checks=0;
        const watcher=setInterval(async()=>{
          checks++;
          const signedIn=!appView.classList.contains('hidden');
          const loginText=String(document.getElementById('loginMessage')?.textContent||'');
          if(signedIn){
            if(shouldRemember){
              localStorage.setItem(REMEMBER_FLAG,'1');
              try{
                if(window.PasswordCredential&&navigator.credentials?.store&&typedPassword){
                  const credential=new PasswordCredential({id:typedUser,password:typedPassword,name:'IPGS Admission Command Center'});
                  await navigator.credentials.store(credential);
                }
              }catch(_){ }
            }else localStorage.removeItem(REMEMBER_FLAG);
            clearInterval(watcher);
          }else if(/invalid|unable|failed/i.test(loginText)||checks>=60){
            clearInterval(watcher);
          }
        },500);
      };
    }

    const originalLogout=window.logout;
    if(typeof originalLogout==='function'){
      window.logout=function(){
        localStorage.removeItem(REMEMBER_FLAG);
        remember.checked=false;
        passwordInput.type='password';
        toggle.textContent='Show';
        originalLogout();
      };
    }

    if(remember.checked&&!sessionStorage.getItem('ipgsAdminPassword')&&navigator.credentials?.get){
      setTimeout(async()=>{
        try{
          const credential=await navigator.credentials.get({password:true,mediation:'optional'});
          if(credential&&credential.type==='password'){
            usernameInput.value=credential.id||'ipgs';
            passwordInput.value=credential.password||'';
            if(passwordInput.value&&loginView&&!loginView.classList.contains('hidden')&&typeof window.login==='function')window.login();
          }
        }catch(_){ }
      },120);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
