// Music: add your tracks to this list and put the files in assets/music/.
// "cover" is optional. Example:
// { title: "Song name", artist: "yukariuni", src: "assets/music/song.mp3", cover: "assets/music/song.webp" },
const TRACKS = [
  { title: "Ecifircas", artist: "Sewerslvt", src: "assets/music/ecifircas.mp3", cover: "assets/music/ecifircas.webp" },
];

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasTracks = TRACKS.length > 0;

// Click to enter. This click also starts the music, because browsers only allow sound after a click.
$("gate").addEventListener(
  "click",
  () => {
    $("gate").classList.add("is-open");
    startMusic();
  },
  { once: true }
);

// The background video stays still for visitors who prefer less motion
if (reduceMotion) $("bg-video").pause();

// Pixel snow: small squares falling slowly
if (!reduceMotion) {
  const canvas = $("snow");
  const ctx = canvas.getContext("2d");
  let flakes = [];

  const spawn = (anywhere) => ({
    x: Math.random() * innerWidth,
    y: anywhere ? Math.random() * innerHeight : -10,
    size: Math.random() * 2 + 1.5,
    vx: Math.random() * 0.4 - 0.2,
    vy: Math.random() * 0.6 + 0.2,
    alpha: Math.random() * 0.5 + 0.3,
  });

  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(90, Math.floor(innerWidth / 14));
    flakes = Array.from({ length: count }, () => spawn(true));
  };

  const draw = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = "#fff";
    for (const f of flakes) {
      f.x += f.vx;
      f.y += f.vy;
      if (f.y > innerHeight + 10 || f.x < -10 || f.x > innerWidth + 10) {
        Object.assign(f, spawn(false));
      }
      ctx.globalAlpha = f.alpha;
      ctx.fillRect(f.x, f.y, f.size, f.size);
    }
    requestAnimationFrame(draw);
  };

  addEventListener("resize", resize);
  resize();
  draw();
}

// Categories: About me, Links, Music
const tabs = [...document.querySelectorAll("[role='tab']")];
const panels = [...document.querySelectorAll("[role='tabpanel']")];
const panelTitle = $("panel-title");
const tabNames = tabs.map((tab) => tab.dataset.tab);

const selectTab = (name, updateHash = true) => {
  for (const tab of tabs) {
    const selected = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) panelTitle.textContent = tab.dataset.label;
  }
  for (const panel of panels) panel.hidden = panel.dataset.panel !== name;
  if (updateHash) history.replaceState(null, "", `#${name}`);
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
    selectTab(next.dataset.tab);
    next.focus();
  });
});

const hash = location.hash.slice(1);
selectTab(tabNames.includes(hash) ? hash : tabNames[0], false);

// Copy the Discord handle
const copyBtn = $("copy-discord");
const copyLabel = $("discord-label");
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("m8na");
    copyLabel.textContent = "Copied!";
  } catch {
    copyLabel.textContent = "Copy failed";
  }
  setTimeout(() => {
    copyLabel.textContent = "m8na";
  }, 1800);
});

// Music player
const audio = new Audio();
audio.preload = "auto";
audio.volume = 0.8;
let current = -1;
let audioCtx = null;
let analyser = null;
let vizMode = "spectrum";

const musicEl = $("music");
const coverEl = $("cover");
const titleEl = $("track-title");
const artistEl = $("track-artist");
const playBtn = $("play");
const prevBtn = $("prev");
const nextBtn = $("next");
const seekEl = $("seek");
const volumeEl = $("volume");
const nowEl = $("time-now");
const totalEl = $("time-total");
const playlistEl = $("playlist");
const vizNote = $("viz-note");
const vizCanvas = $("viz");
const vizCtx = vizCanvas.getContext("2d");

// The visualizer reads the sound through the Web Audio API. Browsers silence that when a page is opened
// from a file, so it only works on the website. The music still plays when the file is opened directly.
const canVisualize = location.protocol === "http:" || location.protocol === "https:";
if (!canVisualize) vizNote.textContent = "The visualizer works on the website, not when this file is opened directly.";

const timeData = new Uint8Array(2048).fill(128);
const freqData = new Uint8Array(1024);

const connectVisualizer = () => {
  if (!canVisualize || analyser) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  audioCtx.createMediaElementSource(audio).connect(analyser);
  analyser.connect(audioCtx.destination);
};

