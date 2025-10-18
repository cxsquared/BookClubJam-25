import { ECS, World } from "@typeonce/ecs";
import { Application, Container, Graphics, Sprite as PSprite } from "pixi.js";
import {
  CursorSystem,
  DecorEventSystem,
  DecorSpawnSystem,
  EnergySystem,
  FadeSystem,
  InventoryEventSystem,
  KeyInputSystem,
  MouseInput,
  MouseListener,
  OpenDoorSystem,
  PackageEventSystem,
  PositionLimiter,
  RenderSystem,
  SpacetimeDBEventSystem,
  SystemTags,
  TweenSystem,
} from "./systems";
import { GameEventMap } from "./events";
import {
  BackgroundComponent,
  Cursor,
  DoorComponent,
  EnergyComponent,
  FadeComponent,
  InventoryComponent,
  MouseEvents,
  OpenDoorController,
  Position,
  Sprite,
  TweenComponent,
} from "./components";
import { DbConnection, ErrorContext, Package } from "./module_bindings";
import { Identity } from "spacetimedb";
import { InputManager } from "./input_manager";
import { ProgressBar } from "@pixi/ui";
import { APP_WIDTH, APP_HEIGHT, randomDecorKey, AssetManager } from "./Globals";
import { initDevtools } from "@pixi/devtools";
import { Easing, Tween } from "@tweenjs/tween.js";
import { SpacetimeDBListener } from "./spacetimedb.listener";
import { InventoryUi } from "./ui/inventory.ui";

export type AlphaTween = {
  alpha: number;
};

export type PositionTween = {
  yOffset: number;
  xOffset: number;
  skew: number;
  bgScale: number;
};

//"wss://space.codyclaborn.me"
const spacedbUri = "ws://localhost:3000";

declare global {
  var editingText: boolean;
  var currentDoorNumber: number;
}

globalThis.editingText = false;
globalThis.currentDoorNumber = 0;

