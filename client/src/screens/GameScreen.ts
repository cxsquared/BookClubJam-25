import { Assets, Container, Graphics, Sprite, Ticker } from 'pixi.js';

import type { AppScreen } from '../navigation';
import { Easing, Group, Tween } from '@tweenjs/tween.js';
import { ECS, World } from '@typeonce/ecs';
import { Identity } from 'spacetimedb';
import { InputManager } from '../input_manager';
import { PositionTween, AlphaTween } from '../main';
import { DbConnection, ErrorContext } from '../module_bindings';
import { SpacetimeDBListener } from '../spacetimedb.listener';
import { InventoryUi } from '../ui/inventory.ui';
import { TextBox } from '../ui/text-box.ui';
import { designConfig } from '../game/designConfig';
import { BackgroundComponent } from '../game/components/background.component';
import { Cursor } from '../game/components/cursor.component';
import { DoorComponent } from '../game/components/door.component';
import { FadeComponent } from '../game/components/fade.component';
import { InventoryComponent } from '../game/components/inventory.component';
import { MouseEvents } from '../game/components/mouse-events.component';
import { OpenDoorController } from '../game/components/open-door-controller.component';
import { Position } from '../game/components/position.component';
import { SpriteComponent } from '../game/components/sprite.component';
import { TextComponent } from '../game/components/text.component';
import { TweenComponent } from '../game/components/tween.component';
import { MouseListener } from '../game/mouse.listener';
import { CursorSystem } from '../game/systems/cursor.system';
import { DecorEventSystem } from '../game/systems/decor-event.system';
import { DecorSpawnSystem } from '../game/systems/decor.spawn.system';
import { DialogueController } from '../game/systems/dialogue-controller.system';
import { EnergySystem } from '../game/systems/energy.system';
import { FadeSystem } from '../game/systems/fade.system';
import { InventoryEventSystem } from '../game/systems/inventory-event.system';
import { KeyInputSystem } from '../game/systems/key-input.system';
import { MouseInput } from '../game/systems/mouse-input.system';
import { OpenDoorSystem } from '../game/systems/open-door.system';
import { PackageEventSystem } from '../game/systems/package-event.system';
import { PositionLimiter } from '../game/systems/position-limiter.system';
import { RenderSystem } from '../game/systems/render.system';
import { SpacetimeDBEventSystem } from '../game/systems/spacetime-db-event.system';
import { SystemTags } from '../game/systems/systems-tags';
import { TweenSystem } from '../game/systems/tween.system';
import { GameEventMap } from '../game/events';

//"wss://space.codyclaborn.me"
const spacedbUri = 'ws://localhost:3000';

/** The screen that contains all the gameplay */
export class GameScreen extends Container implements AppScreen {
    /** A unique identifier for the screen */
    public static SCREEN_ID = 'game';
    /** An array of bundle IDs for dynamic asset loading. */
    public static assetBundles = ['game-screen'];

    private readonly _tweens: Group;
    private background: Sprite;

    private world: World<SystemTags, GameEventMap> | undefined = undefined;
    private running: boolean = false;

