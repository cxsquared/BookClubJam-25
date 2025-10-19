import { Component } from '@typeonce/ecs';

export class Position extends Component('Position')<{
    x: number;
    y: number;
    xOffset: number;
    yOffset: number;
    skew: number;
}> {}
