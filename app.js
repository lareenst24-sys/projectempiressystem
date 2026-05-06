const STORE_KEY = "personalised_tools_canvas_v2";
const THEME_KEY = "personalised_tools_theme_v1";
const SB_STORE_KEY = "personalised_tools_sb_blocks_v1";

const canvasWrap = document.getElementById("canvasWrap");
const canvas = document.getElementById("canvas");
const emptyState = document.getElementById("emptyState");

const fitBtn = document.getElementById("fitBtn");
const dockFit = document.getElementById("dockFit");
const themeBtn = document.getElementById("themeBtn");
const lockBtn = document.getElementById("lockBtn");
const clearBtn = document.getElementById("clearBtn");

const saveBtn = document.getElementById("saveBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetViewBtn = document.getElementById("resetViewBtn");

const posChip = document.getElementById("posChip");
const countChip = document.getElementById("countChip");
const saveChip = document.getElementById("saveChip");
const toastWrap = document.getElementById("toastWrap");

let tools = [];
let scale = 1;
let canvasX = 0;
let canvasY = 0;

let isPanning = false;
let panStartX = 0;
let panStartY = 0;

let activeDragId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let zCounter = 20;
let locked = false;
let saveTimer = null;

let panFrame = null;
let nextPanX = 0;
let nextPanY = 0;

let dragFrame = null;
let nextDragX = 0;
let nextDragY = 0;

/* =========================
   OLD BASIC TOOL TEMPLATES
========================= */

const templates = {
  custom: {
    type: "custom",
    icon: "✦",
    color: "linear-gradient(135deg, var(--purple), #5b38c6)",
    title: "Custom Tool",
    body: () => `<textarea class="custom-area" placeholder="Write or plan anything..."></textarea>`,
  },

  note: {
    type: "note",
    icon: "📝",
    color: "linear-gradient(135deg, var(--purple2), #6a45d8)",
    title: "Note",
    body: () => `<textarea class="note-area" placeholder="Write your notes..."></textarea>`,
  },

  tasks: {
    type: "tasks",
    icon: "✅",
    color: "linear-gradient(135deg, var(--blue), #315ed0)",
    title: "Tasks",
    body: () => `
      <div class="task-list">
        <div class="task-row"><span class="check">✓</span><span class="task-text">Plan next step</span></div>
        <div class="task-row"><span class="check">✓</span><span class="task-text">Review progress</span></div>
        <div class="task-row"><span class="check">✓</span><span class="task-text">Finish one important task</span></div>
      </div>
      <input class="task-input" placeholder="Add task and press Enter..." />
    `,
  },
};

function createTool(type = "custom", title = "Custom Tool", x, y, data = {}) {
  const template = templates[type] || templates.custom;

  const id =
    data.id ||
    (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

  const position = getNewToolPosition();

  const tool = {
    id,
    type: template.type,
    icon: template.icon,
    color: template.color,
    title: title || template.title,
    x: x ?? position.x,
    y: y ?? position.y,
    w: data.w || 300,
    h: data.h || null,
    z: data.z || ++zCounter,
    text: data.text || "",
  };

  tools.push(tool);
  saveTools();
  renderTools();
  toast(`${tool.title} added`);
}

function getNewToolPosition() {
  const rect = canvasWrap.getBoundingClientRect();

  return {
    x: (-canvasX + rect.width / 2) / scale - 150 + (Math.random() - 0.5) * 90,
    y: (-canvasY + rect.height / 2) / scale - 90 + (Math.random() - 0.5) * 70,
  };
}

function renderTools() {
  canvas.querySelectorAll(".tool-card").forEach((el) => el.remove());

  tools.forEach((tool) => {
    const el = document.createElement("section");
    el.className = "tool-card";
    el.dataset.id = tool.id;

    el.style.left = tool.x + "px";
    el.style.top = tool.y + "px";
    el.style.width = tool.w + "px";

    if (tool.h) {
      el.style.minHeight = tool.h + "px";
    }

    el.style.zIndex = tool.z;

    const template = templates[tool.type] || templates.custom;

    el.innerHTML = `
      <div class="card-head">
        <div class="card-icon" style="background:${tool.color};">${tool.icon}</div>

        <div class="card-titlebox">
          <div class="card-title">${escapeHtml(tool.title)}</div>
          <div class="card-type">${escapeHtml(tool.type)}</div>
        </div>

        <button class="card-close" title="Delete">×</button>
      </div>

      <div class="card-body">${template.body()}</div>

      <div class="resize-handle"></div>
    `;

    const head = el.querySelector(".card-head");
    const close = el.querySelector(".card-close");
    const resize = el.querySelector(".resize-handle");

    head.addEventListener("mousedown", (event) => startCardDrag(event, el));
    head.addEventListener("touchstart", (event) => startCardTouchDrag(event, el), {
      passive: false,
    });

    close.addEventListener("click", () => deleteTool(tool.id));
    resize.addEventListener("mousedown", (event) => startResize(event, el));

    el.querySelectorAll("textarea").forEach((area) => {
      area.value = tool.text || "";

      area.addEventListener("input", () => {
        const target = tools.find((item) => item.id === tool.id);

        if (target) {
          target.text = area.value;
        }

        scheduleSave();
      });
    });

    el.querySelectorAll(".task-row").forEach((row) => {
      row.addEventListener("click", () => row.classList.toggle("done"));
    });

    const taskInput = el.querySelector(".task-input");

    if (taskInput) {
      taskInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const value = taskInput.value.trim();

        if (!value) return;

        const list = el.querySelector(".task-list");
        const row = document.createElement("div");

        row.className = "task-row";
        row.innerHTML = `<span class="check">✓</span><span class="task-text">${escapeHtml(value)}</span>`;

        row.addEventListener("click", () => row.classList.toggle("done"));

        list.appendChild(row);
        taskInput.value = "";
        scheduleSave();
      });
    }

    canvas.appendChild(el);
  });

  if (emptyState) {
    emptyState.classList.toggle("hidden", tools.length > 0);
  }

  updateStatus();
}

