/**
 * ================================================================
 * AADITYA GELANI — ECE PORTFOLIO
 * script.js
 * ================================================================
 *
 * MODULES:
 *  1. Boot / Mechanical Activation
 *  2. Particle Canvas (background)
 *  3. Scroll System (GSAP ScrollTrigger)
 *  4. Logic Simulation (NAND Gate)
 *  5. Project IC Cards
 *  6. Research Toggles
 *  7. Micro Interactions
 *  8. Signal Particle (circuit bus)
 */

'use strict';

// ── Detect low-end mobile ────────────────────────────────────────
const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent);
const IS_LOW_END = IS_MOBILE && (navigator.hardwareConcurrency || 4) <= 2;

// ================================================================
// MODULE 1 — BOOT / MECHANICAL ACTIVATION
// ================================================================
(function BootModule() {

  const bootScreen     = document.getElementById('boot-screen');
  const mainSite       = document.getElementById('main-site');
  const ropeContainer  = document.getElementById('rope-container');
  const ropeShaft      = document.getElementById('rope-shaft');
  const ropeKnob       = document.getElementById('rope-knob');
  const ropeHint       = document.getElementById('rope-hint');
  const revealPlate    = document.getElementById('reveal-plate');
  const nameText       = document.getElementById('name-text');
  const nameSub        = document.querySelector('.name-sub');
  const nameTags       = document.querySelector('.name-tags');
  const enterBtn       = document.getElementById('enter-btn');
  const powerFlash     = document.getElementById('power-flash');
  const gearLeftGroup  = document.getElementById('gear-left-group');
  const gearRightGroup = document.getElementById('gear-right-group');

  let isDragging     = false;
  let startY         = 0;
  let currentPull    = 0;
  const MAX_PULL     = 120;
  const TRIGGER_AT   = 70;   // px of pull to trigger activation
  let activated      = false;
  if (!enterBtn || !bootScreen || !mainSite) return;
  // ── Gear rotation state ─────────────────────────────────────
  let gearAngle  = 0;
  let gearSpeed  = 0;
  let gearRAF    = null;

  function spinGears(speed) {
    gearSpeed = speed;
    if (gearRAF !== null) cancelAnimationFrame(gearRAF);
    function frame() {
      gearAngle += gearSpeed;
      gearLeftGroup.setAttribute('transform', `rotate(${gearAngle}, 60, 60)`);
      // Counter-rotate right gear (different ratio for mesh effect)
      gearRightGroup.setAttribute('transform', `rotate(${-gearAngle * 1.4}, 40, 40)`);
      if (gearSpeed > 0.01) {
        gearSpeed *= 0.995; // gradual deceleration if not held
        gearRAF = requestAnimationFrame(frame);
      }
    }
    gearRAF = requestAnimationFrame(frame);
  }

  // Belt path animation
  const beltPath = document.getElementById('belt-path');
  let beltOffset = 0;
  function animateBelt() {
    beltOffset = (beltOffset + gearSpeed * 2) % 24;
    if (beltPath) beltPath.style.strokeDashoffset = beltOffset;
    if (!activated) requestAnimationFrame(animateBelt);
  }
  animateBelt();

  // ── Pointer Events ───────────────────────────────────────────
  function getClientY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  function onDragStart(e) {
    if (activated) return;
    isDragging = true;
    startY = getClientY(e) - currentPull;
    ropeHint.style.opacity = '0';
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!isDragging || activated) return;
    const y = getClientY(e);
    const pull = Math.max(0, Math.min(MAX_PULL, y - startY));
    currentPull = pull;

    // Update rope shaft visual
    const shaftHeight = 60 + pull * 0.8;
    ropeShaft.style.height = shaftHeight + 'px';
    ropeKnob.style.transform = `translateY(${pull}px)`;

    // Spin gears proportional to pull velocity
    const speed = (pull / MAX_PULL) * 3;
    gearSpeed = speed;

    // Trigger full activation
    if (pull >= TRIGGER_AT && !activated) {
      activated = true;
      triggerActivation();
    }
    e.preventDefault();
  }

  function onDragEnd() {
    currentPull = 0;
    if (!activated) {
      isDragging = false;
      // Snap back
      ropeShaft.style.height = '60px';
      ropeKnob.style.transform = 'translateY(0)';
      ropeKnob.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      setTimeout(() => { ropeKnob.style.transition = ''; }, 400);
      ropeHint.style.opacity = '1';
    }
  }

  ropeContainer.addEventListener('mousedown', onDragStart);
  ropeContainer.addEventListener('touchstart', onDragStart, { passive: false });
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchend', onDragEnd);

  // ── Activation sequence ──────────────────────────────────────
  function triggerActivation() {
    isDragging = false;
    revealPlate.style.willChange = "clip-path, transform";
    // Spin gears fast
    gearSpeed = 8;
    spinGears(8);

    // Extend rope completely
    ropeShaft.style.transition = 'height 0.3s ease';
    ropeShaft.style.height = (60 + MAX_PULL * 0.8) + 'px';
    ropeKnob.style.transform = `translateY(${MAX_PULL}px)`;

    // Open plate after short delay
    setTimeout(() => {
      revealPlate.classList.add('open');
      document.body.style.overflow = "hidden";
      
      // Show name text
      setTimeout(() => {
        nameText.classList.add('visible');
        nameSub.classList.add('visible');
        nameTags.classList.add('visible');
        enterBtn.classList.add('visible');
      }, 600);

    }, 400);
  }

  // ── Enter site ───────────────────────────────────────────────
  enterBtn.addEventListener('click', () => {
    document.body.style.overflow = "auto";
    document.body.classList.remove("booting");
    // Flash effect
    powerFlash.style.transition = 'opacity 0.1s';
    powerFlash.style.opacity = '1';
    setTimeout(() => {
      powerFlash.style.transition = 'opacity 0.5s';
      powerFlash.style.opacity = '0';
    }, 100);

    // Fade out boot, show main
    gsap.to(bootScreen, {
      opacity: 0,
      duration: 0.6,
      delay: 0.15,
      onComplete: () => {
        bootScreen.style.display = 'none';
        mainSite.classList.remove('hidden');
        mainSite.style.opacity = '0';
        gsap.to(mainSite, { opacity: 1, duration: 0.8 });
        // Initialize scroll triggers after site is visible
        ScrollModule.init();
      }
    });
  });

})();


