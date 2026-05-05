const STORE_KEY = "personalised_tools_canvas_v2";
const THEME_KEY = "personalised_tools_theme_v1";

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
let saveTimer;

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

  emptyState.classList.toggle("hidden", tools.length > 0);
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

  const x = (event.clientX - rect.left - canvasX) / scale - dragOffsetX;
  const y = (event.clientY - rect.top - canvasY) / scale - dragOffsetY;

  el.style.left = x + "px";
  el.style.top = y + "px";
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

  const x = (touch.clientX - rect.left - canvasX) / scale - dragOffsetX;
  const y = (touch.clientY - rect.top - canvasY) / scale - dragOffsetY;

  el.style.left = x + "px";
  el.style.top = y + "px";
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

  function move(e) {
    el.style.width = Math.max(220, startW + (e.clientX - startX) / scale) + "px";
    el.style.minHeight = Math.max(130, startH + (e.clientY - startY) / scale) + "px";
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

function applyCanvasTransform() {
  canvas.style.transform = `translate(${canvasX}px, ${canvasY}px) scale(${scale})`;

  canvasWrap.style.setProperty("--cx", canvasX + "px");
  canvasWrap.style.setProperty("--cy", canvasY + "px");

  posChip.textContent = `x:${Math.round(-canvasX / scale)} y:${Math.round(-canvasY / scale)}`;
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
  const clickedTop = event.target.closest(".top-frame");
  const clickedDock = event.target.closest(".bottom-dock");
  const clickedRail = event.target.closest(".side-rail");

  if (clickedTool || clickedTop || clickedDock || clickedRail) return;

  isPanning = true;
  panStartX = event.clientX - canvasX;
  panStartY = event.clientY - canvasY;

  canvasWrap.classList.add("panning");
}

function panMove(event) {
  if (!isPanning) return;

  canvasX = event.clientX - panStartX;
  canvasY = event.clientY - panStartY;

  applyCanvasTransform();
}

function stopPan() {
  if (!isPanning) return;

  isPanning = false;
  canvasWrap.classList.remove("panning");

  saveTools();
}

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
  saveChip.textContent = "Saving...";

  clearTimeout(saveTimer);

  saveTimer = setTimeout(saveTools, 500);
}

function showSaved() {
  saveChip.textContent = "Saved ✓";
}

function updateStatus() {
  countChip.textContent = `${tools.length} tool${tools.length === 1 ? "" : "s"}`;
  posChip.textContent = `x:${Math.round(-canvasX / scale)} y:${Math.round(-canvasY / scale)}`;
}

function toggleTheme() {
  document.body.classList.toggle("light");

  const isLight = document.body.classList.contains("light");

  themeBtn.textContent = isLight ? "☀" : "☾";

  localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
}

function loadTheme() {
  if (localStorage.getItem(THEME_KEY) === "light") {
    document.body.classList.add("light");
    themeBtn.textContent = "☀";
  }
}

function toggleLock() {
  locked = !locked;

  lockBtn.textContent = locked ? "🔒" : "🔓";
  lockBtn.classList.toggle("active", locked);

  toast(locked ? "Canvas locked" : "Canvas unlocked");
}

function clearAll() {
  if (!confirm("Clear all tools from this browser?")) return;

  tools = [];

  localStorage.removeItem(STORE_KEY);

  renderTools();
  toast("Cleared");
}

function toast(message) {
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

fitBtn.addEventListener("click", fitView);
dockFit.addEventListener("click", fitView);
resetViewBtn.addEventListener("click", fitView);

themeBtn.addEventListener("click", toggleTheme);
lockBtn.addEventListener("click", toggleLock);
clearBtn.addEventListener("click", clearAll);
saveBtn.addEventListener("click", saveTools);

zoomInBtn.addEventListener("click", () => zoom(0.1));
zoomOutBtn.addEventListener("click", () => zoom(-0.1));

canvasWrap.addEventListener("mousedown", startPan);

document.addEventListener("mousemove", panMove);
document.addEventListener("mouseup", stopPan);

canvasWrap.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    zoom(event.deltaY > 0 ? -0.07 : 0.07);
  },
  { passive: false }
);

document.addEventListener("keydown", (event) => {
  const tag = event.target.tagName;

  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  if (event.key === "+" || event.key === "=") zoom(0.1);
  if (event.key === "-") zoom(-0.1);
  if (event.key.toLowerCase() === "f") fitView();
  if (event.key.toLowerCase() === "l") toggleLock();
  if (event.key.toLowerCase() === "t") toggleTheme();
});

loadTheme();
loadTools();
applyCanvasTransform();
renderTools();
