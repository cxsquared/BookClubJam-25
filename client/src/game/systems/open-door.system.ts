import { Tween, Easing } from '@tweenjs/tween.js';
import { query, queryRequired, System } from '@typeonce/ecs';
import { getDialogue } from '../../Globals';
import { DbConnection } from '../../module_bindings';
import { BackgroundComponent } from '../components/background.component';
import { Position } from '../components/position.component';
import { SpriteComponent } from '../components/sprite.component';
import { FadeEvent, GameEventMap, OpenDoorEvent, ShowText } from '../events';
import { SystemTags } from './systems-tags';
import { PositionTween } from '../../main';
import { OpenDoorController } from '../components/open-door-controller.component';
import { TweenComponent } from '../components/tween.component';
import { DecorComponent } from '../components/decor.component';
import { DoorComponent } from '../components/door.component';
import { tw } from '@pixi/layout/tailwind';

const openYOffset = -350;
const openXOffset = 400;
const openYSkew = -1.4;

const openDoorQuery = queryRequired({
    openController: OpenDoorController,
    tween: TweenComponent<PositionTween>,
});

const backgroundQuery = queryRequired({
    background: BackgroundComponent,
    sprite: SpriteComponent,
    position: Position,
});

const doorQuery = queryRequired({
    door: DoorComponent,
    position: Position,
    sprite: SpriteComponent,
});

const decorQuery = query({
    decor: DecorComponent,
    position: Position,
    sprite: SpriteComponent,
});

export class OpenDoorSystem extends System<SystemTags, GameEventMap>()<{
    conn: DbConnection;
}>('OpenDoorSystem', {
    dependencies: ['TweenSystem'],
    execute: ({ world, emit, poll, input: { conn } }) => {
        poll(OpenDoorEvent).forEach(() => {
            const { openController, tween } = openDoorQuery(world)[0];
            const door = doorQuery(world)[0];
            const decorItems = decorQuery(world);
            const background = backgroundQuery(world)[0];

            openController.isRunning = true;

            tween.tween.onUpdate((values) => {
                door.position.yOffset = values.yOffset;
                door.position.xOffset = values.xOffset;
                door.position.skew = values.skew;
                door.sprite.sprite.scale = values.bgScale;
                background.sprite.sprite.scale = values.bgScale;
                decorItems.forEach((decor) => {
                    decor.position.yOffset = values.yOffset * 0.25;
                    decor.position.xOffset = values.xOffset;
                    decor.position.skew = values.skew;
                    decor.sprite.sprite.scale = values.bgScale;
                });
            });

            tween.onComplete = ({ emit, destroyEntity }) => {
                tween.tween = new Tween({
                    xOffset: 0,
                    yOffset: 0,
                    skew: 0,
                    bgScale: 1,
                });
                tween.running = false;
                tween.tween.easing(Easing.Exponential.InOut);
                openController.isRunning = false;
                door.sprite.sprite.scale = 1;
                door.position.skew = 0;
                door.position.yOffset = 0;
                door.position.xOffset = 0;
                conn.reducers.enterDoor();

                emit({
                    type: FadeEvent,
                    data: {
                        isFadeOut: false,
                    },
                });

                emit({
                    type: ShowText,
                    data: {
                        texts: getDialogue(globalThis.currentDoorNumber),
                    },
                });

                background.sprite.sprite.scale = 1;

                for (const decor of decorQuery(world)) {
                    decor.sprite.sprite.destroy();
                    destroyEntity(decor.entityId);
                }
            };

            tween.tween
                .to(
                    {
                        yOffset: openYOffset,
                        xOffset: openXOffset,
                        skew: openYSkew,
                        bgScale: 5,
                    },
                    1000,
                )
                .start();

            tween.running = true;

            emit({
                type: FadeEvent,
                data: {
                    isFadeOut: true,
                },
            });
        });
    },
}) {}
