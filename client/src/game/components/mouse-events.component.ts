import { Component, EntityId } from '@typeonce/ecs';
import { Sprite } from 'pixi.js';
import { MouseListener } from '../mouse.listener';

export class MouseEvents extends Component('MouseEvents')<{
    listener: MouseListener;
    onClick: (id: EntityId, sprite: Sprite, x: number, y: number) => void;
}> {}
