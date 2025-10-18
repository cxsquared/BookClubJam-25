import { Component, EntityId, SystemExecute, World } from "@typeonce/ecs";
import { Sprite as _Sprite, Container, Graphics, System } from "pixi.js";
import { Decor, Inventory, Package } from "./module_bindings";
import { MouseListener, SystemTags } from "./systems";
import { Input, ProgressBar } from "@pixi/ui";
import { Tween } from "@tweenjs/tween.js";
import { GameEventMap } from "./events";
import { InventoryUi } from "./ui/inventory.ui";
import { TextBox } from "./ui/text-box.ui";

export class Position extends Component("Position")<{
  x: number;
  y: number;
  xOffset: number;
  yOffset: number;
  skew: number;
}> {}

export class PositionLimit extends Component("PositionLimit")<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {}

export class Sprite extends Component("Sprite")<{
  sprite: _Sprite | Input | Container;
}> {}

export class DecorComponent extends Component("Decor")<{
  decor: Decor;
  inputListener: MouseListener;
  originalPosition: Position;
  deleteSprite: _Sprite | undefined;
}> {}

export class DoorComponent extends Component("Door")<{}> {}

export class BackgroundComponent extends Component("Background")<{}> {}

export class FadeComponent extends Component("FadeComponent")<{
  graphic: Graphics;
}> {}

export class MouseEvents extends Component("MouseEvents")<{
  listener: MouseListener;
  onClick: (id: EntityId, sprite: _Sprite, x: number, y: number) => void;
}> {}

export class GrabbedComponent extends Component("GrabbedComponent")<{
  xOffset: number;
  yOffset: number;
  sprite: _Sprite;
}> {}

export class EnergyComponent extends Component("EnergyComponent")<{
  bar: ProgressBar;
}> {}

export class Cursor extends Component("Cursor")<{
  listener: MouseListener;
  grabbedEvents: { id: EntityId; component: GrabbedComponent }[];
}> {}

export class OpenDoorController extends Component("OpenDoorController")<{
  isRunning: boolean;
}> {}

export class TweenComponent<T extends Record<string, any>> extends Component(
  "TweenComponent"
)<{
  tween: Tween<T>;
  justCompleted: boolean;
  onComplete:
    | undefined
    | ((_: SystemExecute<SystemTags, GameEventMap>) => void);
}> {}

export class InventoryComponent extends Component("InventoryComponent")<{
  inventory: Inventory[];
  ui: InventoryUi;
}> {}

export class PackageComponent extends Component("PackageComponent")<{
  package: Package;
}> {}

export class TextComponent extends Component("TextComponent")<{
  textBox: TextBox;
}> {}
