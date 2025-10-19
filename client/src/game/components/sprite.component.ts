import { Input } from '@pixi/ui';
import { Component } from '@typeonce/ecs';
import { Container, Sprite } from 'pixi.js';

export class SpriteComponent extends Component('Sprite')<{
    sprite: Sprite | Input | Container;
}> {}
