import { ECS, World } from "@typeonce/ecs";
import {
  Application,
  Assets,
  Container,
  Sprite as PSprite,
  Texture,
} from "pixi.js";
import {
  CursorSystem,
  DecorSpawnSystem,
  KeyInputSystem,
  MouseInput,
  MouseListener,
  RenderSystem,
  SpacetimeDBEventSystem,
  SpacetimeDBListener,
  SystemTags,
} from "./systems";
import { GameEventMap } from "./events";
import { Cursor, MouseEvents, Position, Sprite } from "./components";
import { DbConnection, ErrorContext } from "./module_bindings";
import { Identity } from "spacetimedb";
import { InputManager } from "./input_manager";

(async () => {
  const app = new Application();
  await app.init({
    width: 800,
    height: 600,
    backgroundColor: 0x222222,
  });
  document.body.appendChild(app.canvas);

  const container = new Container();
  container.width = 800;
  container.height = 600;

  container.eventMode = "static";
  container.on("pointerdown", () => {});

  app.stage.addChild(container);

  const texture = await Assets.load("./door.png");

  let world: World<SystemTags, GameEventMap>;

  const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
    localStorage.setItem("auth_token", token);
    console.log(
      "Connected to SpacetimeDB with identity:",
      identity.toHexString()
    );

    const listener = new SpacetimeDBListener(conn, identity);

    world = ECS.create<SystemTags, GameEventMap>(
      ({ addComponent, createEntity, addSystem }) => {
        const door = new PSprite(texture);
        door.width = 800 / 3;
        door.height = 600 - 100;
        door.anchor.set(0.5, 0.5);
        door.eventMode = "dynamic";
        door.interactiveChildren = true;
        door.interactive = true;
        container.addChild(door);

        const mListener = new MouseListener(door);
        addComponent(
          createEntity(),
          new Cursor({ dragging: undefined }),
          new Position({ x: 0, y: 0 }),
          new MouseEvents({
            listener: mListener,
            onClick: (x, y) => {
              conn.reducers.createDecor("test", x, y);
            },
          })
        );

        addSystem(
          new MouseInput(),
          new KeyInputSystem({ inputManager: new InputManager(), conn }),
          new SpacetimeDBEventSystem({ listener }),
          new DecorSpawnSystem({ ctx: container }),
          new CursorSystem({ listener: mListener, conn }),
          new RenderSystem()
        );

        addComponent(
          createEntity(),
          new Position({ x: 800 / 2, y: 600 / 2 }),
          new Sprite({ sprite: door })
        );
      }
    );
  };

  const onDisconnect = () => {
    console.log("Disconnected from SpacetimeDB");
  };

  const onConnectError = (_ctx: ErrorContext, err: Error) => {
    console.log("Error connecting to SpacetimeDB:", err);
  };

  const connectionBuilder = DbConnection.builder();
  connectionBuilder
    .withUri("ws://localhost:3000")
    .withModuleName("bookclubjam-25")
    .withToken(localStorage.getItem("auth_token") || undefined)
    .onConnect(onConnect)
    .onDisconnect(onDisconnect)
    .onConnectError(onConnectError)
    .build();

  app.ticker.add(({ deltaTime }) => {
    if (world) world.update(deltaTime);
  });
})();
