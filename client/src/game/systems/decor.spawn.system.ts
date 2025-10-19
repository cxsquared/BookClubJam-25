import { profanity } from '@2toad/profanity';
import { Input } from '@pixi/ui';
import { System, EntityId, queryRequired } from '@typeonce/ecs';
import { Container, Sprite, Rectangle } from 'pixi.js';
import { isTextDecor } from '../../Globals';
import { DbConnection } from '../../module_bindings';
import { DecorComponent } from '../components/decor.component';
import { GrabbedComponent } from '../components/grabbed.component';
import { MouseEvents } from '../components/mouse-events.component';
import { PositionLimit } from '../components/position-limit.component';
import { Position } from '../components/position.component';
import { SpriteComponent } from '../components/sprite.component';
import { GameEventMap, DecorAdded } from '../events';
import { MouseListener } from '../mouse.listener';
import { SystemTags } from './systems-tags';
import { Cursor } from '../components/cursor.component';
import { DoorComponent } from '../components/door.component';
import { AppScreen } from '../../navigation';

const doorQuery = queryRequired({
    door: DoorComponent,
    position: Position,
    sprite: SpriteComponent,
});

const cursorQuery = queryRequired({
    cursor: Cursor,
    position: Position,
});

export class DecorSpawnSystem extends System<SystemTags, GameEventMap>()<{
    readonly screen: AppScreen;
    readonly conn: DbConnection;
}>('DecorSpawn', {
    dependencies: ['SpacetimeDBEventSystem'],
    execute: ({ world, poll, createEntity, addComponent, getComponent, input: { screen, conn } }) => {
        const { position: doorPosition, sprite: doorSprite } = doorQuery(world)[0];

        poll(DecorAdded).forEach((event) => {
            const decor = event.data.decor;
            let spriteContainer = new Container();
            spriteContainer.label = `decor:${decor.id}:${decor.key}`;
            spriteContainer.interactiveChildren = true;
            spriteContainer.eventMode = 'static';

            const id = createEntity();
            let grabOffsetY = 0;
            let deleteOffsetX = 6;
            let delteOffsetY = 6;

            screen.addChild(spriteContainer);

            let listener;
            const isText = isTextDecor(event.data.decor.key);

            if (isText) {
                const bg = Sprite.from(event.data.decor.key);
                const input = new Input({
                    bg,
                    padding: [0, 0, 0, 0],
                    textStyle: {
                        align: 'center',
                        fontFamily: '"Comic Sans MS", cursive, sans-serif',
                        fontSize: 12,
                        fontVariant: 'small-caps',
                        lineHeight: 12,
                        wordWrap: true,
                        wordWrapWidth: bg.width - 8,
                        breakWords: true,
                    },
                    maxLength: 58,
                    value: event.data.decor.text,
                    align: 'center',
                    addMask: true,
                });
                input.interactive = conn.identity && decor.owner.isEqual(conn.identity);
                input.onChange.connect(() => {
                    globalThis.editingText = true;
                });
                input.onEnter.connect((newText) => {
                    input.value = profanity.censor(newText);
                    globalThis.editingText = false;
                    conn.reducers.updateDecorText(decor.id, input.value);
                });

                const hanger = Sprite.from('hanger_01');
                hanger.label = 'hanger';
                hanger.eventMode = 'dynamic';
                hanger.cursor = 'grab';
                listener = new MouseListener(hanger, id);

                input.y += hanger.height;

                hanger.on('pointerenter', () => {
                    const grabbed = getComponent({ grabbed: GrabbedComponent })(id);

                    if (deleteSprite && !grabbed?.grabbed) {
                        deleteSprite.visible = true;
                    }
                });

                spriteContainer.addChild(hanger);
                spriteContainer.addChild(input);

                spriteContainer.width = bg.width;
                spriteContainer.height = bg.height + hanger.height;
                spriteContainer.scale = 1;

                deleteOffsetX = hanger.width / 2 - 22;
                grabOffsetY = -input.height / 2 - hanger.height / 2;
            } else {
                const sprite = Sprite.from(event.data.decor.key);
                sprite.cursor = 'grab';
                sprite.anchor.set(0, 0);
                sprite.eventMode = 'dynamic';

                listener = new MouseListener(sprite, id);
                spriteContainer.addChild(sprite);

                sprite.on('pointerenter', () => {
                    const grabbed = getComponent({ grabbed: GrabbedComponent })(id);

                    if (deleteSprite && !grabbed?.grabbed) {
                        deleteSprite.visible = true;
                    }
                });

                spriteContainer.width = sprite.width;
                spriteContainer.height = sprite.height;
            }

            let deleteSprite: Sprite | undefined;
            if (!isText || conn.identity?.isEqual(event.data.decor.owner)) {
                deleteSprite = Sprite.from('delete');
                deleteSprite.visible = false;
                deleteSprite.x = spriteContainer.width - deleteOffsetX;
                deleteSprite.y = -delteOffsetY;
                deleteSprite.hitArea = new Rectangle(0, 0, deleteSprite.width, deleteSprite.height);
                deleteSprite.eventMode = 'dynamic';
                deleteSprite.on('pointerdown', (e) => {
                    conn.reducers.deleteDecor(decor.id);
                    e.stopPropagation();
                });

                spriteContainer.addChild(deleteSprite);
            }

            spriteContainer.x = decor.x - spriteContainer.width / 2;
            spriteContainer.y = decor.y - spriteContainer.height / 2;

            spriteContainer.eventMode = 'static';
            spriteContainer.interactiveChildren = true;
            if (deleteSprite) {
                spriteContainer.on('pointerleave', (_e) => {
                    deleteSprite.visible = false;
                });
            }

            const position = new Position({
                x: spriteContainer.x,
                y: spriteContainer.y,
                xOffset: 0,
                yOffset: 0,
                skew: 0,
            });

            const cursor = cursorQuery(world)[0];
            const onClick = (id: EntityId, sprite: Sprite, x: number, _y: number) => {
                sprite.cursor = 'grabbing';
                cursor.cursor.grabbedEvents.push({
                    id,
                    component: new GrabbedComponent({
                        xOffset: position.x - x,
                        yOffset: grabOffsetY,
                        sprite,
                    }),
                });

                if (deleteSprite) deleteSprite.visible = false;
            };

            const decorComp = new DecorComponent({
                decor,
                inputListener: listener,
                originalPosition: new Position({
                    x: decor.x,
                    y: decor.y,
                    xOffset: 0,
                    yOffset: 0,
                    skew: 0,
                }),
                deleteSprite,
            });
            addComponent(
                id,
                position,
                new SpriteComponent({ sprite: spriteContainer }),
                decorComp,
                new PositionLimit({
                    x: doorPosition.x,
                    y: doorPosition.y,
                    width: doorSprite.sprite.width,
                    height: doorSprite.sprite.height,
                }),
                new MouseEvents({
                    listener,
                    onClick,
                }),
            );
        });
    },
}) {}
