// Music: add your tracks to this list and put the files in assets/music/.
// "cover" is optional. Example:
// { title: "Song name", artist: "yukariuni", src: "assets/music/song.mp3", cover: "assets/music/song.webp" },
const TRACKS = [];

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Click to enter
$("gate").addEventListener("click", () => $("gate").classList.add("is-open"), { once: true });

// The background video stays still for visitors who prefer less motion
if (reduceMotion) $("bg-video").pause();

// Snowflakes
if (!reduceMotion) {
  const canvas = $("snow");
  const ctx = canvas.getContext("2d");
  let flakes = [];

  const spawn = (anywhere) => ({
    x: Math.random() * innerWidth,
    y: anywhere ? Math.random() * innerHeight : -10,
    r: Math.random() * 1.6 + 0.6,
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
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  };

  addEventListener("resize", resize);
  resize();
  draw();
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
    copyLabel.textContent = "Discord: m8na";
  }, 1800);
});

// Music player
const audio = new Audio();
audio.preload = "metadata";
let current = 0;

const musicEl = $("music");
const coverEl = $("cover");
const titleEl = $("track-title");
const artistEl = $("track-artist");
const playBtn = $("play");
const prevBtn = $("prev");
const nextBtn = $("next");
const seekEl = $("seek");
const nowEl = $("time-now");
const totalEl = $("time-total");

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${minutes}:${rest}`;
};

const loadTrack = (index) => {
  const track = TRACKS[index];
  current = index;
  audio.src = track.src;
  titleEl.textContent = track.title;
  artistEl.textContent = track.artist;
  coverEl.classList.toggle("has-art", Boolean(track.cover));
  coverEl.style.backgroundImage = track.cover ? `url("${track.cover}")` : "";
};

// Quick clicks can interrupt a play request, which is harmless, so the rejection is ignored
const play = () => audio.play().catch(() => {});

const step = (direction) => {
  loadTrack((current + direction + TRACKS.length) % TRACKS.length);
  play();
};

playBtn.addEventListener("click", () => (audio.paused ? play() : audio.pause()));
prevBtn.addEventListener("click", () => step(-1));
nextBtn.addEventListener("click", () => step(1));
audio.addEventListener("ended", () => step(1));
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

// The player stays disabled until there is at least one track
const hasTracks = TRACKS.length > 0;
[playBtn, prevBtn, nextBtn, seekEl].forEach((el) => (el.disabled = !hasTracks));
if (hasTracks) loadTrack(0);
