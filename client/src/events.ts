import { EventMap } from "@typeonce/ecs";
import { Decor, Door } from "./module_bindings";

export const DecorAdded = Symbol("DecorAdded");
export const DecorDeleted = Symbol("DecorDeleted");
export const UserEnergyChanged = Symbol("UserEnergyChanged");
export const ChangeDoor = Symbol("ChangeDoor");

export interface GameEventMap extends EventMap {
  [DecorAdded]: { decor: Decor };
  [DecorDeleted]: { decor: Decor };
  [UserEnergyChanged]: { newEnergy: number };
  [ChangeDoor]: { newDoor: Door };
}
