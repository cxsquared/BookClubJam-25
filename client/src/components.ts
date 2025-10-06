import { Component, EntityId } from "@typeonce/ecs";
import { Sprite as _Sprite } from "pixi.js";
import { Decor } from "./module_bindings";
import { MouseListener } from "./systems";
import { ProgressBar } from "@pixi/ui";

export class Position extends Component("Position")<{
  x: number;
  y: number;
}> {}

export class PositionLimit extends Component("PositionLimit")<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {}

export class Sprite extends Component("Sprite")<{
  sprite: _Sprite;
}> {}

export class DecorComponent extends Component("Decor")<{
  decor: Decor;
  inputListener: MouseListener;
}> {}

export class DoorComponent extends Component("Door")<{}> {}

export class MouseEvents extends Component("MouseEvents")<{
  listener: MouseListener;
  onClick: (x: number, y: number) => void;
}> {}

export class EnergyComponent extends Component("EnergyComponent")<{
  bar: ProgressBar;
}> {}

export class Cursor extends Component("Cursor")<{
  dragging: EntityId | undefined;
  listener: MouseListener;
}> {}
