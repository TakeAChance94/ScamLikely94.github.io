const links = document.querySelectorAll('[data-section]');
const sections = document.querySelectorAll('.section');

function showSection(id) {
  sections.forEach(sec => {
    sec.classList.remove('active');
  });
  const target = document.getElementById(id);
  if (target) {
    // Force reflow for restart animation
    void target.offsetWidth;
    target.classList.add('active');
  }
  links.forEach(link => {
    link.classList.toggle('active', link.dataset.section === id);
  });
}

links.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    showSection(link.dataset.section);
  });
});

// Start on home
showSection('home');

// Ensure video plays on mobile
const bgVideo = document.querySelector('.bg-video');
if (bgVideo) {
  const tryPlay = () => bgVideo.play().catch(() => {});
  tryPlay();
  document.addEventListener('touchstart', tryPlay, { once: true });
  document.addEventListener('click', tryPlay, { once: true });
  bgVideo.addEventListener('loadeddata', tryPlay);
}
