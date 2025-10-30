import { Container, Rectangle, Sprite, Text, Ticker } from 'pixi.js';

import type { AppScreen } from '../navigation';
import { navigation } from '../navigation';
import { GameScreen } from './GameScreen';
import { Easing, Group, Tween } from '@tweenjs/tween.js';
import { waitForTweenAsync } from '../utils/utils';
import { PrimaryButton } from '../ui/primary-button.ui';
import { TextBox } from '../ui/text-box.ui';
import { DbConnection, ErrorContext } from '../module_bindings';
import { Identity } from 'spacetimedb';
import { preLoadText } from '../Globals';

//"wss://space.codyclaborn.me"
const spacedbUri = 'ws://localhost:3000';

/** The screen presented at the start, after loading. */
export class TitleScreen extends Container implements AppScreen {
    /** A unique identifier for the screen */
    public static SCREEN_ID = 'title';
    /** An array of bundle IDs for dynamic asset loading. */
    public static assetBundles = ['title-screen'];

    /** A container to assign user interaction to */
    private readonly _hitContainer = new Container();
    /** The hit area to be used by the cannon */
    private readonly _hitArea: Rectangle;
    private readonly tweens: Group = new Group();

    private hasSeenSecondDoor = false;

    private _title!: Text;
    private _playBtn!: PrimaryButton;

    /** A container to group visual elements for easier animation */
    private _topAnimContainer = new Container();
    /** A container to group visual elements for easier animation */
    private _bottomAnimContainer = new Container();

    private textBox: TextBox;

    constructor() {
        super();

        this.textBox = new TextBox(this);
        this.textBox.zIndex = 100;
        this.textBox.showText(['This is a test', 'second line']);
        this.textBox.continue();

        // Create the hit area
        this._hitArea = new Rectangle();

        // Prepare the container for interaction
        this._hitContainer.interactive = true;
        this._hitContainer.hitArea = this._hitArea;
        this.addChild(this._hitContainer);

        // Add visual details like footer, cannon, portholes
        this._buildDetails();

        // Add all parent containers to screen
        this.addChild(this._topAnimContainer, this._bottomAnimContainer);

        this._topAnimContainer.zIndex = 50;
        this._bottomAnimContainer.zIndex = 50;
    }

    /** Called before `show` function, can receive `data` */
    public prepare() {
        // Reset the positions of the group containers
        this._topAnimContainer.y = -350;
        this._bottomAnimContainer.y = 350;
    }

    async connectToDB(): Promise<{ conn: DbConnection; identity: Identity }> {
        const connectionBuilder = DbConnection.builder();
        return new Promise((resolve, reject) => {
            const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
                localStorage.setItem('auth_token', token);
                console.log('Connected to SpacetimeDB with identity:', identity.toHexString());

                conn.subscriptionBuilder()
                    .onApplied((ctx) => {
                        var user = ctx.db.user.identity.find(identity);
                        if (user) {
                            preLoadText(user.currentDoorNumber);

                            if (user.currentDoorNumber > 1) {
                                this.hasSeenSecondDoor = true;
                            }
                        }

                        resolve({ conn, identity });
                    })
                    .subscribe(`SELECT * FROM user WHERE identity = 0x${identity.toHexString()}`);
            };

            const onDisconnect = () => {
                console.log('Disconnected from SpacetimeDB');
            };

            const onConnectError = (_ctx: ErrorContext, err: Error) => {
                if (err.message.includes('Failed to verify token')) {
                    console.log('Auth token is bad. Clearing out and retrying');
                    localStorage.removeItem('auth_token');
                    connectionBuilder
                        .withUri(spacedbUri)
                        .withModuleName('bookclubjam-25')
                        .withToken(localStorage.getItem('auth_token') || undefined)
                        .onConnect(onConnect)
                        .onDisconnect(onDisconnect)
                        .onConnectError(onConnectError)
                        .build();

                    this._bottomAnimContainer.visible = false;

                    return;
                }

                reject(err);

                console.log('Error connecting to SpacetimeDB:', err);
            };

            connectionBuilder
                .withUri(spacedbUri)
                .withModuleName('bookclubjam-25')
                .withToken(localStorage.getItem('auth_token') || undefined)
                .onConnect(onConnect)
                .onDisconnect(onDisconnect)
                .onConnectError(onConnectError)
                .build();
        });
    }

    /** Called when the screen is being shown. */
    public async show() {
        let bg = Sprite.from('title-bg');
        this.addChild(bg);

        await this.connectToDB();

        // Kill tweens of the screen container
        this.tweens.removeAll();

        // Reset screen data
        this.alpha = 0;

        // Tween screen into being visible
        const alphaTween = new Tween({ alpha: 0 }).onUpdate(({ alpha }) => (this.alpha = alpha)).to({ alpha: 1 }, 200);
        this.tweens.add(alphaTween);

        await waitForTweenAsync(alphaTween);

        // The data to be used in the upcoming tweens
        const endData = {
            x: 0,
            y: 0,
            duration: 0.75,
            ease: Easing.Elastic.Out,
        };

        // Tween the containers back to their original position
        const topAnimTween = new Tween({ y: -350 })
            .onUpdate(({ y }) => (this._topAnimContainer.y = y))
            .to({ y: endData.y }, endData.duration * 1000)
            .easing(endData.ease)
            .start();
        this.tweens.add(topAnimTween);

        const bottomTween = new Tween({ y: 350 })
            .onUpdate(({ y }) => (this._bottomAnimContainer.y = y))
            .to({ y: endData.y }, endData.duration * 1000)
            .easing(endData.ease)
            .start();
        this.tweens.add(bottomTween);

        console.log('has seen second door ' + this.hasSeenSecondDoor);
    }

    /** Called when the screen is being hidden. */
    public async hide() {
        // Remove all listeners on the hit container so they don't get triggered outside of the title screen
        this._hitContainer.removeAllListeners();

        // Kill tweens of the screen container
        this.tweens.removeAll();

        // Tween screen into being invisible
        const alphaTween = new Tween({ alpha: 1 }).onUpdate(({ alpha }) => (this.alpha = alpha)).to({ alpha: 0 }, 200);
        this.tweens.add(alphaTween);

        await waitForTweenAsync(alphaTween);
    }

    /**
     * Called every frame.
     * @param time - Ticker object with time related data.
     */
    public update(_time: Ticker) {
        this.tweens.update();
    }

    /**
     * Gets called every time the screen resizes.
     * @param w - width of the screen.
     * @param h - height of the screen.
     */
    public resize(w: number, h: number) {
        // Set visuals to their respective locations

        this._title.x = w * 0.5 - this._title.width / 2;
        this._title.y = 145;

        this._playBtn.x = w * 0.5;
        this._playBtn.y = 500 - this._playBtn.height / 2 + 10;

        // Set hit area of hit container to fit screen
        // Leave a little room to prevent interaction bellow the cannon
        this._hitArea.width = w;
    }

    /** Add visual details to title screen. */
    private _buildDetails() {
        // Add the title card
        this._title = new Text({
            text: 'Book Club Jam 25',
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fill: 0x115555,
                align: 'center',
            },
        });
        this._topAnimContainer.addChild(this._title);

        this._playBtn = new PrimaryButton({
            text: 'Play',
        });

        this._playBtn.onPress.connect(() => {
            // Go to game screen when user presses play button
            navigation.goToScreen(GameScreen);
        });

        this._bottomAnimContainer.addChild(this._playBtn);
    }
}
