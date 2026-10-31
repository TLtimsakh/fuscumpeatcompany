// Адрес на случай, если почтовый скрипт на сервере недоступен
const CONTACT_EMAIL = "vostokdsm@inbox.ru";

const root = document.documentElement;
const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (value) => Math.min(1, Math.max(0, value));

const topbar = document.getElementById("topbar");
const hero = document.getElementById("hero");
const video = document.getElementById("heroVideo");
const soundToggle = document.getElementById("soundToggle");
const playToggle = document.getElementById("playToggle");
const statement = document.getElementById("statement");
const process_ = document.getElementById("process");
const steps = document.getElementById("steps");
const processBar = document.getElementById("processBar");
const band = document.getElementById("band");
const timeline = document.getElementById("timeline");
const stats = document.getElementById("stats");
const zooms = [...document.querySelectorAll("[data-zoom]")];
const metaDescription = document.querySelector('meta[name="description"]');

// Язык: ?lang=zh в ссылке, затем выбор посетителя, затем язык браузера
let lang = "ru";

function t(key) {
  return I18N[lang][key] ?? I18N.ru[key];
}

function readStoredLang() {
  try {
    return localStorage.getItem("lang");
  } catch {
    return null;
  }
}

function pickLang() {
  const wanted = new URLSearchParams(location.search).get("lang") || readStoredLang();
  if (I18N[wanted]) return wanted;
  const browser = (navigator.language || "ru").slice(0, 2).toLowerCase();
  if (browser === "zh" || browser === "ru") return browser;
  return "en";
}

// Русский берём из разметки, чтобы тексты не дублировались
document.querySelectorAll("[data-i18n]").forEach((el) => {
  I18N.ru[el.dataset.i18n] ??= el.innerHTML;
});
const attrTargets = [...document.querySelectorAll("[data-i18n-attr]")].map((el) => {
  const pairs = el.dataset.i18nAttr.split(",").map((pair) => pair.split(":"));
  pairs.forEach(([attr, key]) => {
    I18N.ru[key] = el.getAttribute(attr);
  });
  return { el, pairs };
});
I18N.ru["meta.title"] = document.title;
I18N.ru["meta.description"] = metaDescription.content;

function applyLanguage(next) {
  lang = next;
  root.lang = next === "zh" ? "zh-Hans" : next;
  document.title = t("meta.title");
  metaDescription.content = t("meta.description");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  attrTargets.forEach(({ el, pairs }) => {
    pairs.forEach(([attr, key]) => el.setAttribute(attr, t(key)));
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === next));
  });
  showVideoState();
  setStatus("");
  buildStatement();
  if (statsShown) finishCounters();
  layoutProcess();
  requestFrame();
}

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    try {
      localStorage.setItem("lang", button.dataset.lang);
    } catch {}
    applyLanguage(button.dataset.lang);
  });
});

// Видео: браузеры разрешают автозапуск только без звука, звук включается кнопкой
let stoppedByVisitor = !motionOK;

function showVideoState() {
  playToggle.textContent = t(video.paused ? "video.play" : "video.pause");
  playToggle.setAttribute("aria-pressed", String(video.paused));
  soundToggle.textContent = t(video.muted ? "video.soundOn" : "video.soundOff");
  soundToggle.setAttribute("aria-pressed", String(!video.muted));
}

if (stoppedByVisitor) video.pause();
else video.play().catch(() => {});

video.addEventListener("play", showVideoState);
video.addEventListener("pause", showVideoState);

playToggle.addEventListener("click", () => {
  stoppedByVisitor = !video.paused;
  if (video.paused) video.play();
  else video.pause();
});

soundToggle.addEventListener("click", () => {
  video.muted = !video.muted;
  showVideoState();
  if (!video.muted) {
    stoppedByVisitor = false;
    video.play();
  }
});

// Не тратим трафик и не звучим, пока первый экран вне поля зрения
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) video.pause();
  else if (!stoppedByVisitor) video.play().catch(() => {});
}).observe(hero);

// Блоки всплывают при появлении на экране, элементы группы идут друг за другом
document.querySelectorAll("[data-stagger]").forEach((group) => {
  [...group.children].forEach((child, index) => {
    child.classList.add("reveal");
    child.style.transitionDelay = `${Math.min(index, 8) * 70}ms`;
  });
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-in");
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// Цифры отсчитываются один раз, когда полоса попадает на экран
let statsShown = false;

function formatCount(el, value) {
  const decimals = Number(el.dataset.decimals || 0);
  return new Intl.NumberFormat(lang === "zh" ? "en" : lang, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: el.dataset.count.length > 4,
  }).format(value);
}

function finishCounters() {
  stats.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = formatCount(el, Number(el.dataset.count));
  });
}

function runCounters() {
  const started = performance.now();
  const shownLang = lang;
  function tick(now) {
    if (shownLang !== lang) return;
    const progress = clamp((now - started) / 1400);
    const eased = 1 - (1 - progress) ** 3;
    stats.querySelectorAll("[data-count]").forEach((el) => {
      el.textContent = formatCount(el, Number(el.dataset.count) * eased);
    });
    if (progress < 1) requestAnimationFrame(tick);
    else finishCounters();
  }
  requestAnimationFrame(tick);
}

