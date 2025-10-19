import { Component } from '@typeonce/ecs';
import { Decor } from '../../module_bindings';
import { MouseListener } from '../../systems';
import { Position } from './position.component';
import { Sprite } from 'pixi.js';

export class DecorComponent extends Component('Decor')<{
    decor: Decor;
    inputListener: MouseListener;
    originalPosition: Position;
    deleteSprite: Sprite | undefined;
}> {}
