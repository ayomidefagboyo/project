# Build, Test & Cleanup Status

## 1. Build status

| Target | Status | Notes |
|--------|--------|--------|
| **apps/pos** | ✅ **Passes** | `npm run build` succeeds. Warnings: dynamic/static import mix for `supabase.ts`; chunk size >500KB (consider code-splitting). |
| **apps/dashboard** | ❌ **Fails** | `npm run build` fails with `Cannot find module @rollup/rollup-darwin-x64`. Fix: run `rm -rf node_modules package-lock.json && npm i` in `apps/dashboard`, then rebuild. |
| **backend** | ⚠️ **No formal build** | Python app; no `pyproject.toml` or `pytest` in `requirements.txt`. Imports are validated by `test_setup.py` (see below). |

---

## 2. Test scripts & usage

- **apps/pos** – No `test` script in `package.json` (no Jest/Vitest).
- **apps/dashboard** – No `test` script in `package.json`.
- **backend** – No pytest in `requirements.txt`. Two test-related pieces:
  - **`backend/test_setup.py`** – Manual setup check: imports (FastAPI, uvicorn, pydantic, supabase), app structure, and app import. Run: `cd backend && python test_setup.py`.
  - **`backend/app/api/v1/endpoints/test_auth.py`** – Dev-only API under `/api/v1/test` (e.g. `create-test-token`, `test-database`). **Security:** ensure this router is disabled or restricted in production (e.g. env guard or remove from `api.py` in prod).

**Recommendation:** Add a `test` script to each app when you introduce a test runner (e.g. Vitest for frontends, pytest for backend). Optionally document `python test_setup.py` in README or a “Scripts” section.

---

## 3. Unused / redundant code

| Item | Location | Suggestion |
|------|----------|------------|
| Unused `error` from `useToast()` | `apps/pos/src/App.tsx` (e.g. ~L43) | Use it for toast on error or remove from destructuring. |
| Unused `error` in catch | `apps/pos/src/App.tsx` (~L258) | Use in `error(...)` toast or rename to `_error` if intentionally unused. |
| Unused icons | `SalesBreakdownModal.tsx`: `Users`, `BarChart3` | Remove from imports if not used in UI. |
| `SortIcon` defined inside render | `SalesBreakdownModal.tsx` ~L164 | Move component outside the parent (or memoize) to fix “component created during render” lint and avoid state reset. |
| setState in effect (sync) | `App.tsx` ~L68, `SalesBreakdownModal.tsx` ~L122 | Linter flags sync setState in effects; consider initial state from localStorage or moving logic so setState runs in response to events/callbacks. |
| `test_auth` router | `backend/app/api/v1/api.py` | Guard with `if settings.ENVIRONMENT == "development"` or remove from production router list. |

---

## 4. Docs cleanup

Root-level markdown files:

| Doc | Purpose | Suggestion |
|-----|---------|------------|
| `README.md` | Main project readme | Keep; consider pointing to app-specific READMEs. |
| `apps/pos/README.md` | POS app readme | Keep. |
| `COMPREHENSIVE_REALTIME_GUIDE.md` | Realtime deep-dive | Keep if actively used; else move to `docs/` or merge into main realtime doc. |
| `ENABLE_REALTIME.md` | How to enable realtime | Consider merging into `QUICK_START_REALTIME*.md` to reduce duplication. |
| `EOD_ENHANCEMENT_SUMMARY.md` | EOD sales breakdown feature | Keep as feature summary; optional: move to `docs/eod/`. |
| `POS_IMPLEMENTATION_STATUS.md` | POS status checklist | Keep for tracking; optional: move to `docs/pos/`. |
| `POS_IMPLEMENTATION_SUMMARY.md` | POS summary | Consider merging into `POS_IMPLEMENTATION_STATUS.md` or `docs/pos/`. |
| `POS_PRODUCTION_PLAN.md` | Production plan | Keep; optional: move to `docs/`. |
| `QUICK_START_REALTIME_ALL.md` | Realtime quick start (all) | Consolidate with `QUICK_START_REALTIME.md` if overlapping. |
| `QUICK_START_REALTIME.md` | Realtime quick start | Keep as primary “enable realtime” doc. |
| `REALTIME_DEBUG_GUIDE.md` | Realtime debugging | Keep; optional: `docs/realtime/`. |
| `REALTIME_SYNC_GUIDE.md` | Realtime sync guide | Keep; optional: `docs/realtime/`. |
| `backend/database/ARCHITECTURE_ANALYSIS.md` | DB architecture | Keep in repo; optional: `docs/backend/`. |

**Recommendation:** Create a `docs/` folder and group by area (e.g. `docs/realtime/`, `docs/pos/`, `docs/backend/`). Leave a short README in root that links to these. Remove or merge duplicate “quick start” realtime docs.

---

## 5. Lint status (POS)

`npm run lint` in **apps/pos** currently fails with multiple issues:

- **@typescript-eslint/no-unused-vars** – Unused `error` (App.tsx), unused `Users`/`BarChart3` (SalesBreakdownModal).
- **@typescript-eslint/no-explicit-any** – Several `any` types in SalesBreakdownModal (props, transaction types, etc.); replace with proper types/interfaces.
- **react-hooks/set-state-in-effect** – Sync setState in `useEffect` in App.tsx and SalesBreakdownModal; refactor as above.
- **react-compiler/react-compiler** – “Cannot create components during render” for `SortIcon` in SalesBreakdownModal; move component out of render.

Fixing the above will get the POS app to a passing lint state. Dashboard lint was not run (build broken); fix dashboard build first, then run `npm run lint` there.

---

## 6. Summary checklist

- [ ] Fix dashboard build: `cd apps/dashboard && rm -rf node_modules package-lock.json && npm i && npm run build`
- [ ] Fix POS lint: unused vars, `any` types, setState-in-effect, SortIcon component placement
- [ ] Guard or remove `test_auth` router in production
- [ ] Add `test` scripts when adding test frameworks; document `python test_setup.py` for backend
- [ ] Consolidate or move root-level docs into `docs/` and de-duplicate realtime quick starts
- [ ] (Optional) Add backend pytest and CI step for `test_setup.py` or real tests
