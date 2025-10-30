import { Container, Sprite, Text } from 'pixi.js';
import { LayoutContainer } from '@pixi/layout/components';
import { designConfig } from '../game/designConfig';

export class TextBox extends Container {
    private text: Text;
    private dialogues: string[] = [];
    private bg: Sprite;

    private padding = 26;

    public static preloadText: String = '';

    constructor(parent: Container) {
        super({
            layout: true,
        });

        this.bg = Sprite.from('paper');

        this.height = this.bg.height;
        this.width = this.bg.width;
        this.zIndex = 200;

        const layout = new LayoutContainer({
            layout: {
                width: this.bg.width,
                height: this.bg.height,
                overflow: 'scroll',
                padding: this.padding,
            },
            background: this.bg,
        });

        this.addChild(layout);

        this.x = designConfig.content.width - this.bg.width;
        this.y = designConfig.content.height / 2 - this.bg.height / 2;

        this.text = new Text({
            style: {
                fontSize: 16,
                fontVariant: 'small-caps',
                lineHeight: 20,
                padding: 26,
                wordWrapWidth: this.bg.width - 26 * 2,
                wordWrap: true,
            },
        });

        this.text.x = 26;
        this.text.y = 5;
        layout.addChild(this.text);

        if (TextBox.preloadText) {
            this.text.text = TextBox.preloadText;
        }

        parent.addChild(this);
    }

    public showText(texts: string[]) {
        if (texts.length <= 0) return;

        this.dialogues.push(...texts);
        const newText = this.dialogues.shift();
        if (!newText) {
            return;
        }

        this.visible = true;
        this.text.text = this.text.text + '\n' + newText;
    }

    public continue(): boolean {
        const newText = this.dialogues.shift();
        if (!newText) {
            this.visible = false;
            return false;
        }

        this.visible = true;
        this.text.text = this.text.text + '\n' + newText;

        return true;
    }

    public hide() {
        this.visible = false;
    }
}
