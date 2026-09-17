(function () {
  /* ========== 工具 ========== */
  const $ = (sel) => document.querySelector(sel);

  /* ========== 卡片模板 ========== */
  function cardHTML(game) {
    const name = game.name || "未命名游戏";
    const url = game.url || "#";
    const image = game.image || "images/placeholder.png";
    const desc = game.desc || "";
    const tags = Array.isArray(game.tags) ? game.tags : [];

    const tagHTML = tags
      .map((t) => `<span class="tag">${t}</span>`)
      .join("");

    return `
      <div class="card">
        <img src="${image}" alt="${name}" loading="lazy"
             onerror="this.onerror=null;this.src='images/placeholder.png';" />
        <div class="card-body">
          <h3>${name}</h3>
          <div class="tags">${tagHTML}</div>
          <p class="card-desc">${desc}</p>
          <a class="btn-start" href="${url}" target="_blank" rel="noopener noreferrer">开始游戏</a>
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
        <div class="news-card">
          <h3>${n.title}</h3>
          <div class="news-time">${n.time}</div>
          <p class="news-content">${n.content}</p>
        </div>
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

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.page;

        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        pages.forEach((p) => {
          p.classList.toggle("active", p.id === "page-" + target);
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  /* ========== 初始化 ========== */
  renderNews();
  renderGames();
  renderAbout();
  setupNav();
})();