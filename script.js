// Music: add your tracks to this list and put the files in assets/music/.
// "cover" is optional. Example:
// { title: "Song name", artist: "yukariuni", src: "assets/music/song.mp3", cover: "assets/music/song.webp" },
const TRACKS = [
  { title: "Ecifircas", artist: "Sewerslvt", src: "assets/music/ecifircas.mp3", cover: "assets/music/ecifircas.webp" },
  { title: "Goodbye", artist: "Sewerslvt", src: "assets/music/goodbye.wav", cover: "assets/music/goodbye.jpg" },
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

// Discord status: the sidebar and the About panel show your live Discord status.
// Setup: join https://discord.gg/UrXF2cfJ7F, then paste your Discord user ID between the quotes below.
// (Discord settings → Advanced → Developer Mode on, then right-click your profile → Copy User ID.)
const DISCORD_ID = "1501019083137618011";

const STATUS_LABELS = { online: "Online", idle: "Idle", dnd: "Do not disturb", offline: "Offline" };
const STATUS_COLORS = { online: "#4ade80", idle: "#facc15", dnd: "#f87171", offline: "#9ca3af" };

const setStatusText = (text, color) => {
  for (const el of document.querySelectorAll("[data-status-text]")) el.textContent = text;
  for (const dot of document.querySelectorAll(".status-dot")) dot.style.background = color;
};

const showDiscordStatus = (data) => {
  const state = data.discord_status in STATUS_LABELS ? data.discord_status : "offline";
  // The custom status is the activity of type 4: its text and its emoji if it is a regular one
  const custom = (data.activities || []).find((activity) => activity.type === 4);
  const emoji = custom && custom.emoji && !custom.emoji.id ? custom.emoji.name : "";
  const text = [emoji, custom && custom.state].filter(Boolean).join(" ") || STATUS_LABELS[state];
  setStatusText(text, STATUS_COLORS[state]);
};

const loadDiscordStatus = async () => {
  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
    const json = await response.json();
    if (!json.success) throw new Error("Discord status not available");
    showDiscordStatus(json.data);
  } catch {
    setStatusText("Status unavailable", "#9ca3af");
  }
};

if (DISCORD_ID) {
  loadDiscordStatus();
  setInterval(loadDiscordStatus, 30000);
} else {
  setStatusText("Status unavailable", "#9ca3af");
}

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
// Starting volume (0 to 1). The slider is curved (value squared), so 0.5 is a quiet, comfortable level.
const DEFAULT_VOLUME = 0.5;
let volume = DEFAULT_VOLUME;
const volumeGain = () => volume * volume;
audio.volume = volumeGain();
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

const timeData = new Uint8Array(8192).fill(128);
const freqData = new Uint8Array(4096);

// Parametric equalizer: 5 bands, each with a type, a frequency, a gain (dB) and a Q
const EQ_DEFAULTS = [
  { type: "lowshelf", freq: 80, gain: 0, q: 0.7 },
  { type: "peaking", freq: 250, gain: 0, q: 1 },
  { type: "peaking", freq: 1000, gain: 0, q: 1 },
  { type: "peaking", freq: 4000, gain: 0, q: 1 },
  { type: "highshelf", freq: 12000, gain: 0, q: 0.7 },
];
const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0],
  bass: [6, 3, 0, -1, -1],
  vocal: [-2, 0, 3, 3, -1],
  treble: [-2, -1, 0, 3, 6],
};
const EQ_TYPES = { lowshelf: "Low shelf", peaking: "Peak", highshelf: "High shelf" };
const EQ_MIN_HZ = 20;
const EQ_MAX_HZ = 20000;
const EQ_RANGE = 15; // dB, up and down
const eqBands = EQ_DEFAULTS.map((band) => ({ ...band }));
let filters = [];
let gainNode = null;

const applyEq = () => {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  filters.forEach((filter, i) => {
    const band = eqBands[i];
    if (filter.type !== band.type) filter.type = band.type;
    filter.frequency.setTargetAtTime(band.freq, now, 0.01);
    filter.gain.setTargetAtTime(band.gain, now, 0.01);
    filter.Q.setTargetAtTime(band.q, now, 0.01);
  });
};

