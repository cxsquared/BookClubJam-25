import { EntityId } from '@typeonce/ecs';
import { Sprite } from 'pixi.js';

export class MouseListener {
    public isMouseJustDown: boolean = false;
    public isMouseDown: boolean = false;
    public isMouseUp: boolean = false;
    public isMouseJustUp: boolean = false;
    public justEntered: boolean = false;
    public mouseX: number = 0;
    public mouseY: number = 0;
    public sprite: Sprite;
    public id: EntityId;

    constructor(sprite: Sprite, id: EntityId) {
        this.sprite = sprite;
        this.id = id;
        const downEvent = 'pointerdown';
        sprite.on(downEvent, (e) => {
            this.isMouseUp = false;
            this.isMouseJustUp = false;
            this.isMouseDown = true;
            this.isMouseJustDown = true;
            this.mouseX = e.screenX;
            this.mouseY = e.screenY;
        });

        const upEvent = 'pointerup';
        sprite.on(upEvent, (e) => {
            this.isMouseDown = false;
            this.isMouseJustDown = false;
            this.isMouseUp = true;
            this.mouseX = e.screenX;
            this.mouseY = e.screenY;
        });

        sprite.on('globalpointermove', (e) => {
            this.mouseX = e.screenX;
            this.mouseY = e.screenY;
        });
    }

    public tick() {
        this.isMouseJustUp = false;
        this.isMouseJustDown = false;
    }
}
