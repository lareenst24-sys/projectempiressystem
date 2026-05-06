const VIDEO_TOOL_KEY = "personalised_video_tool_blocks_v1";

const videoToolBlocks = [
  {
    type: "youtube",
    title: "YouTube Studio",
    x: 90,
    y: 70,
  },
  {
    type: "chatgpt",
    title: "ChatGPT Script Helper",
    x: 430,
    y: 70,
  },
  {
    type: "notes",
    title: "Video Planner",
    x: 770,
    y: 70,
  },
  {
    type: "notes",
    title: "Timestamp Notes",
    x: 160,
    y: 350,
  },
  {
    type: "notes",
    title: "Upload Checklist",
    x: 500,
    y: 350,
  },
];

let videoToolOpen = false;

function getSavedVideoToolLayout() {
  try {
    return JSON.parse(localStorage.getItem(VIDEO_TOOL_KEY)) || {};
  } catch {
    return {};
  }
}

function saveVideoToolLayout() {
  const layout = {};

  document.querySelectorAll('.sb-card[data-toolset="video"]').forEach((card) => {
    const title = card.dataset.title;
    const textarea = card.querySelector("textarea");

    layout[title] = {
      x: parseFloat(card.style.left) || 0,
      y: parseFloat(card.style.top) || 0,
      w: parseFloat(card.style.width) || 300,
      h: parseFloat(card.style.minHeight) || 180,
      z: parseInt(card.style.zIndex) || 1,
      text: textarea ? textarea.value : "",
    };
  });

  localStorage.setItem(VIDEO_TOOL_KEY, JSON.stringify(layout));
}

function openVideoToolBlocks() {
  if (videoToolOpen) return;

  if (typeof createSB !== "function") {
    console.error("createSB() not found. Make sure video-tool/app.js loads after main app.js.");
    return;
  }

  const savedLayout = getSavedVideoToolLayout();

  videoToolBlocks.forEach((block) => {
    const saved = savedLayout[block.title] || {};

    const card = createSB(block.type, block.title, saved.x ?? block.x, saved.y ?? block.y, {
      ...saved,
      title: block.title,
      toolset: "video",
    });

    card.dataset.toolset = "video";

    const textarea = card.querySelector("textarea");

    if (textarea && saved.text) {
      textarea.value = saved.text;
    }

    textarea?.addEventListener("input", saveVideoToolLayout);
  });

  videoToolOpen = true;
  document.body.classList.add("video-tool-active");
}

function closeVideoToolBlocks() {
  saveVideoToolLayout();

  document.querySelectorAll('.sb-card[data-toolset="video"]').forEach((card) => {
    card.remove();
  });

  if (typeof updateStatus === "function") {
    updateStatus();
  }

  videoToolOpen = false;
  document.body.classList.remove("video-tool-active");
}

function toggleVideoToolBlocks() {
  if (videoToolOpen) {
    closeVideoToolBlocks();
  } else {
    openVideoToolBlocks();
  }
}

const openVideoToolBtn = document.getElementById("openVideoToolBtn");

if (openVideoToolBtn) {
  openVideoToolBtn.addEventListener("click", toggleVideoToolBlocks);
}
