# Albert Leonardi — Personal Portfolio

A deep-ocean personal portfolio built with Astro, featuring interactive ASCII jellyfish, project case studies, and a personal biography.

This website introduces Albert Leonardi, a Machine Learning Engineer based in Jakarta, Indonesia. It brings together his work, background, and personal moments in a dark ocean setting, with glowing jellyfish and quiet motion throughout the interface.

> in the deep, even the soft things shine

## Features

- **Interactive ocean:** a custom Canvas simulation renders jellyfish as shaded text glyphs, with trailing tentacles, plankton, and bubbles.
- **Natural movement:** four to nine jellyfish spawn at random positions, react to pointer movement and clicks, and swim across the screen’s edges.
- **Project showcase:** a horizontal project strip on desktop, stacked projects on mobile, and individual case-study pages with screenshots and live-site and GitHub links.
- **Personal Blog:** an about page under the Blog name, featuring a LinkedIn-based biography, work experience, education, and three personal photos.
- **Deep-ocean design:** a permanent dark palette, luminous teal accents, serif and monospace typography, and subtle content reveals.
- **Responsive navigation:** desktop navigation and a mobile menu with keyboard focus management and Escape-to-close support.
- **Reduced-motion support:** page slides and content reveals are disabled, while the ocean drifts more slowly and click effects stay quiet.

## Pages

| Route | Content |
| --- | --- |
| `/` | Introduction and interactive jellyfish ocean |
| `/projects` | Selected projects |
| `/projects/aether` | Aether case study, screenshots, and links |
| `/blog` | Personal biography, experience, education, and photos |

### Featured project: Aether

A weather application with rain-aware driving routes, live radar, and an AI assistant.

[Live application](https://aether-wx.vercel.app) · [Source code](https://github.com/albertleooonardi/aether)

## Built with

| Technology | Purpose |
| --- | --- |
| Astro | Static pages, layouts, and components |
| TypeScript | Ocean simulation and browser interactions |
| Canvas 2D | Jellyfish and ambient ocean rendering |
| CSS | Responsive layouts, transitions, and visual styling |
| Newsreader | Serif typography |
| Spline Sans Mono | Monospace typography and ocean glyphs |

Fonts are served locally through Fontsource. Personal photos and project screenshots use WebP assets.

## Getting started

Requirements: Node.js **22.23.4 or newer** and npm **9.6.5 or newer**, matching the installed Astro package’s engine requirements.

Install dependencies from the project directory:

```sh
npm install
```

Start the development server in the background:

```sh
npm run astro -- dev --background
```

The configured port is `4380`. Astro prints the actual local URL when the server starts and selects another port if that one is occupied.

Manage the background server:

```sh
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

### Production build

```sh
npm run build
```

The static website is generated in `dist/`. To inspect that build locally:

```sh
npm run preview
```

The generated `dist/` directory can be deployed to a host that serves static websites. Before deployment, replace the placeholder domain in `astro.config.mjs` and `src/data/site.ts` with the final website URL.

## Customizing the content

| File or directory | What to edit |
| --- | --- |
| `src/data/site.ts` | Name, introduction, role, social links, and background hover cards |
| `src/data/projects.ts` | Project descriptions, technologies, screenshots, and case studies |
| `src/pages/blog/index.astro` | Personal biography, timeline, photo captions, and layout |
| `public/about/` | Personal photos |
| `public/projects/` | Project screenshots |
| `src/styles/global.css` | Ocean colors, typography, and shared motion styles |
| `astro.config.mjs` | Website URL and development-server configuration |

Projects with a `page` field receive a case study at `/projects/<slug>`. Projects with only a `link` open that destination directly. Use `repo` to include a GitHub link. Image paths are relative to `public/`; for example, `public/projects/example.webp` becomes `/projects/example.webp`.

The Blog landing page is a biography rather than a list of articles. An optional Markdown article route and content collection remain in the source; with no articles, Astro may report an empty collection warning during builds.

## Project structure

```text
public/
├── about/                   Personal photos
└── projects/                Project screenshots
src/
├── components/              Navigation, hover cards, and project galleries
├── data/                    Profile and project content
├── layouts/Base.astro       Shared document layout
├── pages/
│   ├── index.astro          Interactive ocean and introduction
│   ├── projects/            Project list and case-study routes
│   └── blog/                Biography and optional article route
├── scripts/
│   ├── ocean/
│   │   ├── world.ts         Jellyfish movement and particle simulation
│   │   ├── renderer.ts      Text-glyph rendering on Canvas
│   │   └── ocean.ts         Frame loop and pointer interactions
│   ├── motion.ts            Content reveals and reduced-motion handling
│   └── project-strip.ts     Desktop project browsing
└── styles/global.css       Shared visual styles
```

Elements marked `data-sea-avoid` steer jellyfish around the interface and dim the ocean behind it. Links, buttons, and elements marked `data-sea-ignore` do not trigger ocean click effects.

## Design and content credits

Layout and motion are inspired by [daoho.dev](https://www.daoho.dev), adapted to this website’s deep-ocean theme and custom jellyfish simulation.

Professional background is based on [Albert’s LinkedIn profile](https://www.linkedin.com/in/albert-leonardi/). The personal photographs were provided by Albert. Aether screenshots come from its [public repository](https://github.com/albertleooonardi/aether).
