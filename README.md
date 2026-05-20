# Our Safe Space

Single-page React + Tailwind app (Vite) implementing a 7-stage relationship milestone game.

Quick start

1. Install dependencies

```bash
npm install
```

2. Run dev server

```bash
npm run dev
```

Notes

- Tailwind, Vite, React are configured. The component lives at `src/App.jsx`.
- This version includes improved UI polish, better stage state handling, and vault error feedback.
- The Master Vault uses a local mock for Supabase images; integrate your Supabase client and replace the mock fetch in `src/App.jsx` to load real images.
