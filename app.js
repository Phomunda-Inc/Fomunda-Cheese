'use strict';

const menuToggle = document.querySelector('.menu-toggle');
const primaryNavigation = document.querySelector('#primary-nav');

function closeNavigation() {
  primaryNavigation.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
}

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  primaryNavigation.classList.toggle('is-open', isOpen);
});

primaryNavigation.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeNavigation);
});

const filters = document.querySelectorAll('[data-filter]');
const products = document.querySelectorAll('[data-category]');

filters.forEach((button) => {
  button.addEventListener('click', () => {
    const category = button.dataset.filter;
    filters.forEach((filter) => {
      const selected = filter === button;
      filter.classList.toggle('active', selected);
      filter.setAttribute('aria-pressed', String(selected));
    });
    products.forEach((product) => {
      product.hidden = category !== 'all' && product.dataset.category !== category;
    });
  });
});

document.querySelector('#year').textContent = String(new Date().getFullYear());
