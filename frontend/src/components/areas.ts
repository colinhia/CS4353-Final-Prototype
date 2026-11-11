import grassPatch from "../../assets/grass_patch.avif";

export type AreaConfig = {
  label: string;
  spots: Record<string, { x: number; y: number }>;
};

export const AREAS: Record<string, AreaConfig> = {
  clementi: {
    label: "Clementi",
    spots: {
      "clementi mall": { x: 42, y: 38 },
      "clementi mrt": { x: 55, y: 52 },
      "block 432": { x: 25, y: 66 },
      "ngee ann poly": { x: 72, y: 30 },
    },
  },
};

export function hashPosition(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { x: 15 + (h % 70), y: 15 + ((h >> 8) % 70) };
}