const resumeAudio = () => {
  connectVisualizer();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
};

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${minutes}:${rest}`;
};

const createNode = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// Shows a track's title, artist and cover without loading the audio
const showTrack = (index) => {
  const track = TRACKS[index];
  titleEl.textContent = track.title;
  artistEl.textContent = track.artist;
  coverEl.classList.toggle("has-art", Boolean(track.cover));
  coverEl.style.backgroundImage = track.cover ? `url("${track.cover}")` : "";
};

const markCurrent = () => {
  for (const button of playlistEl.querySelectorAll(".track")) {
    const selected = Number(button.dataset.index) === current;
    button.classList.toggle("is-current", selected);
    if (selected) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  }
};

// A quick click can interrupt a play request, which is harmless, so the rejection is ignored
const play = () => audio.play().catch(() => {});

const playTrack = (index) => {
  if (!hasTracks) return;
  current = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
  audio.src = TRACKS[current].src;
  showTrack(current);
  markCurrent();
  resumeAudio();
  play();
};

const startMusic = () => playTrack(0);

const togglePlay = () => {
  if (current < 0) {
    playTrack(0);
  } else if (audio.paused) {
    resumeAudio();
    play();
  } else {
    audio.pause();
  }
};

// Playlist: every track in TRACKS, click one to play it
const renderPlaylist = () => {
  if (!hasTracks) {
    playlistEl.replaceChildren(createNode("li", "empty", "Music coming soon"));
    return;
  }
  playlistEl.replaceChildren(
    ...TRACKS.map((track, i) => {
      const button = createNode("button", "track");
      button.type = "button";
      button.dataset.index = String(i);
      const info = createNode("span", "track-info");
      info.append(createNode("span", "track-name", track.title), createNode("span", "track-by", track.artist));
      button.append(
        createNode("span", "track-num", String(i + 1).padStart(2, "0")),
        info,
        createNode("span", "track-time", "--:--")
      );
      const item = createNode("li");
      item.append(button);
      return item;
    })
  );
};

playlistEl.addEventListener("click", (event) => {
  const button = event.target.closest(".track");
  if (button) playTrack(Number(button.dataset.index));
});

// Fill in each track's length by reading its metadata
TRACKS.forEach((track, i) => {
  const probe = new Audio();
  probe.preload = "metadata";
  probe.addEventListener("loadedmetadata", () => {
    const time = playlistEl.querySelector(`.track[data-index="${i}"] .track-time`);
    if (time) time.textContent = formatTime(probe.duration);
  });
  probe.src = track.src;
});

playBtn.addEventListener("click", togglePlay);
prevBtn.addEventListener("click", () => playTrack(current - 1));
nextBtn.addEventListener("click", () => playTrack(current + 1));
audio.addEventListener("ended", () => playTrack(current + 1));
audio.addEventListener("play", () => musicEl.classList.add("is-playing"));
audio.addEventListener("pause", () => musicEl.classList.remove("is-playing"));
audio.addEventListener("error", () => (artistEl.textContent = "Couldn't load this track"));
audio.addEventListener("loadedmetadata", () => (totalEl.textContent = formatTime(audio.duration)));
audio.addEventListener("timeupdate", () => {
  nowEl.textContent = formatTime(audio.currentTime);
  if (audio.duration) seekEl.value = (audio.currentTime / audio.duration) * 100;
});
seekEl.addEventListener("input", () => {
  if (audio.duration) audio.currentTime = (seekEl.value / 100) * audio.duration;
});
volumeEl.addEventListener("input", () => (audio.volume = Number(volumeEl.value)));

// Visualizer: waveform or spectrum, drawn in white
const modeButtons = [...document.querySelectorAll("[data-viz]")];
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    vizMode = button.dataset.viz;
    for (const other of modeButtons) other.setAttribute("aria-pressed", String(other === button));
  });
}

const drawWaveform = (w, h) => {
  vizCtx.lineWidth = 2;
  vizCtx.beginPath();
  for (let i = 0; i < timeData.length; i++) {
    const x = (i / (timeData.length - 1)) * w;
    const y = (timeData[i] / 255) * h;
    if (i === 0) vizCtx.moveTo(x, y);
    else vizCtx.lineTo(x, y);
  }
  vizCtx.stroke();
};

const drawSpectrum = (w, h) => {
  const bars = Math.min(72, Math.floor(w / 9));
  const barWidth = w / bars;
  for (let i = 0; i < bars; i++) {
    // Logarithmic spacing, so low and high frequencies both get room
    const index = Math.min(freqData.length - 1, Math.floor(freqData.length ** (i / bars)));
    const value = freqData[index] / 255;
    const barHeight = Math.max(2, value * h);
    vizCtx.fillStyle = `rgba(255, 255, 255, ${0.3 + value * 0.7})`;
    vizCtx.fillRect(i * barWidth + 1, h - barHeight, Math.max(1, barWidth - 3), barHeight);
  }
};

const drawVisualizer = () => {
  requestAnimationFrame(drawVisualizer);
  const ratio = window.devicePixelRatio || 1;
  const w = vizCanvas.clientWidth;
  const h = vizCanvas.clientHeight;
  if (!w || !h) return; // the Music tab is hidden
  if (vizCanvas.width !== Math.round(w * ratio) || vizCanvas.height !== Math.round(h * ratio)) {
    vizCanvas.width = Math.round(w * ratio);
    vizCanvas.height = Math.round(h * ratio);
    vizCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  if (analyser) {
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);
  }
  vizCtx.clearRect(0, 0, w, h);
  vizCtx.fillStyle = "#fff";
  vizCtx.strokeStyle = "#fff";
  if (vizMode === "waveform") drawWaveform(w, h);
  else drawSpectrum(w, h);
};
requestAnimationFrame(drawVisualizer);

// Start the player in its initial state
renderPlaylist();
[playBtn, prevBtn, nextBtn, seekEl].forEach((el) => (el.disabled = !hasTracks));
if (hasTracks) {
  current = 0;
  showTrack(0);
  markCurrent();
}
