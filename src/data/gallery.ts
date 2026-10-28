// Works on /gallery. Each work is placed on a 12-column grid by `col`
// (a grid-column value) and pushed down by `drop`, which staggers the wall.
//
// While the list is empty the page says "coming soon." Give each work a
// `src: '/gallery/<file>'` (in /public); without one, a generated
// illustration in the earlier night-garden style stands in.

import type { Variant } from '../lib/art';

export interface Work {
  title: string;
  year: string;
  medium?: string;
  alt: string;
  /** Width / height. Used for generated art and to reserve space. */
  ratio: number;
  art: number;
  /** Scene for the generated art. */
  variant: Variant;
  src?: string;
  col: string;
  drop: string;
}

export const works: Work[] = [];
