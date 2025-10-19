import { query, System } from '@typeonce/ecs';
import { GameEventMap } from '../events';
import { SystemTags } from './systems-tags';
import { Position } from '../components/position.component';
import { SpriteComponent } from '../components/sprite.component';

let once = false;

const pixiRender = query({
    position: Position,
    sprite: SpriteComponent,
});

export class RenderSystem extends System<SystemTags, GameEventMap>()<{}>('Render', {
    execute: ({ world }) => {
        if (!once) {
            pixiRender(world).forEach(({ sprite, position }) => {
                sprite.sprite.x = position.x + position.xOffset;
                sprite.sprite.y = position.y + position.yOffset;
                sprite.sprite.skew.y = position.skew;
            });
        }
    },
}) {}
