/* Site behaviour. No dependencies; every page still reads fine without it. */

(() => {
    "use strict";

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const EMAIL = "tyaghchi@uwaterloo.ca";

    /* Theme ---------------------------------------------------------------- */

    const root = document.documentElement;

    function setTheme(theme) {
        root.dataset.theme = theme;
        try { localStorage.setItem("theme", theme); } catch (e) { /* private mode */ }
        document.dispatchEvent(new CustomEvent("themechange"));
    }
    const toggleTheme = () => setTheme(root.dataset.theme === "light" ? "dark" : "light");

    $(".theme-toggle")?.addEventListener("click", toggleTheme);

    /* Mobile nav ------------------------------------------------------------ */

    const header = $(".site-header");
    const menu = $(".menu-toggle");

    function setMenu(open) {
        header.classList.toggle("nav-open", open);
        menu.setAttribute("aria-expanded", String(open));
    }
    menu?.addEventListener("click", () => setMenu(!header.classList.contains("nav-open")));
    document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

    /* Deep links: land on the target once layout has settled ----------------- */

    if (location.hash.length > 1) {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) {
            const land = () => target.scrollIntoView({ behavior: "instant", block: "start" });
            if (document.readyState === "complete") land();
            else addEventListener("load", land, { once: true });
        }
    }

    /* Copy email ------------------------------------------------------------ */

    async function copyEmail() {
        try {
            await navigator.clipboard.writeText(EMAIL);
            return true;
        } catch (e) {
            return false;
        }
    }

    $$(".copy").forEach(btn => {
        const label = $("span", btn);
        const original = label.textContent;
        btn.addEventListener("click", async () => {
            const ok = await copyEmail();
            label.textContent = ok ? "Copied" : "Press ⌘C";
            btn.classList.toggle("done", ok);
            setTimeout(() => {
                label.textContent = original;
                btn.classList.remove("done");
            }, 1800);
        });
    });

    /* Filters (projects + experience) --------------------------------------- */

    $$("[data-filter-group]").forEach(group => {
        const buttons = $$(".filter", group);
        const items = $$("[data-cat]");
        const sections = $$("[data-filter-section]");

        buttons.forEach(btn => {
            btn.addEventListener("click", () => {
                const value = btn.dataset.value;
                buttons.forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
                items.forEach(item => {
                    item.hidden = value !== "all" && !item.dataset.cat.split(" ").includes(value);
                });
                sections.forEach(section => {
                    section.hidden = !$$("[data-cat]", section).some(item => !item.hidden);
                });
            });
        });
    });

    /* Stack explorer: traces from the selected layer to the work that uses it */

    const stack = $(".stack");
    if (stack) {
        const svg = $(".stack-traces", stack);
        const layers = $$(".layer", stack);
        const items = $$(".stack-item", stack);
        let active = layers.find(l => l.getAttribute("aria-pressed") === "true") || layers[0];

        function drawTraces() {
            svg.replaceChildren();
            if (getComputedStyle(svg).display === "none") return;

            const box = stack.getBoundingClientRect();
            const from = active.getBoundingClientRect();
            const x0 = from.right - box.left;
            const y0 = from.top + from.height / 2 - box.top;
            const targets = items.filter(i => !i.classList.contains("off"));
            const left = $(".stack-items", stack).getBoundingClientRect().left - box.left;
            const ns = "http://www.w3.org/2000/svg";
            const add = (name, attrs) => {
                const el = document.createElementNS(ns, name);
                Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
                svg.appendChild(el);
                return el;
            };

            targets.forEach((item, i) => {
                const r = item.getBoundingClientRect();
                const y1 = r.top + r.height / 2 - box.top;
                const x1 = left - 12;
                const dy = y1 - y0;
                const bend = Math.min(Math.abs(dy), (x1 - x0) * .55);
                const startX = x0 + Math.max(10, (x1 - x0 - bend) * .3 + (i * 6));
                const d = `M${x0} ${y0} H${startX}` +
                    (Math.abs(dy) > bend
                        ? ` L${startX + bend} ${y0 + Math.sign(dy) * bend} V${y1} H${x1}`
                        : ` L${startX + Math.abs(dy)} ${y1} H${x1}`);
                add("path", { d });
                const pulse = add("path", { d, class: "pulse" });
                pulse.style.animationDelay = `${i * -.5}s`;
                add("circle", { cx: x1, cy: y1, r: 3.5 });
            });
        }

        function select(layer) {
            active = layer;
            layers.forEach(l => l.setAttribute("aria-pressed", String(l === layer)));
            const name = layer.dataset.layer;
            items.forEach(item => {
                item.classList.toggle("off", !item.dataset.layers.split(" ").includes(name));
            });
            drawTraces();
        }

        layers.forEach(layer => layer.addEventListener("click", () => select(layer)));
        select(active);

        new ResizeObserver(drawTraces).observe(stack);
        document.fonts?.ready.then(drawTraces);
    }

    /* Hero: 3D board (js/board3d.js), or this flat version without WebGL ------- */

    const canvas = $("#board");
    if (canvas) {
        const startFlat = c => {
            c.classList.add("flat", "ready");
            initBoard(c);
        };
        let hasWebGL = false;
        try {
            hasWebGL = !!document.createElement("canvas").getContext("webgl2");
        } catch (e) { /* treated as unsupported */ }

        if (!hasWebGL) {
            startFlat(canvas);
        } else {
            import("./board3d.js")
                .then(m => m.initBoard3D(canvas, canvas.parentElement, { reducedMotion }))
                .catch(() => {
                    const fresh = canvas.cloneNode(false);
                    canvas.replaceWith(fresh);
                    startFlat(fresh);
                });
        }
    }

    function initBoard(canvas) {
        const hero = canvas.parentElement;
        const ctx = canvas.getContext("2d");
        const base = document.createElement("canvas");

        let W = 0, H = 0, DPR = 1;
        let traces = [], chip = null, accent = "#e9975f";
        const pulses = [];
        let running = false, last = 0, spawnIn = 0;

        function rng(seed) {
            return () => {
                seed = (seed + 0x6D2B79F5) | 0;
                let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }

        function layout() {
            const rand = rng(20260);
            const mobile = W < 900;
            const size = mobile ? 92 : Math.max(120, Math.min(W, H) * .25);
            const cx = mobile ? W * .66 : W * .73;
            const cy = mobile ? 128 : H * .43;
            const pins = mobile ? 7 : 11;
            const half = (pins - 1) / 2;
            const pitch = (size * .78) / (pins - 1);
            const padLen = size * .09;
            const spread = pitch * (mobile ? 1.5 : 1.9);
            const step = pitch * .9;
            const reach = Math.hypot(W, H);

            chip = { cx, cy, size, pins, pitch, padLen };
            traces = [];

            for (let side = 0; side < 4; side++) {
                const cos = Math.round(Math.cos(side * Math.PI / 2));
                const sin = Math.round(Math.sin(side * Math.PI / 2));
                const place = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];

                for (let i = -half; i <= half; i++) {
                    const y = i * pitch;
                    const x0 = size / 2 + padLen;
                    const xb = x0 + (half - Math.abs(i)) * step + 12;
                    const disp = i * spread;
                    const xd = xb + Math.abs(disp);
                    const yd = y + disp;
                    const toEdge = rand() < .42;
                    const len = toEdge ? reach : (36 + rand() * Math.min(W, H) * .4);
                    const pts = [[x0, y], [xb, y], [xd, yd], [xd + len, yd]].map(p => place(p[0], p[1]));
                    const lengths = [];
                    let total = 0;
                    for (let k = 1; k < pts.length; k++) {
                        const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
                        lengths.push(l);
                        total += l;
                    }
                    traces.push({ pts, lengths, total, via: !toEdge, passive: !toEdge && rand() < .3 });
                }
            }
        }

        function drawScene(g, trace, pad, silk, chipFill, chipLine) {
            g.clearRect(0, 0, W, H);
            g.lineJoin = "round";
            g.lineCap = "round";

            /* Faint placement grid */
            g.fillStyle = silk;
            g.globalAlpha = .22;
            for (let x = 14; x < W; x += 28) {
                for (let y = 14; y < H; y += 28) g.fillRect(x, y, 1, 1);
            }
            g.globalAlpha = 1;

            /* Traces */
            g.strokeStyle = trace;
            g.lineWidth = 1.25;
            traces.forEach(t => {
                g.beginPath();
                t.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
                g.stroke();
            });

            /* Vias + passives */
            traces.forEach(t => {
                const end = t.pts[t.pts.length - 1];
                const prev = t.pts[t.pts.length - 2];
                if (t.via) {
                    g.strokeStyle = pad;
                    g.lineWidth = 1.5;
                    g.beginPath();
                    g.arc(end[0], end[1], 3.2, 0, Math.PI * 2);
                    g.stroke();
                }
                if (t.passive) {
                    const horizontal = Math.abs(end[1] - prev[1]) < 1;
                    const mx = (end[0] + prev[0]) / 2;
                    const my = (end[1] + prev[1]) / 2;
                    g.fillStyle = pad;
                    for (const s of [-5, 5]) {
                        if (horizontal) g.fillRect(mx + s - 2.5, my - 3.5, 5, 7);
                        else g.fillRect(mx - 3.5, my + s - 2.5, 7, 5);
                    }
                }
            });

            /* Chip */
            const { cx, cy, size, pins, pitch, padLen } = chip;
            const half = (pins - 1) / 2;
            g.fillStyle = pad;
            for (let i = -half; i <= half; i++) {
                const o = i * pitch;
                const w = Math.max(2.5, pitch * .46);
                g.fillRect(cx + size / 2 - 2, cy + o - w / 2, padLen + 2, w);
                g.fillRect(cx - size / 2 - padLen, cy + o - w / 2, padLen + 2, w);
                g.fillRect(cx + o - w / 2, cy + size / 2 - 2, w, padLen + 2);
                g.fillRect(cx + o - w / 2, cy - size / 2 - padLen, w, padLen + 2);
            }

            g.fillStyle = chipFill;
            g.strokeStyle = chipLine;
            g.lineWidth = 1;
            g.beginPath();
            g.roundRect(cx - size / 2, cy - size / 2, size, size, 4);
            g.fill();
            g.stroke();

            g.fillStyle = chipLine;
            g.beginPath();
            g.arc(cx - size / 2 + size * .11, cy - size / 2 + size * .11, Math.max(2, size * .02), 0, Math.PI * 2);
            g.fill();

            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillStyle = silk;
            g.font = `500 ${Math.round(size * .17)}px "IBM Plex Mono", monospace`;
            g.fillText("TY", cx, cy - size * .05);
            g.font = `400 ${Math.max(8, Math.round(size * .07))}px "IBM Plex Mono", monospace`;
            g.fillText("WATERLOO, ON", cx, cy + size * .15);
        }

        function paintLayers() {
            const css = getComputedStyle(root);
            const v = name => css.getPropertyValue(name).trim();
            accent = v("--accent");

            for (const c of [base]) {
                c.width = canvas.width;
                c.height = canvas.height;
                c.getContext("2d").setTransform(DPR, 0, 0, DPR, 0, 0);
            }

            drawScene(base.getContext("2d"), v("--trace"), v("--pad"), v("--silk"), v("--surface"), v("--line-strong"));
        }

        function resize() {
            const r = hero.getBoundingClientRect();
            W = r.width;
            H = r.height;
            DPR = Math.min(devicePixelRatio || 1, 2);
            canvas.width = Math.round(W * DPR);
            canvas.height = Math.round(H * DPR);
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            layout();
            paintLayers();
            pulses.length = 0;
            frame(0);
        }

        function pointAt(t, dist) {
            let d = Math.max(0, dist);
            for (let i = 0; i < t.lengths.length; i++) {
                if (d <= t.lengths[i]) {
                    const a = t.pts[i], b = t.pts[i + 1], f = t.lengths[i] ? d / t.lengths[i] : 0;
                    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, i];
                }
                d -= t.lengths[i];
            }
            const e = t.pts[t.pts.length - 1];
            return [e[0], e[1], t.lengths.length - 1];
        }

        function drawPulse(p) {
            const tail = 90;
            const head = pointAt(p.t, p.d);
            const back = pointAt(p.t, p.d - tail);
            const g = ctx.createLinearGradient(back[0], back[1], head[0], head[1]);
            g.addColorStop(0, "rgba(0,0,0,0)");
            g.addColorStop(1, accent);

            ctx.strokeStyle = (back[0] === head[0] && back[1] === head[1]) ? accent : g;
            ctx.lineWidth = 1.75;
            ctx.beginPath();
            ctx.moveTo(back[0], back[1]);
            for (let i = back[2] + 1; i <= head[2]; i++) ctx.lineTo(p.t.pts[i][0], p.t.pts[i][1]);
            ctx.lineTo(head[0], head[1]);
            ctx.stroke();

            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(head[0], head[1], 1.9, 0, Math.PI * 2);
            ctx.fill();
        }

        function frame(now) {
            if (!canvas.width || !canvas.height) {
                if (running) requestAnimationFrame(frame);
                return;
            }

            const dt = last ? Math.min((now - last) / 1000, .05) : 0;
            last = now;

            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(base, 0, 0, W, H);

            if (!reducedMotion) {
                spawnIn -= dt;
                if (spawnIn <= 0 && pulses.length < 9 && traces.length) {
                    spawnIn = .28 + Math.random() * .4;
                    const t = traces[Math.floor(Math.random() * traces.length)];
                    const limit = Math.min(t.total, Math.hypot(W, H) * .8);
                    pulses.push({ t, d: 0, v: 200 + Math.random() * 150, limit });
                }
                for (let i = pulses.length - 1; i >= 0; i--) {
                    const p = pulses[i];
                    p.d += p.v * dt;
                    drawPulse(p);
                    if (p.d - 90 > p.limit) pulses.splice(i, 1);
                }
            }

            if (running) requestAnimationFrame(frame);
        }

        function start() {
            if (running || reducedMotion) return;
            running = true;
            last = 0;
            requestAnimationFrame(frame);
        }
        function stop() { running = false; }

        let resizeTimer;
        new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resize, 120);
        }).observe(hero);

        document.addEventListener("themechange", () => {
            paintLayers();
            if (!running) frame(0);
        });

        new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) start(); else stop();
        }).observe(hero);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) stop();
            else start();
        });

        resize();
        document.fonts?.ready.then(() => { paintLayers(); if (!running) frame(0); });
    }

    /* Command palette (⌘K) ---------------------------------------------------- */

    const dialog = $("#cmdk");
    if (dialog) {
        const input = $(".cmdk-input", dialog);
        const list = $(".cmdk-list", dialog);
        const go = url => () => { location.href = url; };
        const open = url => () => { window.open(url, "_blank", "noopener"); };

        const commands = [
            ["Home", "Page", go("index.html")],
            ["Projects", "Page", go("projects.html")],
            ["Experience", "Page", go("experience.html")],
            ["About", "Page", go("about.html")],
            ["Contact", "Page", go("contact.html")],
            ["Privacy Policy", "Page", go("privacy.html")],
            ["Automated Medicine Dispenser", "Project", go("projects.html#medicine-dispenser")],
            ["Campus Study Spot Finder", "Project", go("projects.html#study-spot")],
            ["AI Study Assistant", "Project", go("projects.html#ai-study-assistant")],
            ["WiFi Controlled RC Car", "Project", go("projects.html#rc-car")],
            ["Copy email address", "Action", () => { copyEmail(); }],
            ["Switch light / dark theme", "Action", toggleTheme],
            ["Open GitHub", "Link", open("https://github.com/tina-yaghchian")],
            ["Open LinkedIn", "Link", open("https://linkedin.com/in/tina-yaghchian")]
        ];

        let results = commands;
        let selected = 0;

        function render() {
            list.replaceChildren();
            if (!results.length) {
                const empty = document.createElement("p");
                empty.className = "cmdk-empty";
                empty.textContent = "No matches";
                list.appendChild(empty);
                return;
            }
            results.forEach((cmd, i) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = i === selected ? "sel" : "";
                const name = document.createElement("span");
                name.textContent = cmd[0];
                const kind = document.createElement("span");
                kind.className = "mono";
                kind.textContent = cmd[1];
                b.append(name, kind);
                b.addEventListener("click", () => run(cmd));
                list.appendChild(b);
            });
        }

        function mark() {
            $$("button", list).forEach((b, i) => {
                b.classList.toggle("sel", i === selected);
                if (i === selected) b.scrollIntoView({ block: "nearest" });
            });
        }

        function run(cmd) {
            dialog.close();
            cmd[2]();
        }

        function show() {
            input.value = "";
            results = commands;
            selected = 0;
            render();
            dialog.showModal();
            input.focus();
        }

        input.addEventListener("input", () => {
            const q = input.value.trim().toLowerCase();
            results = commands.filter(c => (c[0] + " " + c[1]).toLowerCase().includes(q));
            selected = 0;
            render();
        });

        input.addEventListener("keydown", e => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (!results.length) return;
                const delta = e.key === "ArrowDown" ? 1 : -1;
                selected = (selected + delta + results.length) % results.length;
                mark();
            } else if (e.key === "Enter" && results[selected]) {
                e.preventDefault();
                run(results[selected]);
            }
        });

        dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
        $$("[data-cmdk]").forEach(b => b.addEventListener("click", show));

        document.addEventListener("keydown", e => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                if (dialog.open) dialog.close(); else show();
            }
        });
    }

    /* Footer year ------------------------------------------------------------- */

    const year = $("[data-year]");
    if (year) year.textContent = new Date().getFullYear();
})();
