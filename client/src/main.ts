import { ECS, World } from "@typeonce/ecs";
import { Application, Container, Graphics, Sprite as PSprite } from "pixi.js";
import {
  CursorSystem,
  DecorEventSystem,
  DecorSpawnSystem,
  EnergySystem,
  KeyInputSystem,
  MouseInput,
  MouseListener,
  OpenDoor,
  PositionLimiter,
  RenderSystem,
  SpacetimeDBEventSystem,
  SpacetimeDBListener,
  SystemTags,
} from "./systems";
import { GameEventMap } from "./events";
import {
  Cursor,
  DoorComponent,
  EnergyComponent,
  MouseEvents,
  OpenDoorController,
  Position,
  Sprite,
} from "./components";
import { DbConnection, ErrorContext } from "./module_bindings";
import { Identity } from "spacetimedb";
import { InputManager } from "./input_manager";
import { ProgressBar } from "@pixi/ui";
import { APP_WIDTH, APP_HEIGHT, randomDecorKey, AssetManager } from "./Globals";
import { initDevtools } from "@pixi/devtools";
import { Tween } from "@tweenjs/tween.js";

//"wss://space.codyclaborn.me"
const spacedbUri = "ws://localhost:3000";

(async () => {
  const app = new Application();
  await app.init({
    width: APP_WIDTH,
    height: APP_HEIGHT,
    backgroundColor: 0x222222,
  });
  document.body.appendChild(app.canvas);

  await AssetManager.load();

  const container = new Container();
  container.width = APP_WIDTH;
  container.height = APP_HEIGHT;

  container.eventMode = "static";
  container.on("pointerdown", () => {});

  app.stage.addChild(container);

  const bgSprite = new PSprite(AssetManager.Assets.bg);
  bgSprite.label = "background";
  bgSprite.eventMode = "dynamic";

  container.addChild(bgSprite);

  let world: World<SystemTags, GameEventMap>;

  const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
    localStorage.setItem("auth_token", token);
    console.log(
      "Connected to SpacetimeDB with identity:",
      identity.toHexString()
    );

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
        const door = new PSprite(AssetManager.Assets.door);
        door.anchor.set(0, 0);
        door.eventMode = "dynamic";
        door.x = 296;
        door.y = 44;
        door.label = "door";
        container.addChild(door);

        addComponent(
          createEntity(),
          new OpenDoorController({
            isOpen: false,
            previousState: false,
            tween: new Tween({ yOffset: 0, skew: 0 }),
          })
        );

        addComponent(
          createEntity(),
          new Cursor({
            dragging: undefined,
            listener: new MouseListener(door),
          }),
          new Position({ x: 0, y: 0, yOffset: 0, skew: 0 })
        );

        addComponent(createEntity(), new EnergyComponent({ bar: progressBar }));
        addComponent(
          createEntity(),
          new Position({ x: door.x, y: door.y, yOffset: 0, skew: 0 }),
          new Sprite({ sprite: door }),
          new DoorComponent(),
          new MouseEvents({
            listener: new MouseListener(door),
            onClick: (x, y) => {
              const key = randomDecorKey();

              conn.reducers.createDecor(key, x, y);
            },
          })
        );

        addSystem(
          new MouseInput(),
          new KeyInputSystem({ inputManager: new InputManager(), conn }),
          new SpacetimeDBEventSystem({ listener }),
          new DecorSpawnSystem({ ctx: container, conn }),
          new EnergySystem(),
          new CursorSystem({ conn }),
          new DecorEventSystem(),
          new PositionLimiter(),
          new OpenDoor(),
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
