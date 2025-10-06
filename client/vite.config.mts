// vite.config.mts
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";
import { AssetPack, type AssetPackConfig } from "@assetpack/core";
import { pixiPipes } from "@assetpack/core/pixi";
import { texturePacker } from "@assetpack/core/texture-packer";

function assetpackPlugin(): Plugin {
  const apConfig: AssetPackConfig = {
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
        texturePacker: {
          texturePacker: {
            padding: 2,
            nameStyle: "short",
            removeFileExtension: false,
          },
          resolutionOptions: {
            template: "@%%x",
            resolutions: { default: 1, low: 0.5 },
            fixedResolution: "default",
            maximumTextureSize: 4096,
          },
        },
        audio: {},
        manifest: { createShortcuts: true, trimExtensions: true },
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
  let mode: ResolvedConfig["command"];
  let ap: AssetPack | undefined;

  return {
    name: "vite-plugin-assetpack",
    configResolved(resolvedConfig) {
      mode = resolvedConfig.command;
      if (!resolvedConfig.publicDir) return;
      if (apConfig.output) return;
      const publicDir = resolvedConfig.publicDir.replace(process.cwd(), "");
      apConfig.output = `.${publicDir}/assets/`;
    },
    buildStart: async () => {
      if (mode === "serve") {
        if (ap) return;
        ap = new AssetPack(apConfig);
        void ap.watch();
      } else {
        await new AssetPack(apConfig).run();
      }
    },
    buildEnd: async () => {
      if (ap) {
        await ap.stop();
        ap = undefined;
      }
    },
  };
}

export default defineConfig({
  plugins: [assetpackPlugin()],
});
