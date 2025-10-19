import { System } from '@typeonce/ecs';
import { GameEventMap } from '../events';
import { SystemTags } from './systems-tags';
import { query } from '@typeonce/ecs';
import { MouseEvents } from '../components/mouse-events.component';

const mouseListenerQuery = query({
    mouseEvents: MouseEvents,
});

export class MouseInput extends System<SystemTags, GameEventMap>()('MouseInput', {
    execute: ({ world }) => {
        mouseListenerQuery(world).forEach((e) => {
            if (e.mouseEvents.listener.isMouseJustDown) {
                e.mouseEvents.onClick(
                    e.mouseEvents.listener.id,
                    e.mouseEvents.listener.sprite,
                    e.mouseEvents.listener.mouseX,
                    e.mouseEvents.listener.mouseY,
                );
            }

            e.mouseEvents.listener.tick();
        });
    },
}) {}
