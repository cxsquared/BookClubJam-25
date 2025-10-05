import { query, queryRequired, System } from "@typeonce/ecs";
import { Container, Sprite as PSprite, Texture } from "pixi.js";
import {
  DecorAdded,
  DecorDeleted,
  GameEventMap,
  UserEnergyChanged,
} from "./events";
import { DecorComponent, Position, Sprite } from "./components";
import { DbConnection, Decor, User } from "./module_bindings";
import { Identity } from "spacetimedb";
import { InputManager } from "./input_manager";

export type SystemTags =
  | "Render"
  | "DecorSpawn"
  | "SpacetimeDBEventSystem"
  | "MouseInput"
  | "KeyInput";

const SystemFactory = System<SystemTags, GameEventMap>();

const pixiRender = query({
  position: Position,
  sprite: Sprite,
});

const decorQuery = query({
  decor: DecorComponent,
  position: Position,
  sprite: Sprite,
});

export class RenderSystem extends SystemFactory<{}>("Render", {
  execute: ({ world }) => {
    pixiRender(world).forEach(({ sprite, position }) => {
      sprite.sprite.x = position.x;
      sprite.sprite.y = position.y;
    });
  },
}) {}

export class MouseListener {
  public isMouseJustDown: boolean = false;
  public isMouseDown: boolean = false;
  public isMouseUp: boolean = false;
  public isMouseJustUp: boolean = false;
  public mouseX: number = 0;
  public mouseY: number = 0;

  constructor(container: Container) {
    container.addListener("pointerdown", (e) => {
      this.isMouseUp = false;
      this.isMouseJustUp = false;
      this.isMouseDown = true;
      this.isMouseJustDown = true;
      this.mouseX = e.x;
      this.mouseY = e.y;
    });

    container.addListener("pointerup", (e) => {
      this.isMouseDown = false;
      this.isMouseJustDown = false;
      this.isMouseUp = true;
      this.mouseX = e.x;
      this.mouseY = e.y;
    });
  }

  public tick() {
    this.isMouseJustUp = false;
    this.isMouseJustDown = false;
  }
}

export class MouseInput extends SystemFactory<{
  listener: MouseListener;
  conn: DbConnection;
}>("MouseInput", {
  execute: ({ input: { listener, conn } }) => {
    if (listener.isMouseJustDown) {
      conn.reducers.createDecor("test", listener.mouseX, listener.mouseY);
    }

    listener.tick();
  },
}) {}

export class DecorSpawnSystem extends SystemFactory<{
  readonly ctx: Container;
}>("DecorSpawn", {
  execute: ({ poll, createEntity, addComponent, input: { ctx } }) => {
    poll(DecorAdded).forEach((event) => {
      const decor = event.data.decor;
      const player = new PSprite(Texture.WHITE);
      player.width = 32;
      player.height = 32;
      player.anchor.set(0.5, 0.5);
      ctx.addChild(player);

      addComponent(
        createEntity(),
        new Position({ x: decor.x, y: decor.y }),
        new Sprite({ sprite: player }),
        new DecorComponent({ decor })
      );
    });
  },
}) {}

export class SpacetimeDBListener {
  public readonly decorAdded: Decor[];
  public readonly decorDeleted: Decor[];
  public readonly decorUpdated: Decor[];
  public readonly userUpdated: User[];
  public currentDoorId: BigInt = BigInt(0);
  public userSub;
  public doorSub;
  public decorSub;

