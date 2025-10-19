import { queryRequired, System } from '@typeonce/ecs';
import { InputManager } from '../../input_manager';
import { TextComponent } from '../components/text.component';
import { GameEventMap, ShowText } from '../events';
import { SystemTags } from './systems-tags';

var textBoxQuery = queryRequired({
    text: TextComponent,
});

export class DialogueController extends System<SystemTags, GameEventMap>()<{
    readonly inputManager: InputManager;
}>('DialogueController', {
    execute: ({ world, poll, input: { inputManager } }) => {
        var textBox = textBoxQuery(world)[0];

        if (textBox.text.textBox.visible && inputManager.isKeyPressed('Space')) {
            textBox.text.textBox.continue();
        }

        poll(ShowText).forEach(({ data }) => {
            textBox.text.textBox.showText(data.texts);
        });

        inputManager.tick();
    },
}) {}
