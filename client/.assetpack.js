import { pixiPipes } from "@assetpack/core/pixi";

export default {
  entry: "./assets",
  output: "./public",
  ignore: ["**/*.html"],
  cache: true,
  cacheLocation: ".assetpack",
  logLevel: "info",
  pipes: [
    ...pixiPipes({
      cacheBust: true,
      resolutions: { default: 1, low: 0.5 },
      compression: { jpg: true, png: true, webp: true },
      texturePacker: { nameStyle: "short" },
      audio: {},
      manifest: { createShortcuts: true },
    }),
  ],
  assetSettings: [
    {
      files: ["**/*.png"],
      settings: {
        compress: {
          jpg: true,
          png: true,
          // all png files will be compressed to avif format but not webp
          webp: false,
          avif: true,
        },
      },
    },
  ],
};
