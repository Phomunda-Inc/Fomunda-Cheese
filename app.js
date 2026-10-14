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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    closeNavigation();
    menuToggle.focus();
  }
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

const contactForm = document.querySelector('#contact-form');
const messageField = document.querySelector('#message');
const contactStatus = document.querySelector('#contact-status');

document.querySelectorAll('[data-inquiry]').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelector('#interest').value = 'Product availability';
    if (!messageField.value.trim()) {
      messageField.value = `I'd like to learn more about ${link.dataset.inquiry}, including available formats and pricing.`;
    }
  });
});

const submitButton = contactForm.querySelector('button[type="submit"]');

// Static-site delivery simulation. No customer data is transmitted or retained.
contactForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (submitButton.disabled || !contactForm.reportValidity()) return;
  submitButton.disabled = true;
  submitButton.firstChild.nodeValue = 'Sending... ';
  contactForm.setAttribute('aria-busy', 'true');
  contactStatus.textContent = '';

  window.setTimeout(() => {
    contactForm.reset();
    contactForm.setAttribute('aria-busy', 'false');
    submitButton.disabled = false;
    submitButton.firstChild.nodeValue = 'Send inquiry ';
    contactStatus.textContent =
      'Message sent. Thanks for reaching out! Our team will be in touch soon.';
  }, 700);
});

contactForm.addEventListener('input', () => {
  contactStatus.textContent = '';
});

const employeeDialog = document.querySelector('#employee-dialog');
document.querySelector('#employee-login').addEventListener('click', (event) => {
  event.preventDefault();
  employeeDialog.showModal();
});
employeeDialog.querySelectorAll('.dialog-close, .dialog-dismiss').forEach((button) => {
  button.addEventListener('click', () => employeeDialog.close());
});
employeeDialog.addEventListener('click', (event) => {
  if (event.target !== employeeDialog) return;
  const bounds = employeeDialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  ) {
    employeeDialog.close();
  }
});

document.querySelector('#year').textContent = String(new Date().getFullYear());