function startCardDrag(event, el) {
  if (locked) return;

  activeDragId = el.dataset.id;

  const rect = el.getBoundingClientRect();

  dragOffsetX = (event.clientX - rect.left) / scale;
  dragOffsetY = (event.clientY - rect.top) / scale;

  el.classList.add("dragging");

  const target = tools.find((item) => item.id === activeDragId);

  if (target) {
    target.z = ++zCounter;
    el.style.zIndex = target.z;
  }

  document.addEventListener("mousemove", cardDragMove);
  document.addEventListener("mouseup", stopCardDrag);
}

function cardDragMove(event) {
  if (!activeDragId) return;

  const el = document.querySelector(`[data-id="${activeDragId}"]`);
  if (!el) return;

  const rect = canvasWrap.getBoundingClientRect();

  nextDragX = (event.clientX - rect.left - canvasX) / scale - dragOffsetX;
  nextDragY = (event.clientY - rect.top - canvasY) / scale - dragOffsetY;

  if (dragFrame) return;

  dragFrame = requestAnimationFrame(() => {
    el.style.left = nextDragX + "px";
    el.style.top = nextDragY + "px";
    dragFrame = null;
  });
}

function stopCardDrag() {
  if (!activeDragId) return;

  const el = document.querySelector(`[data-id="${activeDragId}"]`);
  const target = tools.find((item) => item.id === activeDragId);

  if (el && target) {
    target.x = parseFloat(el.style.left);
    target.y = parseFloat(el.style.top);
    el.classList.remove("dragging");
  }

  activeDragId = null;

  saveTools();

  document.removeEventListener("mousemove", cardDragMove);
  document.removeEventListener("mouseup", stopCardDrag);
}

