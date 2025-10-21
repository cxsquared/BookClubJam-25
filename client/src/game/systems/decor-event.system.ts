import { query, queryRequired, System } from '@typeonce/ecs';
import { GameEventMap, MoveDecorFailed, MoveDecorSucceeded, DeleteDecorFailed, DeleteDecorSucceeded } from '../events';
import { SystemTags } from './systems-tags';
import { DecorComponent } from '../components/decor.component';
import { Position } from '../components/position.component';
import { SpriteComponent } from '../components/sprite.component';
import { InventoryComponent } from '../components/inventory.component';

const decorQuery = query({
    decor: DecorComponent,
    position: Position,
    sprite: SpriteComponent,
});

const inventoryQuery = queryRequired({
    inventory: InventoryComponent,
});

export class DecorEventSystem extends System<SystemTags, GameEventMap>()<{}>('DecorEventSystem', {
    dependencies: ['SpacetimeDBEventSystem'],
    execute: ({ world, poll, destroyEntity }) => {
        poll(MoveDecorFailed).forEach(({ data }) => {
            const decor = decorQuery(world).find((d) => d.decor.decor.id === data.event.reducer.args.decorId);

            if (decor) {
                decor.position.x = decor.decor.originalPosition.x;
                decor.position.y = decor.decor.originalPosition.y;
            }
        });

        poll(MoveDecorSucceeded).forEach(({ data }) => {
            const decor = decorQuery(world).find((d) => d.decor.decor.id === data.event.reducer.args.decorId);

            if (decor) {
                decor.decor.originalPosition.x = decor.position.x;
                decor.decor.originalPosition.y = decor.position.y;
            }
        });

        poll(DeleteDecorFailed).forEach(({ data }) => {
            const decor = decorQuery(world).find((d) => d.decor.decor.id === data.event.reducer.args.decorId);

            if (decor) {
                decor.sprite.sprite.interactive = true;
            }
        });

        const { inventory } = inventoryQuery(world)[0];

        poll(DeleteDecorSucceeded).forEach(({ data }) => {
            const decor = decorQuery(world).find((d) => d.decor.decor.id === data.event.reducer.args.decorId);

            if (decor) {
                inventory.latestPackageXY = { x: decor.position.x, y: decor.position.y };

                decor.sprite.sprite.destroy();
                destroyEntity(decor.entityId);
            }
        });
    },
}) {}
