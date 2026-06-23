/**
 * ══════════════════════════════════════════════════════════════
 * AADITYA GELANI — ECE PORTFOLIO  |  script.js  v2.0
 * ══════════════════════════════════════════════════════════════
 *
 * MODULES
 *  BootSystem   — rope drag, gears with inertia, hatch reveal
 *  CanvasSystem — particle background
 *  ScrollSystem — GSAP-driven reveals + circuit bus
 *  LogicSystem  — NAND gate simulation
 *  ProjectSystem— IC card expand/collapse
 *  ResearchSystem—accordion
 *  NavSystem    — burger, active links, smooth scroll
 */

'use strict';

// ── Environment flags ────────────────────────────────────────────
const IS_TOUCH  = window.matchMedia('(hover: none)').matches;
const IS_MOBILE = window.innerWidth < 768;
// MOBILE OPTIMIZATION: reduce particle count on small/slow devices
const IS_LOW_PERF = IS_MOBILE && (navigator.hardwareConcurrency || 4) <= 2;

// ── Utility: get pointer Y (mouse or touch) ───────────────────────
function pointerY(e) {
  return e.touches ? e.touches[0].clientY : e.clientY;
}

// ── Utility: clamp ─────────────────────────────────────────────
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// ── Utility: lerp ──────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }


/* ══════════════════════════════════════════════════════════════
   MODULE: CanvasSystem
   Particle / node background on boot screen
   ══════════════════════════════════════════════════════════════ */
