# Contributing to GanttSmart

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork the repo and clone it locally
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your Supabase and Linear credentials
4. Start the dev server: `npm run dev`

## Development

- **Stack**: React, TypeScript, Vite, Tailwind CSS
- **Lint**: `npm run lint`
- **Type check**: `npx tsc --noEmit`
- **Build**: `npm run build`

## Submitting Changes

1. Open an issue first to discuss what you'd like to change
2. Create a branch from `main` (`git checkout -b feature/your-feature`)
3. Make your changes — keep PRs focused and small
4. Ensure `npm run lint` and `npx tsc --noEmit` pass
5. Open a pull request against `main`

## Pull Request Guidelines

- Keep the title short and descriptive
- Reference the related issue (e.g., "Closes #12")
- Include a brief description of what changed and why
- Add screenshots for UI changes

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS info
- Screenshots if applicable

## Code Style

- Follow the existing patterns in the codebase
- Use TypeScript — avoid `any`
- Prefer functional components and hooks

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
