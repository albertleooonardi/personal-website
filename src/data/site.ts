// Everything personal on the site lives here and in projects.ts / gallery.ts.

export interface Source {
  name: string;
  role: string;
  dates: string;
  summary: string;
  href: string;
  /** Optional square logo in /public. Without one, the card shows a monogram. */
  icon?: string;
  /** A source that stands for several others shows each one in its card. */
  group?: string[];
}

export const site = {
  name: 'Albert Leonardi',
  title: "Ciao! I'm Albert Leonardi.",
  role: 'Machine Learning Engineer',
  focus: 'I build AI automation, data pipelines, and production ML systems.',
  description: 'Albert Leonardi, machine learning engineer in Jakarta, Indonesia, building AI automation, data pipelines, and production ML systems.',
  url: 'https://example.com',
  quote: ['in the deep,', 'even the soft things shine'],
  /** Shown under the hero and in the mobile menu, e.g. { label: 'github', href: 'https://github.com/…' }. */
  socials: [
    { label: 'github', href: 'https://github.com/albertleooonardi' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/albert-leonardi/' },
  ] as { label: string; href: string }[],
  /** Linked from the gallery once it has works. */
  instagram: '',
};

// Hover cards for names in the hero. Wrap a name in <Cited source="key"> on
// the home page and add the key here to give it a card.
export const sources: Record<string, Source> = {
  // Background from Albert’s public LinkedIn profile, reviewed October 2026.
  cpi: {
    name: 'Charoen Pokphand Indonesia',
    role: 'Machine Learning Engineer',
    dates: 'May 2026–present',
    summary: 'Building AI automation, data infrastructure, and real-time web applications with FastAPI, n8n, Airflow, Kafka, and Next.js.',
    href: 'https://www.linkedin.com/in/albert-leonardi/',
  },
  bncc: {
    name: 'Bina Nusantara Computer Club',
    role: 'Back-End & Java Mentor',
    dates: '2024–2025',
    summary: 'Mentored students in back-end development and Java, covering Laravel, MySQL, object-oriented programming, and practical projects.',
    href: 'https://www.linkedin.com/in/albert-leonardi/',
  },
  binus: {
    name: 'BINUS University',
    role: 'Computer Science',
    dates: '2022–2026',
    summary: 'Bachelor’s degree in Computer Science.',
    href: 'https://www.linkedin.com/in/albert-leonardi/',
  },
  aether: {
    name: 'Aether',
    role: 'Weather, maps & AI',
    dates: '2026',
    summary: 'A weather app that checks rain along your route, with live radar and an AI assistant.',
    href: '/projects/aether',
  },
};
