# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TimeLine Planner** is a React-based project planning application featuring a Gantt-style timeline view with task and resource management. The project is structured as a monorepo with a single frontend application.

## Directory Structure

```
TimeLinePlanner/
└── frontend/              # Main React application
    ├── src/
    │   ├── components/
    │   │   ├── layout/    # Layout components (Sidebar)
    │   │   └── ui/        # UI components (DateRangePicker)
    │   ├── pages/         # Page components (TimelinePage, TasksPage, ResourcesPage)
    │   ├── App.tsx        # Main app with page routing
    │   └── index.css      # Global styles and Tailwind theme
    ├── vite.config.ts     # Vite configuration with @ alias
    ├── postcss.config.js  # PostCSS with Tailwind v4
    └── tsconfig.json      # TypeScript configuration
```

## Technology Stack

- **React**: 19.2.0 with TypeScript
- **Build Tool**: Vite 7.2.4
- **Styling**: Tailwind CSS v4 (with @tailwindcss/postcss)
- **UI Library**: Lucide React (icons)
- **Date Handling**: date-fns 4.1.0, react-day-picker 9.13.2
- **Type Checking**: TypeScript 5.9.3
- **Linting**: ESLint with typescript-eslint, react-hooks, react-refresh plugins

## Common Commands

### Development
```bash
cd TimeLinePlanner/frontend
npm run dev              # Start dev server with HMR (http://localhost:5173)
npm run build            # Build for production (outputs to dist/)
npm run preview          # Preview production build locally
npm run lint             # Run ESLint
```

### Build Steps
The build command runs TypeScript compilation first (`tsc -b`) then Vite bundling.

## Architecture & Key Patterns

### Page Navigation
The app uses a simple state-based routing in `App.tsx` with `activePage` state and a `renderPage()` switch function. The `Sidebar` component handles navigation by calling `onPageChange()`. No external router is currently used—consider this if adding more complex routing later.

### Tailwind v4 Custom Theme
Colors are defined in `src/index.css` using CSS custom properties and Tailwind's `@theme` directive:
- **System Colors**: `app-bg`, `app-surface`, `app-border`
- **Text Colors**: `app-text-main`, `app-text-head`, `app-text-muted`
- **Interactive**: `app-primary`, `app-primary-hover`, `app-accent`, `app-error`

Use these custom color names in Tailwind classes instead of standard colors (e.g., `bg-app-surface` not `bg-slate-100`).

### Sticky Headers & Scroll Sync (TATO Standard)
See `.cursor/rules/tabular-layout-standards.mdc` for mandatory layout standards for all table/timeline pages:
- Page headers use `z-50`, table headers use `z-20` or `z-30`
- Multi-panel layouts (sidebar + content) must synchronize vertical scroll using refs and `onScroll` handlers
- Horizontal scrollbars must remain visible in viewport (use `overflow-hidden` containers)
- Use `.hide-scrollbar` CSS class to hide unnecessary scrollbars on sidebar panels

### DateRangePicker Component
The `DateRangePicker` component supports three view modes (days/months/years) with a custom-styled `react-day-picker`. It's used in `TimelinePage` to control the date range for the timeline grid. The component handles click-outside detection to auto-close and resets view mode on close.

### Timeline/Gantt View
`TimelinePage` demonstrates the project's most complex UI:
- **Zoom levels** (2W, 3W, M, Q, 2Q) with configurable day widths
- **Synchronized scroll** between resource sidebar and timeline grid
- **Sticky header** with dynamic date grouping (quarters/months/weeks/days based on zoom)
- **CSS gradients** for grid lines (for performance)
- **Computed dimensions**: `useMemo` calculates total width, week/month/quarter groupings, and start offsets

Data is mock (100 hardcoded resources), ready for API integration.

## Styling Notes

- **Tailwind v4 syntax**: Use `@import "tailwindcss"` in CSS, `@theme` for custom properties
- **Font**: Inter Tight from Google Fonts, set as default in theme
- **Layout utilities**: Frequent use of `flex`, `h-screen`, `overflow-hidden`, `sticky`, `z-index` for complex layouts
- **Responsive**: Currently not mobile-optimized; all components assume desktop viewport
- **Animations**: Uses Tailwind's `animate-in` classes and custom `transition` utilities

## Cursor Rules

The project includes one custom Cursor rule in `.cursor/rules/tabular-layout-standards.mdc` that mandates layout standards for all page components (Tasks, Resources, Timeline, etc.). Always review this file when adding new pages with tables or lists.

## Development Workflow

1. **Local development**: Run `npm run dev` in `frontend/` directory
2. **Type checking**: TypeScript is checked during build; run `tsc -b` to check without building
3. **Linting**: Run `npm run lint` to check ESLint rules before committing
4. **Build process**: `npm run build` compiles TypeScript then bundles with Vite

## Future Considerations

- Currently using state-based page routing; consider React Router setup as app grows
- Mock data in TimelinePage (100 hardcoded resources); replace with API calls
- TasksPage and ResourcesPage are placeholders; implement table/list views following TATO standards
- No backend; plan API integration for tasks, resources, and timeline data
