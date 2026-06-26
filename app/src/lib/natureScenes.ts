/** Curated calming nature photography (Unsplash) for Comfort Mode slideshow. */
export interface NatureScene {
  id: string;
  label: string;
  url: string;
  /** Ken Burns drift direction */
  pan: 'left' | 'right' | 'up' | 'down';
}

const unsplash = (id: string, w = 1920) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const NATURE_SCENES: NatureScene[] = [
  { id: 'forest-lake', label: 'Forest Lake', url: unsplash('photo-1501785888041-af3ef285b470'), pan: 'right' },
  { id: 'ocean-sunset', label: 'Ocean Sunset', url: unsplash('photo-1507525428034-b723cf961d3e'), pan: 'left' },
  { id: 'alpine', label: 'Alpine Peaks', url: unsplash('photo-1464822759023-fed622ff2c3b'), pan: 'up' },
  { id: 'meadow', label: 'Wildflower Meadow', url: unsplash('photo-1501594907352-04cda38ebc27'), pan: 'right' },
  { id: 'waterfall', label: 'Misty Waterfall', url: unsplash('photo-1432405262542-0098737844e7'), pan: 'down' },
  { id: 'redwood', label: 'Redwood Grove', url: unsplash('photo-1441974231531-c6227db76b6e'), pan: 'left' },
  { id: 'northern', label: 'Northern Lights', url: unsplash('photo-1531366935697-9388b106cb42'), pan: 'up' },
  { id: 'bamboo', label: 'Bamboo Forest', url: unsplash('photo-1518495973542-9a396d0080f9'), pan: 'right' },
];

export const SCENE_CYCLE_MS = 14_000;

export function preloadNatureScenes(): void {
  for (const scene of NATURE_SCENES) {
    const img = new Image();
    img.src = scene.url;
  }
}
