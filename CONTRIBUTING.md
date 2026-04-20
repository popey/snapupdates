# Contributing

Thanks for your interest in contributing to Snap Store Updates!

## Getting Started

1. Fork the repository
2. Clone your fork and set up the dev environment (see [README](README.md))
3. Create a branch for your change
4. Make your changes, test locally, and open a pull request

## Development Workflow

1. Make your code change
2. Type-check: `cd snap-worker && npx tsc --noEmit`
3. Run tests: `cd snap-worker && npm test`
4. Start the dev server and verify in a browser: `npm run dev` then visit http://localhost:8787
5. Open a pull request with a clear description of the change

## Guidelines

- **Test locally before submitting** — all changes should be verified against the local dev server
- **Keep it simple** — the site serves static HTML with no client-side JavaScript (except nav toggle)
- **Follow existing patterns** — the codebase is a single-file Worker; keep new routes and helpers consistent with what's already there
- **One thing per PR** — small, focused pull requests are easier to review

## Reporting Bugs

Open an [issue](https://github.com/popey/snapupdates/issues) with:

- What you expected to happen
- What actually happened
- Steps to reproduce (URL, browser, etc.)

## Feature Requests

Open an [issue](https://github.com/popey/snapupdates/issues) and describe the use case. The project aims to stay lightweight and focused — not every feature will be a fit, but all ideas are welcome.

## Security

If you find a security vulnerability, please report it responsibly. See [SECURITY.md](SECURITY.md) for details.