function startCardTouchDrag(event, el) {
  if (locked) return;

  event.preventDefault();

  const touch = event.touches[0];

  activeDragId = el.dataset.id;

  const rect = el.getBoundingClientRect();

  dragOffsetX = (touch.clientX - rect.left) / scale;
  dragOffsetY = (touch.clientY - rect.top) / scale;

  el.classList.add("dragging");

  document.addEventListener("touchmove", cardTouchMove, { passive: false });
  document.addEventListener("touchend", stopCardTouchDrag);
}

function cardTouchMove(event) {
  if (!activeDragId) return;

  event.preventDefault();

  const touch = event.touches[0];
  const el = document.querySelector(`[data-id="${activeDragId}"]`);
  if (!el) return;

  const rect = canvasWrap.getBoundingClientRect();

  nextDragX = (touch.clientX - rect.left - canvasX) / scale - dragOffsetX;
  nextDragY = (touch.clientY - rect.top - canvasY) / scale - dragOffsetY;

  if (dragFrame) return;

  dragFrame = requestAnimationFrame(() => {
    el.style.left = nextDragX + "px";
    el.style.top = nextDragY + "px";
    dragFrame = null;
  });
}

function stopCardTouchDrag() {
  stopCardDrag();

  document.removeEventListener("touchmove", cardTouchMove);
  document.removeEventListener("touchend", stopCardTouchDrag);
}

function startResize(event, el) {
  event.stopPropagation();

  if (locked) return;

  const id = el.dataset.id;
  const startX = event.clientX;
  const startY = event.clientY;
  const startW = el.offsetWidth;
  const startH = el.offsetHeight;

  let resizeFrame = null;
  let nextW = startW;
  let nextH = startH;

  function move(e) {
    nextW = Math.max(220, startW + (e.clientX - startX) / scale);
    nextH = Math.max(130, startH + (e.clientY - startY) / scale);

    if (resizeFrame) return;

    resizeFrame = requestAnimationFrame(() => {
      el.style.width = nextW + "px";
      el.style.minHeight = nextH + "px";
      resizeFrame = null;
    });
  }

  function up() {
    const target = tools.find((item) => item.id === id);

    if (target) {
      target.w = parseFloat(el.style.width);
      target.h = parseFloat(el.style.minHeight);
      saveTools();
    }

    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

function deleteTool(id) {
  tools = tools.filter((item) => item.id !== id);
  saveTools();
  renderTools();
}

/* =========================
   CANVAS
========================= */

function applyCanvasTransform() {
  canvas.style.transform = `translate3d(${canvasX}px, ${canvasY}px, 0) scale(${scale})`;

  canvasWrap.style.setProperty("--cx", canvasX + "px");
  canvasWrap.style.setProperty("--cy", canvasY + "px");

  if (posChip) {
    posChip.textContent = `x:${Math.round(-canvasX / scale)} y:${Math.round(-canvasY / scale)}`;
  }
}

function zoom(delta) {
  const oldScale = scale;

  scale = Math.min(2.5, Math.max(0.25, scale + delta));

  const rect = canvasWrap.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  canvasX = centerX - (centerX - canvasX) * (scale / oldScale);
  canvasY = centerY - (centerY - canvasY) * (scale / oldScale);

  applyCanvasTransform();
  scheduleSave();
}

function fitView() {
  scale = 1;
  canvasX = 0;
  canvasY = 0;

  applyCanvasTransform();
  saveTools();
}

function startPan(event) {
  if (locked) return;

  const clickedTool = event.target.closest(".tool-card");
  const clickedSB = event.target.closest(".sb-card");
  const clickedTop = event.target.closest(".top-frame");
  const clickedDock = event.target.closest(".bottom-dock");
  const clickedRail = event.target.closest(".side-rail");
  const clickedOverlay = event.target.closest(".video-tool-overlay");

  if (clickedTool || clickedSB || clickedTop || clickedDock || clickedRail || clickedOverlay) return;

  isPanning = true;
  panStartX = event.clientX - canvasX;
  panStartY = event.clientY - canvasY;

  canvasWrap.classList.add("panning");
}

function panMove(event) {
  if (!isPanning) return;

  nextPanX = event.clientX - panStartX;
  nextPanY = event.clientY - panStartY;

  if (panFrame) return;

  panFrame = requestAnimationFrame(() => {
    canvasX = nextPanX;
    canvasY = nextPanY;
    applyCanvasTransform();
    panFrame = null;
  });
}

function stopPan() {
  if (!isPanning) return;

  isPanning = false;
  canvasWrap.classList.remove("panning");

  saveTools();
}

/* =========================
   STORAGE
========================= */

function saveTools() {
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      tools,
      zCounter,
      canvasX,
      canvasY,
      scale,
    })
  );

  showSaved();
  updateStatus();
}

