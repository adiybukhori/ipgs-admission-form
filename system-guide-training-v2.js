(function loadGuideTrainingV2AndLatest(){
  if(window.__ipgsGuideV2BootstrapLoaded)return;
  window.__ipgsGuideV2BootstrapLoaded=true;

  function loadScript(src,flag){
    if(flag&&window[flag])return;
    if(flag)window[flag]=true;
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    document.head.appendChild(script);
    return script;
  }

  loadScript('/acc-login-ui.js?v=20261002','__ipgsAccLoginUiRequested');

  const legacy=document.createElement('script');
  legacy.src='https://cdn.jsdelivr.net/gh/adiybukhori/ipgs-admission-form@cdafa47034cef3ddaa21e98f2fc920cc19492536/system-guide-training-v2.js';
  legacy.async=false;
  legacy.onload=function(){loadScript('/system-guide-training-latest.js?v=20261002','__ipgsLatestGuidePatchRequested')};
  legacy.onerror=function(){loadScript('/system-guide-training-latest.js?v=20261002','__ipgsLatestGuidePatchRequested')};
  document.head.appendChild(legacy);
})();