new IntersectionObserver(([entry], observer) => {
  if (!entry.isIntersecting) return;
  statsShown = true;
  observer.disconnect();
  if (motionOK) runCounters();
  else finishCounters();
}, { threshold: 0.4 }).observe(stats);

// Крупная фраза: слова загораются по мере прокрутки, в китайском по иероглифам
let statementWords = [];
let litWords = -1;

function buildStatement() {
  if (!motionOK) return;
  const text = statement.textContent;
  const parts = lang === "zh" ? Array.from(text) : text.split(" ");
  statement.setAttribute("aria-label", text);
  statement.innerHTML = "";
  statementWords = parts.map((part, index) => {
    const word = document.createElement("span");
    word.setAttribute("aria-hidden", "true");
    word.textContent = part;
    statement.append(word, lang === "zh" || index === parts.length - 1 ? "" : " ");
    return word;
  });
  litWords = -1;
}

// Лента производства: на широком экране секция закрепляется и едет вбок,
// на телефоне это обычная лента, которую листают пальцем
const pinQuery = window.matchMedia("(min-width: 761px) and (min-height: 600px)");
let processDistance = 0;

function layoutProcess() {
  const pinned = motionOK && pinQuery.matches;
  process_.classList.toggle("is-pinned", pinned);
  if (!pinned) {
    process_.style.height = "";
    steps.style.transform = "";
    processDistance = 0;
    return;
  }
  processDistance = Math.max(0, steps.scrollWidth - window.innerWidth);
  process_.style.height = `${window.innerHeight + processDistance}px`;
}

// Всё, что привязано к прокрутке, считается один раз за кадр
let frameQueued = false;

function requestFrame() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(renderFrame);
}

function renderFrame() {
  frameQueued = false;
  const vh = window.innerHeight;
  topbar.classList.toggle("is-solid", window.scrollY > hero.offsetHeight - 120);
  if (!motionOK) return;

  const heroProgress = clamp(window.scrollY / (hero.offsetHeight - vh));
  hero.style.setProperty("--p", heroProgress.toFixed(4));
  hero.classList.toggle("is-shrunk", heroProgress > 0.3);

  const statementBox = statement.getBoundingClientRect();
  const lit = Math.round(clamp((vh * 0.85 - statementBox.top) / (vh * 0.55)) * statementWords.length);
  if (lit !== litWords) {
    statementWords.forEach((word, index) => word.classList.toggle("is-lit", index < lit));
    litWords = lit;
  }

  zooms.forEach((zoom) => {
    const box = zoom.getBoundingClientRect();
    if (box.bottom < 0 || box.top > vh) return;
    zoom.style.setProperty("--z", clamp((vh - box.top) / (vh * 0.8)).toFixed(4));
  });

  if (processDistance) {
    const progress = clamp(-process_.getBoundingClientRect().top / processDistance);
    steps.style.transform = `translate3d(${-progress * processDistance}px, 0, 0)`;
    processBar.style.transform = `scaleX(${progress.toFixed(4)})`;
  }

  const bandBox = band.getBoundingClientRect();
  const grown = clamp(-bandBox.top / (band.offsetHeight - vh));
  band.style.setProperty("--b", (1 - clamp(grown / 0.8)).toFixed(4));
  band.classList.toggle("is-full", grown > 0.72);

  const lineBox = timeline.getBoundingClientRect();
  timeline.style.setProperty("--line", clamp((vh * 0.7 - lineBox.top) / lineBox.height).toFixed(4));
}

window.addEventListener("scroll", requestFrame, { passive: true });
window.addEventListener("resize", () => {
  layoutProcess();
  requestFrame();
});
window.addEventListener("load", () => {
  layoutProcess();
  requestFrame();
});

// Окно «Написать нам»
const dialog = document.getElementById("contactDialog");
const form = document.getElementById("contactForm");
const statusLine = document.getElementById("formStatus");
const submit = document.getElementById("formSubmit");

document.querySelectorAll("[data-open-contact]").forEach((button) => {
  button.addEventListener("click", () => dialog.showModal());
});
document.getElementById("contactClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

function setStatus(text, kind) {
  statusLine.textContent = text;
  statusLine.className = "form-status" + (kind ? " is-" + kind : "");
}

function openMailDraft(data) {
  const body = [data.get("message"), "", data.get("name"), data.get("email"), data.get("phone")]
    .filter((line, index) => index < 3 || line)
    .join("\n");
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t("form.subject"))}&body=${encodeURIComponent(body)}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let firstInvalid = null;
  form.querySelectorAll("[required]").forEach((field) => {
    const valid = field.checkValidity();
    field.setAttribute("aria-invalid", String(!valid));
    if (!valid && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) {
    setStatus(t("form.invalid"), "error");
    firstInvalid.focus();
    return;
  }

  const data = new FormData(form);
  submit.disabled = true;
  setStatus(t("form.sending"));
  try {
    const response = await fetch(form.action, { method: "POST", body: data });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "send failed");
    form.reset();
    setStatus(t("form.sent"), "ok");
  } catch {
    setStatus(t("form.fallback").replace("{email}", CONTACT_EMAIL), "error");
    openMailDraft(data);
  } finally {
    submit.disabled = false;
  }
});

applyLanguage(pickLang());
