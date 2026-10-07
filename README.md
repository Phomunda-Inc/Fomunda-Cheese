# Spöverket

A fictional Swedish fishing-rod startup website, built with HTML, CSS, JavaScript, and Vite.

## Run locally

Install Node.js 22.12 or newer, then run:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal. Stop the server with `Ctrl+C`.

## Production build

```sh
npm run build
npm run preview
```

## Features

- Responsive Swedish storefront with three fishing rods.
- Filter products by fishing style.
- Demo cart with quantity controls and a total in Swedish kronor.
- Cart saved in your browser across reloads.
- Keyboard-accessible cart, skip link, mobile navigation, and reduced-motion support.
- Local illustrations and system fonts; no external font or image requests.

This is a fictional demo: there is no checkout, payment processing, or order submission. Product details, prices, and brand claims are illustrative.

## Tests

```sh
npm test
```

Tests exercise the actual storefront JavaScript with a lightweight DOM adapter using Node's built-in test runner. They cover filtering, cart totals, persistence, quantity limits, focus restoration, dialog controls, and storage errors. They are not a substitute for visual browser testing.

## Development-history fixture

The 67 incremental commits after the original repository commit were generated as a simulated development timeline for this fictional project. Each changes project files; author identities and timestamps were not backdated or fabricated. This history is not evidence of historical startup activity.
