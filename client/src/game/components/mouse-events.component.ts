import { Component, EntityId } from '@typeonce/ecs';
import { MouseListener } from '../../systems';
import { Sprite } from 'pixi.js';

export class MouseEvents extends Component('MouseEvents')<{
    listener: MouseListener;
    onClick: (id: EntityId, sprite: Sprite, x: number, y: number) => void;
}> {}