const CanvasSystem = (() => {

  let canvas, ctx, W, H, particles = [], raf;

  function init() {
    canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    buildParticles();
    loop();
    window.addEventListener('resize', debounce(resize, 200));
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function buildParticles() {
    // MOBILE OPTIMIZATION: fewer particles
    const count = IS_LOW_PERF ? 20 : IS_MOBILE ? 35 : 65;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .25,
      vy: (Math.random() - .5) * .25,
      r:  Math.random() * 1.2 + .4,
      a:  Math.random() * .45 + .08
    }));
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    const linkDist = IS_MOBILE ? 90 : 130;

    // Connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.hypot(dx, dy);
        if (d < linkDist) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,232,122,${.055 * (1 - d / linkDist)})`;
          ctx.lineWidth = .6;
          ctx.stroke();
        }
      }
    }

    // Dots
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,232,122,${p.a})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });

    raf = requestAnimationFrame(loop);
  }

  function stop() { cancelAnimationFrame(raf); }

  return { init, stop };
})();


/* ══════════════════════════════════════════════════════════════
   MODULE: BootSystem
   Rope pull → gear spin → hatch open → name reveal
   ══════════════════════════════════════════════════════════════ */
const BootSystem = (() => {

  // DOM refs
  let ropeSystem, ropeCable, ropeKnob, ropeHint, bootStatus;
  let hatchTop, hatchBot, nameReveal, enterBtn, powerFlash;
  let progressFill, bootPct;
  let glGroup, grGroup;  // gear transform groups
  let beltT, beltB;      // belt paths

  // State
  let dragging   = false;
  let startY     = 0;
  let pullPx     = 0;        // current visual pull amount (px)
  let pullTarget = 0;        // target for spring damping
  const MAX_PULL = clamp(window.innerHeight * .2, 90, 160);
  const TRIGGER  = MAX_PULL * .55;
  let activated  = false;

  // Gear physics
  let gearAngle   = 0;
  let gearVelocity = 0;   // deg/frame — driven by pull velocity
  let gearRAF     = null;
  let lastPull    = 0;

  // Belt dash offset
  let beltOffset  = 0;

  function init() {
    ropeSystem   = document.getElementById('rope-system');
    ropeCable    = document.getElementById('rope-cable');
    ropeKnob     = document.getElementById('rope-knob');
    ropeHint     = document.getElementById('rope-hint');
    bootStatus   = document.getElementById('boot-status');
    hatchTop     = document.getElementById('hp-top');
    hatchBot     = document.getElementById('hp-bot');
    nameReveal   = document.getElementById('name-reveal');
    enterBtn     = document.getElementById('enter-btn');
    powerFlash   = document.getElementById('power-flash');
    progressFill = document.getElementById('progress-fill');
    bootPct      = document.getElementById('boot-pct');
    glGroup      = document.getElementById('gl-g');
    grGroup      = document.getElementById('gr-g');
    beltT        = document.getElementById('belt-t');
    beltB        = document.getElementById('belt-b');

    if (!ropeSystem) return;

    // Pointer events
    ropeSystem.addEventListener('mousedown',  onDown);
    ropeSystem.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('touchmove',  onMove, { passive: false });
    window.addEventListener('mouseup',    onUp);
    window.addEventListener('touchend',   onUp);
    // Keyboard accessibility
    ropeSystem.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') triggerFull();
    });

    enterBtn && enterBtn.addEventListener('click', onEnter);

    startGearLoop();
  }

  // ── Pointer handlers ─────────────────────────────────────────
  function onDown(e) {
    if (activated) return;
    dragging = true;
    startY   = pointerY(e) - pullPx;
    ropeHint.style.opacity = '0';
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging || activated) return;
    const rawY   = pointerY(e);
    const newPull = clamp(rawY - startY, 0, MAX_PULL);

    // Elastic overshoot feel: apply slight resistance near max
    const resistance = newPull > MAX_PULL * .75
      ? 1 - (newPull - MAX_PULL * .75) / (MAX_PULL * .5) * .25
      : 1;

    pullTarget = newPull * resistance;

    // Drive gear velocity from pull delta
    const delta = pullTarget - pullPx;
    gearVelocity = lerp(gearVelocity, delta * .55, .25);

    if (pullTarget >= TRIGGER && !activated) {
      activated = true;
      triggerFull();
    }
    e.preventDefault();
  }

  function onUp() {
    if (!activated && dragging) {
      dragging = true; // keep animating spring back
      springBack();
    }
    dragging = false;
  }

  // Spring the rope back smoothly
  function springBack() {
    if (activated) return;
    function tick() {
      pullTarget = lerp(pullTarget, 0, .12);
      applyPull(pullTarget);
      if (Math.abs(pullTarget) > .5) requestAnimationFrame(tick);
      else {
        applyPull(0);
        ropeHint.style.opacity = '1';
      }
    }
    requestAnimationFrame(tick);
  }

  // Apply visual pull to rope cable + knob
  function applyPull(px) {
    pullPx = px;
    // CSS variable for cable height
    const baseH = clamp(window.innerHeight * .08, 50, 90);
    ropeCable.style.setProperty('--rope-h', `${baseH + px * .7}px`);
    ropeKnob.style.transform = `translateY(${px}px)`;
    // Progress bar while pulling
    const pct = Math.round((px / MAX_PULL) * 60);
    setProgress(pct);
  }

  // ── Gear loop (runs continuously, velocity decays) ────────────
  // PERFORMANCE: uses transform, not setAttribute, so no layout thrash
  function startGearLoop() {
    function frame() {
      // Lerp pullPx toward target for smooth spring
      if (dragging) {
        pullPx = lerp(pullPx, pullTarget, .22);
        applyPull(pullPx);
      }

      // Inertia: velocity decays with friction
      if (!dragging) {
        gearVelocity *= .93;
      }
      // Add small idle oscillation so gears don't look dead
      const idleAdd = Math.sin(Date.now() * .001) * .04;
      gearAngle += gearVelocity + idleAdd;

      // Apply via CSS transform-origin + rotate — no SVG attr writes during render
      if (glGroup) glGroup.style.transform = `rotate(${gearAngle}deg)`;
      if (grGroup) grGroup.style.transform = `rotate(${-gearAngle * 1.35}deg)`;

      // Belt offset
      beltOffset = (beltOffset + Math.abs(gearVelocity) * 1.8 + .4) % 28;
      if (beltT) beltT.style.strokeDashoffset = -beltOffset;
      if (beltB) beltB.style.strokeDashoffset =  beltOffset;

      gearRAF = requestAnimationFrame(frame);
    }
    frame();
  }

  // ── Full activation sequence ─────────────────────────────────
  function triggerFull() {
    cancelAnimationFrame(gearRAF);

    // Snap rope to full pull
    applyPull(MAX_PULL);
    // Spin gears fast
    gearVelocity = 12;
    bootStatus && (bootStatus.textContent = 'ENGAGING…');

    // Animate gear spin with high velocity then ease off
    let spinVel = 14;
    const spinDown = () => {
      spinVel *= .96;
      gearAngle += spinVel;
      if (glGroup) glGroup.style.transform = `rotate(${gearAngle}deg)`;
      if (grGroup) grGroup.style.transform = `rotate(${-gearAngle * 1.35}deg)`;
      beltOffset = (beltOffset + spinVel * 1.6) % 28;
      if (beltT) beltT.style.strokeDashoffset = -beltOffset;
      if (beltB) beltB.style.strokeDashoffset =  beltOffset;
      if (spinVel > .1) requestAnimationFrame(spinDown);
    };
    requestAnimationFrame(spinDown);

    // Progress bar races to 100%
    animateProgress(100, 1200);

    // Open hatch after delay
    setTimeout(openHatch, 500);
  }

  function openHatch() {
    bootStatus && (bootStatus.textContent = 'SYSTEM READY');
    // RESPONSIVE FIX: translate panels in opposite Y directions
    // No clip-path — just translateY transforms
    if (hatchTop) {
      hatchTop.style.transition = 'transform .9s cubic-bezier(0.16,1,0.3,1)';
      hatchTop.style.transform  = 'translateY(-100%)';
    }
    if (hatchBot) {
      hatchBot.style.transition = 'transform .9s cubic-bezier(0.16,1,0.3,1)';
      hatchBot.style.transform  = 'translateY(100%)';
    }
    setTimeout(revealName, 700);
  }

  function revealName() {
    if (!nameReveal) return;
    nameReveal.classList.add('visible');

    const name  = document.getElementById('nr-name');
    const role  = nameReveal.querySelector('.nr-role');
    const tags  = nameReveal.querySelector('.nr-tags');
    const btn   = document.getElementById('enter-btn');

    // Flicker-then-steady for name text (boot effect)
    if (name) {
      name.classList.add('vis');
      flickerElement(name, 3);
    }
    setTimeout(() => role  && role.classList.add('vis'),  500);
    setTimeout(() => tags  && tags.classList.add('vis'),  850);
    setTimeout(() => btn   && btn.classList.add('vis'),  1100);
  }

  // Subtle flicker — changes opacity rapidly then settles
  function flickerElement(el, times) {
    let count = 0;
    const total = times * 2;
    function tick() {
      el.style.opacity = count % 2 === 0 ? '.3' : '1';
      count++;
      if (count < total) setTimeout(tick, 60 + Math.random() * 80);
      else el.style.opacity = '1';
    }
    setTimeout(tick, 50);
  }

  // Progress bar helpers
  function setProgress(pct) {
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (bootPct) bootPct.textContent = `${pct}%`;
  }
  function animateProgress(target, ms) {
    const start = Date.now();
    const from  = parseInt(progressFill ? progressFill.style.width : '0') || 0;
    function step() {
      const t = Math.min(1, (Date.now() - start) / ms);
      const ease = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(from + (target - from) * ease));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Enter site ────────────────────────────────────────────────
  function onEnter() {
    const bootEl   = document.getElementById('boot-screen');
    const mainEl   = document.getElementById('main-site');
    const flashEl  = document.getElementById('power-flash');

    // Flash
    if (flashEl) {
      flashEl.style.transition = 'opacity .08s';
      flashEl.style.opacity    = '1';
      setTimeout(() => {
        flashEl.style.transition = 'opacity .55s';
        flashEl.style.opacity    = '0';
      }, 80);
    }

    // GSAP fade: boot out → main in
    if (window.gsap) {
      gsap.to(bootEl, {
        opacity:0, duration:.6, delay:.1,
        onComplete: () => {
          bootEl.style.display = 'none';
          mainEl.classList.remove('hidden');
          mainEl.removeAttribute('aria-hidden');
          mainEl.style.opacity = '0';
          CanvasSystem.stop();
          gsap.to(mainEl, {opacity:1, duration:.7, onComplete: ScrollSystem.init});
        }
      });
    } else {
      bootEl.style.display = 'none';
      mainEl.classList.remove('hidden');
      mainEl.removeAttribute('aria-hidden');
      ScrollSystem.init();
    }
  }

  return { init };
})();


/* ══════════════════════════════════════════════════════════════
   MODULE: ScrollSystem
   GSAP ScrollTrigger reveals + circuit bus particle
   ══════════════════════════════════════════════════════════════ */
const ScrollSystem = (() => {

  function init() {
    if (!window.gsap || !window.ScrollTrigger) {
      // Fallback: just make all .reveal elements visible
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('vis'));
      return;
    }
    gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

    // ── Section headers ───────────────────────────────────────
    document.querySelectorAll('.sec-badge,.sec-title,.sec-rule').forEach(el => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        x: -24, opacity: 0, duration: .65, ease: 'power2.out'
      });
    });

    // ── .reveal elements — IntersectionObserver approach
    //    (lighter weight than per-element ScrollTrigger)
    const revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('vis');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });

    document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

    // ── Skill bars trigger ─────────────────────────────────────
    ScrollTrigger.create({
      trigger: '#skills',
      start: 'top 65%',
      once: true,
      onEnter: () => {
        document.querySelectorAll('.skfill').forEach((bar, i) => {
          setTimeout(() => { bar.style.width = bar.dataset.pct + '%'; }, i * 70);
        });
      }
    });

    // ── PCB trace strip animation ─────────────────────────────
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top 60%',
      once: true,
      onEnter: () => {
        document.querySelectorAll('.trace-path').forEach(p => p.classList.add('animated'));
      }
    });

    // ── Circuit bus dot follows scroll ────────────────────────
    // MOBILE OPTIMIZATION: skip on mobile
    if (!IS_MOBILE) {
      const dot   = document.getElementById('cb-dot');
      const track = document.querySelector('.cb-track');
      if (dot && track) {
        const update = debounce(() => {
          const scrollable = document.documentElement.scrollHeight - window.innerHeight;
          const pct = scrollable > 0 ? window.scrollY / scrollable : 0;
          const trackH = track.getBoundingClientRect().height;
          dot.style.top = `calc(var(--nav-h) + ${pct * (trackH - 12)}px)`;
        }, 10);
        window.addEventListener('scroll', update, { passive: true });
        update();
      }
    }

    // ── Nav active link ───────────────────────────────────────
    document.querySelectorAll('.sec').forEach(sec => {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: self => {
          if (!self.isActive) return;
          document.querySelectorAll('.nlink').forEach(a => {
            const href = a.getAttribute('href')?.slice(1);
            a.classList.toggle('active', href === sec.id);
          });
        }
      });
    });
  }

  return { init };
})();


/* ══════════════════════════════════════════════════════════════
   MODULE: LogicSystem
   NAND gate simulation with wire particle animation
   ══════════════════════════════════════════════════════════════ */
const LogicSystem = (() => {

  let stateA = 0, stateB = 0;

  function init() {
    const btnA = document.getElementById('inputA');
    const btnB = document.getElementById('inputB');
    if (!btnA || !btnB) return;

    btnA.addEventListener('click', () => toggle(btnA, 'A'));
    btnB.addEventListener('click', () => toggle(btnB, 'B'));
    update();
  }

  function toggle(btn, which) {
    const cur  = parseInt(btn.dataset.state) || 0;
    const next = cur ^ 1;
    btn.dataset.state = next;
    btn.setAttribute('aria-pressed', String(!!next));
    btn.querySelector('.tog-val').textContent = next ? 'HIGH' : 'LOW';
    if (which === 'A') stateA = next; else stateB = next;
    update();
  }

  function update() {
    const out = (stateA & stateB) ^ 1; // NAND truth

    // Wire states
    setWire('wire-a', stateA);
    setWire('wire-b', stateB);

    // Gate glow
    const gateSvg = document.getElementById('nand-svg');
    if (gateSvg) {
      gateSvg.classList.add('processing');
      // Update input/output line colors
      document.getElementById('il-a')?.setAttribute('stroke', stateA ? 'var(--g)' : '#1a2e1a');
      document.getElementById('il-b')?.setAttribute('stroke', stateB ? 'var(--g)' : '#1a2e1a');
      document.getElementById('ol') ?.setAttribute('stroke', out   ? 'var(--g)' : '#1a2e1a');
      setTimeout(() => gateSvg.classList.remove('processing'), 450);
    }

    // LED
    const led = document.getElementById('output-led');
    const val = document.getElementById('output-val');
    if (led) led.classList.toggle('on', !!out);
    if (val) {
      val.textContent = out ? 'HIGH' : 'LOW';
      val.style.color = out ? 'var(--g)' : 'var(--text-d)';
    }

    // Truth table row highlight
    document.querySelectorAll('.tt-r').forEach(row => {
      const match = +row.dataset.a === stateA && +row.dataset.b === stateB;
      row.classList.toggle('active', match);
    });
  }

  function setWire(id, active) {
    const wire = document.getElementById(id);
    if (!wire) return;
    wire.classList.toggle('active', !!active);
  }

  return { init };
})();


/* ══════════════════════════════════════════════════════════════
   MODULE: ProjectSystem
   IC card expand / collapse with 3D tilt on desktop
   ══════════════════════════════════════════════════════════════ */
const ProjectSystem = (() => {

  function init() {
    const cards = document.querySelectorAll('.ic-card');
    cards.forEach(card => {
      const body   = card.querySelector('.ic-body');
      const detail = card.querySelector('.ic-detail');
      const closeX = card.querySelector('.icd-x');

      // Click card to expand
      card.addEventListener('click', e => {
        if (e.target.closest('.icd-x') || e.target.closest('.icd-a')) return;
        const isOpen = detail.classList.contains('open');
        // Close all others
        document.querySelectorAll('.ic-detail.open').forEach(d => d.classList.remove('open'));
        if (!isOpen) {
          detail.classList.add('open');
          setTimeout(() => detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
        }
      });

      // Close button
      closeX?.addEventListener('click', e => {
        detail.classList.remove('open');
        e.stopPropagation();
      });

      // 3D tilt — MOBILE OPTIMIZATION: hover only on pointer:fine devices
      if (!IS_TOUCH && body) {
        card.addEventListener('mousemove', e => {
          const r  = card.getBoundingClientRect();
          const x  = ((e.clientX - r.left) / r.width  - .5) * 7;
          const y  = ((e.clientY - r.top)  / r.height - .5) * 7;
          body.style.transform =
            `perspective(700px) rotateX(${-y}deg) rotateY(${x}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => {
          body.style.transform = '';
        });
      }
    });
  }

  return { init };
})();


