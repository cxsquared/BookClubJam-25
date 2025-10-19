import { query, System } from '@typeonce/ecs';
import { TweenComponent } from '../components/tween.component';
import { GameEventMap } from '../events';
import { SystemTags } from './systems-tags';

const tweenQuery = query({
    tween: TweenComponent,
});

export class TweenSystem extends System<SystemTags, GameEventMap>()<{}>('TweenSystem', {
    execute: (exe) => {
        const { world } = exe;
        tweenQuery(world).forEach(({ tween }) => {
            if (tween.running && !tween.tween.update()) {
                tween.running = false;

                if (tween.onComplete) tween.onComplete(exe);
            }
        });
    },
}) {}
