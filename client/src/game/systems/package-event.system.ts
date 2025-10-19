import { query, System } from '@typeonce/ecs';
import { Container, Sprite } from 'pixi.js';
import { DbConnection } from '../../module_bindings';
import { MouseEvents } from '../components/mouse-events.component';
import { PackageComponent } from '../components/package.component';
import { Position } from '../components/position.component';
import { SpriteComponent } from '../components/sprite.component';
import { GameEventMap, PackageDeleted, PackageAdded } from '../events';
import { MouseListener } from '../mouse.listener';
import { SystemTags } from './systems-tags';
import { designConfig } from '../designConfig';

const packageQuery = query({
    package: PackageComponent,
    sprite: SpriteComponent,
});

export class PackageEventSystem extends System<SystemTags, GameEventMap>()<{
    container: Container;
    conn: DbConnection;
}>('PackageEventSystem', {
    dependencies: ['SpacetimeDBEventSystem'],
    execute: ({ world, poll, createEntity, addComponent, getComponent, destroyEntity, input: { container, conn } }) => {
        const existingPackages = packageQuery(world);

        poll(PackageDeleted).forEach(({ data }) => {
            const packageToDelete = existingPackages.find((ep) => ep.package.package.id === data.package.id);

            if (packageToDelete) {
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
            container.addChild(sprite);

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
