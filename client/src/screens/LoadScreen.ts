import { Container, Ticker } from 'pixi.js';

import { LoadingSpinner } from '../ui/loading.ui';
import { Group, Tween } from '@tweenjs/tween.js';
import { waitForTweenAsync } from '../utils/utils';

/** The default load screen for the game. */
export class LoadScreen extends Container {
    /** A unique identifier for the screen */
    public static SCREEN_ID = 'loader';
    /** An array of bundle IDs for dynamic asset loading. */
    public static assetBundles = ['preload'];

    private readonly _loadingSpinner: LoadingSpinner;
    private readonly tweens: Group = new Group();

    constructor() {
        super();

        this._loadingSpinner = new LoadingSpinner();
        this.addChild(this._loadingSpinner);
    }

    /** Called when the screen is being shown. */
    public async show() {
        // Kill tweens of the screen container
        this.tweens.removeAll();

        // Reset screen data
        this.alpha = 0;

        // Tween screen into being visible
        const alphaTween = new Tween({ alpha: 0 }).onUpdate(({ alpha }) => (this.alpha = alpha)).to({ alpha: 1 }, 200);
        this.tweens.add(alphaTween);

        await waitForTweenAsync(alphaTween);
    }

    /** Called when the screen is being hidden. */
    public async hide() {
        // Kill tweens of the screen container
        this.tweens.removeAll();

        // Tween screen into being invisible
        const alphaTween = new Tween({ alpha: 1 }).onUpdate(({ alpha }) => (this.alpha = alpha)).to({ alpha: 0 }, 200);
        this.tweens.add(alphaTween);

        await waitForTweenAsync(alphaTween);
    }

    /**
     * Called every frame
     * @param time - Ticker object with time related data.
     */
    public update(_time: Ticker) {
        // Rotate spinner
        this._loadingSpinner.update();
        this.tweens.update();
    }

    /**
     * Gets called every time the screen resizes.
     * @param w - width of the screen.
     * @param h - height of the screen.
     */
    public resize(w: number, h: number) {
        this._loadingSpinner.x = w * 0.5;
        this._loadingSpinner.y = h * 0.5;
    }
}
