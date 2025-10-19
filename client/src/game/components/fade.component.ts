import { Component } from '@typeonce/ecs';
import { Graphics } from 'pixi.js';

export class FadeComponent extends Component('FadeComponent')<{
    graphic: Graphics;
}> {}