/* ══════════════════════════════════════════════════════════════
   MODULE: ResearchSystem
   Accordion-style research papers
   ══════════════════════════════════════════════════════════════ */
const ResearchSystem = (() => {

  function init() {
    document.querySelectorAll('.rp-head').forEach(btn => {
      btn.addEventListener('click', () => {
        const item  = btn.closest('.rp-item');
        const isOpen = item.classList.contains('open');
        // Close all
        document.querySelectorAll('.rp-item.open').forEach(i => {
          i.classList.remove('open');
          i.querySelector('.rp-head').setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  return { init };
})();


/* ══════════════════════════════════════════════════════════════
   MODULE: NavSystem
   Hamburger menu + smooth scroll + active link tracking
   ══════════════════════════════════════════════════════════════ */
const NavSystem = (() => {

  function init() {
    const burger = document.getElementById('nav-burger');
    const menu   = document.getElementById('nav-menu');

    // Hamburger toggle
    burger?.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });

    // Close on link click (mobile)
    menu?.querySelectorAll('.nlink').forEach(a => {
      a.addEventListener('click', () => {
        menu.classList.remove('open');
        burger?.setAttribute('aria-expanded', 'false');
      });
    });

    // Smooth scroll for all #hash links
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          const offset = document.getElementById('sys-nav')?.offsetHeight || 56;
          const top    = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      });
    });
  }

  return { init };
})();


/* ══════════════════════════════════════════════════════════════
   UTILITY: debounce
   ══════════════════════════════════════════════════════════════ */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
/* ══════════════════════════════════════════════════════════════
   NEW JS MODULES — Communication Bus + Firmware Library
   PASTE LOCATION: In script.js, BEFORE the final BOOTSTRAP block
   (i.e., before the line: document.addEventListener('DOMContentLoaded', ...)
   ══════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════
   MODULE: PCBNetSystem
   PCB Routing Network — Clubs & Chapters
   Architecture:
   - CPU node at center; module nodes in equal-angle ring
   - SVG orthogonal (right-angle) PCB traces between CPU & modules
   - Animated signal pulses travel traces via GSAP motion-path
   - ScrollTrigger reveals: traces draw first, then nodes appear
   - Hover: pulse fires CPU→module; trace brightens
   - Telemetry bar: live packet counter + bus utilisation
   ══════════════════════════════════════════════════════════════ */
const PCBNetSystem = (() => {

  /* ── Config ─────────────────────────────────────────────────── */
  const RING_RADIUS_FACTOR = 0.34;   // fraction of wrap width
  const MIN_RADIUS         = 180;    // px
  const MAX_RADIUS         = 280;    // px
  const MODULE_W           = 200;    // must match CSS .pn-module width
  const MODULE_H           = 130;    // estimated card height
  const CPU_SIZE           = 120;
  const PULSE_INTERVAL     = 1800;   // ms between auto pulses
  let   _pktCount          = 0;
  let   _pulseTimer        = null;
  let   _traces            = [];     // { el, pathEl, len, modIdx }
  let   _revealed          = false;

  function init() {
    const section  = document.getElementById('comms');
    const wrap     = document.getElementById('pn-wrap');
    const svg      = document.getElementById('pn-svg');
    const cpuEl    = document.getElementById('pn-cpu');
    const modules  = Array.from(document.querySelectorAll('.pn-module'));
    if (!section || !wrap || !svg || !cpuEl || !modules.length) return;

    _buildSignalBars(modules);
    _layout(wrap, cpuEl, modules);
    _buildTraces(svg, wrap, cpuEl, modules);
    _bindHover(modules);
    _initScrollTrigger(section, cpuEl, modules);
    _startTelemetry();

    // Re-layout on resize (debounced)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth > 700) {
          // Clear old traces
          while (svg.firstChild) svg.removeChild(svg.firstChild);
          _traces = [];
          _layout(wrap, cpuEl, modules);
          _buildTraces(svg, wrap, cpuEl, modules);
          if (_revealed) {
            modules.forEach(m => m.classList.add('pnm-visible'));
            _traces.forEach(t => {
              gsap.set(t.pathEl, { strokeDashoffset: 0 });
            });
          }
        }
      }, 200);
    });
  }

  /* Build signal-strength bar UI (reads data-strength attr) */
  function _buildSignalBars(modules) {
    modules.forEach(mod => {
      const bar = mod.querySelector('.pnm-sig-bar');
      if (!bar) return;
      const strength = parseInt(bar.dataset.strength || '3', 10);
      bar.innerHTML = '';
      for (let i = 1; i <= 5; i++) {
        const b = document.createElement('div');
        const h = 4 + i * 1.6;
        b.style.cssText = `
          width:3px;height:${h}px;border-radius:1px;
          background:${i <= strength ? 'var(--g)' : 'var(--border)'};
          box-shadow:${i <= strength ? '0 0 4px var(--g)' : 'none'};
          align-self:flex-end;
        `;
        bar.appendChild(b);
      }
    });
  }

  /* Position CPU at center, modules in equal-angle ring */
  function _layout(wrap, cpuEl, modules) {
    if (window.innerWidth <= 700) {
      // Mobile: static flow, JS does nothing
      wrap.style.minHeight = '';
      cpuEl.style.cssText = '';
      modules.forEach(m => {
        m.style.position = 'relative';
        m.style.top = m.style.left = '';
      });
      return;
    }

    const W      = wrap.offsetWidth || wrap.getBoundingClientRect().width || 800;
    const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, W * RING_RADIUS_FACTOR));
    const cx     = W / 2;
    const cy     = radius + CPU_SIZE / 2 + 40;
    const H      = cy + radius + MODULE_H + 20;

    wrap.style.minHeight = H + 'px';

    // CPU
    cpuEl.style.position  = 'absolute';
    cpuEl.style.left      = (cx - CPU_SIZE / 2) + 'px';
    cpuEl.style.top       = (cy - CPU_SIZE / 2) + 'px';
    cpuEl.style.transform = 'none';

    // Modules — evenly around the ring, starting top
    const n       = modules.length;
    const startDeg = -90; // start at top
    modules.forEach((mod, i) => {
      const angleDeg = startDeg + (360 / n) * i;
      const angleRad = (angleDeg * Math.PI) / 180;
      const mx = cx + radius * Math.cos(angleRad) - MODULE_W / 2;
      const my = cy + radius * Math.sin(angleRad) - MODULE_H / 2;
      mod.style.position = 'absolute';
      mod.style.left = mx + 'px';
      mod.style.top  = my + 'px';
      mod.style.width = MODULE_W + 'px';
      // Store positions for trace drawing
      mod._cx = cx + radius * Math.cos(angleRad);
      mod._cy = cy + radius * Math.sin(angleRad);
    });

    // Store CPU center
    cpuEl._cx = cx;
    cpuEl._cy = cy;
  }

  /* Build orthogonal PCB traces (right-angle routing) as SVG paths */
  function _buildTraces(svg, wrap, cpuEl, modules) {
    if (window.innerWidth <= 700) return;
    _traces = [];

    modules.forEach((mod, i) => {
      const cpuX = cpuEl._cx;
      const cpuY = cpuEl._cy;
      const modX = mod._cx;
      const modY = mod._cy;

      // Right-angle routing: horizontal then vertical (Manhattan routing)
      // Choose elbow point to avoid crossing through CPU
      const elbowX = modX;
      const elbowY = cpuY;

      const d = `M ${cpuX} ${cpuY} L ${elbowX} ${elbowY} L ${modX} ${modY}`;

      // Calculate path length for dash animation
      const totalLen = Math.abs(modX - cpuX) + Math.abs(modY - cpuY);

      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('class', 'pn-trace');
      pathEl.style.setProperty('--dash-len', totalLen + 'px');
      pathEl.setAttribute('stroke-dasharray', totalLen);
      pathEl.setAttribute('stroke-dashoffset', totalLen);

      // Add solder pad at module end
      const padEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      padEl.setAttribute('cx', modX);
      padEl.setAttribute('cy', modY);
      padEl.setAttribute('r', '5');
      padEl.setAttribute('fill', 'var(--bg)');
      padEl.setAttribute('stroke', 'var(--g-dim)');
      padEl.setAttribute('stroke-width', '1.5');
      padEl.classList.add('pn-trace-pad');
      padEl.style.opacity = '0';

      // Add solder pad at CPU end
      const cpuPadEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      cpuPadEl.setAttribute('cx', cpuX);
      cpuPadEl.setAttribute('cy', cpuY);
      cpuPadEl.setAttribute('r', '3.5');
      cpuPadEl.setAttribute('fill', 'var(--g-dim)');
      cpuPadEl.setAttribute('stroke', 'none');
      cpuPadEl.classList.add('pn-trace-pad');
      cpuPadEl.style.opacity = '0';

      svg.appendChild(pathEl);
      svg.appendChild(padEl);
      svg.appendChild(cpuPadEl);

      _traces.push({ pathEl, padEl, cpuPadEl, len: totalLen, modIdx: i,
                     cpuX, cpuY, modX, modY, elbowX, elbowY });
    });
  }

  /* Fire signal pulse along a trace (GSAP motion along path) */
  function _firePulse(traceData, isCyan) {
    const { pathEl, cpuX, cpuY, elbowX, elbowY, modX, modY } = traceData;

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'pn-pulse-dot' + (isCyan ? ' cyan' : ''));
    pathEl.parentNode.appendChild(dot);

    gsap.fromTo(dot,
      { opacity: 0 },
      {
        opacity: 1,
        duration: .08,
        onComplete: () => {
          gsap.to(dot, {
            motionPath: {
              path: pathEl,
              align: pathEl,
              autoRotate: false,
            },
            duration: .7,
            ease: 'power1.inOut',
            onComplete: () => {
              gsap.to(dot, {
                opacity: 0, duration: .2,
                onComplete: () => dot.remove()
              });
              _pktCount++;
              _updatePktCounter();
            }
          });
        }
      }
    );

    // Briefly highlight the trace
    gsap.to(pathEl, {
      stroke: isCyan ? 'rgba(0,200,240,.5)' : 'rgba(0,232,122,.5)',
      duration: .3,
      yoyo: true, repeat: 1,
      onComplete: () => pathEl.classList.remove('active')
    });
  }

  /* Auto-cycle pulses around the ring */
  function _startAutoPulse(modules) {
    let idx = 0;
    _pulseTimer = setInterval(() => {
      if (window.innerWidth <= 700) return;
      const t = _traces[idx % _traces.length];
      if (t) _firePulse(t, idx % 3 === 1);
      idx++;
      // Update bus utilisation
      const util = Math.min(99, 30 + Math.floor(Math.random() * 50));
      const utilEl = document.getElementById('pnt-util');
      if (utilEl) utilEl.textContent = util + '%';
    }, PULSE_INTERVAL);
  }

  function _updatePktCounter() {
    const el = document.getElementById('pnt-pkt');
    if (el) el.textContent = String(_pktCount).padStart(4, '0');
  }

  /* Bind hover to fire pulse toward that module */
  function _bindHover(modules) {
    modules.forEach((mod, i) => {
      mod.addEventListener('mouseenter', () => {
        if (window.innerWidth <= 700) return;
        const t = _traces.find(tr => tr.modIdx === i);
        if (t) _firePulse(t, i % 2 === 0);
        // Highlight pad
        if (t) {
          gsap.to(t.padEl, {
            attr: { stroke: 'var(--g)', r: 7 },
            duration: .2, yoyo: true, repeat: 1
          });
        }
      });
    });
  }

  /* Telemetry bar live clock flicker */
  function _startTelemetry() {
    const clkEl = document.getElementById('pnt-clk');
    const clkValues = ['48MHz', '96MHz', '48MHz', '24MHz', '48MHz'];
    let ci = 0;
    setInterval(() => {
      ci = (ci + 1) % clkValues.length;
      if (clkEl) clkEl.textContent = clkValues[ci];
    }, 2200);
  }

  /* ScrollTrigger: draw traces → reveal nodes → start pulse loop */
  function _initScrollTrigger(section, cpuEl, modules) {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      once: true,
      onEnter: () => {
        _revealed = true;
        if (window.innerWidth <= 700) {
          // Mobile: just show all modules
          modules.forEach(m => m.classList.add('pnm-visible'));
          return;
        }

        // 1. Draw CPU rings (they're CSS-animated already, just make sure visible)
        gsap.fromTo(cpuEl, { opacity: 0, scale: .5 },
          { opacity: 1, scale: 1, duration: .6, ease: 'back.out(1.5)' });

        // 2. Stagger trace draws
        _traces.forEach((t, i) => {
          gsap.to(t.pathEl, {
            strokeDashoffset: 0,
            duration: .8,
            delay: .4 + i * .15,
            ease: 'power2.out',
            onStart: () => t.pathEl.classList.add('active'),
            onComplete: () => {
              // Show solder pads
              gsap.to([t.padEl, t.cpuPadEl], {
                opacity: 1, duration: .2,
                attr: { stroke: 'var(--g)' }
              });
              // Reveal module card
              modules[t.modIdx].classList.add('pnm-visible');
            }
          });
        });

        // 3. Start auto pulses after traces are drawn
        setTimeout(() => _startAutoPulse(modules), 1800);

        // 4. Animate bus utilisation bar
        let util = 0;
        const utilEl = document.getElementById('pnt-util');
        const utilAnim = setInterval(() => {
          util = Math.min(72, util + 4);
          if (utilEl) utilEl.textContent = util + '%';
          if (util >= 72) clearInterval(utilAnim);
        }, 60);
      }
    });
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════════
   MODULE: FirmwareSystem
   Handles Firmware Library section animations:
   - Terminal log typing effect on scroll enter
   - Sequential slot reveal (slide-in from left, staggered)
   - Progress bar fill per slot
   - Hover: slot powers up (status: INSTALLED → ACTIVE + LED glow)
   ══════════════════════════════════════════════════════════════ */