// Chain: audio -> equalizer -> limiter -> analyser -> volume -> speakers
const connectVisualizer = () => {
  if (!canVisualize || analyser) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(audio);

  filters = eqBands.map(() => audioCtx.createBiquadFilter());
  applyEq();

  // Soft limiter so boosting a band never clips
  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 8192; // finer bass resolution
  analyser.smoothingTimeConstant = settings.smooth;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10; // the bass no longer hits the ceiling

  gainNode = audioCtx.createGain();
  audio.volume = 1;
  gainNode.gain.value = volumeGain();

  const chain = [source, ...filters, limiter, analyser, gainNode, audioCtx.destination];
  for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
};

const setVolume = (value) => {
  volume = value;
  if (gainNode) gainNode.gain.value = volumeGain();
  else audio.volume = volumeGain();
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
volumeEl.addEventListener("input", () => setVolume(Number(volumeEl.value)));
volumeEl.value = String(DEFAULT_VOLUME);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ---------- Visualizer settings (saved in the browser) ----------
const SETTINGS_KEY = "yukari-visualizer";
const SETTINGS_DEFAULTS = { speed: 0.5, smooth: 0.8, sens: 1, color: "#ffffff", glow: true, cursor: true, mode: "spectrum" };
const settings = { ...SETTINGS_DEFAULTS };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
} catch {
  // storage unavailable: the defaults are used
}
const saveSettings = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
};

let accentRgb = "255, 255, 255";
const rgba = (alpha) => `rgba(${accentRgb}, ${alpha})`;
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

const SWATCHES = ["#ffffff", "#a78bfa", "#67e8f9", "#f472b6", "#4ade80", "#fb923c", "#f87171"];
const swatchBox = $("swatches");
const colorInput = $("set-color");
const swatchButtons = SWATCHES.map((color) => {
  const button = createNode("button", "swatch");
  button.type = "button";
  button.style.background = color;
  button.dataset.color = color;
  button.setAttribute("aria-label", `Color ${color}`);
  button.addEventListener("click", () => setAccent(color));
  swatchBox.insertBefore(button, colorInput);
  return button;
});

// The color is the visualizer's, and also the glow around it
function setAccent(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) hex = SETTINGS_DEFAULTS.color;
  settings.color = hex.toLowerCase();
  accentRgb = hexToRgb(settings.color);
  document.documentElement.style.setProperty("--accent-rgb", accentRgb);
  colorInput.value = settings.color;
  for (const button of swatchButtons) button.setAttribute("aria-pressed", String(button.dataset.color === settings.color));
  saveSettings();
}

const bindSlider = (id, key, format, onChange) => {
  const input = $(id);
  const value = $(`${id}-val`);
  const show = () => (value.textContent = format(Number(input.value)));
  input.value = String(settings[key]);
  show();
  input.addEventListener("input", () => {
    settings[key] = Number(input.value);
    show();
    if (onChange) onChange();
    saveSettings();
  });
};
const bindChecks = () => {
  for (const [id, key] of [["set-glow", "glow"], ["set-cursor", "cursor"]]) {
    const box = $(id);
    box.checked = Boolean(settings[key]);
    box.addEventListener("change", () => {
      settings[key] = box.checked;
      saveSettings();
    });
  }
};

const applySmooth = () => {
  if (analyser) analyser.smoothingTimeConstant = settings.smooth;
};
bindSlider("set-speed", "speed", (v) => `${Math.round(v * 100)}%`);
bindSlider("set-smooth", "smooth", (v) => `${Math.round((v / 0.95) * 100)}%`, applySmooth);
bindSlider("set-sens", "sens", (v) => `${v.toFixed(2)}x`);
bindChecks();
colorInput.addEventListener("input", () => setAccent(colorInput.value));

// ---------- Visualizer modes ----------
const VIZ_MODE_NAMES = ["spectrum", "mirror", "area", "radial", "waveform"];
if (!VIZ_MODE_NAMES.includes(settings.mode)) settings.mode = "spectrum";
vizMode = settings.mode;
const modeButtons = [...document.querySelectorAll("[data-viz]")];
const showMode = () => {
  for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.dataset.viz === vizMode));
};
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    vizMode = button.dataset.viz;
    settings.mode = vizMode;
    showMode();
    saveSettings();
  });
}
showMode();

