/* RoundBell, a boxing round timer.
   Phases: prep (get ready) -> work/rest alternating -> done. */

const STORE_KEY = "roundbell.v1";
const $ = (id) => document.getElementById(id);

const LIMITS = {
  rounds: { min: 1, max: 30, step: 1 },
  work: { min: 30, max: 600, step: 30 },   // seconds
  rest: { min: 15, max: 300, step: 15 },
  prep: { min: 0, max: 60, step: 5 },
};

let cfg = loadCfg();

function loadCfg() {
  const def = { rounds: 12, work: 180, rest: 60, prep: 10, sound: true };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    return def;
  }
}

function saveCfg() {
  localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
}

/* ---------- timer state ---------- */

let phase = "idle";      // idle | prep | work | rest | done
let round = 0;           // current round, 1-based
let remaining = 0;       // seconds left in phase
let phaseTotal = 1;      // seconds in this phase
let endAt = 0;           // wall-clock ms when phase ends
let handle = null;
let paused = false;
let warned = false;      // 10-second warning fired for this phase

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ---------- rendering ---------- */

function render() {
  $("app").dataset.phase = phase;
  const labels = {
    idle: "Ready when you are",
    prep: "Get ready",
    work: "Fight",
    rest: "Rest",
    done: "Final bell",
  };
  $("phaseLabel").textContent = labels[phase];
  $("roundLabel").innerHTML =
    phase === "work" || phase === "rest"
      ? `Round ${round} of ${cfg.rounds}`
      : phase === "done"
        ? `${cfg.rounds} rounds in the bag 🎉`
        : "&nbsp;";
  $("clock").textContent = fmt(phase === "idle" ? cfg.work : Math.max(0, remaining));
  $("clock").classList.toggle(
    "warning",
    (phase === "work" || phase === "rest") && remaining <= 10 && remaining > 0
  );
  $("progressFill").style.width =
    phase === "idle" || phase === "done"
      ? "0%"
      : `${(100 * (phaseTotal - remaining)) / phaseTotal}%`;

  $("startBtn").textContent =
    phase === "idle" || phase === "done" ? "Start" : paused ? "Resume" : "Pause";
  $("startBtn").classList.toggle("paused", paused);
  $("skipBtn").disabled = phase === "idle" || phase === "done";
  $("resetBtn").disabled = phase === "idle";
  $("settings").classList.toggle("locked", !(phase === "idle" || phase === "done"));

  $("val-rounds").textContent = cfg.rounds;
  $("val-work").textContent = fmt(cfg.work);
  $("val-rest").textContent = fmt(cfg.rest);
  $("val-prep").textContent = fmt(cfg.prep);
  $("soundToggle").textContent = cfg.sound ? "🔔 Sound on" : "🔕 Muted";
}

/* ---------- phase machine ---------- */

function startPhase(next) {
  phase = next;
  phaseTotal = next === "prep" ? cfg.prep : next === "work" ? cfg.work : cfg.rest;
  remaining = phaseTotal;
  endAt = Date.now() + phaseTotal * 1000;
  warned = false;
  if (next === "work") bell(1);   // round starts, single bell
  if (next === "rest") bell(3);   // round over, triple bell
  render();
}

function advance() {
  if (phase === "prep") {
    round = 1;
    startPhase("work");
  } else if (phase === "work") {
    if (round >= cfg.rounds) {
      finish();
    } else {
      startPhase("rest");
    }
  } else if (phase === "rest") {
    round += 1;
    startPhase("work");
  }
}

function finish() {
  stopLoop();
  phase = "done";
  bell(3);
  render();
}

function loop() {
  if (paused) return;
  remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  if (!warned && (phase === "work" || phase === "rest") && remaining === 10 && phaseTotal > 15) {
    warned = true;
    clacks();
  }
  if (remaining <= 0) {
    advance();
  } else {
    render();
  }
}

function startLoop() {
  stopLoop();
  handle = setInterval(loop, 200);
}

function stopLoop() {
  clearInterval(handle);
  handle = null;
}

/* ---------- controls ---------- */

$("startBtn").addEventListener("click", () => {
  audioReady();
  if (phase === "idle" || phase === "done") {
    round = 0;
    paused = false;
    if (cfg.prep > 0) {
      startPhase("prep");
    } else {
      round = 1;
      startPhase("work");
    }
    startLoop();
  } else if (paused) {
    endAt = Date.now() + remaining * 1000;
    paused = false;
    render();
  } else {
    paused = true;
    render();
  }
});

$("skipBtn").addEventListener("click", () => {
  if (phase === "idle" || phase === "done") return;
  paused = false;
  advance();
});

$("resetBtn").addEventListener("click", () => {
  stopLoop();
  phase = "idle";
  round = 0;
  paused = false;
  render();
});

$("soundToggle").addEventListener("click", () => {
  cfg.sound = !cfg.sound;
  saveCfg();
  render();
});

document.querySelectorAll(".stepper button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const { key, dir } = btn.dataset;
    const lim = LIMITS[key];
    cfg[key] = Math.min(lim.max, Math.max(lim.min, cfg[key] + lim.step * Number(dir)));
    saveCfg();
    render();
  });
});

/* ---------- sounds ----------
   WAV files played through <audio> elements, not Web Audio: on iOS,
   media playback ignores the silent switch, Web Audio does not. */

const sounds = {
  bell1: new Audio("bell1.wav"),
  bell3: new Audio("bell3.wav"),
  clack: new Audio("clack.wav"),
};
Object.values(sounds).forEach((a) => a.load());
let unlocked = false;

function audioReady() {
  // iOS only lets audio start from a user gesture; play each sound muted
  // once during the Start tap so later programmatic plays are allowed
  if (unlocked) return;
  unlocked = true;
  Object.values(sounds).forEach((a) => {
    a.muted = true;
    const p = a.play();
    if (p) {
      p.then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      }).catch(() => {
        a.muted = false;
      });
    }
  });
}

function play(name) {
  if (!cfg.sound) return;
  const a = sounds[name];
  a.currentTime = 0;
  a.play().catch(() => {});
}

function bell(times) {
  play(times >= 3 ? "bell3" : "bell1");
}

function clacks() {
  play("clack");
}

/* ---------- keep the screen awake during a session ---------- */

let wakeLock = null;
async function keepAwake() {
  try {
    if ("wakeLock" in navigator && !wakeLock && phase !== "idle" && phase !== "done") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    }
  } catch { /* not critical */ }
}
document.addEventListener("visibilitychange", keepAwake);
setInterval(keepAwake, 3000);

render();
