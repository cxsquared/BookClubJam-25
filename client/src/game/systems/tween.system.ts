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
            tween.tween.update();

            if (tween.justCompleted) {
                if (tween.onComplete) tween.onComplete(exe);

                tween.justCompleted = false;
            }
        });
    },
}) {}
