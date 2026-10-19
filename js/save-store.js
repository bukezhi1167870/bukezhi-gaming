(function () {
  'use strict';
  let lastWarning = 0;
  function warn(message) {
    if (Date.now() - lastWarning < 3000) return;
    lastWarning = Date.now();
    let box = document.getElementById('save-warning');
    if (!box) {
      box = document.createElement('div'); box.id = 'save-warning'; box.setAttribute('role','alert');
      box.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:20000;max-width:90%;padding:12px 18px;border-radius:12px;background:#7c2537;color:white;font:14px/1.6 system-ui;';
      document.body.append(box);
    }
    box.textContent = message;
  }
  window.gameSave = {
    warn,
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (_) { warn('保存失败：浏览器存储不可用或空间不足。请保留当前页面，检查存储权限或释放空间。'); return false; }
    },
    read(key, validate) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const value = JSON.parse(raw);
        if (!validate(value)) throw Error('invalid');
        return value;
      } catch (_) { warn('存档无法读取或内容不完整，原存档已保留。请导入有效备份或开始新游戏。'); return null; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch (_) { warn('无法清理旧存档，请检查浏览器存储权限。'); } },
    integer(n, min, max) { return Number.isInteger(n) && n >= min && n <= max; },
    text(s, max = 2000) { return typeof s === 'string' && s.length <= max; },
    escape(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  };
})();
