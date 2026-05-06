/* =========================
   REUSABLE BLOCK SYSTEM
   blocks/block.js
========================= */

(function () {
  const BLOCK_PREFIX = "personalised_blocks_";

  let board = null;
  let zIndex = 100;
  const openToolsets = new Set();

  function getMain() {
    return window.MainApp || {};
  }

  function getCanvas() {
    return getMain().canvas || document.getElementById("canvas");
  }

  function getScale() {
    return getMain().scale || 1;
  }

  function isLocked() {
    return typeof getMain().isLocked === "function" ? getMain().isLocked() : false;
  }

  function toast(message) {
    if (typeof getMain().toast === "function") {
      getMain().toast(message);
    }
  }

  function updateStatus() {
    if (typeof getMain().updateStatus === "function") {
      getMain().updateStatus();
    }
  }

  function ensureBoard() {
    if (board) return board;

    board = document.createElement("div");
    board.className = "block-board";
    board.id = "blockBoard";

    const canvas = getCanvas();

    if (canvas) {
      canvas.appendChild(board);
    }

    return board;
  }

  function storageKey(toolset) {
    return `${BLOCK_PREFIX}${toolset}`;
  }

  function safeId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "block-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getTemplate(type, block = {}) {
    const templates = {
      notes: {
        icon: "📝",
        typeLabel: "Notes",
        color: "linear-gradient(135deg, var(--purple), #5b38c6)",
        title: "Notes",
        body: `<textarea class="block-note" placeholder="Write anything..."></textarea>`,
      },

      planner: {
        icon: "🎬",
        typeLabel: "Planner",
        color: "linear-gradient(135deg, var(--purple), #5b38c6)",
        title: "Video Planner",
        body: `
          <textarea class="block-note" placeholder="Video idea, hook, script notes, title options..."></textarea>
        `,
      },

      timestamp: {
        icon: "⏱",
        typeLabel: "Timeline",
        color: "linear-gradient(135deg, var(--blue), #315ed0)",
        title: "Timestamp Notes",
        body: `
          <textarea class="block-note" placeholder="00:00 Intro&#10;00:30 Main point&#10;01:15 Edit note..."></textarea>
        `,
      },

      checklist: {
        icon: "✅",
        typeLabel: "Checklist",
        color: "linear-gradient(135deg, var(--gold), #9b7929)",
        title: "Upload Checklist",
        body: `
          <div class="block-row"><span class="block-dot"></span><b>Title ready</b><span class="block-right">todo</span></div>
          <div class="block-row"><span class="block-dot" style="background:var(--gold);"></span><b>Thumbnail ready</b><span class="block-right">todo</span></div>
          <div class="block-row"><span class="block-dot" style="background:var(--blue);"></span><b>Description ready</b><span class="block-right">todo</span></div>
          <div class="block-row"><span class="block-dot" style="background:var(--green);"></span><b>Tags ready</b><span class="block-right">todo</span></div>
        `,
      },

      youtube: {
        icon: "▶",
        typeLabel: "YouTube",
        color: "linear-gradient(135deg, #ff3545, #8e1b25)",
        title: "YouTube Studio",
        body: `
          <div class="block-actions">
            <a class="block-action-btn red" href="https://studio.youtube.com/" target="_blank" rel="noopener">Open Studio</a>
            <a class="block-action-btn" href="https://www.youtube.com/" target="_blank" rel="noopener">Open YouTube</a>
          </div>
          <div style="height:12px;"></div>
          <div class="block-row"><span class="block-dot" style="background:#ff3545;"></span><b>Dashboard</b><span class="block-right">external</span></div>
          <div class="block-row"><span class="block-dot" style="background:var(--gold);"></span><b>Upload planner</b><span class="block-right">later</span></div>
          <div class="block-row"><span class="block-dot" style="background:var(--blue);"></span><b>Editor notes</b><span class="block-right">later</span></div>
        `,
      },

      chatgpt: {
        icon: "🤖",
        typeLabel: "AI Tool",
        color: "linear-gradient(135deg, var(--green), #167c45)",
        title: "ChatGPT Helper",
        body: `
          <div class="block-actions">
            <a class="block-action-btn gold" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a>
          </div>
          <div style="height:12px;"></div>
          <div class="block-row"><span class="block-dot" style="background:var(--green);"></span><b>Generate title ideas</b><span class="block-right">prompt</span></div>
          <div class="block-row"><span class="block-dot" style="background:var(--purple);"></span><b>Rewrite hook</b><span class="block-right">prompt</span></div>
          <div class="block-row"><span class="block-dot" style="background:var(--gold);"></span><b>Create description</b><span class="block-right">prompt</span></div>
        `,
      },

      links: {
        icon: "🔗",
        typeLabel: "Links",
        color: "linear-gradient(135deg, var(--blue), #315ed0)",
        title: "Tool Links",
        body: `
          <div class="block-actions">
            <a class="block-action-btn" href="https://studio.youtube.com/" target="_blank" rel="noopener">YouTube Studio</a>
            <a class="block-action-btn" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
          </div>
        `,
      },

      stats: {
        icon: "📊",
        typeLabel: "Stats",
        color: "linear-gradient(135deg, var(--purple), #5b38c6)",
        title: "Stats",
        body: `
          <div class="block-stat-grid">
            <div class="block-stat"><b style="color:var(--gold);">0</b><span>Videos</span><small>saved</small></div>
            <div class="block-stat"><b style="color:var(--blue);">0</b><span>Ideas</span><small>planned</small></div>
            <div class="block-stat"><b style="color:var(--purple2);">0</b><span>Scripts</span><small>drafted</small></div>
            <div class="block-stat"><b>0</b><span>Uploads</span><small>ready</small></div>
          </div>
        `,
      },
    };

    const fallback = templates.notes;
    const template = templates[type] || fallback;

    return {
      icon: block.icon || template.icon,
      typeLabel: block.typeLabel || template.typeLabel,
      color: block.color || template.color,
      title: block.title || template.title,
      body: block.body || template.body,
    };
  }

  function create(block = {}) {
    ensureBoard();

    const type = block.type || "notes";
    const template = getTemplate(type, block);

    const card = document.createElement("section");

    card.className = "block-card";
    card.dataset.id = block.id || safeId();
    card.dataset.type = type;
    card.dataset.title = template.title;

    if (block.toolset) {
      card.dataset.toolset = block.toolset;
    }

    card.style.left = (block.x ?? 120) + "px";
    card.style.top = (block.y ?? 120) + "px";
    card.style.width = (block.w ?? 300) + "px";
    card.style.minHeight = (block.h ?? 180) + "px";
    card.style.zIndex = block.z ?? ++zIndex;

    card.innerHTML = `
      <div class="block-head">
        <div class="block-icon" style="background:${template.color};">${template.icon}</div>

        <div class="block-title-box">
          <div class="block-title">${escapeHtml(template.title)}</div>
          <div class="block-type">${escapeHtml(template.typeLabel)}</div>
        </div>

        <button class="block-close" title="Remove">×</button>
      </div>

      <div class="block-body">
        ${template.body}
      </div>

      <div class="block-resize"></div>
    `;

    board.appendChild(card);
    bind(card);

    const textarea = card.querySelector("textarea");
    if (textarea && block.text) {
      textarea.value = block.text;
    }

    updateStatus();

    return card;
  }

  function bind(card) {
    const head = card.querySelector(".block-head");
    const close = card.querySelector(".block-close");
    const resize = card.querySelector(".block-resize");

    head.addEventListener("mousedown", (event) => startDrag(event, card));
    head.addEventListener("touchstart", (event) => startTouchDrag(event, card), {
      passive: false,
    });

    close.addEventListener("click", () => {
      const toolset = card.dataset.toolset;
      card.remove();

      if (toolset) saveToolset(toolset);
      updateStatus();
    });

    resize.addEventListener("mousedown", (event) => startResize(event, card));

    card.querySelectorAll("textarea").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const toolset = card.dataset.toolset;
        if (toolset) saveToolset(toolset);
      });
    });
  }

  function startDrag(event, card) {
    if (isLocked()) return;

    event.stopPropagation();

    card.classList.add("dragging");
    card.style.zIndex = ++zIndex;

    const scale = getScale();
    const rect = card.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    const offsetX = (event.clientX - rect.left) / scale;
    const offsetY = (event.clientY - rect.top) / scale;

    let frame = null;
    let nextX = parseFloat(card.style.left) || 0;
    let nextY = parseFloat(card.style.top) || 0;

    function move(e) {
      nextX = (e.clientX - boardRect.left) / scale - offsetX;
      nextY = (e.clientY - boardRect.top) / scale - offsetY;

      if (frame) return;

      frame = requestAnimationFrame(() => {
        card.style.left = nextX + "px";
        card.style.top = nextY + "px";
        frame = null;
      });
    }

    function up() {
      card.classList.remove("dragging");

      const toolset = card.dataset.toolset;
      if (toolset) saveToolset(toolset);

      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    }

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  function startTouchDrag(event, card) {
    if (isLocked()) return;

    event.preventDefault();
    event.stopPropagation();

    card.classList.add("dragging");
    card.style.zIndex = ++zIndex;

    const touch = event.touches[0];
    const scale = getScale();
    const rect = card.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    const offsetX = (touch.clientX - rect.left) / scale;
    const offsetY = (touch.clientY - rect.top) / scale;

    function move(e) {
      e.preventDefault();

      const t = e.touches[0];

      const x = (t.clientX - boardRect.left) / scale - offsetX;
      const y = (t.clientY - boardRect.top) / scale - offsetY;

      card.style.left = x + "px";
      card.style.top = y + "px";
    }

    function up() {
      card.classList.remove("dragging");

      const toolset = card.dataset.toolset;
      if (toolset) saveToolset(toolset);

      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", up);
    }

    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", up);
  }

  function startResize(event, card) {
    if (isLocked()) return;

    event.stopPropagation();

    const scale = getScale();
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = card.offsetWidth;
    const startH = card.offsetHeight;

    let frame = null;
    let nextW = startW;
    let nextH = startH;

    function move(e) {
      nextW = Math.max(220, startW + (e.clientX - startX) / scale);
      nextH = Math.max(150, startH + (e.clientY - startY) / scale);

      if (frame) return;

      frame = requestAnimationFrame(() => {
        card.style.width = nextW + "px";
        card.style.minHeight = nextH + "px";
        frame = null;
      });
    }

    function up() {
      const toolset = card.dataset.toolset;
      if (toolset) saveToolset(toolset);

      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    }

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  function getCardsByToolset(toolset) {
    ensureBoard();
    return Array.from(document.querySelectorAll(`.block-card[data-toolset="${toolset}"]`));
  }

  function serializeCard(card) {
    const textarea = card.querySelector("textarea");

    return {
      id: card.dataset.id,
      type: card.dataset.type,
      title: card.dataset.title,
      toolset: card.dataset.toolset,
      x: parseFloat(card.style.left) || 0,
      y: parseFloat(card.style.top) || 0,
      w: parseFloat(card.style.width) || 300,
      h: parseFloat(card.style.minHeight) || 180,
      z: parseInt(card.style.zIndex, 10) || 1,
      text: textarea ? textarea.value : "",
    };
  }

  function saveToolset(toolset) {
    const cards = getCardsByToolset(toolset).map(serializeCard);
    localStorage.setItem(storageKey(toolset), JSON.stringify(cards));
    updateStatus();
  }

  function loadToolset(toolset, fallbackBlocks = []) {
    let saved = [];

    try {
      saved = JSON.parse(localStorage.getItem(storageKey(toolset))) || [];
    } catch {
      saved = [];
    }

    const source = saved.length ? saved : fallbackBlocks;

    source.forEach((block) => {
      create({
        ...block,
        toolset,
      });
    });

    openToolsets.add(toolset);
    updateStatus();
  }

  function removeToolset(toolset) {
    saveToolset(toolset);

    getCardsByToolset(toolset).forEach((card) => {
      card.remove();
    });

    openToolsets.delete(toolset);
    updateStatus();
  }

  function isToolsetOpen(toolset) {
    return getCardsByToolset(toolset).length > 0 || openToolsets.has(toolset);
  }

  function toggleToolset(toolset, blocks = []) {
    if (isToolsetOpen(toolset)) {
      removeToolset(toolset);
      return false;
    }

    loadToolset(toolset, blocks);
    return true;
  }

  function count() {
    return document.querySelectorAll(".block-card").length;
  }

  function clearAll() {
    document.querySelectorAll(".block-card").forEach((card) => card.remove());

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(BLOCK_PREFIX)) {
        localStorage.removeItem(key);
      }
    });

    openToolsets.clear();
    updateStatus();
  }

  window.BlockSystem = {
    create,
    toggleToolset,
    loadToolset,
    removeToolset,
    saveToolset,
    isToolsetOpen,
    clearAll,
    count,
  };
})();
