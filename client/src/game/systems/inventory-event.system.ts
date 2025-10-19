import { queryRequired, System } from '@typeonce/ecs';
import { InventoryComponent } from '../components/inventory.component';
import { GameEventMap, InventoryAdded, InventoryDeleted } from '../events';
import { SystemTags } from './systems-tags';

const inventoryQuery = queryRequired({
    inventory: InventoryComponent,
});

export class InventoryEventSystem extends System<SystemTags, GameEventMap>()<{}>('InventoryEventSystem', {
    dependencies: ['SpacetimeDBEventSystem'],
    execute: ({ world, poll }) => {
        const { inventory } = inventoryQuery(world)[0];

        poll(InventoryAdded).forEach(({ data }) => {
            inventory.inventory.push(data.inventory);
            inventory.ui.update(inventory);
        });

        poll(InventoryDeleted).forEach(({ data }) => {
            const index = inventory.inventory.findIndex((it) => it.id === data.inventory.id);
            if (index >= 0) {
                inventory.inventory.splice(index, 1);
                inventory.ui.update(inventory);
            }
        });
    },
}) {}
