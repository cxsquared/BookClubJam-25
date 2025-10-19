import { CircularProgressBar } from '@pixi/ui';

export class LoadingSpinner extends CircularProgressBar {
    isFilling = true;
    value = 50;

    constructor() {
        super({
            backgroundColor: '0x3e3f40',
            fillColor: '0x3effff',
            radius: 50,
            lineWidth: 15,
            value: 50,
            backgroundAlpha: 0.5,
            fillAlpha: 0.8,
            cap: 'round',
        });

        this.x += this.width / 2;
        this.y += -this.height / 2;
    }

    update() {
        this.isFilling ? this.value++ : this.value--;
        if (this.value >= 100) {
            this.isFilling = false;
        } else if (this.value <= 0) {
            this.isFilling = true;
        }
        this.progress = this.value;
        this.rotation += 0.1;
    }
}
