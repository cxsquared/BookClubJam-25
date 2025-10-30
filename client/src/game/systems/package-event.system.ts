import { query, queryRequired, System } from '@typeonce/ecs';
import { DbConnection } from '../../module_bindings';
import { MouseEvents } from '../components/mouse-events.component';
import { PackageComponent } from '../components/package.component';
import { Position } from '../components/position.component';
import { SpriteComponent } from '../components/sprite.component';
import { GameEventMap, PackageDeleted, PackageAdded } from '../events';
import { MouseListener } from '../mouse.listener';
import { SystemTags } from './systems-tags';
import { designConfig } from '../designConfig';
import { AppScreen } from '../../navigation';
import { InventoryComponent } from '../components/inventory.component';
import { AsepriteAsset } from '../../utils/asesprite.loader';
import { Tween } from '@tweenjs/tween.js';
import { TweenComponent } from '../components/tween.component';

const packageQuery = query({
    package: PackageComponent,
    sprite: SpriteComponent,
    position: Position,
});

const inventoryQuery = queryRequired({
    inventory: InventoryComponent,
});

export class PackageEventSystem extends System<SystemTags, GameEventMap>()<{
    screen: AppScreen;
    packageAsset: AsepriteAsset;
    conn: DbConnection;
}>('PackageEventSystem', {
    dependencies: ['SpacetimeDBEventSystem', 'OpenDoorSystem'],
    execute: ({
        world,
        poll,
        createEntity,
        addComponent,
        removeComponent,
        getComponent,
        destroyEntity,
        input: { screen, conn, packageAsset },
    }) => {
        const existingPackages = packageQuery(world);
        const { inventory } = inventoryQuery(world)[0];

        poll(PackageDeleted).forEach(({ data }) => {
            const packageToDelete = existingPackages.find((ep) => ep.package.package.id === data.package.id);

            if (packageToDelete) {
                inventory.latestPackageXY = { x: packageToDelete.position.x, y: packageToDelete.position.y };
                packageToDelete.sprite.sprite.destroy();

                removeComponent(packageToDelete.entityId, MouseEvents);

                const openSprite = packageAsset.createAnimatedSprite('open');
                openSprite.play();
                openSprite.onComplete = () => {
                    openSprite.destroy();
                    destroyEntity(packageToDelete.entityId);
                };
                openSprite.x = packageToDelete.position.x;
                openSprite.y = packageToDelete.position.y;
                screen.addChild(openSprite);

                packageToDelete.sprite.sprite = openSprite;
            }
        });

        poll(PackageAdded).forEach(async ({ data }) => {
            const entityId = createEntity();

            const sprite = packageAsset.createAnimatedSprite('idle');
            sprite.play();

            sprite.label = `package:${data.package.id}`;
            sprite.interactive = true;

            const startY = -32;

            const x =
                designConfig.content.width / 2 + Math.random() * (designConfig.content.width / 2) - sprite.width - 5;
            const y = designConfig.content.height - sprite.height + 5;

            sprite.x = x;
            sprite.y = startY;

            sprite.zIndex = 50;
            screen.addChild(sprite);

            const position = new Position({
                x: x,
                y: startY,
                xOffset: 0,
                yOffset: 0,
                skew: 0,
            });

            const listener = new MouseListener(sprite, entityId);

            const tween = new Tween({ y: startY })
                .to({ y: y }, 300)
                .start()
                .onUpdate(({ y }) => {
                    position.y = y;
                });

            addComponent(
                entityId,
                new PackageComponent({
                    package: data.package,
                }),
                position,
                new SpriteComponent({
                    sprite: sprite,
                }),
                new MouseEvents({
                    listener: listener,
                    onClick: (id, _sprite, _x, _y) => {
                        const packageItem = getComponent({
                            package: PackageComponent,
                        })(id);

                        if (packageItem) {
                            conn.reducers.openPackage(packageItem.package.package.id);
                        }
                    },
                }),
                new TweenComponent({
                    tween: tween,
                    onComplete: undefined,
                    running: true,
                }),
            );
        });
    },
}) {}