$("set-reset").addEventListener("click", () => {
  Object.assign(settings, SETTINGS_DEFAULTS);
  for (const [id, key] of [["set-speed", "speed"], ["set-smooth", "smooth"], ["set-sens", "sens"]]) {
    $(id).value = String(settings[key]);
    $(id).dispatchEvent(new Event("input"));
  }
  $("set-glow").checked = settings.glow;
  $("set-cursor").checked = settings.cursor;
  vizMode = settings.mode;
  showMode();
  setAccent(settings.color);
});

// ---------- Analysis: smooth bands, no blocky bass ----------
// The spectrum is read with interpolation between FFT bins (the old version showed the same bin as a big flat block
// in the bass), then eased over time using the Speed setting.
const BAND_COUNT = 96;
const BAND_MIN_HZ = 25;
const BAND_MAX_HZ = 16000;
const BASS_BANDS = 27; // roughly 25 to 150 Hz
const bandEdges = Float32Array.from({ length: BAND_COUNT + 1 }, (_, i) => BAND_MIN_HZ * (BAND_MAX_HZ / BAND_MIN_HZ) ** (i / BAND_COUNT));
const bands = new Float32Array(BAND_COUNT);
const bandOut = new Float32Array(BAND_COUNT);
let bassLevel = 0;
let bassSlow = 0;

const sampleSpectrum = (hz) => {
  const position = hz / (audioCtx.sampleRate / analyser.fftSize);
  const index = Math.min(freqData.length - 2, Math.floor(position));
  const t = Math.min(1, position - index);
  return (freqData[index] + (freqData[index + 1] - freqData[index]) * t) / 255;
};

const updateBands = (dt) => {
  const rise = 0.25 + 0.75 * settings.speed;
  const fall = 0.03 + 0.5 * settings.speed ** 2;
  const frames = Math.min(4, dt * 60);
  for (let i = 0; i < BAND_COUNT; i++) {
    let target = 0;
    if (analyser) {
      const lo = bandEdges[i];
      const hi = bandEdges[i + 1];
      const peak = Math.max(sampleSpectrum(lo), sampleSpectrum(Math.sqrt(lo * hi)), sampleSpectrum(hi));
      const tilt = 0.7 + 0.5 * (i / BAND_COUNT); // the bass is naturally much louder
      target = Math.min(1, (peak * settings.sens) ** 1.4 * tilt);
    }
    const rate = target > bands[i] ? rise : fall;
    bands[i] += (target - bands[i]) * (1 - (1 - rate) ** frames);
  }

  // Bass level for the glow: the loudness of the low bands plus a boost on sudden hits
  let sum = 0;
  for (let i = 0; i < BASS_BANDS; i++) sum += bands[i];
  const average = sum / BASS_BANDS;
  bassSlow += (average - bassSlow) * Math.min(1, dt * 1.5);
  const target = Math.min(1, average * 0.6 + Math.max(0, average - bassSlow) * 3);
  const bassRate = target > bassLevel ? 0.5 : 0.12;
  bassLevel += (target - bassLevel) * (1 - (1 - bassRate) ** frames);
};

// Groups the 96 bands into n bars
const bandsFor = (n) => {
  for (let i = 0; i < n; i++) {
    const lo = Math.floor((i * BAND_COUNT) / n);
    const hi = Math.max(lo + 1, Math.floor(((i + 1) * BAND_COUNT) / n));
    let peak = 0;
    for (let b = lo; b < hi; b++) if (bands[b] > peak) peak = bands[b];
    bandOut[i] = peak;
  }
  return bandOut;
};

// The site reacts to the bass through the --bass CSS variable
const pulseTargets = [$("bg-pulse"), musicEl, panelTitle, document.querySelector(".sidebar")];
let lastPulse = -1;
const applyPulse = () => {
  const value = settings.glow ? bassLevel : 0;
  if (Math.abs(value - lastPulse) < 0.008) return;
  lastPulse = value;
  for (const element of pulseTargets) element.style.setProperty("--bass", value.toFixed(3));
};

// ---------- Drawing ----------
const drawSpectrum = (w, h) => {
  const bars = Math.min(64, Math.floor(w / 10));
  const values = bandsFor(bars);
  const barWidth = w / bars;
  for (let i = 0; i < bars; i++) {
    const barHeight = Math.max(2, values[i] * h);
    vizCtx.fillStyle = rgba(0.3 + values[i] * 0.7);
    vizCtx.fillRect(i * barWidth + 1, h - barHeight, Math.max(1, barWidth - 3), barHeight);
  }
};

