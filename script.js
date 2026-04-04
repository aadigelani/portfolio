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
    gsap.registerPlugin(ScrollTrigger);

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
});

// Handle resize: refresh ScrollTrigger if active
window.addEventListener('resize', debounce(() => {
  if (window.ScrollTrigger) ScrollTrigger.refresh();
}, 300));
