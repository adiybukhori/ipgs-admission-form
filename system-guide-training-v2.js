(function loadLegacyGuideTrainingV2(){
  if(window.__ipgsLegacyGuideV2Loaded)return;
  window.__ipgsLegacyGuideV2Loaded=true;
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/gh/adiybukhori/ipgs-admission-form@cdafa47034cef3ddaa21e98f2fc920cc19492536/system-guide-training-v2.js';
  script.async=false;
  document.head.appendChild(script);
})();

(function enhanceAccLoginUi(){
  function init(){
    const passwordInput=document.getElementById('password');
    const usernameInput=document.getElementById('username');
    if(!passwordInput||!usernameInput||document.getElementById('ipgsRememberMe'))return;

    const style=document.createElement('style');
    style.textContent='.ipgs-password-wrap{position:relative;display:flex;align-items:center}.ipgs-password-wrap input{padding-right:72px!important}.ipgs-password-toggle{position:absolute;right:7px;border:0;background:transparent;color:var(--purple);font-size:11px;font-weight:800;padding:6px 7px;border-radius:8px}.ipgs-password-toggle:hover{background:var(--purpleSoft)}.ipgs-login-options{display:flex;align-items:center;gap:8px;margin:-2px 0 14px;font-size:12px;color:var(--muted)}.ipgs-remember-label{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none}.ipgs-remember-label input{width:15px;height:15px;accent-color:var(--purple)}';
    document.head.appendChild(style);

    const wrap=document.createElement('div');
    wrap.className='ipgs-password-wrap';
    passwordInput.parentNode.insertBefore(wrap,passwordInput);
    wrap.appendChild(passwordInput);

    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='ipgs-password-toggle';
    toggle.textContent='Show';
    toggle.onclick=function(){
      const show=passwordInput.type==='password';
      passwordInput.type=show?'text':'password';
      toggle.textContent=show?'Hide':'Show';
      passwordInput.focus();
    };
    wrap.appendChild(toggle);

    const options=document.createElement('div');
    options.className='ipgs-login-options';
    options.innerHTML='<label class="ipgs-remember-label"><input id="ipgsRememberMe" type="checkbox"> Remember me</label><span style="font-size:10px;color:#8a90a0">Browser autofill</span>';
    wrap.closest('.field')?.insertAdjacentElement('afterend',options);

    const remember=document.getElementById('ipgsRememberMe');
    remember.checked=localStorage.getItem('ipgsAdminRememberMe')==='1';
    remember.addEventListener('change',()=>{
      if(remember.checked)localStorage.setItem('ipgsAdminRememberMe','1');
      else localStorage.removeItem('ipgsAdminRememberMe');
    });

    usernameInput.setAttribute('autocomplete','username');
    passwordInput.setAttribute('autocomplete','current-password');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
