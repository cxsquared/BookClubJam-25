import { Component } from '@typeonce/ecs';
import { Inventory } from '../../module_bindings';
import { InventoryUi } from '../../ui/inventory.ui';

export class InventoryComponent extends Component('InventoryComponent')<{
    inventory: Inventory[];
    ui: InventoryUi;
    latestPackageXY: { x: number; y: number } | undefined;
}> {}
