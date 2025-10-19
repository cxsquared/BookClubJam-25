import { Component } from '@typeonce/ecs';

export class PositionLimit extends Component('PositionLimit')<{
    x: number;
    y: number;
    width: number;
    height: number;
}> {}
