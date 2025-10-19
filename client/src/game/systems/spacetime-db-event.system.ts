import { System } from '@typeonce/ecs';
import { SpacetimeDBListener } from '../../spacetimedb.listener';
import {
    GameEventMap,
    UserEnergyChanged,
    DecorAdded,
    DecorDeleted,
    DecorUpdated,
    MoveDecorSucceeded,
    MoveDecorFailed,
    DeleteDecorFailed,
    DeleteDecorSucceeded,
    InventoryAdded,
    InventoryDeleted,
    PackageAdded,
    PackageDeleted,
} from '../events';
import { SystemTags } from './systems-tags';

export class SpacetimeDBEventSystem extends System<SystemTags, GameEventMap>()<{
    readonly listener: SpacetimeDBListener;
}>('SpacetimeDBEventSystem', {
    execute: ({ emit, input: { listener } }) => {
        let updatedUser = listener.userUpdated.shift();
        while (updatedUser) {
            emit({
                type: UserEnergyChanged,
                data: { newEnergy: updatedUser.energy },
            });
            updatedUser = listener.userUpdated.shift();
        }

        let addedDecor = listener.decorAdded.shift();
        while (addedDecor) {
            emit({
                type: DecorAdded,
                data: { decor: addedDecor },
            });
            addedDecor = listener.decorAdded.shift();
        }

        let deletedDecor = listener.decorDeleted.shift();
        while (deletedDecor) {
            emit({
                type: DecorDeleted,
                data: { decor: deletedDecor },
            });
            deletedDecor = listener.decorDeleted.shift();
        }

        let updatedDecor = listener.decorUpdated.shift();
        while (updatedDecor) {
            emit({
                type: DecorUpdated,
                data: { decor: updatedDecor },
            });
            updatedDecor = listener.decorUpdated.shift();
        }

        let failedMoveDecor = listener.moveDecorEvent.shift();
        while (failedMoveDecor) {
            if (failedMoveDecor.status.tag === 'Committed') {
                emit({
                    type: MoveDecorSucceeded,
                    data: { event: failedMoveDecor },
                });
            } else if (failedMoveDecor.status.tag === 'Failed') {
                emit({
                    type: MoveDecorFailed,
                    data: { event: failedMoveDecor },
                });
            }
            failedMoveDecor = listener.moveDecorEvent.shift();
        }

        let failedDeleteDecor = listener.deleteDecorEvent.shift();
        while (failedDeleteDecor) {
            if (failedDeleteDecor.status.tag === 'Failed') {
                emit({
                    type: DeleteDecorFailed,
                    data: { event: failedDeleteDecor },
                });
            } else if (failedDeleteDecor.status.tag === 'Committed') {
                emit({
                    type: DeleteDecorSucceeded,
                    data: { event: failedDeleteDecor },
                });
            }
            failedDeleteDecor = listener.deleteDecorEvent.shift();
        }

        let inventoryAdded = listener.inventoryAdded.shift();
        while (inventoryAdded) {
            emit({
                type: InventoryAdded,
                data: { inventory: inventoryAdded },
            });
            inventoryAdded = listener.inventoryAdded.shift();
        }

        let inventoryDeleted = listener.inventoryDeleted.shift();
        while (inventoryDeleted) {
            emit({
                type: InventoryDeleted,
                data: { inventory: inventoryDeleted },
            });
            inventoryDeleted = listener.inventoryDeleted.shift();
        }

        let packageAdded = listener.packageAdded.shift();
        while (packageAdded) {
            emit({
                type: PackageAdded,
                data: { package: packageAdded },
            });
            packageAdded = listener.packageAdded.shift();
        }

        let packageDeleted = listener.packageDeleted.shift();
        while (packageDeleted) {
            emit({
                type: PackageDeleted,
                data: { package: packageDeleted },
            });
            packageDeleted = listener.packageDeleted.shift();
        }
    },
}) {}