const drawMirror = (w, h) => {
  const bars = Math.min(64, Math.floor(w / 10));
  const values = bandsFor(bars);
  const barWidth = w / bars;
  for (let i = 0; i < bars; i++) {
    const barHeight = Math.max(2, values[i] * h * 0.92);
    vizCtx.fillStyle = rgba(0.3 + values[i] * 0.7);
    vizCtx.fillRect(i * barWidth + 1, (h - barHeight) / 2, Math.max(1, barWidth - 3), barHeight);
  }
};

const drawArea = (w, h) => {
  const count = 96;
  const values = bandsFor(count);
  const step = w / (count - 1);
  const pts = Array.from({ length: count }, (_, i) => [i * step, h - Math.max(2, values[i] * h * 0.95)]);
  vizCtx.beginPath();
  vizCtx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < count; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    vizCtx.quadraticCurveTo(px, py, (px + cx) / 2, (py + cy) / 2);
  }
  vizCtx.lineTo(w, pts[count - 1][1]);
  vizCtx.strokeStyle = rgba(1);
  vizCtx.lineWidth = 2;
  vizCtx.stroke();
  vizCtx.lineTo(w, h);
  vizCtx.lineTo(0, h);
  vizCtx.closePath();
  const fade = vizCtx.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, rgba(0.5));
  fade.addColorStop(1, rgba(0.02));
  vizCtx.fillStyle = fade;
  vizCtx.fill();
};

const drawRadial = (w, h) => {
  const half = 48;
  const total = half * 2;
  const values = bandsFor(half);
  const size = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const base = size * 0.2 + bassLevel * size * 0.03;
  const reach = size * 0.26;
  vizCtx.lineWidth = 2.5;
  vizCtx.lineCap = "round";
  vizCtx.strokeStyle = rgba(0.15 + bassLevel * 0.4);
  vizCtx.beginPath();
  vizCtx.arc(cx, cy, base - 4, 0, Math.PI * 2);
  vizCtx.stroke();
  for (let i = 0; i < total; i++) {
    const value = values[i < half ? i : total - 1 - i]; // mirrored, so the circle is symmetric
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const length = 2 + value * reach;
    vizCtx.strokeStyle = rgba(0.3 + value * 0.7);
    vizCtx.beginPath();
    vizCtx.moveTo(cx + cos * base, cy + sin * base);
    vizCtx.lineTo(cx + cos * (base + length), cy + sin * (base + length));
    vizCtx.stroke();
  }
};

const drawWaveform = (w, h) => {
  vizCtx.strokeStyle = rgba(1);
  vizCtx.lineWidth = 2;
  vizCtx.beginPath();
  for (let i = 0; i < timeData.length; i += 4) {
    const x = (i / (timeData.length - 1)) * w;
    const y = clamp(h / 2 + ((timeData[i] - 128) / 128) * (h / 2) * settings.sens, 0, h);
    if (i === 0) vizCtx.moveTo(x, y);
    else vizCtx.lineTo(x, y);
  }
  vizCtx.stroke();
};

const VIZ_DRAWERS = { spectrum: drawSpectrum, mirror: drawMirror, area: drawArea, radial: drawRadial, waveform: drawWaveform };

let lastFrame = performance.now();
const drawVisualizer = (now = performance.now()) => {
  requestAnimationFrame(drawVisualizer);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  // Analysis and the site's bass glow run on every tab, drawing only when the Music tab is visible
  if (analyser) {
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);
  }
  updateBands(dt);
  applyPulse();

  const ratio = window.devicePixelRatio || 1;
  const w = vizCanvas.clientWidth;
  const h = vizCanvas.clientHeight;
  if (!w || !h) return; // the Music tab is hidden
  if (vizCanvas.width !== Math.round(w * ratio) || vizCanvas.height !== Math.round(h * ratio)) {
    vizCanvas.width = Math.round(w * ratio);
    vizCanvas.height = Math.round(h * ratio);
    vizCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  vizCtx.clearRect(0, 0, w, h);
  (VIZ_DRAWERS[vizMode] || drawSpectrum)(w, h);
};
requestAnimationFrame(drawVisualizer);

