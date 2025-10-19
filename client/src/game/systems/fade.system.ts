import { queryRequired, System } from '@typeonce/ecs';
import { FadeComponent } from '../components/fade.component';
import { TweenComponent } from '../components/tween.component';
import { GameEventMap, FadeEvent } from '../events';
import { SystemTags } from './systems-tags';

const fadeQuery = queryRequired({
    fade: FadeComponent,
    tween: TweenComponent,
});

export class FadeSystem extends System<SystemTags, GameEventMap>()<{}>('FadeSystem', {
    dependencies: ['OpenDoorSystem', 'KeyInput', 'TweenSystem'],
    execute: ({ world, poll }) => {
        const { tween } = fadeQuery(world)[0];

        poll(FadeEvent).forEach(({ data }) => {
            if (data.isFadeOut) {
                tween.tween.stop();
                tween.tween.to(
                    {
                        alpha: 1,
                    },
                    1000,
                );
            } else {
                tween.tween.stop();
                tween.tween.to(
                    {
                        alpha: 0,
                    },
                    250,
                );
            }

            tween.tween.startFromCurrentValues();
        });
    },
}) {}
