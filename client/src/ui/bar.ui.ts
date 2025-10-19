import { ProgressBar } from '@pixi/ui';
import { Graphics } from 'pixi.js';
import { designConfig } from '../game/designConfig';

export class ProgressBarUi extends ProgressBar {
    constructor() {
        const barArgs = {
            fillColor: 0x22ffff,
            borderColor: 0xffffff,
            backgroundColor: 0x000000,
            width: 450,
            height: 35,
            radius: 25,
            border: 3,
        };

        const bg = new Graphics()
            .roundRect(0, 0, barArgs.width, barArgs.height, barArgs.radius)
            .fill(barArgs.borderColor)
            .roundRect(
                barArgs.border,
                barArgs.border,
                barArgs.width - barArgs.border * 2,
                barArgs.height - barArgs.border * 2,
                barArgs.radius,
            )
            .fill(barArgs.backgroundColor);
        const fill = new Graphics()
            .roundRect(0, 0, barArgs.width, barArgs.height, barArgs.radius)
            .fill(barArgs.borderColor)
            .roundRect(
                barArgs.border,
                barArgs.border,
                barArgs.width - barArgs.border * 2,
                barArgs.height - barArgs.border * 2,
                barArgs.radius,
            )
            .fill(barArgs.fillColor);

        super({
            bg,
            fill,
            progress: 0,
        });

        this.x = designConfig.content.width - this.height - 25;
        this.y = 520;

        this.rotation = -Math.PI / 2;
    }
}