  constructor(conn: DbConnection, identity: Identity) {
    this.decorAdded = [];
    this.decorDeleted = [];
    this.decorUpdated = [];
    this.userUpdated = [];

    console.log("building listeners");

    this.doorSub = conn
      .subscriptionBuilder()
      .onError((ctx) => {
        console.log(ctx.event);
      })
      .onApplied((ctx) => {
        console.log("door subscribed");
        if (this.currentDoorId == undefined) return;

        for (const door of ctx.db.door.tableCache.iter()) {
          if (door.currentVisitor.isEqual(identity)) {
            console.log("found current door " + door.id);
            this.currentDoorId = door.id;
            break;
          }
        }
      })
      .subscribe([
        `SELECT * FROM door WHERE current_visitor = 0x${identity.toHexString()}`,
      ]);

    this.userSub = conn
      .subscriptionBuilder()
      .onError((ctx) => {
        console.log(ctx.event);
      })
      .onApplied(() => {
        console.log("user subbed");
      })
      .subscribe(
        `SELECT * FROM user WHERE identity = 0x${identity.toHexString()}`
      );

    this.decorSub = conn
      .subscriptionBuilder()
      .onError((ctx) => {
        console.log(ctx.event);
      })
      .onApplied(() => {
        console.log("decor Sub");
      })
      .subscribe(`SELECT * FROM decor WHERE door_id = ${this.currentDoorId}`);

    conn.db.door.onInsert((_ctx, row) => {
      console.log("new door " + row.id);
      this.currentDoorId = row.id;

      const newSubscription = conn
        .subscriptionBuilder()
        .onError((ctx) => {
          console.log(ctx.event);
        })
        .onApplied(() => {
          console.log("new decor sub");
        })
        .subscribe(`SELECT * FROM decor WHERE door_id = ${this.currentDoorId}`);

      if (this.decorSub.isActive()) {
        this.decorSub.unsubscribe();
      }

      this.decorSub = newSubscription;
    });

    conn.db.user.onUpdate((_ctx, _oldRow, newRow) => {
      console.log(
        "user updated " + newRow.identity.toHexString().substring(0, 8)
      );
      this.userUpdated.push(newRow);
    });

    conn.db.decor.onInsert((_, row) => {
      console.log("decor added " + row.id);

      if (this.currentDoorId && row.doorId == this.currentDoorId)
        this.decorAdded.push(row);
    });

    conn.db.decor.onDelete((_, row) => {
      console.log("decor deleted " + row.id);

      this.decorDeleted.push(row);
    });

    conn.db.decor.onUpdate((_ctx, _oldRow, newRow) => {
      console.log("decor updated " + newRow.id);

      this.decorUpdated.push(newRow);
    });
  }
}

export class SpacetimeDBEventSystem extends SystemFactory<{
  readonly listener: SpacetimeDBListener;
}>("SpacetimeDBEventSystem", {
  execute: ({ emit, input: { listener } }) => {
    let updatedUser = listener.userUpdated.shift();
    while (updatedUser) {
      emit({
        type: UserEnergyChanged,
        data: { newEnergy: updatedUser.energy },
      });
      updatedUser = listener.userUpdated.shift();
    }

    let addedDecor = listener.decorAdded.shift();
    while (addedDecor) {
      emit({
        type: DecorAdded,
        data: { decor: addedDecor },
      });
      addedDecor = listener.decorAdded.shift();
    }

    let deletedDecor = listener.decorDeleted.shift();
    while (deletedDecor) {
      emit({
        type: DecorDeleted,
        data: { decor: deletedDecor },
      });
      deletedDecor = listener.decorDeleted.shift();
    }

    let updatedDecor = listener.decorUpdated.shift();
    while (updatedDecor) {
      emit({
        type: DecorDeleted,
        data: { decor: updatedDecor },
      });
      updatedDecor = listener.decorUpdated.shift();
    }
  },
}) {}

export class KeyInputSystem extends SystemFactory<{
  inputManager: InputManager;
  conn: DbConnection;
}>("KeyInput", {
  execute: ({ world, destroyEntity, input: { inputManager, conn } }) => {
    if (inputManager.isKeyPressed("Space")) {
      conn.reducers.enterDoor();

      for (const decor of decorQuery(world)) {
        decor.sprite.sprite.removeFromParent();
        destroyEntity(decor.entityId);
      }
    }

    inputManager.tick();
  },
}) {}