function loadTools() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));

    if (!saved) return;

    tools = saved.tools || [];
    zCounter = saved.zCounter || 20;
    canvasX = saved.canvasX || 0;
    canvasY = saved.canvasY || 0;
    scale = saved.scale || 1;
  } catch (error) {
    tools = [];
  }
}

function scheduleSave() {
  if (saveChip) {
    saveChip.textContent = "Saving...";
  }

  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveTools, 500);
}

function showSaved() {
  if (saveChip) {
    saveChip.textContent = "Saved ✓";
  }
}

function updateStatus() {
  const normalTools = tools.length;
  const sbTools = document.querySelectorAll(".sb-card").length;
  const total = normalTools + sbTools;

  if (countChip) {
    countChip.textContent = `${total} tool${total === 1 ? "" : "s"}`;
  }

  if (posChip) {
    posChip.textContent = `x:${Math.round(-canvasX / scale)} y:${Math.round(-canvasY / scale)}`;
  }
}

/* =========================
   THEME / LOCK / CLEAR
========================= */

function toggleTheme() {
  document.body.classList.toggle("light");

  const isLight = document.body.classList.contains("light");

  if (themeBtn) {
    themeBtn.textContent = isLight ? "☀" : "☾";
  }

  localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
}

function loadTheme() {
  if (localStorage.getItem(THEME_KEY) === "light") {
    document.body.classList.add("light");

    if (themeBtn) {
      themeBtn.textContent = "☀";
    }
  }
}

function toggleLock() {
  locked = !locked;

  if (lockBtn) {
    lockBtn.textContent = locked ? "🔒" : "🔓";
    lockBtn.classList.toggle("active", locked);
  }

  toast(locked ? "Canvas locked" : "Canvas unlocked");
}

function clearAll() {
  if (!confirm("Clear all tools from this browser?")) return;

  tools = [];
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(SB_STORE_KEY);

  if (sbBoard) {
    sbBoard.innerHTML = "";
  }

  renderTools();
  updateStatus();
  toast("Cleared");
}

