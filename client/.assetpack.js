import { json } from '@assetpack/core/json';
import { pixiPipes } from '@assetpack/core/pixi';

export default {
    entry: './raw-assets',
    output: './public/assets/',
    cache: true,
    pipes: [
        ...pixiPipes({
            cacheBust: true,
            texturePacker: {
                texturePacker: {
                    removeFileExtension: true,
                },
            },
            manifest: {
                output: './src/manifest.json',
            },
        }),
        json(),
    ],
};
