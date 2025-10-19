import { queryRequired, System } from '@typeonce/ecs';
import { InputManager } from '../../input_manager';
import { GameEventMap, OpenDoorEvent } from '../events';
import { SystemTags } from './systems-tags';
import { TextComponent } from '../components/text.component';
import { PositionTween } from '../../main';
import { OpenDoorController } from '../components/open-door-controller.component';
import { TweenComponent } from '../components/tween.component';

var textBoxQuery = queryRequired({
    text: TextComponent,
});

const openDoorQuery = queryRequired({
    openController: OpenDoorController,
    tween: TweenComponent<PositionTween>,
});

export class KeyInputSystem extends System<SystemTags, GameEventMap>()<{
    inputManager: InputManager;
}>('KeyInput', {
    execute: ({ world, emit, input: { inputManager } }) => {
        var textBox = textBoxQuery(world)[0];
        if (!textBox.text.textBox.visible && !globalThis.editingText && inputManager.isKeyPressed('Space')) {
            const openDoor = openDoorQuery(world)[0];
            if (!openDoor.openController.isRunning) {
                emit({
                    type: OpenDoorEvent,
                    data: {},
                });
            }
        }

        inputManager.tick();
    },
}) {}