function toast(message) {
  if (!toastWrap) return;

  const el = document.createElement("div");

  el.className = "toast";
  el.textContent = message;

  toastWrap.appendChild(el);

  setTimeout(() => el.remove(), 2300);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   SB = SMALL BLOCK SYSTEM
   Drag + Resize + Save
========================= */

let sbBoard = null;
let sbZ = 100;

function ensureSBBoard() {
  if (sbBoard) return sbBoard;

  sbBoard = document.createElement("div");
  sbBoard.className = "sb-board";
  sbBoard.id = "sbBoard";

  if (canvas) {
    canvas.appendChild(sbBoard);
  }

  return sbBoard;
}

function createSB(type, title, x = 120, y = 120, data = {}) {
  ensureSBBoard();

  const config = getSBConfig(type, title);

  const id =
    data.id ||
    (crypto.randomUUID ? crypto.randomUUID() : "sb-" + Date.now() + Math.random());

  const card = document.createElement("section");

  card.className = "sb-card";
  card.dataset.id = id;
  card.dataset.type = type;
  card.dataset.title = config.title;

  card.style.left = (data.x ?? x) + "px";
  card.style.top = (data.y ?? y) + "px";
  card.style.width = (data.w ?? 300) + "px";
  card.style.minHeight = (data.h ?? 180) + "px";
  card.style.zIndex = data.z ?? ++sbZ;

  card.innerHTML = `
    <div class="sb-head">
      <div class="sb-icon" style="background:${config.color};">${config.icon}</div>

      <div class="sb-title-box">
        <div class="sb-title">${escapeHtml(config.title)}</div>
        <div class="sb-type">${escapeHtml(config.typeLabel)}</div>
      </div>

      <button class="sb-close" title="Remove">×</button>
    </div>

    <div class="sb-body">
      ${config.body}
    </div>

    <div class="sb-resize"></div>
  `;

  bindSB(card);

  sbBoard.appendChild(card);

  const textarea = card.querySelector("textarea");

  if (textarea && data.text) {
    textarea.value = data.text;
  }

  saveSBs();
  updateStatus();

  return card;
}

function getSBConfig(type, title) {
  const configs = {
    stats: {
      icon: "📊",
      typeLabel: "Stats",
      color: "linear-gradient(135deg, var(--purple), #5b38c6)",
      title: title || "Stats Overview",
      body: `
        <div class="sb-stat-grid">
          <div class="sb-stat">
            <b style="color:var(--gold);">83.6k</b>
            <span>Total revenue</span>
            <small>↑ +18%</small>
          </div>
          <div class="sb-stat">
            <b style="color:var(--blue);">47</b>
            <span>Open tasks</span>
            <small style="color:var(--red);">8 late</small>
          </div>
          <div class="sb-stat">
            <b style="color:var(--purple2);">4</b>
            <span>Businesses</span>
            <small style="color:var(--muted);">active</small>
          </div>
          <div class="sb-stat">
            <b>12</b>
            <span>Projects</span>
            <small>6 on track</small>
          </div>
        </div>
      `,
    },

    finance: {
      icon: "💰",
      typeLabel: "Finance",
      color: "linear-gradient(135deg, var(--gold), #9b7929)",
      title: title || "Finance — Apex",
      body: `
        <div class="sb-bar-block">
          <div class="sb-bar-top">
            <span>Revenue</span>
            <b style="color:var(--green);">£24,800</b>
          </div>
          <div class="sb-track">
            <div class="sb-fill" style="width:78%;background:var(--green);"></div>
          </div>
        </div>

        <div class="sb-bar-block">
          <div class="sb-bar-top">
            <span>Services</span>
            <b style="color:var(--gold);">£19,300</b>
          </div>
          <div class="sb-track">
            <div class="sb-fill" style="width:62%;background:var(--gold);"></div>
          </div>
        </div>

        <div class="sb-bar-block">
          <div class="sb-bar-top">
            <span>Expenses</span>
            <b style="color:var(--red);">£3,200</b>
          </div>
          <div class="sb-track">
            <div class="sb-fill" style="width:18%;background:var(--red);"></div>
          </div>
        </div>
      `,
    },

    business: {
      icon: "🏢",
      typeLabel: "Business",
      color: "linear-gradient(135deg, var(--blue), #315ed0)",
      title: title || "Businesses",
      body: `
        <div class="sb-row">
          <span class="sb-dot"></span>
          <b>Apex Studio</b>
          <span class="sb-right">£24.8k</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--gold);"></span>
          <b>NovaTech Ltd</b>
          <span class="sb-right">£18.2k</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--blue);"></span>
          <b>Koda Retail</b>
          <span class="sb-right">£9.1k</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--green);"></span>
          <b>Volta Media</b>
          <span class="sb-right">£31.5k</span>
        </div>
      `,
    },

    habits: {
      icon: "⚡",
      typeLabel: "Habits",
      color: "linear-gradient(135deg, var(--purple2), #6a45d8)",
      title: title || "Habits Today",
      body: `
        <div class="sb-row">
          <span class="sb-dot"></span>
          <b>Morning run</b>
          <span class="sb-right">🔥 7</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--gold);"></span>
          <b>Read 30 mins</b>
          <span class="sb-right">🔥 12</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--blue);"></span>
          <b>Journal</b>
          <span class="sb-right">3</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--muted2);"></span>
          <b>Meditate</b>
          <span class="sb-right">5</span>
        </div>
      `,
    },

    notes: {
      icon: "📝",
      typeLabel: "Notes",
      color: "linear-gradient(135deg, var(--purple), #5b38c6)",
      title: title || "Notes",
      body: `
        <textarea class="sb-note" placeholder="Write anything..."></textarea>
      `,
    },

    chatgpt: {
      icon: "🤖",
      typeLabel: "AI Tool",
      color: "linear-gradient(135deg, var(--green), #167c45)",
      title: title || "ChatGPT Tool",
      body: `
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--green);"></span>
          <b>Prompt builder</b>
          <span class="sb-right">Later</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--purple);"></span>
          <b>Script helper</b>
          <span class="sb-right">Later</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--gold);"></span>
          <b>Idea generator</b>
          <span class="sb-right">Later</span>
        </div>
      `,
    },

    youtube: {
      icon: "▶",
      typeLabel: "YouTube",
      color: "linear-gradient(135deg, #ff3545, #8e1b25)",
      title: title || "YouTube Studio",
      body: `
        <div class="sb-row">
          <span class="sb-dot" style="background:#ff3545;"></span>
          <b>Studio dashboard</b>
          <span class="sb-right">Link</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--gold);"></span>
          <b>Upload planner</b>
          <span class="sb-right">Later</span>
        </div>
        <div class="sb-row">
          <span class="sb-dot" style="background:var(--blue);"></span>
          <b>Editor notes</b>
          <span class="sb-right">Later</span>
        </div>
      `,
    },
  };

  return configs[type] || configs.notes;
}

function bindSB(card) {
  const head = card.querySelector(".sb-head");
  const closeBtn = card.querySelector(".sb-close");
  const resizeHandle = card.querySelector(".sb-resize");

  head.addEventListener("mousedown", (event) => startSBDrag(event, card));
  head.addEventListener("touchstart", (event) => startSBTouchDrag(event, card), {
    passive: false,
  });

  closeBtn.addEventListener("click", () => {
    card.remove();
    saveSBs();
    updateStatus();
  });

  resizeHandle.addEventListener("mousedown", (event) => startSBResize(event, card));

  card.querySelectorAll("textarea").forEach((textarea) => {
    textarea.addEventListener("input", saveSBs);
  });
}

function startSBDrag(event, card) {
  if (locked) return;

  event.stopPropagation();

  card.classList.add("dragging");
  card.style.zIndex = ++sbZ;

  const rect = card.getBoundingClientRect();
  const boardRect = sbBoard.getBoundingClientRect();

  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  function move(e) {
    const x = e.clientX - boardRect.left - offsetX;
    const y = e.clientY - boardRect.top - offsetY;

    card.style.left = x + "px";
    card.style.top = y + "px";
  }

  function up() {
    card.classList.remove("dragging");

    saveSBs();

    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

function startSBTouchDrag(event, card) {
  if (locked) return;

  event.preventDefault();
  event.stopPropagation();

  card.classList.add("dragging");
  card.style.zIndex = ++sbZ;

  const touch = event.touches[0];
  const rect = card.getBoundingClientRect();
  const boardRect = sbBoard.getBoundingClientRect();

  const offsetX = touch.clientX - rect.left;
  const offsetY = touch.clientY - rect.top;

  function move(e) {
    const t = e.touches[0];

    const x = t.clientX - boardRect.left - offsetX;
    const y = t.clientY - boardRect.top - offsetY;

    card.style.left = x + "px";
    card.style.top = y + "px";
  }

  function up() {
    card.classList.remove("dragging");

    saveSBs();

    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", up);
  }

  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", up);
}

function startSBResize(event, card) {
  if (locked) return;

  event.stopPropagation();

  const startX = event.clientX;
  const startY = event.clientY;
  const startW = card.offsetWidth;
  const startH = card.offsetHeight;

  function move(e) {
    const nextW = Math.max(220, startW + e.clientX - startX);
    const nextH = Math.max(150, startH + e.clientY - startY);

    card.style.width = nextW + "px";
    card.style.minHeight = nextH + "px";
  }

  function up() {
    saveSBs();

    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

function saveSBs() {
  const cards = [];

  document.querySelectorAll(".sb-card").forEach((card) => {
    const textarea = card.querySelector("textarea");

    cards.push({
      id: card.dataset.id,
      type: card.dataset.type,
      title: card.dataset.title,
      x: parseFloat(card.style.left) || 0,
      y: parseFloat(card.style.top) || 0,
      w: parseFloat(card.style.width) || 300,
      h: parseFloat(card.style.minHeight) || 180,
      z: parseInt(card.style.zIndex) || 1,
      text: textarea ? textarea.value : "",
    });
  });

  localStorage.setItem(SB_STORE_KEY, JSON.stringify(cards));
  updateStatus();
}

function loadSBs() {
  ensureSBBoard();

  let saved = [];

  try {
    saved = JSON.parse(localStorage.getItem(SB_STORE_KEY)) || [];
  } catch {
    saved = [];
  }

  if (saved.length === 0) {
    loadDefaultSBs();
    return;
  }

  saved.forEach((item) => {
    createSB(item.type, item.title, item.x, item.y, item);
  });

  updateStatus();
}

function loadDefaultSBs() {
  createSB("stats", "Stats Overview", 60, 50);
  createSB("finance", "Finance — Apex", 390, 40);
  createSB("business", "Businesses", 720, 60);
  createSB("habits", "Habits Today", 620, 330);
  createSB("notes", "Notes", 80, 390);
}

/* =========================
   VIDEO TOOL OVERLAY
========================= */

function openVideoTool() {
  let overlay = document.getElementById("videoToolOverlay");

  if (!overlay) {
    overlay = document.createElement("section");
    overlay.id = "videoToolOverlay";
    overlay.className = "video-tool-overlay";

    overlay.innerHTML = `
      <header class="video-tool-top">
        <div class="video-tool-title">
          <h1>Video Tool</h1>
          <p>Plan videos, track timestamps, and connect your creator tools</p>
        </div>

        <div class="video-tool-actions">
          <button class="icon-btn" id="videoThemeBtn" title="Theme">☾</button>
          <button class="video-close-btn" id="closeVideoToolBtn" title="Close">×</button>
        </div>
      </header>

      <main class="video-tool-main">
        <section class="video-tool-grid">
          <article class="video-card large">
            <div class="video-card-head">
              <div class="video-card-icon">🎬</div>
              <h3>Video Planner</h3>
              <span>Core</span>
            </div>
            <div class="video-card-body">
              <input class="video-input" placeholder="Video title idea..." />
              <input class="video-input" placeholder="Paste YouTube link or reference..." />
              <textarea class="video-textarea" placeholder="Video notes, hook, script idea, or plan..."></textarea>
              <button class="video-main-btn">Save Video Plan</button>
            </div>
          </article>

          <article class="video-card">
            <div class="video-card-head">
              <div class="video-card-icon">⏱</div>
              <h3>Timestamps</h3>
              <span>Notes</span>
            </div>
            <div class="video-card-body">
              <input class="video-input" placeholder="Example: 04:32" />
              <textarea class="video-textarea" placeholder="What happens at this time?"></textarea>
              <button class="video-main-btn">Add Timestamp</button>
            </div>
          </article>

          <article class="video-card">
            <div class="video-card-head">
              <div class="video-card-icon">🔗</div>
              <h3>Integrations</h3>
              <span>Tools</span>
            </div>
            <div class="video-card-body">
              <button class="video-soft-btn" type="button" onclick="createSB('youtube', 'YouTube Studio', 120, 90)">Add YouTube SB</button>
              <button class="video-soft-btn" type="button" onclick="createSB('chatgpt', 'ChatGPT Tool', 460, 90)">Add ChatGPT SB</button>
              <a class="video-soft-btn" href="https://studio.youtube.com/" target="_blank" rel="noopener">Open YouTube Studio</a>
              <a class="video-soft-btn" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a>
            </div>
          </article>

          <article class="video-card">
            <div class="video-card-head">
              <div class="video-card-icon">🧠</div>
              <h3>AI Help</h3>
              <span>Prompt</span>
            </div>
            <div class="video-card-body">
              <div class="video-row"><span class="video-dot"></span>Generate title ideas</div>
              <div class="video-row"><span class="video-dot"></span>Rewrite hook</div>
              <div class="video-row"><span class="video-dot"></span>Create description</div>
              <div class="video-row"><span class="video-dot"></span>Make tags later</div>
            </div>
          </article>

          <article class="video-card large">
            <div class="video-card-head">
              <div class="video-card-icon">📌</div>
              <h3>Saved Video Board</h3>
              <span>Coming next</span>
            </div>
            <div class="video-card-body">
              <div class="video-row"><span class="video-dot"></span>No videos saved yet.</div>
              <div class="video-row"><span class="video-dot"></span>Next we can make this save with localStorage.</div>
              <div class="video-row"><span class="video-dot"></span>Later we can connect APIs or external tools.</div>
            </div>
          </article>
        </section>
      </main>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById("closeVideoToolBtn");
    const videoThemeBtn = document.getElementById("videoThemeBtn");

    closeBtn.addEventListener("click", closeVideoTool);

    videoThemeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light");
      const isLight = document.body.classList.contains("light");
      videoThemeBtn.textContent = isLight ? "☀" : "☾";
      localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
    });
  }

  overlay.classList.add("open");
}

function closeVideoTool() {
  const overlay = document.getElementById("videoToolOverlay");

  if (overlay) {
    overlay.classList.remove("open");
  }
}

/* =========================
   EVENTS
========================= */

if (fitBtn) fitBtn.addEventListener("click", fitView);
if (dockFit) dockFit.addEventListener("click", fitView);
if (resetViewBtn) resetViewBtn.addEventListener("click", fitView);

if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
if (lockBtn) lockBtn.addEventListener("click", toggleLock);
if (clearBtn) clearBtn.addEventListener("click", clearAll);
if (saveBtn) saveBtn.addEventListener("click", saveTools);

if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoom(0.1));
if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoom(-0.1));

if (canvasWrap) {
  canvasWrap.addEventListener("mousedown", startPan);

  canvasWrap.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoom(event.deltaY > 0 ? -0.07 : 0.07);
    },
    { passive: false }
  );
}

document.addEventListener("mousemove", panMove);
document.addEventListener("mouseup", stopPan);

document.addEventListener("keydown", (event) => {
  const tag = event.target.tagName;

  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  if (event.key === "+" || event.key === "=") zoom(0.1);
  if (event.key === "-") zoom(-0.1);
  if (event.key.toLowerCase() === "f") fitView();
  if (event.key.toLowerCase() === "l") toggleLock();
  if (event.key.toLowerCase() === "t") toggleTheme();
});

const openVideoToolBtn = document.getElementById("openVideoToolBtn");

if (openVideoToolBtn) {
  openVideoToolBtn.addEventListener("click", openVideoTool);
}

/* =========================
   START APP
========================= */

loadTheme();
loadTools();
applyCanvasTransform();
renderTools();
loadSBs();
