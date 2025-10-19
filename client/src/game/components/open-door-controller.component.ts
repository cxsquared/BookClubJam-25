import { Component } from '@typeonce/ecs';

export class OpenDoorController extends Component('OpenDoorController')<{
    isRunning: boolean;
}> {}
