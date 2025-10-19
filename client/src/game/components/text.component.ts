import { Component } from '@typeonce/ecs';
import { TextBox } from '../../ui/text-box.ui';

export class TextComponent extends Component('TextComponent')<{
    textBox: TextBox;
}> {}
