import { Container, Ticker } from 'pixi.js';

import { LoadingSpinner } from '../ui/loading.ui';

/** The default load screen for the game. */
export class LoadScreen extends Container {
    /** A unique identifier for the screen */
    public static SCREEN_ID = 'loader';
    /** An array of bundle IDs for dynamic asset loading. */
    public static assetBundles = ['preload'];

    private readonly _loadingSpinner: LoadingSpinner;

    constructor() {
        super();

        this._loadingSpinner = new LoadingSpinner();
        this.addChild(this._loadingSpinner);
    }

    /** Called when the screen is being shown. */
    public async show() {
        // Kill tweens of the screen container
        //gsap.killTweensOf(this);

        // Reset screen data
        this.alpha = 1;

        // Tween screen into being visible
        //await gsap.to(this, { alpha: 1, duration: 0.2, ease: 'linear' });
    }

    /** Called when the screen is being hidden. */
    public async hide() {
        // Kill tweens of the screen container
        //gsap.killTweensOf(this);
        // Tween screen into being invisible
        //await gsap.to(this, { alpha: 0, delay: 0.1, duration: 0.2, ease: 'linear' });
    }

    /**
     * Called every frame
     * @param time - Ticker object with time related data.
     */
    public update(_time: Ticker) {
        // Rotate spinner
        this._loadingSpinner.update();
    }

    /**
     * Gets called every time the screen resizes.
     * @param w - width of the screen.
     * @param h - height of the screen.
     */
    public resize(_w: number, _h: number) {}
}
