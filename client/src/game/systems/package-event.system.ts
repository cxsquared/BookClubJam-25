import { query, queryRequired, System } from '@typeonce/ecs';
import { Sprite } from 'pixi.js';
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
    conn: DbConnection;
}>('PackageEventSystem', {
    dependencies: ['SpacetimeDBEventSystem'],
    execute: ({ world, poll, createEntity, addComponent, getComponent, destroyEntity, input: { screen, conn } }) => {
        const existingPackages = packageQuery(world);
        const { inventory } = inventoryQuery(world)[0];

        poll(PackageDeleted).forEach(({ data }) => {
            const packageToDelete = existingPackages.find((ep) => ep.package.package.id === data.package.id);

            if (packageToDelete) {
                inventory.latestPackageXY = { x: packageToDelete.position.x, y: packageToDelete.position.y };
                destroyEntity(packageToDelete.entityId);

                packageToDelete.sprite.sprite.destroy();
            }
        });

        poll(PackageAdded).forEach(({ data }) => {
            const entityId = createEntity();

            const sprite = Sprite.from('package');
            sprite.label = `package:${data.package.id}`;
            sprite.interactive = true;

            const x =
                designConfig.content.width / 2 + Math.random() * (designConfig.content.width / 2) - sprite.width - 5;
            const y = designConfig.content.height - sprite.height + 5;

            sprite.x = x;
            sprite.y = y;

            sprite.zIndex = 50;
            screen.addChild(sprite);

            const listener = new MouseListener(sprite, entityId);

            addComponent(
                entityId,
                new PackageComponent({
                    package: data.package,
                }),
                new Position({
                    x: x,
                    y: y,
                    xOffset: 0,
                    yOffset: 0,
                    skew: 0,
                }),
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
            );
        });
    },
}) {}
