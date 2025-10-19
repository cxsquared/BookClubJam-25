import { query, System } from '@typeonce/ecs';
import { GameEventMap } from '../events';
import { SystemTags } from './systems-tags';
import { PositionLimit } from '../components/position-limit.component';
import { Position } from '../components/position.component';
import { SpriteComponent } from '../components/sprite.component';

const positionLimitQuery = query({
    limit: PositionLimit,
    position: Position,
    sprite: SpriteComponent,
});

export class PositionLimiter extends System<SystemTags, GameEventMap>()<{}>('PositionLimit', {
    execute: ({ world }) => {
        positionLimitQuery(world).forEach(({ sprite, position, limit }) => {
            const width = sprite.sprite.width;
            const height = sprite.sprite.height;

            if (position.x < limit.x) position.x = limit.x;

            if (position.x > limit.x + limit.width - width) position.x = limit.x + limit.width - width;

            if (position.y < limit.y) position.y = limit.y;

            if (position.y > limit.y + limit.height - height) position.y = limit.y + limit.height - height;
        });
    },
}) {}
