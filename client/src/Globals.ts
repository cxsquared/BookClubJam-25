import { Assets } from "pixi.js";

export const APP_WIDTH = 800;
export const APP_HEIGHT = 600;

export const DECOR_KEYS = ["heart_01", "eye_01", "cac_01", "star_01", "paw_01"];

export function randomDecorKey(): string {
  const key = DECOR_KEYS[Math.floor(Math.random() * DECOR_KEYS.length)];
  if (key === undefined) return "test";
  return key;
}

export class AssetManager {
  public static Assets: any;
  public static async load() {
    await Assets.init({ manifest: "./manifest.json" });
    this.Assets = await Assets.loadBundle("default");
  }
}
