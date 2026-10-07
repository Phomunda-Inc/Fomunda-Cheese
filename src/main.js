import './style.css';

const products = [
  { id: 'sjon', name: 'Sjön 210', category: 'spinning', label: 'Spinnfiske', length: '2,10 m', weight: '5–25 g', price: 899, color: 'sage', description: 'Ett lätt allroundspö för abborre och lugna dagar vid sjön.' },
  { id: 'kusten', name: 'Kusten 270', category: 'spinning', label: 'Spinnfiske', length: '2,70 m', weight: '15–40 g', price: 1299, color: 'sand', description: 'Lite längre kast. Lite större vatten. För havsöring och kustäventyr.' },
  { id: 'alven', name: 'Älven 900', category: 'fly', label: 'Flugfiske', length: '9 fot', weight: 'Klass 5', price: 1699, color: 'clay', description: 'Ett följsamt flugspö för öring, strömmande vatten och tålamod.' },
];

const currency = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 });
const productList = document.querySelector('#products');
const cartItems = document.querySelector('#cart-items');



const cart = {};

function rodIllustration() {
  return `<svg viewBox="0 0 400 260" aria-hidden="true" focusable="false">
    <path d="M62 214 L340 42" stroke="#243e34" stroke-width="3" stroke-linecap="round"/>
    <path d="M62 214 L112 183" stroke="#b29060" stroke-width="12" stroke-linecap="round"/>
    <path d="M78 204 L92 195" stroke="#243e34" stroke-width="13"/>
    <g fill="none" stroke="#243e34" stroke-width="2">
      <ellipse cx="151" cy="164" rx="5" ry="8" transform="rotate(-32 151 164)"/>
      <ellipse cx="216" cy="124" rx="4" ry="7" transform="rotate(-32 216 124)"/>
      <ellipse cx="275" cy="87" rx="3" ry="5" transform="rotate(-32 275 87)"/>
      <path d="M151 172 L216 131 L275 92 L340 42" stroke-width="0.8"/>
    </g>
    <circle cx="105" cy="209" r="14" fill="#243e34"/>
    <circle cx="105" cy="209" r="8" fill="#b29060"/>
    <path d="M104 194 L98 185 M118 212 L130 212 L130 220" fill="none" stroke="#243e34" stroke-width="3"/>
  </svg>`;
}

function renderProducts(filter = 'all') {
  productList.innerHTML = products
    .filter((product) => filter === 'all' || product.category === filter)
    .map((product) => `<article class="product">
      <div class="product-art ${product.color}"><span>${product.label}</span>${rodIllustration()}</div>
      <div class="product-info">
        <div class="product-title"><h3>${product.name}</h3><strong>${currency.format(product.price)}</strong></div>
        <p>${product.description}</p>
        <div class="product-specs"><span>${product.length}</span><span>${product.weight}</span></div>
        <button class="button button-add" type="button" data-add="${product.id}">Lägg i varukorg <span aria-hidden="true">+</span></button>
      </div>
    </article>`).join('');
}

function renderCart() {
  const selected = products.filter((product) => cart[product.id]);
  document.querySelector('#cart-count').textContent = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  document.querySelector('#cart-total').textContent = currency.format(selected.reduce((sum, product) => sum + product.price * cart[product.id], 0));
  cartItems.innerHTML = selected.length ? selected.map((product) => `<div class="cart-item">
    <div><h3>${product.name}</h3><p>${currency.format(product.price)} / st</p></div>
    <div class="quantity">
      <button type="button" data-change="${product.id}" data-step="-1" aria-label="Minska antal ${product.name}">−</button>
      <span aria-label="Antal">${cart[product.id]}</span>
      <button type="button" data-change="${product.id}" data-step="1" aria-label="Öka antal ${product.name}">+</button>
    </div>
  </div>`).join('') : '<p class="empty-cart">Här var det lugnt. Hitta ditt spö och lägg det i varukorgen.</p>';
}


document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((filter) => filter.setAttribute('aria-pressed', String(filter === button)));
    renderProducts(button.dataset.filter);
  });
});




renderProducts();
renderCart();
