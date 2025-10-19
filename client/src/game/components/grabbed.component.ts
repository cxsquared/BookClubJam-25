import { Component } from '@typeonce/ecs';
import { Sprite } from 'pixi.js';

export class GrabbedComponent extends Component('GrabbedComponent')<{
    xOffset: number;
    yOffset: number;
    sprite: Sprite;
}> {}