// Parametric equalizer interface: a curve with draggable points, plus exact controls for every band
const eqCanvas = $("eq-curve");
const eqCtx = eqCanvas.getContext("2d");
const eqBox = $("eq-bands");
const presetButtons = [...document.querySelectorAll("[data-preset]")];
$("eq-note").textContent = canVisualize
  ? "Drag a point · scroll on it for Q · double-click to reset"
  : "The equalizer works on the website, not when this file is opened directly.";

const hzToPos = (hz) => Math.log(hz / EQ_MIN_HZ) / Math.log(EQ_MAX_HZ / EQ_MIN_HZ);
const posToHz = (pos) => EQ_MIN_HZ * (EQ_MAX_HZ / EQ_MIN_HZ) ** pos;
const formatHz = (hz) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2).replace(/\.?0+$/, "")} kHz` : `${Math.round(hz)} Hz`);
const formatDb = (db) => `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;

// Filter maths (RBJ cookbook), used to draw the response curve without needing the audio engine
const biquadCoeffs = (band) => {
  const A = 10 ** (band.gain / 40);
  const w0 = (2 * Math.PI * band.freq) / 48000;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  if (band.type === "peaking") {
    const alpha = sin / (2 * band.q);
    return [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A];
  }
  const k = 2 * Math.sqrt(A) * (sin / Math.SQRT2);
  if (band.type === "lowshelf") {
    return [
      A * (A + 1 - (A - 1) * cos + k),
      2 * A * (A - 1 - (A + 1) * cos),
      A * (A + 1 - (A - 1) * cos - k),
      A + 1 + (A - 1) * cos + k,
      -2 * (A - 1 + (A + 1) * cos),
      A + 1 + (A - 1) * cos - k,
    ];
  }
  return [
    A * (A + 1 + (A - 1) * cos + k),
    -2 * A * (A - 1 + (A + 1) * cos),
    A * (A + 1 + (A - 1) * cos - k),
    A + 1 - (A - 1) * cos + k,
    2 * (A - 1 - (A + 1) * cos),
    A + 1 - (A - 1) * cos - k,
  ];
};

const coeffsDb = ([b0, b1, b2, a0, a1, a2], hz) => {
  const w = (2 * Math.PI * hz) / 48000;
  const c1 = Math.cos(w);
  const c2 = Math.cos(2 * w);
  const num = b0 * b0 + b1 * b1 + b2 * b2 + 2 * (b0 * b1 + b1 * b2) * c1 + 2 * b0 * b2 * c2;
  const den = a0 * a0 + a1 * a1 + a2 * a2 + 2 * (a0 * a1 + a1 * a2) * c1 + 2 * a0 * a2 * c2;
  return 10 * Math.log10(Math.max(1e-12, num) / Math.max(1e-12, den));
};

// Controls under the curve
const ui = [];
let eqActive = -1;
const unpressPresets = () => presetButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
const setActive = (index) => {
  eqActive = index;
  ui.forEach((entry, i) => entry.card.classList.toggle("is-active", i === index));
};

const showEq = () => {
  eqBands.forEach((band, i) => {
    const entry = ui[i];
    entry.select.value = band.type;
    entry.freq.input.value = String(Math.round(hzToPos(band.freq) * 1000));
    entry.freq.value.textContent = formatHz(band.freq);
    entry.gain.input.value = String(band.gain);
    entry.gain.value.textContent = formatDb(band.gain);
    entry.q.input.value = String(band.q);
    entry.q.value.textContent = band.q.toFixed(2);
    entry.q.input.disabled = !canVisualize || band.type !== "peaking"; // shelves have no Q
  });
};

const eqChanged = () => {
  showEq();
  applyEq();
  unpressPresets();
};

const makeParam = (name, min, max, step, onInput) => {
  const wrap = createNode("label", "eq-param");
  const head = createNode("span", "eq-param-head");
  const value = createNode("span", "eq-val");
  head.append(createNode("span", "", name), value);
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.disabled = !canVisualize;
  input.setAttribute("aria-label", name);
  input.addEventListener("input", () => onInput(Number(input.value)));
  wrap.append(head, input);
  return { wrap, input, value };
};

