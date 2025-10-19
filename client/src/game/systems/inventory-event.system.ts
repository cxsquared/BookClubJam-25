import { queryRequired, System } from '@typeonce/ecs';
import { InventoryComponent } from '../components/inventory.component';
import { GameEventMap, InventoryAdded, InventoryDeleted, PackageDeleted } from '../events';
import { SystemTags } from './systems-tags';
import { designConfig } from '../designConfig';
import { Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { Position } from '../components/position.component';
import { SpriteComponent } from '../components/sprite.component';
import { TweenComponent } from '../components/tween.component';
import { AppScreen } from '../../navigation';

const inventoryQuery = queryRequired({
    inventory: InventoryComponent,
});

let first = true;

export class InventoryEventSystem extends System<SystemTags, GameEventMap>()<{
    screen: AppScreen;
}>('InventoryEventSystem', {
    dependencies: ['SpacetimeDBEventSystem', 'PackageEventSystem'],
    execute: ({ world, poll, addComponent, createEntity, input: { screen } }) => {
        const { inventory } = inventoryQuery(world)[0];

        const x = inventory.latestPackageXY?.x ?? designConfig.content.width / 2;
        const y = inventory.latestPackageXY?.y ?? designConfig.content.height;

        let addedInventory = false;
        poll(InventoryAdded).forEach(({ data }) => {
            addedInventory = true;
            inventory.inventory.push(data.inventory);
            inventory.ui.update(inventory);

            if (first) {
                return;
            }

            const s = Sprite.from(data.inventory.decorKey);
            s.x = x + s.width / 2;
            s.y = y + s.height / 2;
            screen.addChild(s);

            const targetXY = inventory.ui.getItemPosition(data.inventory.decorKey);
            const position = new Position({ x, y, xOffset: 0, yOffset: 0, skew: 0 });

            targetXY.x += 40;
            targetXY.y += 45;

            const tween = new Tween({ x, y })
                .to(targetXY, 400)
                .onUpdate(({ x, y }) => {
                    position.x = x;
                    position.y = y;
                })
                .easing(Easing.Exponential.Out)
                .start();

            const id = createEntity();

            addComponent(
                id,
                position,
                new SpriteComponent({ sprite: s }),
                new TweenComponent({
                    tween,
                    running: true,
                    onComplete: ({ getComponent, destroyEntity }) => {
                        const sprite = getComponent({
                            sprite: SpriteComponent,
                        })(id);

                        destroyEntity(id);
                        sprite?.sprite.sprite.destroy();
                    },
                }),
            );
        });

        poll(InventoryDeleted).forEach(({ data }) => {
            const index = inventory.inventory.findIndex((it) => it.id === data.inventory.id);
            if (index >= 0) {
                inventory.inventory.splice(index, 1);
                inventory.ui.update(inventory);
            }
        });

        if (addedInventory && first) {
            first = false;
        }
    },
}) {}
