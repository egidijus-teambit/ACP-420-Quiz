/* ACP-420 practice exam — app logic (vanilla JS, no build step).
 * Data is stored in the browser's localStorage, so attempts are kept per browser.
 * Use Export / Import on the Statistics page to move or merge results.
 */
(function () {
  "use strict";

  const CONFIG = {
    totalQuestions: 75,
    durationMin: 180,
    passPct: 66,
    lowTimeMin: 10,
    storeKey: "acp420.attempts.v1",
    progressKey: "acp420.inprogress.v1",
    themeKey: "acp420.theme"
  };

  const Q = window.QUESTIONS || [];
  const D = window.DOMAINS || {};
  const QMAP = Object.fromEntries(Q.map(q => [q.id, q]));
  const LETTERS = "ABCDEFGH";

  /* ---------- helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  function hashStr(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return h >>> 0;
  }
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function fmtDur(sec) {
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function sameSet(a, b) { if (a.length !== b.length) return false; const s = new Set(a); return b.every(x => s.has(x)); }

  /* ---------- storage (wrapped: storage may be unavailable) ---------- */
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } },
    del(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  };
  let memAttempts = null; // fallback when storage fails
  function getAttempts() { return memAttempts || store.get(CONFIG.storeKey, []); }
  function saveAttempts(list) { if (!store.set(CONFIG.storeKey, list)) memAttempts = list; }

  /* ---------- theme ---------- */
  function applyTheme(t) { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  applyTheme(store.get(CONFIG.themeKey, null));
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next); store.set(CONFIG.themeKey, next);
  });

  /* ---------- navigation ---------- */
  function show(view) {
    $$(".view").forEach(v => (v.hidden = v.id !== "view-" + view));
    const tab = view === "stats" ? "stats" : "start";
    $$(".nav button").forEach(b => b.setAttribute("aria-current", b.dataset.nav === tab ? "page" : "false"));
    window.scrollTo(0, 0);
  }
  $$(".nav button").forEach(b => b.addEventListener("click", () => {
    if (exam && b.dataset.nav !== "exam") {
      // leaving an active exam keeps progress (timer keeps running)
      saveProgress();
    }
    if (b.dataset.nav === "stats") renderStats();
    else if (exam) show("exam");
    else renderStart();
  }));

  /* ---------- exam building ---------- */
  function allocation(total) {
    const ids = Object.keys(D);
    const raw = ids.map(id => ({ id, v: (D[id].weight / 100) * total }));
    raw.forEach(r => (r.n = Math.floor(r.v)));
    let left = total - raw.reduce((s, r) => s + r.n, 0);
    raw.slice().sort((a, b) => (b.v - b.n) - (a.v - a.n)).forEach(r => { if (left > 0) { r.n++; left--; } });
    // never ask for more than the bank holds
    raw.forEach(r => { const avail = Q.filter(q => String(q.d) === r.id).length; r.n = Math.min(r.n, avail); });
    return Object.fromEntries(raw.map(r => [r.id, r.n]));
  }

  function buildExam(name, variant) {
    const alloc = allocation(CONFIG.totalQuestions);
    const selRand = variant === "R" ? Math.random : rng(hashStr("acp420-variant-" + variant));
    let picked = [];
    Object.keys(alloc).forEach(d => {
      const pool = Q.filter(q => String(q.d) === d).map(q => q.id).sort();
      picked = picked.concat(shuffle(pool, selRand).slice(0, alloc[d]));
    });
    const order = shuffle(picked); // order differs on every attempt
    const perm = {};
    order.forEach(id => (perm[id] = shuffle(QMAP[id].o.map((_, i) => i))));
    const now = Date.now();
    return {
      id: uid(), name, variant, startedAt: now, deadline: now + CONFIG.durationMin * 60000,
      qids: order, perm, answers: {}, flagged: [], current: 0
    };
  }

  /* ---------- START view ---------- */
  function renderStart() {
    show("start");
    $("#bankSize").textContent = Q.length + " questions";
    $("#passMark").textContent = CONFIG.passPct + "%";
    const alloc = allocation(CONFIG.totalQuestions);
    $("#weights").innerHTML = Object.keys(D).map(d => {
      const n = Q.filter(q => String(q.d) === d).length;
      return `<div class="small" style="margin-top:6px">${esc(D[d].name)} <span class="muted">· ${alloc[d]} in exam / ${n} in bank</span></div>
        <div class="weight-row"><div class="bar"><i style="width:${D[d].weight * 4}%"></i></div><span class="muted">${D[d].weight}%</span></div>`;
    }).join("");
    $("#poolInfo").textContent = `Draws ${CONFIG.totalQuestions} of ${Q.length} questions.`;
    const names = [...new Set(getAttempts().map(a => a.name))];
    $("#knownNames").innerHTML = names.map(n => `<option value="${esc(n)}">`).join("");
    if (!$("#nameInput").value && names.length) $("#nameInput").value = names[names.length - 1];

    const prog = store.get(CONFIG.progressKey, null);
    const box = $("#resumeBox");
    if (prog && prog.deadline > Date.now()) {
      const answered = Object.keys(prog.answers).length;
      box.innerHTML = `<div class="card resume" style="margin-bottom:16px">
        <h2>Unfinished exam</h2>
        <p class="lead" style="margin-bottom:12px">${esc(prog.name)} · Variant ${esc(prog.variant)} · ${answered}/${prog.qids.length} answered · ${fmtClock((prog.deadline - Date.now()) / 1000)} left</p>
        <div class="row"><button class="btn primary" id="resumeBtn">Resume</button><button class="btn danger" id="discardBtn">Discard</button></div></div>`;
      $("#resumeBtn").onclick = () => startExam(prog);
      $("#discardBtn").onclick = () => { store.del(CONFIG.progressKey); renderStart(); };
    } else if (prog) {
      // time ran out while away: grade what was answered
      exam = prog; finishExam(true);
      return;
    } else box.innerHTML = "";
  }

  $("#startForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#nameInput").value.trim();
    if (!name) { $("#nameInput").focus(); return; }
    const variant = ($("input[name=variant]:checked") || {}).value || "A";
    startExam(buildExam(name, variant));
  });

  /* ---------- EXAM view ---------- */
  let exam = null, tick = null;

  function saveProgress() { if (exam) store.set(CONFIG.progressKey, exam); }

  function startExam(state) {
    exam = state;
    saveProgress();
    show("exam");
    renderGrid();
    renderQuestion();
    clearInterval(tick);
    tick = setInterval(updateTimer, 1000);
    updateTimer();
  }

  function updateTimer() {
    if (!exam) return;
    const left = (exam.deadline - Date.now()) / 1000;
    const t = $("#timer");
    t.textContent = fmtClock(left);
    t.classList.toggle("low", left <= CONFIG.lowTimeMin * 60);
    if (left <= 0) finishExam(true);
  }

  function updateProgress() {
    const n = Object.keys(exam.answers).filter(k => exam.answers[k].length).length;
    $("#progressText").textContent = `${n} of ${exam.qids.length} answered · ${exam.flagged.length} flagged`;
    $("#progressBar").style.width = pct(n, exam.qids.length) + "%";
  }

  function renderGrid() {
    $("#qgrid").innerHTML = exam.qids.map((id, i) => {
      const cls = [(exam.answers[id] || []).length ? "answered" : "", exam.flagged.includes(id) ? "flagged" : "", i === exam.current ? "current" : ""].join(" ");
      return `<button class="${cls}" data-i="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`;
    }).join("");
    $$("#qgrid button").forEach(b => (b.onclick = () => go(+b.dataset.i)));
    updateProgress();
  }

  function renderQuestion() {
    const id = exam.qids[exam.current];
    const q = QMAP[id];
    const multi = q.type === "multi";
    const sel = exam.answers[id] || [];
    const flagged = exam.flagged.includes(id);
    const card = $("#questionCard");
    card.innerHTML = `
      <div class="qmeta">
        <span class="tag">Question ${exam.current + 1} of ${exam.qids.length}</span>
        <span class="tag">${esc(D[q.d].name)}</span>
        ${multi ? `<span class="tag multi">Select ${q.a.length}</span>` : `<span class="tag">Select 1</span>`}
      </div>
      <p class="qtext">${esc(q.q)}</p>
      <div class="options" role="${multi ? "group" : "radiogroup"}">
        ${exam.perm[id].map((orig, pos) => `
          <label class="opt">
            <input type="${multi ? "checkbox" : "radio"}" name="ans" value="${orig}" ${sel.includes(orig) ? "checked" : ""}>
            <span class="letter">${LETTERS[pos]}.</span><span>${esc(q.o[orig])}</span>
          </label>`).join("")}
      </div>
      <p class="small muted" id="multiHint" style="margin:10px 0 0;min-height:1.5em"></p>
      <div class="exam-nav">
        <button class="btn" id="prevBtn" ${exam.current === 0 ? "disabled" : ""}>← Previous</button>
        <button class="btn flag-btn" id="flagBtn" aria-pressed="${flagged}">${flagged ? "⚑ Flagged" : "⚐ Flag for review"}</button>
        ${exam.current < exam.qids.length - 1
          ? `<button class="btn primary" id="nextBtn">Next →</button>`
          : `<button class="btn primary" id="lastBtn">Review & finish</button>`}
      </div>`;

    $$("input[name=ans]", card).forEach(inp => inp.addEventListener("change", () => {
      let vals = $$("input[name=ans]:checked", card).map(x => +x.value);
      if (multi && vals.length > q.a.length) { // keep the limit like the real exam
        inp.checked = false; vals = vals.filter(v => v !== +inp.value);
        $("#multiHint").textContent = `You can select up to ${q.a.length} answers. Unselect one first.`;
      } else $("#multiHint").textContent = "";
      exam.answers[id] = vals;
      if (!vals.length) delete exam.answers[id];
      saveProgress(); renderGrid();
    }));
    $("#prevBtn").onclick = () => go(exam.current - 1);
    $("#flagBtn").onclick = () => {
      exam.flagged = flagged ? exam.flagged.filter(x => x !== id) : exam.flagged.concat(id);
      saveProgress(); renderQuestion(); renderGrid();
    };
    if ($("#nextBtn")) $("#nextBtn").onclick = () => go(exam.current + 1);
    if ($("#lastBtn")) $("#lastBtn").onclick = askFinish;
  }

  function go(i) {
    if (i < 0 || i >= exam.qids.length) return;
    exam.current = i; saveProgress(); renderQuestion(); renderGrid();
    $("#questionCard").scrollIntoView({ block: "nearest" });
  }

  document.addEventListener("keydown", e => {
    if (!exam || $("#view-exam").hidden || $("#confirmDlg").open) return;
    if (e.target.tagName === "INPUT" && e.target.type === "text") return;
    if (e.key === "ArrowRight") go(exam.current + 1);
    if (e.key === "ArrowLeft") go(exam.current - 1);
  });

  $("#finishBtn").onclick = askFinish;
  function askFinish() {
    const unanswered = exam.qids.filter(id => !(exam.answers[id] || []).length).length;
    const parts = [];
    if (unanswered) parts.push(`<b>${unanswered}</b> unanswered`);
    if (exam.flagged.length) parts.push(`<b>${exam.flagged.length}</b> flagged`);
    $("#dlgText").innerHTML = parts.length
      ? `You still have ${parts.join(" and ")} question(s). Unanswered questions count as wrong.`
      : "All questions are answered. Submit your exam?";
    const dlg = $("#confirmDlg");
    dlg.showModal();
    $("#dlgCancel").onclick = () => dlg.close();
    $("#dlgOk").onclick = () => { dlg.close(); finishExam(false); };
  }

  /* ---------- grading ---------- */
  function finishExam(timedOut) {
    if (!exam) return;
    clearInterval(tick);
    const end = Math.min(Date.now(), exam.deadline);
    const perDomain = {};
    let correct = 0;
    const results = {};
    exam.qids.forEach(id => {
      const q = QMAP[id];
      const sel = exam.answers[id] || [];
      const ok = sel.length > 0 && sameSet(sel, q.a);
      results[id] = ok;
      if (ok) correct++;
      const d = perDomain[q.d] || (perDomain[q.d] = { c: 0, t: 0 });
      d.t++; if (ok) d.c++;
    });
    const total = exam.qids.length;
    const attempt = {
      id: exam.id, name: exam.name, variant: exam.variant,
      startedAt: exam.startedAt, finishedAt: end,
      durationSec: Math.round((end - exam.startedAt) / 1000),
      timedOut: !!timedOut,
      qids: exam.qids, perm: exam.perm, answers: exam.answers, flagged: exam.flagged,
      results, perDomain, correct, total,
      unanswered: exam.qids.filter(id => !(exam.answers[id] || []).length).length,
      score: pct(correct, total), passed: pct(correct, total) >= CONFIG.passPct
    };
    const list = getAttempts();
    if (!list.some(a => a.id === attempt.id)) list.push(attempt);
    saveAttempts(list);
    store.del(CONFIG.progressKey);
    exam = null;
    renderResults(attempt.id, timedOut);
  }

  /* ---------- RESULTS view ---------- */
  function renderResults(attemptId, timedOut) {
    const a = getAttempts().find(x => x.id === attemptId);
    if (!a) { renderStats(); return; }
    show("results");
    const wrong = a.total - a.correct - a.unanswered;
    const domRows = Object.keys(D).filter(d => a.perDomain[d]).map(d => {
      const p = a.perDomain[d]; const s = pct(p.c, p.t);
      return `<tr><td>${esc(D[d].name)}</td><td class="num">${p.c}/${p.t}</td>
        <td style="width:40%"><div class="bar"><i style="width:${s}%"></i></div></td><td class="num">${s}%</td></tr>`;
    }).join("");

    const v = $("#view-results");
    v.innerHTML = `
      ${timedOut ? `<div class="card resume" style="margin-bottom:16px"><b>Time's up.</b> Your exam was submitted automatically.</div>` : ""}
      <div class="card">
        <div class="score-hero">
          <div><div class="score-num">${a.score}%</div><div class="muted small">${a.correct} of ${a.total} correct</div></div>
          <div>
            <span class="badge ${a.passed ? "pass" : "fail"}">${a.passed ? "✓ Passed" : "✕ Not passed"}</span>
            <div class="small muted" style="margin-top:6px">Passing mark ${CONFIG.passPct}% · ${esc(a.name)} · Variant ${esc(a.variant)} · ${fmtDate(a.finishedAt)}</div>
          </div>
          <div class="row" style="margin-left:auto">
            <button class="btn" id="toStats">Statistics</button>
            <button class="btn primary" id="retake">Take another exam</button>
          </div>
        </div>
        <div class="kpis">
          <div class="kpi"><b>${a.correct}</b><span>Correct</span></div>
          <div class="kpi"><b>${wrong}</b><span>Wrong</span></div>
          <div class="kpi"><b>${a.unanswered}</b><span>Unanswered</span></div>
          <div class="kpi"><b>${fmtDur(a.durationSec)}</b><span>Time used of ${CONFIG.durationMin}m</span></div>
        </div>
      </div>
      <div class="card">
        <h2>Score by topic</h2>
        <table class="dom-table"><thead><tr><th>Topic</th><th class="num">Correct</th><th></th><th class="num">Score</th></tr></thead><tbody>${domRows}</tbody></table>
      </div>
      <div class="card">
        <h2>Review answers</h2>
        <div class="filters" id="revFilters">
          ${[["all", "All"], ["wrong", "Incorrect"], ["correct", "Correct"], ["unanswered", "Unanswered"], ["flagged", "Flagged"]]
            .map(([k, l], i) => `<button class="chip" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join("")}
          <select id="revDomain" style="width:auto;max-width:260px;padding:5px 10px;border-radius:999px;font-size:13px">
            <option value="">All topics</option>${Object.keys(D).map(d => `<option value="${d}">${esc(D[d].name)}</option>`).join("")}
          </select>
        </div>
        <div id="reviewList"></div>
      </div>`;
    $("#toStats").onclick = renderStats;
    $("#retake").onclick = renderStart;
    let filter = "all", dom = "";
    const draw = () => { $("#reviewList").innerHTML = reviewHtml(a, filter, dom); };
    $$("#revFilters .chip").forEach(c => c.onclick = () => {
      filter = c.dataset.f; $$("#revFilters .chip").forEach(x => x.setAttribute("aria-pressed", x === c)); draw();
    });
    $("#revDomain").onchange = e => { dom = e.target.value; draw(); };
    draw();
  }

  function reviewHtml(a, filter, dom) {
    const items = a.qids.map((id, i) => ({ id, i })).filter(({ id }) => {
      const q = QMAP[id]; if (!q) return false;
      if (dom && String(q.d) !== dom) return false;
      const sel = a.answers[id] || [];
      if (filter === "wrong") return !a.results[id] && sel.length;
      if (filter === "correct") return a.results[id];
      if (filter === "unanswered") return !sel.length;
      if (filter === "flagged") return (a.flagged || []).includes(id);
      return true;
    });
    if (!items.length) return `<div class="empty">No questions match this filter.</div>`;
    return items.map(({ id, i }) => {
      const q = QMAP[id]; const sel = a.answers[id] || []; const ok = a.results[id];
      const order = (a.perm && a.perm[id]) || q.o.map((_, k) => k);
      return `<div class="review-item ${ok ? "correct" : "wrong"}">
        <div class="qmeta">
          <span class="tag">Q${i + 1}</span><span class="tag">${esc(D[q.d].name)}</span>
          <span class="badge ${ok ? "pass" : "fail"}">${ok ? "✓ Correct" : sel.length ? "✕ Incorrect" : "– Unanswered"}</span>
          ${(a.flagged || []).includes(id) ? `<span class="tag multi">⚑ Flagged</span>` : ""}
        </div>
        <p class="qtext">${esc(q.q)}</p>
        <div class="options">
          ${order.map((orig, pos) => {
            const isC = q.a.includes(orig), picked = sel.includes(orig);
            const cls = isC ? "is-correct" : picked ? "is-wrong" : "";
            const mark = isC && picked ? "✓ Your answer · correct" : isC ? "✓ Correct answer" : picked ? "✕ Your answer" : "";
            return `<div class="opt ${cls}"><span class="letter">${LETTERS[pos]}.</span><span>${esc(q.o[orig])}</span><span class="mark">${mark}</span></div>`;
          }).join("")}
        </div>
        <div class="explain"><b>Explanation</b>${esc(q.e)}</div>
      </div>`;
    }).join("");
  }

  /* ---------- STATS view ---------- */
  let statsName = "";
  let cmp = { a: "", b: "" };

  function renderStats() {
    show("stats");
    const all = getAttempts().slice().sort((x, y) => x.finishedAt - y.finishedAt);
    const v = $("#view-stats");
    if (!all.length) {
      v.innerHTML = `<div class="card empty"><h2>No attempts yet</h2><p>Finish an exam and your results show up here.</p>
        <div class="row" style="justify-content:center"><button class="btn primary" id="goStart">Start an exam</button>
        <label class="btn">Import results<input type="file" id="importFile" accept="application/json" hidden></label></div></div>`;
      $("#goStart").onclick = renderStart;
      $("#importFile").onchange = importFile;
      return;
    }
    const names = [...new Set(all.map(a => a.name))].sort((a, b) => a.localeCompare(b));
    if (statsName && !names.includes(statsName)) statsName = "";
    const list = statsName ? all.filter(a => a.name === statsName) : all;

    const avg = Math.round(list.reduce((s, a) => s + a.score, 0) / list.length);
    const best = Math.max(...list.map(a => a.score));
    const passRate = pct(list.filter(a => a.passed).length, list.length);
    const avgTime = Math.round(list.reduce((s, a) => s + a.durationSec, 0) / list.length);

    // overlap with previous attempt of the same person
    const prevOf = {};
    const lastBy = {};
    all.forEach(a => { if (lastBy[a.name]) prevOf[a.id] = lastBy[a.name]; lastBy[a.name] = a; });
    const overlap = (a, b) => { const s = new Set(b.qids); return a.qids.filter(x => s.has(x)).length; };

    // domain averages
    const domAgg = {};
    list.forEach(a => Object.entries(a.perDomain).forEach(([d, p]) => {
      const g = domAgg[d] || (domAgg[d] = { c: 0, t: 0 }); g.c += p.c; g.t += p.t;
    }));

    // most missed
    const miss = {};
    list.forEach(a => a.qids.forEach(id => {
      const m = miss[id] || (miss[id] = { asked: 0, wrong: 0 }); m.asked++; if (!a.results[id]) m.wrong++;
    }));
    const missed = Object.entries(miss).filter(([id, m]) => m.wrong > 0 && QMAP[id])
      .sort((x, y) => (y[1].wrong / y[1].asked) - (x[1].wrong / x[1].asked) || y[1].wrong - x[1].wrong).slice(0, 10);

    const rows = list.slice().reverse().map(a => {
      const p = prevOf[a.id];
      const ov = p ? overlap(a, p) : null;
      return `<tr>
        <td>${fmtDate(a.finishedAt)}</td><td>${esc(a.name)}</td><td>${esc(a.variant)}</td>
        <td class="num"><b>${a.score}%</b></td><td class="num">${a.correct}/${a.total}</td>
        <td><span class="badge ${a.passed ? "pass" : "fail"}">${a.passed ? "✓ Pass" : "✕ Fail"}</span></td>
        <td class="num">${fmtDur(a.durationSec)}${a.timedOut ? " ⏱" : ""}</td>
        <td class="num">${ov === null ? "–" : `${ov}/${a.total} same · ${a.total - ov} new`}</td>
        <td><button class="btn small" data-open="${a.id}" style="padding:4px 10px">Review</button></td></tr>`;
    }).join("");

    const opts = sel => list.slice().reverse().map(a =>
      `<option value="${a.id}" ${sel === a.id ? "selected" : ""}>${esc(a.name)} · ${esc(a.variant)} · ${a.score}% · ${fmtDate(a.finishedAt)}</option>`).join("");
    if (!list.some(a => a.id === cmp.a)) cmp.a = list.length > 1 ? list[list.length - 2].id : list[0].id;
    if (!list.some(a => a.id === cmp.b)) cmp.b = list[list.length - 1].id;

    v.innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <h1 style="margin:0">Statistics</h1>
          <div class="row">
            <select id="nameFilter" style="width:auto"><option value="">Everyone (${names.length})</option>
              ${names.map(n => `<option ${n === statsName ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
          </div>
        </div>
        <div class="stat-tiles" style="margin-top:16px">
          <div class="kpi"><b>${list.length}</b><span>Attempts</span></div>
          <div class="kpi"><b>${avg}%</b><span>Average score</span></div>
          <div class="kpi"><b>${best}%</b><span>Best score</span></div>
          <div class="kpi"><b>${passRate}%</b><span>Pass rate</span></div>
          <div class="kpi"><b>${fmtDur(avgTime)}</b><span>Average time</span></div>
        </div>
      </div>

      <div class="card">
        <h2>Score per attempt ${statsName ? "– " + esc(statsName) : "– everyone"}</h2>
        <div class="legend"><span><i style="background:var(--series-1)"></i>Score</span><span><i style="background:none;border-top:1px dashed var(--muted);border-radius:0;height:0;width:14px"></i>Passing mark ${CONFIG.passPct}%</span></div>
        ${trendChart(list)}
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>Average by topic</h2>
          <table class="dom-table"><tbody>
          ${Object.keys(D).filter(d => domAgg[d]).map(d => { const s = pct(domAgg[d].c, domAgg[d].t);
            return `<tr><td>${esc(D[d].name)}</td><td style="width:35%"><div class="bar"><i style="width:${s}%"></i></div></td><td class="num">${s}%</td></tr>`; }).join("")}
          </tbody></table>
          <p class="small muted" style="margin:10px 0 0">Weakest topics first deserve the most study time.</p>
        </div>
        <div class="card">
          <h2>Most missed questions</h2>
          ${missed.length ? `<ol class="small" style="padding-left:18px;margin:0">${missed.map(([id, m]) =>
            `<li style="margin-bottom:8px">${esc(QMAP[id].q.length > 120 ? QMAP[id].q.slice(0, 117) + "…" : QMAP[id].q)}
             <div class="muted">Missed ${m.wrong} of ${m.asked} · ${esc(D[QMAP[id].d].name)}</div></li>`).join("")}</ol>`
            : `<p class="muted">No missed questions. Nice.</p>`}
        </div>
      </div>

      <div class="card">
        <h2>Compare two attempts</h2>
        <div class="grid-2" style="gap:10px">
          <label class="field"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--series-1);margin-right:6px"></i>Attempt 1</span><select id="cmpA">${opts(cmp.a)}</select></label>
          <label class="field"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--series-2);margin-right:6px"></i>Attempt 2</span><select id="cmpB">${opts(cmp.b)}</select></label>
        </div>
        <div id="cmpOut"></div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <h2 style="margin:0">All attempts</h2>
          <div class="row">
            <button class="btn" id="exportBtn">Export JSON</button>
            <label class="btn">Import JSON<input type="file" id="importFile" accept="application/json" hidden></label>
            <button class="btn danger" id="clearBtn">${statsName ? "Delete " + esc(statsName) + "'s attempts" : "Delete all"}</button>
          </div>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Finished</th><th>Name</th><th>Variant</th><th class="num">Score</th><th class="num">Correct</th><th>Result</th><th class="num">Time</th><th class="num">vs. previous attempt</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <p class="small muted" style="margin:10px 0 0">"vs. previous attempt" shows how many questions were repeated from the same person's previous attempt. Results are stored in this browser only; use Export/Import to share or merge them.</p>
      </div>`;

    $("#nameFilter").onchange = e => { statsName = e.target.value; renderStats(); };
    $$("[data-open]").forEach(b => (b.onclick = () => renderResults(b.dataset.open)));
    $("#cmpA").onchange = e => { cmp.a = e.target.value; drawCompare(list); };
    $("#cmpB").onchange = e => { cmp.b = e.target.value; drawCompare(list); };
    $("#exportBtn").onclick = exportData;
    $("#importFile").onchange = importFile;
    $("#clearBtn").onclick = () => {
      const msg = statsName ? `Delete all attempts by ${statsName}?` : "Delete ALL stored attempts? This can't be undone.";
      if (!confirm(msg)) return;
      saveAttempts(statsName ? getAttempts().filter(a => a.name !== statsName) : []);
      statsName = ""; renderStats();
    };
    drawCompare(list);
    bindTips(v);
  }

  function drawCompare(list) {
    const A = list.find(a => a.id === cmp.a), B = list.find(a => a.id === cmp.b);
    const out = $("#cmpOut");
    if (!A || !B) { out.innerHTML = ""; return; }
    if (A.id === B.id) { out.innerHTML = `<p class="muted">Pick two different attempts.</p>`; return; }
    const setB = new Set(B.qids);
    const shared = A.qids.filter(x => setB.has(x));
    const bothMissed = shared.filter(id => !A.results[id] && !B.results[id]);
    const fixed = shared.filter(id => !A.results[id] && B.results[id]);
    const regressed = shared.filter(id => A.results[id] && !B.results[id]);
    const diff = B.score - A.score;
    out.innerHTML = `
      <div class="kpis">
        <div class="kpi"><b>${A.score}% → ${B.score}%</b><span>Score change ${diff >= 0 ? "+" : ""}${diff} pts</span></div>
        <div class="kpi"><b>${shared.length}/${A.total}</b><span>Questions in both (${pct(shared.length, A.total)}%)</span></div>
        <div class="kpi"><b>${fixed.length} / ${regressed.length}</b><span>Shared: now right / now wrong</span></div>
        <div class="kpi"><b>${bothMissed.length}</b><span>Missed in both</span></div>
      </div>
      <table class="dom-table cmp-bars" style="margin-top:14px"><thead><tr><th>Topic</th><th></th><th class="num">1</th><th class="num">2</th></tr></thead><tbody>
      ${Object.keys(D).map(d => {
        const a = A.perDomain[d], b = B.perDomain[d]; const sa = a ? pct(a.c, a.t) : 0, sb = b ? pct(b.c, b.t) : 0;
        return `<tr><td>${esc(D[d].name)}</td><td style="width:35%"><div class="pair">
          <div class="bar s1"><i style="width:${sa}%"></i></div><div class="bar s2"><i style="width:${sb}%"></i></div></div></td>
          <td class="num">${sa}%</td><td class="num">${sb}%</td></tr>`;
      }).join("")}</tbody></table>
      ${bothMissed.length ? `<details style="margin-top:16px"><summary style="cursor:pointer;font-weight:600">Missed in both attempts (${bothMissed.length})</summary><ul class="small" style="padding-left:18px">${bothMissed.map(id =>
        `<li style="margin-bottom:6px">${esc(QMAP[id].q)}<div class="muted">Answer: ${esc(QMAP[id].a.map(i => QMAP[id].o[i]).join(" + "))}</div></li>`).join("")}</ul></details>` : ""}`;
  }

  function trendChart(list) {
    const W = 760, H = 240, P = { l: 36, r: 16, t: 12, b: 28 };
    const n = list.length;
    const x = i => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (n - 1));
    const y = v => P.t + (1 - v / 100) * (H - P.t - P.b);
    const grid = [0, 25, 50, 75, 100].map(g =>
      `<line class="gridline" x1="${P.l}" x2="${W - P.r}" y1="${y(g)}" y2="${y(g)}"/><text x="${P.l - 6}" y="${y(g) + 4}" text-anchor="end">${g}%</text>`).join("");
    const path = list.map((a, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(a.score).toFixed(1)}`).join(" ");
    const step = Math.ceil(n / 10);
    const labels = list.map((a, i) => (i % step === 0 || i === n - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">#${i + 1}</text>` : "").join("");
    const dots = list.map((a, i) =>
      `<g data-tip="${esc(`#${i + 1} ${a.name} · Variant ${a.variant} · ${a.score}% · ${fmtDate(a.finishedAt)}`)}">
        <circle cx="${x(i)}" cy="${y(a.score)}" r="14" fill="transparent"/><circle class="dot" cx="${x(i)}" cy="${y(a.score)}" r="5"/></g>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score per attempt">
      ${grid}<line class="threshold" x1="${P.l}" x2="${W - P.r}" y1="${y(CONFIG.passPct)}" y2="${y(CONFIG.passPct)}"/>
      ${n > 1 ? `<path class="line" d="${path}"/>` : ""}${dots}${labels}</svg>`;
  }

  let tipEl = null;
  function bindTips(root) {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "chart-tip"; tipEl.hidden = true; document.body.appendChild(tipEl); }
    $$("[data-tip]", root).forEach(g => {
      g.addEventListener("mouseenter", () => { tipEl.textContent = g.dataset.tip; tipEl.hidden = false; });
      g.addEventListener("mousemove", e => { tipEl.style.left = e.clientX + "px"; tipEl.style.top = e.clientY - 8 + "px"; });
      g.addEventListener("mouseleave", () => (tipEl.hidden = true));
    });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: "acp420-quiz", version: 1, exportedAt: new Date().toISOString(), attempts: getAttempts() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `acp420-results-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importFile(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        const incoming = Array.isArray(data) ? data : data.attempts;
        if (!Array.isArray(incoming)) throw new Error("No attempts found");
        const list = getAttempts(); const ids = new Set(list.map(a => a.id));
        let added = 0;
        incoming.forEach(a => { if (a && a.id && a.qids && !ids.has(a.id)) { list.push(a); added++; } });
        saveAttempts(list);
        alert(`Imported ${added} new attempt(s).`);
        renderStats();
      } catch (err) { alert("Couldn't import this file: " + err.message); }
    };
    r.readAsText(f);
  }

  /* ---------- boot ---------- */
  renderStart();
})();