eqBands.forEach((band, i) => {
  const card = createNode("div", "eq-band");
  const head = createNode("div", "eq-head");
  const select = document.createElement("select");
  select.className = "eq-select";
  select.disabled = !canVisualize;
  select.setAttribute("aria-label", `Band ${i + 1} type`);
  for (const [type, label] of Object.entries(EQ_TYPES)) select.append(new Option(label, type));
  select.addEventListener("change", () => {
    band.type = select.value;
    eqChanged();
  });
  head.append(createNode("span", "eq-name", `Band ${i + 1}`), select);

  const freq = makeParam("Frequency", 0, 1000, 1, (v) => {
    band.freq = Math.round(posToHz(v / 1000));
    eqChanged();
  });
  const gain = makeParam("Gain", -EQ_RANGE, EQ_RANGE, 0.5, (v) => {
    band.gain = v;
    eqChanged();
  });
  const q = makeParam("Q", 0.2, 10, 0.1, (v) => {
    band.q = v;
    eqChanged();
  });

  card.append(head, freq.wrap, gain.wrap, q.wrap);
  card.addEventListener("pointerenter", () => setActive(i));
  card.addEventListener("focusin", () => setActive(i));
  eqBox.append(card);
  ui.push({ card, select, freq, gain, q });
});

for (const button of presetButtons) {
  button.disabled = !canVisualize;
  button.addEventListener("click", () => {
    eqBands.forEach((band, i) => Object.assign(band, EQ_DEFAULTS[i], { gain: EQ_PRESETS[button.dataset.preset][i] }));
    showEq();
    applyEq();
    for (const other of presetButtons) other.setAttribute("aria-pressed", String(other === button));
  });
}
showEq();

// Curve: drag a point = frequency and gain, scroll on it = Q, double-click = reset its gain
const GRID_HZ = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const eqPad = 14;
const eqX = (hz, w) => hzToPos(hz) * w;
const eqY = (db, h) => h / 2 - (db / EQ_RANGE) * (h / 2 - eqPad);

