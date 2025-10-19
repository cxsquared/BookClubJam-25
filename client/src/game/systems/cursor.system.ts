import { query, queryRequired, System } from '@typeonce/ecs';
import { DbConnection } from '../../module_bindings';
import { GrabbedComponent } from '../components/grabbed.component';
import { GameEventMap } from '../events';
import { SystemTags } from './systems-tags';
import { Cursor } from '../components/cursor.component';
import { Position } from '../components/position.component';
import { DecorComponent } from '../components/decor.component';
import { SpriteComponent } from '../components/sprite.component';

const cursorQuery = queryRequired({
    cursor: Cursor,
    position: Position,
});

const grabbedQuery = query({
    grabbed: GrabbedComponent,
    sprite: SpriteComponent,
    position: Position,
    decor: DecorComponent,
});

export class CursorSystem extends System<SystemTags, GameEventMap>()<{
    conn: DbConnection;
}>('CursorSystem', {
    execute: ({ world, addComponent, removeComponent, input: { conn } }) => {
        const cursorEntity = cursorQuery(world)[0];

        cursorEntity.position.x = cursorEntity.cursor.listener.mouseX;
        cursorEntity.position.y = cursorEntity.cursor.listener.mouseY;

        cursorEntity.cursor.grabbedEvents.forEach(({ id, component }) => {
            addComponent(id, component);
        });
        cursorEntity.cursor.grabbedEvents = [];

        grabbedQuery(world).forEach(({ entityId, grabbed, sprite, position, decor }) => {
            position.x = cursorEntity.cursor.listener.mouseX - sprite.sprite.width / 2;
            position.y = cursorEntity.cursor.listener.mouseY - sprite.sprite.height / 2 - grabbed.yOffset;

            if (decor.inputListener.isMouseJustUp || decor.inputListener.isMouseUp) {
                grabbed.sprite.cursor = 'grab';
                removeComponent(entityId, GrabbedComponent);
                conn.reducers.moveDecor(
                    decor.decor.id,
                    cursorEntity.cursor.listener.mouseX,
                    cursorEntity.cursor.listener.mouseY,
                    0,
                );
            }
        });
    },
}) {}
