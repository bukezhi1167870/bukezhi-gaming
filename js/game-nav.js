(function () {
  const category = document.currentScript.dataset.category || 'home';
  const bar = document.createElement('div');
  bar.className = 'game-return';
  bar.dataset.category = category;
  bar.style.cssText = 'position:fixed;right:calc(12px + env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));z-index:250;font:13px system-ui;pointer-events:none;';
  const link = document.createElement('a');
  link.href = '../../index.html#' + category;
  link.textContent = '← 返回导航';
  link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:10px 14px;color:#f5f2fa;border:1px solid rgba(255,255,255,.2);border-radius:999px;text-decoration:none;background:rgba(45,36,58,.86);box-shadow:0 3px 12px rgba(0,0,0,.16);backdrop-filter:blur(8px);pointer-events:auto;';
  bar.append(link);
  if (category === 'other') {
    // The bookkeeping app has a fixed sidebar and a mobile menu button.
    bar.style.bottom = 'calc(76px + env(safe-area-inset-bottom))';
  }
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 640px) {
      .game-return {
        position: relative !important;
        z-index: auto !important;
        inset: auto !important;
        display: flex;
        justify-content: flex-end;
        align-self: stretch;
        flex: 0 0 auto;
        padding: 12px max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom));
        background: transparent;
      }
      .game-return[data-category="other"] { justify-content: flex-start; }
    }
  `;
  document.head.append(style);
  document.body.append(bar);
})();
