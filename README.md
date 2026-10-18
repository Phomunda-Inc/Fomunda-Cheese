# Phomunda Inc.

Website for our independent creamery and trade partners.

## Local development

Requires Node.js 22.13 or newer on the 22.x release line, or Node.js 24 or newer.

Install dependencies with `npm ci`, then run `npm run setup` once. Configure
the values described in `.env.example` before starting with `npm start`.
The default local address is http://127.0.0.1:3500.

## Quality checks

Run `npm run lint`, `npm run format:check`, and `npm test` before submitting changes.
Use `npm run format` to apply the shared formatting rules.
