import { ECS, World } from "@typeonce/ecs";
import {
  Application,
  Assets,
  Container,
  Sprite as PSprite,
  Texture,
} from "pixi.js";
import {
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
import { Position, Sprite } from "./components";
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
    const mListener = new MouseListener(container);

    world = ECS.create<SystemTags, GameEventMap>(
      ({ addComponent, createEntity, addSystem }) => {
        addSystem(
          new KeyInputSystem({ inputManager: new InputManager(), conn })
        );
        addSystem(new MouseInput({ listener: mListener, conn }));
        addSystem(new SpacetimeDBEventSystem({ listener }));
        addSystem(new DecorSpawnSystem({ ctx: container }));
        addSystem(new RenderSystem());

        const player = new PSprite(texture);
        player.width = 800 / 3;
        player.height = 600 - 100;
        player.anchor.set(0.5, 0.5);
        container.addChild(player);

        addComponent(
          createEntity(),
          new Position({ x: 800 / 2, y: 600 / 2 }),
          new Sprite({ sprite: player })
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
