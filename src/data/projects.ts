// Projects shown on /projects. While the list is empty the page says
// "coming soon." Entries with a `page` get their own case-study page at
// /projects/<slug>; entries with only a `link` open that link instead.
//
// Give each image slot a picture in /public (`thumb`, `cover`, `poster`, a
// shot's `src`). Slots left empty fall back to a generated illustration
// (src/lib/art.ts), which is still in the earlier night-garden style.

import type { Variant } from '../lib/art';

export type Part = string | { text: string; href: string };

export interface Shot {
  title: string;
  caption: string;
  alt: string;
  src?: string;
  art?: number;
  /** Scene for the generated art: meadow, bloom, fence or canopy. */
  variant?: Variant;
}

export type StoryBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; parts: Part[] }
  | { kind: 'gallery'; title: string; shots: Shot[]; start?: number }
  | { kind: 'clip'; src: string; poster?: string; label: string }
  | { kind: 'image'; alt: string; src?: string; art?: number };

export interface Project {
  slug: string;
  name: string;
  description: string;
  year: string;
  tech: string[];
  art: number;
  link?: string;
  repo?: string;
  thumb?: string;
  page?: {
    tagline: string;
    about: Part[];
    cover?: string;
    poster?: string;
    video?: string;
    story?: StoryBlock[];
  };
}

export const projects: Project[] = [
  {
    slug: 'aether',
    name: 'Aether',
    description: 'A weather app with rain-aware driving routes, live radar, and an AI assistant.',
    year: '2026',
    tech: ['React', 'Tailwind CSS', 'Node.js', 'Leaflet', 'WeatherAPI', 'Vercel'],
    art: 1,
    link: 'https://aether-wx.vercel.app',
    repo: 'https://github.com/albertleooonardi/aether',
    thumb: '/projects/aether-dashboard.webp',
    page: {
      tagline: 'Know if you’ll get wet on the way there.',
      about: [
        'Aether brings forecasts, maps, and an AI assistant into one place. It helps you plan a journey around the weather by comparing driving routes and checking the forecast for when you’ll reach each stretch of road.',
      ],
      cover: '/projects/aether-dashboard.webp',
      poster: '/projects/aether-hero.webp',
      story: [
        { kind: 'heading', text: 'The weather at a glance' },
        {
          kind: 'text',
          parts: [
            'Current conditions sit alongside a 12-hour forecast, a three-day outlook, UV, air quality, and wind. Search for a place, explore nearby cities, or switch to the radar map. The interface adapts to the weather and time of day, with layouts for phones and desktops.',
          ],
        },
        {
          kind: 'gallery',
          title: 'Inside Aether',
          shots: [
            {
              title: 'The forecast',
              caption: 'Current conditions and an hourly outlook, with rain, wind, and humidity at a glance.',
              src: '/projects/aether-dashboard.webp',
              alt: 'Aether’s dark weather dashboard showing current conditions, rain chance, humidity, wind, and an hourly forecast.',
            },
            {
              title: 'The journey',
              caption: 'A recommended driving route with a rain-chance breakdown along the road.',
              src: '/projects/aether-map-route.webp',
              alt: 'Aether’s directions view showing a recommended driving route and rain chances on the map.',
            },
          ],
        },
        { kind: 'heading', text: 'A forecast for the journey' },
        {
          kind: 'text',
          parts: [
            'Aether compares up to three driving routes, samples the weather along each one at the estimated arrival times, and recommends the driest option. Colored road segments show where rain is expected, with percentages and an explicit no-data state when a forecast is unavailable.',
          ],
        },
        { kind: 'heading', text: 'Ask AetherAI' },
        {
          kind: 'text',
          parts: [
            'Ask about the weather in another city, request a rain-checked route, or adjust your departure time in a follow-up. The assistant can show a route map inside its reply and asks you to choose when a place name is ambiguous.',
          ],
        },
        { kind: 'heading', text: 'Built to keep working' },
        {
          kind: 'text',
          parts: [
            'The React interface uses Tailwind CSS and Leaflet, with WeatherAPI forecasts and OSRM routing. A shared Node.js backend runs locally and as Vercel serverless functions. AI requests can fall back from Gemini to Groq, then to a local assistant when neither provider is available.',
          ],
        },
      ],
    },
  },
];

export const projectHref = (p: Project) => (p.page ? `/projects/${p.slug}` : p.link);
export const isExternal = (href: string) => /^https?:/.test(href);