    constructor() {
        super();

        this.running = false;
        this._tweens = new Group();

        this.background = Sprite.from('bg');
        this.background.label = 'background';
        this.background.eventMode = 'dynamic';
        this.background.anchor = { x: 0.5, y: 0.5 };
        this.addChild(this.background);

        const fadeGraphic = new Graphics()
            .rect(0, 0, designConfig.content.width, designConfig.content.height)
            .fill(0x00000000);

        fadeGraphic.alpha = 0;
        fadeGraphic.label = 'fade';
        fadeGraphic.interactive = false;
        fadeGraphic.eventMode = 'none';
        fadeGraphic.zIndex = 100;

        this.addChild(fadeGraphic);

        const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
            localStorage.setItem('auth_token', token);
            console.log('Connected to SpacetimeDB with identity:', identity.toHexString());

            const listener = new SpacetimeDBListener(conn, identity);
            const inventoryUi = new InventoryUi((key, x, y) => {
                if (editingText) return;

                const inventoryItem = inventoryComp.inventory.find((i) => i.decorKey === key);

                if (inventoryItem) {
                    conn.reducers.createDecor(inventoryItem.id, x, y);
                }
            });
            this.addChild(inventoryUi);

            const inventoryComp = new InventoryComponent({
                inventory: [],
                latestPackageXY: undefined,
                ui: inventoryUi,
            });

            this.world = ECS.create<SystemTags, GameEventMap>(({ addComponent, createEntity, addSystem }) => {
                addComponent(createEntity(), inventoryComp);

                const doorId = createEntity();
                const door = Sprite.from('door');
                door.anchor.set(0, 0);
                door.eventMode = 'dynamic';
                door.x = 296;
                door.y = 44;
                door.label = 'door';
                this.addChild(door);

                const openTween = new Tween<PositionTween>({
                    yOffset: 0,
                    xOffset: 0,
                    skew: 0,
                    bgScale: 1,
                });
                openTween.easing(Easing.Exponential.InOut);

                addComponent(
                    createEntity(),
                    new OpenDoorController({
                        isRunning: false,
                    }),
                    new TweenComponent<PositionTween>({
                        tween: openTween,
                        running: false,
                        onComplete: undefined,
                    }),
                );

                const mListener = new MouseListener(door, doorId);

                addComponent(
                    createEntity(),
                    new Cursor({
                        listener: mListener,
                        grabbedEvents: [],
                    }),
                    new Position({ x: 0, y: 0, yOffset: 0, xOffset: 0, skew: 0 }),
                );

                const fadeTween = new Tween<AlphaTween>({
                    alpha: 0,
                });
                fadeTween.onUpdate(({ alpha }) => {
                    fadeGraphic.alpha = alpha;
                });

                addComponent(
                    createEntity(),
                    new FadeComponent({
                        graphic: fadeGraphic,
                    }),
                    new TweenComponent<AlphaTween>({
                        tween: fadeTween,
                        running: false,
                        onComplete: undefined,
                    }),
                );

                addComponent(
                    createEntity(),
                    new SpriteComponent({ sprite: this.background }),
                    new Position({
                        x: designConfig.content.width / 2,
                        y: designConfig.content.height / 2,
                        xOffset: 0,
                        yOffset: 0,
                        skew: 0,
                    }),
                    new BackgroundComponent(),
                );

                addComponent(
                    doorId,
                    new Position({
                        x: door.x,
                        y: door.y,
                        yOffset: 0,
                        xOffset: 0,
                        skew: 0,
                    }),
                    new SpriteComponent({ sprite: door }),
                    new DoorComponent(),
                    new MouseEvents({
                        listener: mListener,
                        onClick: (_id, _sprite, _x, _y) => {},
                    }),
                );

                let textBox = new TextBox(this);
                textBox.visible = false;
                addComponent(
                    createEntity(),
                    new Position({
                        x: 0,
                        y: designConfig.content.height - textBox.box_height - 25,
                        xOffset: 0,
                        yOffset: 0,
                        skew: 0,
                    }),
                    new SpriteComponent({
                        sprite: textBox,
                    }),
                    new TextComponent({
                        textBox: textBox,
                    }),
                );

                if (!globalThis.packageAsset) {
                    throw new Error('please load package asset');
                }

                addSystem(
                    new TweenSystem(),
                    new MouseInput(),
                    new KeyInputSystem({ inputManager: new InputManager() }),
                    new SpacetimeDBEventSystem({ listener }),
                    new DecorSpawnSystem({ screen: this, conn }),
                    new PackageEventSystem({ screen: this, conn, packageAsset: globalThis.packageAsset }),
                    new InventoryEventSystem({ screen: this }),
                    new EnergySystem(),
                    new CursorSystem({ conn }),
                    new DecorEventSystem(),
                    new PositionLimiter(),
                    new OpenDoorSystem({ conn }),
                    new FadeSystem(),
                    new DialogueController({
                        inputManager: new InputManager(),
                    }),
                    new RenderSystem(),
                );
            });
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

                return;
            }

            console.log('Error connecting to SpacetimeDB:', err);
        };

        const connectionBuilder = DbConnection.builder();
        connectionBuilder
            .withUri(spacedbUri)
            .withModuleName('bookclubjam-25')
            .withToken(localStorage.getItem('auth_token') || undefined)
            .onConnect(onConnect)
            .onDisconnect(onDisconnect)
            .onConnectError(onConnectError)
            .build();
    }

    /** Called when the screen is being shown. */
    public async show() {
        // Kill tweens of the screen container
        this._tweens.removeAll();

        // Reset screen data
        this.alpha = 0;

        // Wake up the game
        const fadeIn = new Tween({ alpha: 0 })
            .to({ alpha: 1 }, 200)
            .onUpdate(({ alpha }) => (this.alpha = alpha))
            .onComplete(() => (this.running = true))
            .start();
        this._tweens.add(fadeIn);
    }

    /** Called when the screen is being hidden. */
    public async hide() {
        // Kill tweens of the screen container
        this._tweens.removeAll();
        this.running = false;

        const fadeOut = new Tween({ alpha: 1 })
            .to({ alpha: 0 }, 200)
            .onUpdate(({ alpha }) => (this.alpha = alpha))
            .start();
        this._tweens.add(fadeOut);
    }

    /**
     * Called every frame.
     * @param time - Ticker object with time related data.
     */
    public update(time: Ticker) {
        this._tweens.update();

        if (this.world && this.running) this.world.update(time.deltaMS);
    }

    /**
     * Gets called every time the screen resizes.
     * @param w - width of the screen.
     * @param h - height of the screen.
     */
    public resize(_w: number, _h: number) {
        // Fit background to screen
        this.background.width = designConfig.content.width;
        this.background.height = designConfig.content.height;
    }
}
