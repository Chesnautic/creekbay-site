/* pkcentraL tape countdown: daily clip TV (PK page), mini TV (home), kinetic wordmark (home).
   Reads channels/schedule.json. Add ?preview=YYYY-MM-DD to any page to see another day. */
(function () {
  "use strict";
  var DAY = 864e5;
  var preview = (location.search.match(/[?&]preview=(\d{4}-\d{2}-\d{2})/) || [])[1];
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var today = preview ? parse(preview) : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  var todayStr = ymd(today);

  function state(sch) {
    var drop = parse(sch.drop);
    var left = Math.max(0, Math.round((drop - today) / DAY));
    var aired = (sch.clips || []).filter(function (c) { return c.date <= todayStr; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return { left: left, out: left === 0, clip: aired[aired.length - 1] || null, pass: sch.passUrl };
  }
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- home: kinetic wordmark ---------- */
  var kin = document.getElementById("heroKinetic");
  if (kin && window.OK) {
    var wm = document.querySelector(".hero .wordmark");
    try {
      var kProps = {
        word: "Creek Bay Records", shape: "torusKnot", color: "#FFFFFF", fill: "#3E3E3E",
        font: { fontFamily: "AppleGaramond, Georgia, serif", fontSize: 64, fontWeight: 700 },
        density: 12, speed: reduced ? 0 : 8, sizePercent: 96, hoverBoost: 7, distort: 8
      };
      var kin3d = window.OK.mountKinetic(kin, kProps);
      if (wm) wm.classList.add("kinetic-on");
      /* switch between the component's two forms: the knot and the twisted bar */
      if (!reduced && kin3d && kin3d.update) {
        var forms = [{ shape: "torusKnot", sizePercent: 96 }, { shape: "box", sizePercent: 118 }], fi = 0;
        setInterval(function () {
          if (document.hidden) return;
          kin.classList.add("kin-swap");
          setTimeout(function () {
            fi = (fi + 1) % forms.length;
            kin3d.update(Object.assign({}, kProps, forms[fi]));
            setTimeout(function () { kin.classList.remove("kin-swap"); }, 80);
          }, 380);
        }, 9000);
      }
    } catch (e) { kin.remove(); }
  }


  /* drop day: pk logo bouncing around the TV like a DVD screensaver, staying out of the photo boxes.
     It moves inside the biggest open rectangle (right of the girl, above the title and car). */
  function bounceLogo(screen, avoid) {
    var img = document.createElement("img");
    img.src = "channels/pk_logo.png"; img.alt = ""; img.className = "ch-bounce";
    var glass = screen.querySelector(".ch-glass"); screen.insertBefore(img, glass);
    var x0 = 0, y0 = 0, x1 = 1, y1 = 1;
    avoid.forEach(function (r) {                      // shrink the box away from each avoided area
      if (r[0] <= 0.05 && r[2] < 0.5) x0 = Math.max(x0, r[2]);
      else if (r[1] <= 0.05 && r[3] < 0.5) y0 = Math.max(y0, r[3]);
      else if (r[3] >= 0.95 || r[2] >= 0.95) y1 = Math.min(y1, r[1]);
    });
    var pad = 0.025, px = 0.4, py = 0.3, vx = 0.14, vy = 0.10, lastT = 0;
    function frame(t) {
      var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0; lastT = t;
      var W = screen.clientWidth, H = screen.clientHeight, w = img.offsetWidth / W, h = img.offsetHeight / H;
      if (W && w) {
        var lo = x0 + pad, hi = x1 - pad - w, top = y0 + pad, bot = y1 - pad - h;
        if (!reduced) { px += vx * dt; py += vy * dt; }
        var hit = false;
        if (px < lo) { px = lo; vx = Math.abs(vx); hit = true; } else if (px > hi) { px = hi; vx = -Math.abs(vx); hit = true; }
        if (py < top) { py = top; vy = Math.abs(vy); hit = true; } else if (py > bot) { py = bot; vy = -Math.abs(vy); hit = true; }
        if (hit) { img.classList.remove("hit"); void img.offsetWidth; img.classList.add("hit"); }
        img.style.transform = "translate(" + (px * W).toFixed(1) + "px," + (py * H).toFixed(1) + "px)";
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var needsSchedule = document.getElementById("pkChannels") || document.getElementById("pkMiniTv");
  if (!needsSchedule) return;

  fetch("channels/schedule.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (sch) {
    var st = state(sch);
    var label = st.out ? "CH 00" : "CH " + String(st.left).padStart(2, "0");

    /* ---------- home: mini TV ---------- */
    var mini = document.getElementById("pkMiniTv");
    if (mini) {
      var mv = mini.querySelector("video"), mtag = mini.querySelector(".tag"), mout = mini.querySelector(".out");
      mtag.textContent = label;
      if (st.out) { mout.style.display = "grid"; mv.remove(); }
      else if (st.clip) {
        mv.poster = st.clip.poster || "";
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) { if (!mv.src) mv.src = st.clip.src; mv.play().catch(function () {}); }
            else mv.pause();
          });
        }, { rootMargin: "200px" });
        io.observe(mini);
      }
      var cap = document.getElementById("pkMiniStatus");
      if (cap) cap.textContent = st.out ? "Out now" : st.left + (st.left === 1 ? " day" : " days");
    }

    /* ---------- PK page: TV + keyboard ---------- */
    var root = document.getElementById("pkChannels");
    if (!root) return;
    var vid = root.querySelector("video"), screen = root.querySelector(".ch-screen"), out = root.querySelector(".ch-out");
    var osdTR = root.querySelector(".ch-osd.tr"), osdBL = root.querySelector(".ch-osd.bl"), osdBR = root.querySelector(".ch-osd.br");
    var soundBtn = root.querySelector("#chSound"), count = root.querySelector(".ch-count .n"), pass = root.querySelector(".ch-pass");
    var soundOn = false;

    osdTR.textContent = label;
    count.textContent = st.out ? "Out now" : st.left + (st.left === 1 ? " day" : " days");
    if (st.out) {
      osdBL.textContent = "★ OUT NOW"; osdBR.textContent = "";
      soundBtn.style.display = "none"; pass.textContent = "Out now"; pass.href = sch.passUrl || pass.href;
      root.classList.add("is-out");
      var kb = document.getElementById("chKeys"), hint = root.querySelector(".ch-hint"), n = root.querySelector(".ch-count .n");
      if (kb) kb.remove(); if (hint) hint.remove(); if (n) n.style.display = "none";
      if (sch.out && sch.out.src) {
        screen.classList.add("ch-drop");
        vid.poster = sch.out.poster || ""; vid.src = sch.out.src; vid.loop = true;
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) vid.play().catch(function () {}); else vid.pause(); });
        }).observe(screen);
        bounceLogo(screen, sch.out.avoid || []);
      } else { vid.remove(); out.style.display = "grid"; }
    } else if (st.clip) {
      vid.poster = st.clip.poster || ""; vid.src = st.clip.src; vid.loop = true;
      var vio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) vid.play().catch(function () {}); else vid.pause(); });
      });
      vio.observe(screen);
    }

    function setSound(on) {
      if (st.out) return;
      soundOn = on; vid.muted = !on; if (on) vid.play().catch(function () {});
      osdBR.textContent = on ? "SOUND ON" : "SPACE = SOUND";
      soundBtn.textContent = on ? "MUTE" : "SOUND";
    }
    soundBtn.addEventListener("click", function () { setSound(!soundOn); });
    screen.addEventListener("click", function () { setSound(!soundOn); });

    var last = 0;
    function flick() {
      var n = performance.now(); if (n - last < 120 || reduced) return; last = n;
      screen.classList.remove("flick"); void screen.offsetWidth; screen.classList.add("flick");
    }
    var kbd = document.getElementById("chKeys");
    var onScreen = false;
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }).observe(root);
    window.addEventListener("keydown", function (e) {
      if (!onScreen || (e.target.closest && e.target.closest("input,textarea,select,button,a"))) return;
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) setSound(!soundOn); }
      if (!e.repeat) flick();
    });
    if (kbd) kbd.addEventListener("pointerdown", flick);

    /* keyboard only mounts when the set scrolls near, so the page loads light */
    if (kbd && window.OK) {
      var kio = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; kio.disconnect();
        try {
          window.OK.mountKeyboard(kbd, {
            finish: "metal", caseColor: "#8A8C91", keyColor: "#55575C", modColor: "#FD7407", pressColor: "#ffb36b",
            legendColor: "#FFFFFF", modLegendColor: "#FFFFFF", tilt: 17, size: 92, stiffness: 20, gap: 5, shadows: true,
            sound: true, soundOptions: { pitch: 10, volume: 8 }, followPointer: true, strength: 9
          });
        } catch (e) { kbd.remove(); }
      }, { rootMargin: "300px" });
      kio.observe(kbd);
    }

    var tv = root.querySelector(".ch-tv");
    if (!reduced) root.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = root.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      tv.style.transform = "rotateY(" + x * 8 + "deg) rotateX(" + -y * 5 + "deg)";
      root.querySelector(".ch-case").style.setProperty("--sx", (50 + x * 90).toFixed(1) + "%");
    });

    var toast = document.getElementById("chToast");
    function say(t) { toast.textContent = t; toast.classList.add("show"); clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove("show"); }, 2600); }
  }).catch(function () {});
})();