// ================================================================
// MODULE 2 — PARTICLE CANVAS (Background stars/nodes)
// ================================================================
(function CanvasModule() {
  if (IS_LOW_END) return; // Skip on low-end devices

  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Create grid-like nodes
  function createParticles() {
    particles = [];
    const count = IS_MOBILE ? 30 : 60;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        alpha: Math.random() * 0.5 + 0.1
      });
    }
  }
  createParticles();

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,255,136,${0.06 * (1 - dist/120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,136,${p.alpha})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });

    requestAnimationFrame(drawParticles);
  }

  drawParticles();
})();


// ================================================================
// MODULE 3 — SCROLL SYSTEM
// ================================================================
const ScrollModule = (function() {

  function init() {
    gsap.registerPlugin(ScrollTrigger);

    // ── Reveal section headers ──────────────────────────────
    document.querySelectorAll('.section-header').forEach(el => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        x: -30,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out'
      });
    });

    // ── About card ──────────────────────────────────────────
    gsap.from('.about-card', {
      scrollTrigger: { trigger: '#about', start: 'top 70%' },
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out'
    });

    // Animate PCB traces
    const traces = document.querySelectorAll('.trace');
    ScrollTrigger.create({
      trigger: '#about',
      start: 'top 60%',
      onEnter: () => traces.forEach(t => t.classList.add('animated'))
    });

    // ── Skills bars ─────────────────────────────────────────
    ScrollTrigger.create({
      trigger: '#skills',
      start: 'top 60%',
      onEnter: animateSkills
    });

    // ── Logic section ────────────────────────────────────────
    gsap.from('.logic-panel', {
      scrollTrigger: { trigger: '#logic', start: 'top 70%' },
      scale: 0.95,
      opacity: 0,
      duration: 0.6
    });
    gsap.from('.truth-table-container', {
      scrollTrigger: { trigger: '#logic', start: 'top 70%' },
      x: 30,
      opacity: 0,
      duration: 0.6,
      delay: 0.2
    });

    // ── Project cards stagger ────────────────────────────────
    gsap.from('.ic-card', {
      scrollTrigger: { trigger: '#projects', start: 'top 70%' },
      y: 50,
      opacity: 0,
      stagger: 0.15,
      duration: 0.7,
      ease: 'power2.out'
    });

    // ── Research items stagger ───────────────────────────────
    gsap.from('.research-item', {
      scrollTrigger: { trigger: '#research', start: 'top 75%' },
      x: -20,
      opacity: 0,
      stagger: 0.1,
      duration: 0.5
    });

    // ── Terminal lines stagger ───────────────────────────────
    gsap.from('.terminal-line', {
      scrollTrigger: { trigger: '#contact', start: 'top 75%' },
      opacity: 0,
      x: -10,
      stagger: 0.08,
      duration: 0.4
    });

    // ── Signal particle ──────────────────────────────────────
    startSignalParticle();

    // ── Nav highlight on scroll ──────────────────────────────
    const sections = document.querySelectorAll('.sys-section');
    const navLinks = document.querySelectorAll('.nav-links a');

    sections.forEach(sec => {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 40%',
        end: 'bottom 40%',
        onToggle: self => {
          if (self.isActive) {
            const id = sec.id;
            navLinks.forEach(a => {
              a.style.color = a.getAttribute('href') === `#${id}`
                ? 'var(--green)'
                : 'var(--text-dim)';
            });
          }
        }
      });
    });
  }

  // ── Skill bar animation ──────────────────────────────────────
  function animateSkills() {
    document.querySelectorAll('.skill-fill').forEach((bar, i) => {
      const pct = bar.getAttribute('data-pct');
      setTimeout(() => {
        bar.style.width = pct + '%';
      }, i * 80);
    });
  }

  // ── Signal particle flowing down bus ────────────────────────
  function startSignalParticle() {
    if (IS_MOBILE) return;
    const particle = document.getElementById('signal-particle');
    if (!particle) return;

    particle.style.opacity = '1';
    let progress = 0;

    function moveParticle() {
      const docH = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewH = window.innerHeight;
      // Particle position follows scroll
      const pct = scrollTop / (docH - viewH);
      const y = 60 + pct * (viewH - 120);

      gsap.to(particle, {
        attr: { cy: y },
        duration: 0.5,
        ease: 'power1.out'
      });
    }

    window.addEventListener('scroll', moveParticle, { passive: true });

    // Gentle idle animation
    gsap.to(particle, {
      attr: { r: 7 },
      duration: 1.2,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });
  }

  return { init };
})();


