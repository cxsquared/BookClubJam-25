import { EventMap } from "@typeonce/ecs";
import { Decor, Door, MoveDecor, Reducer } from "./module_bindings";
import { ReducerEvent } from "spacetimedb";

export const DecorAdded = Symbol("DecorAdded");
export const DecorUpdated = Symbol("DecorUpdated");
export const DecorDeleted = Symbol("DecorDeleted");
export const UserEnergyChanged = Symbol("UserEnergyChanged");
export const ChangeDoor = Symbol("ChangeDoor");
export const MoveDecorFailed = Symbol("MoveDecorFailed");
export const MoveDecorSucceeded = Symbol("MoveDecorSucceeded");

export interface GameEventMap extends EventMap {
  [DecorAdded]: { decor: Decor };
  [DecorUpdated]: { decor: Decor };
  [DecorDeleted]: { decor: Decor };
  [MoveDecorFailed]: {
    event: ReducerEvent<{ name: "MoveDecor"; args: MoveDecor }>;
  };
  [MoveDecorSucceeded]: {
    event: ReducerEvent<{ name: "MoveDecor"; args: MoveDecor }>;
  };
  [UserEnergyChanged]: { newEnergy: number };
  [ChangeDoor]: { newDoor: Door };
}