(async () => {
  const app = new Application();
  await app.init({
    width: APP_WIDTH,
    height: APP_HEIGHT,
    backgroundColor: 0x222222,
    antialias: false,
    resolution: window.devicePixelRatio,
  });
  document.body.appendChild(app.canvas);

  await AssetManager.load();

  const container = new Container();
  container.width = APP_WIDTH;
  container.height = APP_HEIGHT;

  container.eventMode = "static";
  container.on("pointerdown", () => {});

  app.stage.addChild(container);

  const fadeGraphic = new Graphics()
    .rect(0, 0, APP_WIDTH, APP_HEIGHT)
    .fill(0x00000000);

  fadeGraphic.alpha = 0;
  fadeGraphic.label = "fade";
  fadeGraphic.interactive = false;
  fadeGraphic.eventMode = "none";
  fadeGraphic.zIndex = 100;

  container.addChild(fadeGraphic);

  let world: World<SystemTags, GameEventMap>;

  const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
    localStorage.setItem("auth_token", token);
    console.log(
      "Connected to SpacetimeDB with identity:",
      identity.toHexString()
    );

    const bgSprite = new PSprite(AssetManager.Assets.bg);
    bgSprite.label = "background";
    bgSprite.eventMode = "dynamic";
    bgSprite.anchor = { x: 0.5, y: 0.5 };
    container.addChild(bgSprite);

    const listener = new SpacetimeDBListener(conn, identity);
    const barArgs = {
      fillColor: 0x22ffff,
      borderColor: 0xffffff,
      backgroundColor: 0x000000,
      width: 450,
      height: 35,
      radius: 25,
      border: 3,
    };
    const bg = new Graphics()
      .roundRect(0, 0, barArgs.width, barArgs.height, barArgs.radius)
      .fill(barArgs.borderColor)
      .roundRect(
        barArgs.border,
        barArgs.border,
        barArgs.width - barArgs.border * 2,
        barArgs.height - barArgs.border * 2,
        barArgs.radius
      )
      .fill(barArgs.backgroundColor);
    const fill = new Graphics()
      .roundRect(0, 0, barArgs.width, barArgs.height, barArgs.radius)
      .fill(barArgs.borderColor)
      .roundRect(
        barArgs.border,
        barArgs.border,
        barArgs.width - barArgs.border * 2,
        barArgs.height - barArgs.border * 2,
        barArgs.radius
      )
      .fill(barArgs.fillColor);

    const inventoryUi = new InventoryUi((key, x, y) => {
      if (editingText) return;

      const inventoryItem = inventoryComp.inventory.find(
        (i) => i.decorKey === key
      );

      if (inventoryItem) {
        conn.reducers.createDecor(inventoryItem.id, x, y);
      }
    });
    container.addChild(inventoryUi);

    const inventoryComp = new InventoryComponent({
      inventory: [],
      ui: inventoryUi,
    });

    // Component usage
    let progressBar = new ProgressBar({
      bg,
      fill,
      progress: 0,
    });
    progressBar.x = APP_WIDTH - progressBar.height - 25;
    progressBar.y = 520;
    progressBar.rotation = -Math.PI / 2;

    container.addChild(progressBar);
    world = ECS.create<SystemTags, GameEventMap>(
      ({ addComponent, createEntity, addSystem }) => {
        addComponent(createEntity(), inventoryComp);

        const doorId = createEntity();
        const door = new PSprite(AssetManager.Assets.door);
        door.anchor.set(0, 0);
        door.eventMode = "dynamic";
        door.x = 296;
        door.y = 44;
        door.label = "door";
        container.addChild(door);

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
            justCompleted: false,
            onComplete: undefined,
          })
        );

        const mListener = new MouseListener(door, doorId);

        addComponent(
          createEntity(),
          new Cursor({
            listener: mListener,
            grabbedEvents: [],
          }),
          new Position({ x: 0, y: 0, yOffset: 0, xOffset: 0, skew: 0 })
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
            justCompleted: false,
            onComplete: undefined,
          })
        );

        addComponent(
          createEntity(),
          new Sprite({ sprite: bgSprite }),
          new Position({
            x: APP_WIDTH / 2,
            y: APP_HEIGHT / 2,
            xOffset: 0,
            yOffset: 0,
            skew: 0,
          }),
          new BackgroundComponent()
        );

        addComponent(createEntity(), new EnergyComponent({ bar: progressBar }));
        addComponent(
          doorId,
          new Position({
            x: door.x,
            y: door.y,
            yOffset: 0,
            xOffset: 0,
            skew: 0,
          }),
          new Sprite({ sprite: door }),
          new DoorComponent(),
          new MouseEvents({
            listener: mListener,
            onClick: (_id, _sprite, x, y) => {},
          })
        );

        addSystem(
          new TweenSystem(),
          new MouseInput(),
          new KeyInputSystem({ inputManager: new InputManager() }),
          new SpacetimeDBEventSystem({ listener }),
          new DecorSpawnSystem({ ctx: container, conn }),
          new PackageEventSystem({ container, conn }),
          new InventoryEventSystem(),
          new EnergySystem(),
          new CursorSystem({ conn }),
          new DecorEventSystem(),
          new PositionLimiter(),
          new OpenDoorSystem({ conn }),
          new FadeSystem(),
          new RenderSystem()
        );
      }
    );
  };

  const onDisconnect = () => {
    console.log("Disconnected from SpacetimeDB");
  };

  const onConnectError = (_ctx: ErrorContext, err: Error) => {
    if (err.message.includes("Failed to verify token")) {
      console.log("Auth token is bad. Clearing out and retrying");
      localStorage.removeItem("auth_token");
      connectionBuilder
        .withUri(spacedbUri)
        .withModuleName("bookclubjam-25")
        .withToken(localStorage.getItem("auth_token") || undefined)
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError)
        .build();

      return;
    }

    console.log("Error connecting to SpacetimeDB:", err);
  };

  const connectionBuilder = DbConnection.builder();
  connectionBuilder
    .withUri(spacedbUri)
    .withModuleName("bookclubjam-25")
    .withToken(localStorage.getItem("auth_token") || undefined)
    .onConnect(onConnect)
    .onDisconnect(onDisconnect)
    .onConnectError(onConnectError)
    .build();

  initDevtools({ app });

  app.ticker.add(({ deltaTime }) => {
    if (world) world.update(deltaTime);
  });
})();
