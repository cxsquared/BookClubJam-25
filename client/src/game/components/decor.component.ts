import { Component } from '@typeonce/ecs';
import { Decor } from '../../module_bindings';
import { Position } from './position.component';
import { Sprite } from 'pixi.js';
import { MouseListener } from '../mouse.listener';

export class DecorComponent extends Component('Decor')<{
    decor: Decor;
    inputListener: MouseListener;
    originalPosition: Position;
    deleteSprite: Sprite | undefined;
}> {}
