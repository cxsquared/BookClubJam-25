import { EntityId, EventMap } from "@typeonce/ecs";
import {
  Decor,
  DeleteDecor,
  Door,
  Inventory,
  MoveDecor,
  Package,
} from "./module_bindings";
import { ReducerEvent } from "spacetimedb";
import { GrabbedComponent } from "./components";

export const DecorAdded = Symbol("DecorAdded");
export const DecorUpdated = Symbol("DecorUpdated");
export const DecorDeleted = Symbol("DecorDeleted");
export const UserEnergyChanged = Symbol("UserEnergyChanged");
export const ChangeDoor = Symbol("ChangeDoor");
export const MoveDecorFailed = Symbol("MoveDecorFailed");
export const MoveDecorSucceeded = Symbol("MoveDecorSucceeded");
export const DeleteDecorSucceeded = Symbol("MoveDecorSucceeded");
export const DeleteDecorFailed = Symbol("DeleteDecorFailed");
export const DecorGrabbed = Symbol("DecorGrabbed");
export const FadeEvent = Symbol("FadeEvent");
export const InventoryAdded = Symbol("InventoryAdded");
export const InventoryDeleted = Symbol("InventoryDeleted");
export const PackageAdded = Symbol("PackageAdded");
export const PackageDeleted = Symbol("PackageDeleted");

export interface GameEventMap extends EventMap {
  [DecorAdded]: { decor: Decor };
  [DecorUpdated]: { decor: Decor };
  [DecorDeleted]: { decor: Decor };
  [DecorGrabbed]: { id: EntityId; component: GrabbedComponent };
  [MoveDecorFailed]: {
    event: ReducerEvent<{ name: "MoveDecor"; args: MoveDecor }>;
  };
  [MoveDecorSucceeded]: {
    event: ReducerEvent<{ name: "MoveDecor"; args: MoveDecor }>;
  };
  [DeleteDecorSucceeded]: {
    event: ReducerEvent<{ name: "DeleteDecor"; args: DeleteDecor }>;
  };
  [DeleteDecorFailed]: {
    event: ReducerEvent<{ name: "DeleteDecor"; args: DeleteDecor }>;
  };
  [UserEnergyChanged]: { newEnergy: number };
  [ChangeDoor]: { newDoor: Door };
  [FadeEvent]: { isFadeOut: boolean };
  [InventoryAdded]: { inventory: Inventory };
  [InventoryDeleted]: { inventory: Inventory };
  [PackageAdded]: { package: Package };
  [PackageDeleted]: { package: Package };
}