// ================================================================
// MODULE 4 — LOGIC SIMULATION (NAND GATE)
// ================================================================
(function LogicModule() {

  const btnA      = document.getElementById('inputA');
  const btnB      = document.getElementById('inputB');
  const wireA     = document.getElementById('wire-a');
  const wireB     = document.getElementById('wire-b');
  const outputLed = document.getElementById('output-led');
  const outputVal = document.getElementById('output-value');
  const gateSvg   = document.getElementById('nand-gate-svg');
  const rows      = document.querySelectorAll('.tt-row');

  let stateA = 0, stateB = 0;

  function updateLogic() {
    const output = !(stateA && stateB) ? 1 : 0; // NAND truth

    // Update wire visual
    wireA.classList.toggle('active', stateA === 1);
    wireB.classList.toggle('active', stateB === 1);

    // Animate gate processing
    gateSvg.classList.add('processing');
    setTimeout(() => gateSvg.classList.remove('processing'), 400);

    // Output
    outputLed.classList.toggle('on', output === 1);
    outputVal.textContent = output ? 'HIGH' : 'LOW';
    outputVal.style.color = output ? 'var(--green)' : 'var(--text-dim)';

    // Animate gate particles
    animateGateParticles();

    // Update input line colors
    document.getElementById('in-line-a').setAttribute('stroke',
      stateA ? 'var(--green)' : '#334433');
    document.getElementById('in-line-b').setAttribute('stroke',
      stateB ? 'var(--green)' : '#334433');
    document.getElementById('out-line').setAttribute('stroke',
      output ? 'var(--green)' : '#334433');

    // Highlight truth table row
    rows.forEach(row => {
      const match = parseInt(row.dataset.a) === stateA &&
                    parseInt(row.dataset.b) === stateB;
      row.classList.toggle('active', match);
    });
  }

  function animateGateParticles() {
    const particles = document.querySelectorAll('.gate-particle');
    particles.forEach((p, i) => {
      const isActive = i === 0 ? stateA : stateB;
      if (!isActive) return;
      p.setAttribute('opacity', '1');
      // Simple translate animation via GSAP if available, else CSS
      if (window.gsap) {
        const startX = 0;
        const endX   = 165;
        gsap.fromTo(p, {
          attr: { cx: startX, cy: i === 0 ? 40 : 80, opacity: 1 }
        }, {
          attr: { cx: endX, cy: 60, opacity: 0 },
          duration: 0.5,
          ease: 'power1.in'
        });
      } else {
        setTimeout(() => p.setAttribute('opacity', '0'), 500);
      }
    });
  }

  function toggleInput(btn) {
    const cur = parseInt(btn.dataset.state);
    const next = cur === 0 ? 1 : 0;
    btn.dataset.state = next;
    btn.querySelector('.toggle-state').textContent = next ? 'HIGH' : 'LOW';
    if (btn.id === 'inputA') stateA = next;
    else stateB = next;
    updateLogic();
  }

  btnA.addEventListener('click', () => toggleInput(btnA));
  btnB.addEventListener('click', () => toggleInput(btnB));

  // Initial state (both LOW → NAND = HIGH)
  updateLogic();

})();


