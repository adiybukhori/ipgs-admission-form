(function loadGuideTrainingV2AndLatest(){
  if(window.__ipgsGuideV2BootstrapLoaded)return;
  window.__ipgsGuideV2BootstrapLoaded=true;

  function loadLatest(){
    if(window.__ipgsLatestGuidePatchRequested)return;
    window.__ipgsLatestGuidePatchRequested=true;
    const patch=document.createElement('script');
    patch.src='/system-guide-training-latest.js?v=20261002';
    patch.async=false;
    document.head.appendChild(patch);
  }

  const legacy=document.createElement('script');
  legacy.src='https://cdn.jsdelivr.net/gh/adiybukhori/ipgs-admission-form@cdafa47034cef3ddaa21e98f2fc920cc19492536/system-guide-training-v2.js';
  legacy.async=false;
  legacy.onload=loadLatest;
  legacy.onerror=loadLatest;
  document.head.appendChild(legacy);
})();
