import { Tween } from '@tweenjs/tween.js';
import { Component, SystemExecute } from '@typeonce/ecs';
import { SystemTags } from '../../systems';
import { GameEventMap } from '../../events';

export class TweenComponent<T extends Record<string, any>> extends Component('TweenComponent')<{
    tween: Tween<T>;
    justCompleted: boolean;
    onComplete: undefined | ((_: SystemExecute<SystemTags, GameEventMap>) => void);
}> {}