// ================================================================
// MODULE 5 — PROJECT IC CARDS
// ================================================================
(function ProjectModule() {

  const cards = document.querySelectorAll('.ic-card');

  cards.forEach(card => {
    const body    = card.querySelector('.ic-body');
    const expand  = card.querySelector('.ic-expand');
    const closeBtn = card.querySelector('.detail-close');

    // Toggle expand on card click
    card.addEventListener('click', e => {
      if (e.target.closest('.detail-close')) return;
      if (e.target.closest('.detail-link')) return; // allow link clicks

      const isOpen = expand.classList.contains('open');
      // Close all others
      document.querySelectorAll('.ic-expand.open').forEach(el => el.classList.remove('open'));

      if (!isOpen) {
        expand.classList.add('open');
        // Smooth scroll into view
        setTimeout(() => {
          expand.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    });

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', e => {
        expand.classList.remove('open');
        e.stopPropagation();
      });
    }
  });

  // ── Magnetic hover on IC cards ───────────────────────────────
  if (!IS_MOBILE) {
    cards.forEach(card => {
      const body = card.querySelector('.ic-body');
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        body.style.transform =
          `perspective(800px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        body.style.transform = '';
      });
    });
  }

})();


// ================================================================
// MODULE 6 — RESEARCH TOGGLES
// ================================================================
function toggleResearch(headerEl) {
  const item = headerEl.closest('.research-item');
  const body = item.querySelector('.research-body');
  const icon = item.querySelector('.research-expand-icon');

  const isExpanded = item.classList.contains('expanded');
  // Close all
  document.querySelectorAll('.research-item.expanded').forEach(el => {
    el.classList.remove('expanded');
    el.querySelector('.research-body').classList.add('collapsed');
  });

  if (!isExpanded) {
    item.classList.add('expanded');
    body.classList.remove('collapsed');
  }
}


// ================================================================
// MODULE 7 — MICRO INTERACTIONS
// ================================================================
(function MicroModule() {
  if (IS_MOBILE) return;

  // ── Cursor proximity effect on buttons ───────────────────────
  const sysButtons = document.querySelectorAll('.sys-btn, .logic-toggle, .contact-link');

  document.addEventListener('mousemove', e => {
    sysButtons.forEach(btn => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const maxDist = 80;

      if (dist < maxDist) {
        const force = (1 - dist / maxDist) * 8;
        btn.style.transform = `translate(${dx * force / maxDist}px, ${dy * force / maxDist}px)`;
      } else {
        btn.style.transform = '';
      }
    });
  });

  // ── Nav link underline slide ─────────────────────────────────
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    link.style.position = 'relative';
    link.style.overflow = 'hidden';
  });

})();


// ================================================================
// MODULE 8 — PCB TRACE ANIMATION ON SCROLL
// ================================================================
(function PCBTraceModule() {
  // Create animated circuit traces on the circuit bus
  const busSvg = document.getElementById('circuit-bus');
  if (!busSvg || IS_MOBILE) return;

  // Add horizontal tap lines at section junctions
  const sections = document.querySelectorAll('.sys-section');
  sections.forEach((sec, i) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      onEnter: () => {
        // Flash the bus
        const line = document.getElementById('bus-line');
        if (line) {
          line.setAttribute('stroke', '#00ff8888');
          setTimeout(() => line.setAttribute('stroke', '#00ff8822'), 300);
        }
      }
    });
  });
})();


// ================================================================
// UTILITY — Nav smooth scroll
// ================================================================
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});


// ================================================================
// UTILITY — Resize handler
// ================================================================
window.addEventListener('resize', () => {
  if (window.ScrollTrigger) ScrollTrigger.refresh();
});