const FirmwareSystem = (() => {

  // Terminal log messages that cycle during slot installation
  const LOG_LINES = [
    '// Scanning firmware library…',
    '// Verifying checksums…',
    '// Mounting module rack…',
    '// Installing SLOT 01…',
    '// Installing SLOT 02…',
    '// Installing SLOT 03…',
    '// Installing SLOT 04…',
    '// All modules installed. System ready.',
  ];

  function init() {
    const section = document.getElementById('firmware');
    const slots   = document.querySelectorAll('.fw-slot');
    const logLine = document.getElementById('fw-log-line');
    if (!section || !slots.length) return;

    // ── Resolve data-version placeholder text ──────────────────
    // The HTML uses {{ data-version }} as a placeholder string.
    // Replace it with the actual data attribute value.
    slots.forEach(slot => {
      const verEl = slot.querySelector('.fws-ver');
      if (verEl) verEl.textContent = slot.dataset.version || 'v1.0';
    });

    // ── ScrollTrigger: sequential slot reveal ──────────────────
    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      once: true,
      onEnter: () => {
        // Start terminal log cycling
        _cycleLog(logLine);

        // Stagger each slot reveal
        slots.forEach((slot, i) => {
          setTimeout(() => {
            // Animate slot sliding in
            gsap.to(slot, {
              opacity: 1,
              x: 0,
              duration: .55,
              ease: 'power2.out'
            });
            // Fill progress bar
            const bar = slot.querySelector('.fws-bar');
            if (bar) {
              setTimeout(() => {
                bar.style.width = '100%';
              }, 300);
            }
          }, i * 180); // stagger
        });
      }
    });

    // ── Hover/Focus: power up slot (INSTALLED → ACTIVE) ────────
    slots.forEach(slot => {
      slot.addEventListener('mouseenter', () => _activateSlot(slot));
      slot.addEventListener('focusin',    () => _activateSlot(slot));
      slot.addEventListener('mouseleave', () => _deactivateSlot(slot));
      slot.addEventListener('focusout',   () => _deactivateSlot(slot));
    });
  }

  /* Cycle terminal log lines with typewriter cadence */
  function _cycleLog(el) {
    if (!el) return;
    let idx = 0;
    const step = () => {
      if (idx >= LOG_LINES.length) return;
      el.textContent = LOG_LINES[idx++];
      // Speed up first few lines, slow final line
      const delay = idx >= LOG_LINES.length ? 1200 : 280;
      setTimeout(step, delay);
    };
    step();
  }

  /* Power up: switch status label + LED to ACTIVE */
  function _activateSlot(slot) {
    slot.classList.add('active');
    const statusEl = slot.querySelector('.fws-status');
    const ledEl    = slot.querySelector('.fws-led');
    if (statusEl) statusEl.textContent = 'ACTIVE';
    if (ledEl) {
      ledEl.style.background  = 'var(--g)';
      ledEl.style.boxShadow   = '0 0 10px var(--g)';
    }
  }

  /* Power down: revert status label + LED to INSTALLED */
  function _deactivateSlot(slot) {
    slot.classList.remove('active');
    const statusEl = slot.querySelector('.fws-status');
    const ledEl    = slot.querySelector('.fws-led');
    if (statusEl) statusEl.textContent = 'INSTALLED';
    if (ledEl) {
      ledEl.style.background  = '';
      ledEl.style.boxShadow   = '';
    }
  }

  return { init };
})();


/* ──────────────────────────────────────────────────────────────
   INTEGRATION PATCH — add the two new modules to the main
   ScrollSystem.init() call inside the existing onEnter callback.

   PASTE LOCATION: In script.js, find the line that reads:
       ScrollSystem.init();
   (inside BootSystem's onEnter / enter-btn click handler)

   ADD these two lines IMMEDIATELY AFTER it:
       CommBusSystem.init();
       FirmwareSystem.init();

   Also add them to the DOMContentLoaded block like so:
   (they are safe to call early — they check for DOM presence)
─────────────────────────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════════
   BOOTSTRAP — init order matters
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  CanvasSystem.init();
  BootSystem.init();
  // Main site modules initialised after entering site (in BootSystem.onEnter → ScrollSystem.init)
  // But we pre-init non-visual modules immediately
  LogicSystem.init();
  ProjectSystem.init();
  ResearchSystem.init();
  NavSystem.init();
  FirmwareSystem.init();
  PCBNetSystem.init()
});

// Handle resize: refresh ScrollTrigger if active
window.addEventListener('resize', debounce(() => {
  if (window.ScrollTrigger) ScrollTrigger.refresh();
}, 300));
