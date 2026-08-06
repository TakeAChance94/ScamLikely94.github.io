const player = document.getElementById('player');
const buildings = document.querySelectorAll('.building');
const panels = document.querySelectorAll('.panel');
const closes = document.querySelectorAll('.close');

let x = 45; // %
let y = 70;
const speed = 0.9;
const keys = {};

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

function move() {
  let moved = false;
  if (keys['arrowleft'] || keys['a']) { x -= speed; moved = true; }
  if (keys['arrowright'] || keys['d']) { x += speed; moved = true; }
  if (keys['arrowup'] || keys['w']) { y -= speed; moved = true; }
  if (keys['arrowdown'] || keys['s']) { y += speed; moved = true; }

  // Clamp
  x = Math.max(5, Math.min(95, x));
  y = Math.max(15, Math.min(90, y));

  player.style.left = x + '%';
  player.style.top = y + '%';

  if (moved) checkBuildings();
  requestAnimationFrame(move);
}

function checkBuildings() {
  const pRect = player.getBoundingClientRect();
  buildings.forEach(b => {
    const bRect = b.getBoundingClientRect();
    const overlap = !(
      pRect.right < bRect.left + 20 ||
      pRect.left > bRect.right - 20 ||
      pRect.bottom < bRect.top + 20 ||
      pRect.top > bRect.bottom - 20
    );
    if (overlap) {
      openPanel(b.dataset.panel);
    }
  });
}

function openPanel(id) {
  panels.forEach(p => p.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

closes.forEach(btn => {
  btn.addEventListener('click', () => {
    panels.forEach(p => p.classList.remove('active'));
  });
});

// Click buildings too
buildings.forEach(b => {
  b.addEventListener('click', () => openPanel(b.dataset.panel));
});

// Start loop
move();
