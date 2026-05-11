# Serenius Build Discipline

Standard local workflow:

1. `git status --short`
2. `npm run lint`
3. `npm run build`
4. `git add .`
5. `git commit -m "<clear message>"`
6. `git push origin main`

Guidance:

- For documentation-only changes, `npm run build` is optional but preferred before push.
- For app/runtime changes, `npm run build` is required.
- Do not introduce new dependencies without approval.
- If Codex changes app behavior, summarize changed files and risks.
- Main branch is the source of truth.
- Vercel should be checked after pushing `main`.