const eqPointAt = (px, py, radius) => {
  const w = eqCanvas.clientWidth;
  const h = eqCanvas.clientHeight;
  let best = -1;
  let bestDistance = radius;
  eqBands.forEach((band, i) => {
    const distance = Math.hypot(px - eqX(band.freq, w), py - eqY(band.gain, h));
    if (distance <= bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
};

const eqLocal = (event) => {
  const rect = eqCanvas.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
};

let dragging = -1;
eqCanvas.addEventListener("pointerdown", (event) => {
  if (!canVisualize) return;
  const [px, py] = eqLocal(event);
  const index = eqPointAt(px, py, 20);
  if (index < 0) return;
  dragging = index;
  setActive(index);
  eqCanvas.setPointerCapture(event.pointerId);
});
eqCanvas.addEventListener("pointermove", (event) => {
  const [px, py] = eqLocal(event);
  if (dragging < 0) {
    eqCanvas.style.cursor = canVisualize && eqPointAt(px, py, 20) >= 0 ? "grab" : "default";
    return;
  }
  const w = eqCanvas.clientWidth;
  const h = eqCanvas.clientHeight;
  const band = eqBands[dragging];
  band.freq = Math.round(posToHz(clamp(px / w, 0, 1)));
  band.gain = Math.round(clamp(((h / 2 - py) / (h / 2 - eqPad)) * EQ_RANGE, -EQ_RANGE, EQ_RANGE) * 2) / 2;
  eqChanged();
});
const endDrag = () => (dragging = -1);
eqCanvas.addEventListener("pointerup", endDrag);
eqCanvas.addEventListener("pointercancel", endDrag);
eqCanvas.addEventListener("dblclick", (event) => {
  if (!canVisualize) return;
  const [px, py] = eqLocal(event);
  const index = eqPointAt(px, py, 20);
  if (index < 0) return;
  eqBands[index].gain = 0;
  eqChanged();
});
eqCanvas.addEventListener(
  "wheel",
  (event) => {
    if (!canVisualize) return;
    const [px, py] = eqLocal(event);
    const index = eqPointAt(px, py, 26);
    if (index < 0 || eqBands[index].type !== "peaking") return;
    event.preventDefault();
    setActive(index);
    eqBands[index].q = Math.round(clamp(eqBands[index].q * (event.deltaY < 0 ? 1.1 : 1 / 1.1), 0.2, 10) * 100) / 100;
    eqChanged();
  },
  { passive: false }
);

const drawEq = () => {
  requestAnimationFrame(drawEq);
  const ratio = window.devicePixelRatio || 1;
  const w = eqCanvas.clientWidth;
  const h = eqCanvas.clientHeight;
  if (!w || !h) return; // the Music tab is hidden
  if (eqCanvas.width !== Math.round(w * ratio) || eqCanvas.height !== Math.round(h * ratio)) {
    eqCanvas.width = Math.round(w * ratio);
    eqCanvas.height = Math.round(h * ratio);
    eqCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  eqCtx.clearRect(0, 0, w, h);
  eqCtx.font = '11px "Outfit", system-ui, sans-serif';
  eqCtx.textBaseline = "alphabetic";

  // Grid
  eqCtx.lineWidth = 1;
  eqCtx.fillStyle = rgba(0.4);
  for (const hz of GRID_HZ) {
    const x = Math.round(eqX(hz, w)) + 0.5;
    eqCtx.strokeStyle = rgba(0.07);
    eqCtx.beginPath();
    eqCtx.moveTo(x, 0);
    eqCtx.lineTo(x, h);
    eqCtx.stroke();
    if (hz === 100 || hz === 1000 || hz === 10000) eqCtx.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), x + 4, h - 5);
  }
  for (const db of [-12, -6, 0, 6, 12]) {
    const y = Math.round(eqY(db, h)) + 0.5;
    eqCtx.strokeStyle = db === 0 ? rgba(0.25) : rgba(0.07);
    eqCtx.beginPath();
    eqCtx.moveTo(0, y);
    eqCtx.lineTo(w, y);
    eqCtx.stroke();
    if (db !== 0) eqCtx.fillText(`${db > 0 ? "+" : ""}${db}`, 4, y - 3);
  }

  // Live spectrum behind the curve, drawn as a smooth shape
  if (analyser) {
    eqCtx.beginPath();
    eqCtx.moveTo(0, h);
    for (let x = 0; x <= w; x += 2) {
      const value = clamp((sampleSpectrum(posToHz(x / w)) * settings.sens) ** 1.4, 0, 1) * h * 0.7;
      eqCtx.lineTo(x, h - value);
    }
    eqCtx.lineTo(w, h);
    eqCtx.closePath();
    eqCtx.fillStyle = rgba(0.14);
    eqCtx.fill();
  }

  // Combined response of all bands
  const coeffs = eqBands.map(biquadCoeffs);
  const zero = eqY(0, h);
  eqCtx.beginPath();
  for (let x = 0; x <= w; x += 2) {
    const hz = posToHz(x / w);
    const db = clamp(coeffs.reduce((sum, c) => sum + coeffsDb(c, hz), 0), -EQ_RANGE, EQ_RANGE);
    if (x === 0) eqCtx.moveTo(x, eqY(db, h));
    else eqCtx.lineTo(x, eqY(db, h));
  }
  eqCtx.strokeStyle = rgba(1);
  eqCtx.lineWidth = 2;
  eqCtx.stroke();
  eqCtx.lineTo(w, zero);
  eqCtx.lineTo(0, zero);
  eqCtx.closePath();
  eqCtx.fillStyle = rgba(0.1);
  eqCtx.fill();

  // Band points
  eqCtx.textAlign = "center";
  eqCtx.textBaseline = "middle";
  eqBands.forEach((band, i) => {
    const x = eqX(band.freq, w);
    const y = eqY(band.gain, h);
    const on = i === eqActive || i === dragging;
    eqCtx.beginPath();
    eqCtx.arc(x, y, on ? 10 : 8, 0, Math.PI * 2);
    eqCtx.fillStyle = on ? rgba(1) : "#07070a";
    eqCtx.fill();
    eqCtx.lineWidth = 1.5;
    eqCtx.strokeStyle = rgba(1);
    eqCtx.stroke();
    eqCtx.fillStyle = on ? "#07070a" : rgba(1);
    eqCtx.fillText(String(i + 1), x, y + 0.5);
  });
  eqCtx.textAlign = "start";
};
requestAnimationFrame(drawEq);

// Pointer effects: a ring that follows the cursor, a pixel trail, and a burst when you click
const fxCanvas = $("fx");
const fxCtx = fxCanvas.getContext("2d");
if (!reduceMotion) {
  let fxW = 0;
  let fxH = 0;
  const resizeFx = () => {
    const ratio = window.devicePixelRatio || 1;
    fxW = innerWidth;
    fxH = innerHeight;
    fxCanvas.width = fxW * ratio;
    fxCanvas.height = fxH * ratio;
    fxCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  addEventListener("resize", resizeFx);
  resizeFx();

  const pointer = { x: 0, y: 0, ringX: 0, ringY: 0, radius: 14, active: false, hover: false, down: false };
  const particles = [];
  const ripples = [];
  const INTERACTIVE = "a, button, input, select, label, canvas, [role='tab']";
  const rand = (min, max) => min + Math.random() * (max - min);

  addEventListener("pointermove", (event) => {
    if (!settings.cursor || event.pointerType === "touch") return;
    if (!pointer.active) {
      pointer.ringX = event.clientX;
      pointer.ringY = event.clientY;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
    const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    pointer.hover = Boolean(event.target.closest && event.target.closest(INTERACTIVE));
    const count = Math.min(3, Math.floor(distance / 14) + (Math.random() < 0.15 ? 1 : 0));
    for (let i = 0; i < count && particles.length < 300; i++) {
      const life = rand(0.5, 1);
      particles.push({ x: pointer.x + rand(-3, 3), y: pointer.y + rand(-3, 3), vx: rand(-25, 25), vy: rand(-10, 35), size: rand(2, 4.5), life, max: life });
    }
  });

  addEventListener("pointerdown", (event) => {
    if (!settings.cursor) return;
    pointer.down = true;
    for (let i = 0; i < 16 && particles.length < 300; i++) {
      const angle = (i / 16) * Math.PI * 2 + rand(-0.2, 0.2);
      const speed = rand(80, 260);
      const life = rand(0.5, 0.9);
      particles.push({ x: event.clientX, y: event.clientY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: rand(2.5, 5), life, max: life });
    }
    ripples.push({ x: event.clientX, y: event.clientY, radius: 6, life: 0.6, max: 0.6 });
  });
  addEventListener("pointerup", () => (pointer.down = false));
  document.documentElement.addEventListener("mouseleave", () => (pointer.active = false));

  let fxLast = performance.now();
  const drawFx = (now = performance.now()) => {
    requestAnimationFrame(drawFx);
    const dt = Math.min(0.05, (now - fxLast) / 1000);
    fxLast = now;
    fxCtx.clearRect(0, 0, fxW, fxH);
    if (!settings.cursor) {
      particles.length = 0;
      ripples.length = 0;
      return;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      fxCtx.fillStyle = rgba((p.life / p.max) * 0.9);
      fxCtx.fillRect(p.x, p.y, p.size, p.size);
    }

    fxCtx.lineWidth = 1.5;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.life -= dt;
      if (r.life <= 0) {
        ripples.splice(i, 1);
        continue;
      }
      r.radius += 150 * dt;
      fxCtx.strokeStyle = rgba((r.life / r.max) * 0.7);
      fxCtx.beginPath();
      fxCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      fxCtx.stroke();
    }

    if (pointer.active) {
      pointer.ringX += (pointer.x - pointer.ringX) * (1 - Math.exp(-dt * 16));
      pointer.ringY += (pointer.y - pointer.ringY) * (1 - Math.exp(-dt * 16));
      const targetRadius = pointer.down ? 9 : pointer.hover ? 26 : 14;
      pointer.radius += (targetRadius - pointer.radius) * (1 - Math.exp(-dt * 14));
      const glow = fxCtx.createRadialGradient(pointer.ringX, pointer.ringY, 0, pointer.ringX, pointer.ringY, pointer.radius * 3);
      glow.addColorStop(0, rgba(0.14 + bassLevel * 0.2));
      glow.addColorStop(1, rgba(0));
      fxCtx.fillStyle = glow;
      fxCtx.fillRect(pointer.ringX - pointer.radius * 3, pointer.ringY - pointer.radius * 3, pointer.radius * 6, pointer.radius * 6);
      fxCtx.strokeStyle = rgba(0.8);
      fxCtx.beginPath();
      fxCtx.arc(pointer.ringX, pointer.ringY, pointer.radius, 0, Math.PI * 2);
      fxCtx.stroke();
    }
  };
  requestAnimationFrame(drawFx);
}

// Start the player in its initial state
renderPlaylist();
[playBtn, prevBtn, nextBtn, seekEl].forEach((el) => (el.disabled = !hasTracks));
if (hasTracks) {
  current = 0;
  showTrack(0);
  markCurrent();
}

setAccent(settings.color);
