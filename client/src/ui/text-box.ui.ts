import { Container, Text } from 'pixi.js';
import { LayoutContainer } from '@pixi/layout/components';
import { designConfig } from '../game/designConfig';

export class TextBox extends Container {
    private text: Text;
    private dialogues: string[] = [];

    private padding = 25;
    public box_height = designConfig.content.height / 4;

    constructor(parent: Container) {
        super({
            layout: true,
        });

        this.height = this.box_height;
        this.width = designConfig.content.width;
        this.zIndex = 200;

        const layout = new LayoutContainer({
            layout: {
                width: designConfig.content.width - this.padding * 2,
                backgroundColor: '0x8f0ff555',
                height: this.box_height,
                justifyContent: 'center',
                objectFit: 'contain',
                alignContent: 'center',
                overflow: 'scroll',
                padding: this.padding,
            },
        });

        layout.x = this.padding;

        this.addChild(layout);

        this.x = 0;
        this.y = designConfig.content.height - this.height;

        this.text = new Text({
            layout: {
                width: designConfig.content.width - this.padding * 2,
                height: this.box_height - this.padding * 2,
            },
        });
        layout.addChild(this.text);

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
        this.text.text = newText;
    }

    public continue(): boolean {
        const newText = this.dialogues.shift();
        if (!newText) {
            this.visible = false;
            return false;
        }

        this.visible = true;
        this.text.text = newText;

        return true;
    }

    public hide() {
        this.visible = false;
    }
}
