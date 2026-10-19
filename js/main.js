(function () {
  /* ========== 工具 ========== */
  const $ = (sel) => document.querySelector(sel);

  /* ========== 卡片模板 ========== */
  function cardHTML(game) {
    const name = game.name || "未命名游戏";
    const url = game.url || "#";
    const image = game.image || "images/placeholder.webp";
    const desc = game.desc || "";
    const tags = Array.isArray(game.tags) ? game.tags : [];

    const tagHTML = tags
      .map((t) => `<span class="tag">${t}</span>`)
      .join("");

    return `
      <div class="card">
        <img src="${image}" alt="${name}" loading="lazy"
             onerror="this.onerror=null;this.src='images/placeholder.webp';" />
        <div class="card-body">
          <h3>${name}</h3>
          <div class="tags">${tagHTML}</div>
          <p class="card-desc">${desc}</p>
          <a class="btn-start" href="${url}" ${window.matchMedia("(max-width: 640px)").matches ? "" : 'target="_blank"'} rel="noopener noreferrer">开始游戏</a>
        </div>
      </div>
    `;
  }

  /* ========== 渲染游戏 ========== */
  function renderGames() {
    const games = window.games || [];

    const homeGames = games.filter(
      (g) => g.category === "single" || g.category === "multi"
    );
    const homeOthers = games.filter((g) => g.category === "other");
    const singleGames = games.filter((g) => g.category === "single");
    const multiGames = games.filter((g) => g.category === "multi");
    const otherGames = games.filter((g) => g.category === "other");

    $("#home-games").innerHTML = homeGames.map(cardHTML).join("");
    $("#home-others").innerHTML = homeOthers.map(cardHTML).join("");
    $("#single-games").innerHTML = singleGames.map(cardHTML).join("");
    $("#multi-games").innerHTML = multiGames.map(cardHTML).join("");
    $("#other-games").innerHTML = otherGames.map(cardHTML).join("");
  }

  /* ========== 渲染更新动态 ========== */
  function renderNews() {
    const list = (window.newsList || []).slice(0, 3);
    const box = $("#news-list");
    if (!box) return;

    box.innerHTML = list
      .map(
        (n) => `
        <details class="news-card">
          <summary>${n.title}</summary>
          <div class="news-time">${n.time}</div>
          <p class="news-content">${n.content}</p>
        </details>
      `
      )
      .join("");
  }

  /* ========== 渲染关于本站 ========== */
  function renderAbout() {
    const box = $("#about-text");
    if (box && window.siteInfo) {
      box.textContent = window.siteInfo.about || "";
    }
  }

  /* ========== 导航切换 ========== */
  function setupNav() {
    const buttons = document.querySelectorAll(".nav-item");
    const pages = document.querySelectorAll(".page");

    function showPage(scroll = false) {
      const requested = location.hash.slice(1);
      const target = Array.from(buttons).some(b => b.dataset.page === requested) ? requested : 'home';
      buttons.forEach(b => {
        const active = b.dataset.page === target;
        b.classList.toggle('active', active);
        if (active) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + target));
      if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
      const active = Array.from(buttons).find(b => b.dataset.page === target);
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    buttons.forEach(btn => btn.addEventListener('click', () => {
      if (location.hash !== '#' + btn.dataset.page) location.hash = btn.dataset.page;
      else showPage(true);
    }));
    window.addEventListener('hashchange', () => showPage(true));
    showPage();
  }

  /* ========== 初始化 ========== */
  renderNews();
  renderGames();
  renderAbout();
  setupNav();
})();