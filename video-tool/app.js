/* =========================
   VIDEO TOOL LOGIC
   video-tool/app.js
========================= */

const videoToolBlocks = [
  {
    type: "youtube",
    title: "YouTube Studio",
    x: 90,
    y: 70,
    w: 310,
    h: 190,
  },
  {
    type: "chatgpt",
    title: "ChatGPT Script Helper",
    x: 430,
    y: 70,
    w: 320,
    h: 210,
  },
  {
    type: "planner",
    title: "Video Planner",
    x: 770,
    y: 70,
    w: 340,
    h: 230,
  },
  {
    type: "timestamp",
    title: "Timestamp Notes",
    x: 160,
    y: 350,
    w: 330,
    h: 230,
  },
  {
    type: "checklist",
    title: "Upload Checklist",
    x: 520,
    y: 350,
    w: 320,
    h: 210,
  },
  {
    type: "links",
    title: "Creator Tool Links",
    x: 880,
    y: 350,
    w: 300,
    h: 170,
  },
];

function toggleVideoTool() {
  if (!window.BlockSystem) {
    console.error("BlockSystem not found. Check script order: app.js, blocks/block.js, video-tool/app.js");
    return;
  }

  const isOpen = window.BlockSystem.toggleToolset("video", videoToolBlocks);

  document.body.classList.toggle("video-tool-active", isOpen);
}

function syncVideoToolActiveState() {
  if (!window.BlockSystem) return;

  const isOpen = window.BlockSystem.isToolsetOpen("video");
  document.body.classList.toggle("video-tool-active", isOpen);
}

const openVideoToolBtn = document.getElementById("openVideoToolBtn");

if (openVideoToolBtn) {
  openVideoToolBtn.addEventListener("click", toggleVideoTool);
}

syncVideoToolActiveState();
