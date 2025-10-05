import { Component } from "@typeonce/ecs";
import { Sprite as _Sprite } from "pixi.js";
import { Decor } from "./module_bindings";

export class Position extends Component("Position")<{
  x: number;
  y: number;
}> {}

export class Sprite extends Component("Sprite")<{
  sprite: _Sprite;
}> {}

export class DecorComponent extends Component("Decor")<{
  decor: Decor;
}> {}
