import { query, queryRequired, System } from "@typeonce/ecs";
import { Container, Sprite as PSprite, Rectangle } from "pixi.js";
import {
  DecorAdded,
  DecorDeleted,
  DecorUpdated,
  DeleteDecorFailed,
  DeleteDecorSucceeded,
  GameEventMap,
  MoveDecorFailed,
  MoveDecorSucceeded,
  UserEnergyChanged,
} from "./events";
import {
  Cursor,
  DecorComponent,
  DoorComponent,
  EnergyComponent,
  MouseEvents,
  OpenDoorController,
  Position,
  PositionLimit,
  Sprite,
} from "./components";
import {
  DbConnection,
  Decor,
  DeleteDecor,
  MoveDecor,
  User,
} from "./module_bindings";
import { Identity, ReducerEvent } from "spacetimedb";
import { InputManager } from "./input_manager";
import { AssetManager } from "./Globals";
import { Tween } from "@tweenjs/tween.js";

export type SystemTags =
  | "Render"
  | "PositionLimit"
  | "DecorSpawn"
  | "SpacetimeDBEventSystem"
  | "MouseInput"
  | "KeyInput"
  | "EnergySystem"
  | "CursorSystem"
  | "OpenDoorSystem"
  | "DecorEventSystem";

const SystemFactory = System<SystemTags, GameEventMap>();

const pixiRender = query({
  position: Position,
  sprite: Sprite,
});

const doorQuery = queryRequired({
  door: DoorComponent,
  position: Position,
  sprite: Sprite,
});

const cursorQuery = queryRequired({
  cursor: Cursor,
  position: Position,
});

const decorQuery = query({
  decor: DecorComponent,
  position: Position,
  sprite: Sprite,
});

const mouseListenerQuery = query({
  mouseEvents: MouseEvents,
});

const positionLimitQuery = query({
  limit: PositionLimit,
  position: Position,
  sprite: Sprite,
});

export class RenderSystem extends SystemFactory<{}>("Render", {
  execute: ({ world }) => {
    pixiRender(world).forEach(({ sprite, position }) => {
      sprite.sprite.x = position.x;
      sprite.sprite.y = position.y + position.yOffset;
      sprite.sprite.skew.y = position.skew;
    });
  },
}) {}

export class PositionLimiter extends SystemFactory<{}>("PositionLimit", {
  execute: ({ world }) => {
    positionLimitQuery(world).forEach(({ sprite, position, limit }) => {
      const width = sprite.sprite.width;
      const height = sprite.sprite.height;
      const centerX = width / 2 + position.x;
      const centerY = height / 2 + position.y;

      if (centerX < limit.x) position.x = limit.x + width;

      if (centerX > limit.x + limit.width)
        position.x = limit.x + limit.width - width;

      if (centerY < limit.y) position.y = limit.y + height;

      if (centerY > limit.y + limit.height)
        position.y = limit.y + limit.height - height;
    });
  },
}) {}

export class DecorEventSystem extends SystemFactory<{}>("DecorEventSystem", {
  execute: ({ world, poll, destroyEntity }) => {
    poll(MoveDecorFailed).forEach(({ data }) => {
      const decor = decorQuery(world).find(
        (d) => d.decor.decor.id === data.event.reducer.args.decorId
      );

      if (decor) {
        decor.position.x = decor.decor.originalPosition.x;
        decor.position.y = decor.decor.originalPosition.y;
      }
    });

    poll(MoveDecorSucceeded).forEach(({ data }) => {
      const decor = decorQuery(world).find(
        (d) => d.decor.decor.id === data.event.reducer.args.decorId
      );

      if (decor) {
        decor.decor.originalPosition.x = decor.position.x;
        decor.decor.originalPosition.y = decor.position.y;
      }
    });

    poll(DeleteDecorFailed).forEach(({ data }) => {
      const decor = decorQuery(world).find(
        (d) => d.decor.decor.id === data.event.reducer.args.decorId
      );

      if (decor) {
        decor.sprite.sprite.interactive = true;
      }
    });

    poll(DeleteDecorSucceeded).forEach(({ data }) => {
      const decor = decorQuery(world).find(
        (d) => d.decor.decor.id === data.event.reducer.args.decorId
      );

      if (decor) {
        decor.sprite.sprite.removeFromParent();
        destroyEntity(decor.entityId);
      }
    });
  },
}) {}

export class MouseListener {
  public isMouseJustDown: boolean = false;
  public isMouseDown: boolean = false;
  public isMouseUp: boolean = false;
  public isMouseJustUp: boolean = false;
  public justEntered: boolean = false;
  public mouseX: number = 0;
  public mouseY: number = 0;
  public sprite: Container;

  constructor(sprite: Container) {
    this.sprite = sprite;
    const downEvent = "pointerdown";
    sprite.on(downEvent, (e) => {
      this.isMouseUp = false;
      this.isMouseJustUp = false;
      this.isMouseDown = true;
      this.isMouseJustDown = true;
      this.mouseX = e.x;
      this.mouseY = e.y;
    });

    const upEvent = "pointerup";
    sprite.on(upEvent, (e) => {
      this.isMouseDown = false;
      this.isMouseJustDown = false;
      this.isMouseUp = true;
      this.mouseX = e.x;
      this.mouseY = e.y;
    });

    sprite.on("globalpointermove", (e) => {
      this.mouseX = e.screenX;
      this.mouseY = e.screenY;
    });
  }

  public tick() {
    this.isMouseJustUp = false;
    this.isMouseJustDown = false;
  }
}

export class MouseInput extends SystemFactory<{}>("MouseInput", {
  execute: ({ world }) => {
    mouseListenerQuery(world).forEach((e) => {
      if (e.mouseEvents.listener.isMouseJustDown) {
        e.mouseEvents.onClick(
          e.mouseEvents.listener.mouseX,
          e.mouseEvents.listener.mouseY
        );
      }

      e.mouseEvents.listener.tick();
    });
  },
}) {}

export class DecorSpawnSystem extends SystemFactory<{
  readonly ctx: Container;
  readonly conn: DbConnection;
}>("DecorSpawn", {
  execute: ({
    world,
    poll,
    createEntity,
    addComponent,
    input: { ctx, conn },
  }) => {
    const { position: doorPosition, sprite: doorSprite } = doorQuery(world)[0];

    poll(DecorAdded).forEach((event) => {
      const decor = event.data.decor;
      const sprite = new PSprite(AssetManager.Assets[event.data.decor.key]);
      sprite.label = `decor:${decor.id}:${decor.key}`;
      sprite.x = decor.x;
      sprite.y = decor.y;
      sprite.cursor = "pointer";
      sprite.anchor.set(0.5, 0.5);
      ctx.addChild(sprite);
      sprite.eventMode = "static";

      const listener = new MouseListener(sprite);
      const position = new Position({
        x: decor.x,
        y: decor.y,
        yOffset: 0,
        skew: 0,
      });

      const cursor = cursorQuery(world)[0].cursor;

      const deleteSprite = new PSprite(AssetManager.Assets.delete);
      deleteSprite.visible = false;
      deleteSprite.x = sprite.width / 2 - 2;
      deleteSprite.y = -sprite.height / 2 - 6;
      deleteSprite.hitArea = new Rectangle(
        0,
        0,
        deleteSprite.width,
        deleteSprite.height
      );
      deleteSprite.eventMode = "static";
      deleteSprite.on("pointerdown", (e) => {
        conn.reducers.deleteDecor(decor.id);
        e.stopPropagation();
      });

      sprite.addChild(deleteSprite);

      const id = createEntity();

      sprite.on("pointerenter", () => {
        if (!cursor.dragging) {
          deleteSprite.visible = true;
        }
      });

      sprite.on("pointerleave", () => {
        deleteSprite.visible = false;
      });

      const decorComp = new DecorComponent({
        decor,
        inputListener: listener,
        originalPosition: new Position({
          x: decor.x,
          y: decor.y,
          yOffset: 0,
          skew: 0,
        }),
        deleteSprite,
      });
      addComponent(
        id,
        position,
        new Sprite({ sprite }),
        decorComp,
        new PositionLimit({
          x: doorPosition.x,
          y: doorPosition.y,
          width: doorSprite.sprite.width,
          height: doorSprite.sprite.height,
        }),
        new MouseEvents({
          listener,
          onClick: (x, y) => {
            cursor.dragging = id;

            position.x = x;
            position.y = y;

            deleteSprite.visible = false;
          },
        })
      );
    });
  },
}) {}

export class SpacetimeDBListener {
  public readonly decorAdded: Decor[];
  public readonly decorDeleted: Decor[];
  public readonly decorUpdated: Decor[];
  public readonly userUpdated: User[];

  public readonly moveDecorEvent: ReducerEvent<{
    name: "MoveDecor";
    args: MoveDecor;
  }>[];

  public readonly deleteDecorEvent: ReducerEvent<{
    name: "DeleteDecor";
    args: DeleteDecor;
  }>[];

  public currentDoorId: BigInt = BigInt(0);
  public userSub;
  public doorSub;
  public decorSub;

  constructor(conn: DbConnection, identity: Identity) {
    this.decorAdded = [];
    this.decorDeleted = [];
    this.decorUpdated = [];
    this.userUpdated = [];
    this.moveDecorEvent = [];
    this.deleteDecorEvent = [];

    console.log("building listeners");

    conn.reducers.onMoveDecor((ctx) => {
      this.moveDecorEvent.push(
        ctx.event as ReducerEvent<{
          name: "MoveDecor";
          args: MoveDecor;
        }>
      );
    });

    conn.reducers.onDeleteDecor((ctx) => {
      this.deleteDecorEvent.push(
        ctx.event as ReducerEvent<{
          name: "DeleteDecor";
          args: DeleteDecor;
        }>
      );
    });

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

    conn.db.user.onInsert((_ctx, row) => {
      this.userUpdated.push(row);
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
        type: DecorUpdated,
        data: { decor: updatedDecor },
      });
      updatedDecor = listener.decorUpdated.shift();
    }

    let failedMoveDecor = listener.moveDecorEvent.shift();
    while (failedMoveDecor) {
      if (failedMoveDecor.status.tag === "Committed") {
        emit({
          type: MoveDecorSucceeded,
          data: { event: failedMoveDecor },
        });
      } else if (failedMoveDecor.status.tag === "Failed") {
        emit({
          type: MoveDecorFailed,
          data: { event: failedMoveDecor },
        });
      }
      failedMoveDecor = listener.moveDecorEvent.shift();
    }

    let failedDeleteDecor = listener.deleteDecorEvent.shift();
    while (failedDeleteDecor) {
      if (failedDeleteDecor.status.tag === "Failed") {
        emit({
          type: DeleteDecorFailed,
          data: { event: failedDeleteDecor },
        });
      } else if (failedDeleteDecor.status.tag === "Committed") {
        emit({
          type: DeleteDecorSucceeded,
          data: { event: failedDeleteDecor },
        });
      }
      failedDeleteDecor = listener.deleteDecorEvent.shift();
    }
  },
}) {}

export class KeyInputSystem extends SystemFactory<{
  inputManager: InputManager;
  conn: DbConnection;
}>("KeyInput", {
  execute: ({ world, destroyEntity, input: { inputManager, conn } }) => {
    if (inputManager.isKeyPressed("Space")) {
      const openDoor = openDoorQuery(world)[0];
      const door = doorQuery(world)[0];

      openDoor.openController.isOpen = true;

      openDoor.openController.tween.onComplete(() => {
        openDoor.openController.tween = new Tween({ yOffset: 0, skew: 0 });
        door.position.skew = 0;
        door.position.yOffset = 0;
        conn.reducers.enterDoor();
        openDoor.openController.isOpen = false;
        openDoor.openController.previousState = false;

        for (const decor of decorQuery(world)) {
          decor.sprite.sprite.removeFromParent();
          destroyEntity(decor.entityId);
        }
      });
    }

    inputManager.tick();
  },
}) {}

export class CursorSystem extends SystemFactory<{
  conn: DbConnection;
}>("CursorSystem", {
  execute: ({ getComponent, world, input: { conn } }) => {
    const cursorEntity = cursorQuery(world)[0];

    cursorEntity.position.x = cursorEntity.cursor.listener.mouseX;
    cursorEntity.position.y = cursorEntity.cursor.listener.mouseY;

    if (cursorEntity.cursor.dragging) {
      const decorEntity = getComponent({
        decor: DecorComponent,
        position: Position,
      })(cursorEntity.cursor.dragging);

      if (decorEntity) {
        decorEntity.position.x = cursorEntity.cursor.listener.mouseX;
        decorEntity.position.y = cursorEntity.cursor.listener.mouseY;

        if (
          decorEntity.decor.inputListener.isMouseJustUp ||
          decorEntity.decor.inputListener.isMouseUp
        ) {
          cursorEntity.cursor.dragging = undefined;
          conn.reducers.moveDecor(
            decorEntity.decor.decor.id,
            cursorEntity.cursor.listener.mouseX,
            cursorEntity.cursor.listener.mouseY,
            0
          );
        }
      }
    }
  },
}) {}

const energyBarQuery = query({
  energyComponent: EnergyComponent,
});

export class EnergySystem extends SystemFactory<{}>("EnergySystem", {
  execute: ({ poll, world }) => {
    const energyBars = energyBarQuery(world);
    poll(UserEnergyChanged).forEach((event) => {
      energyBars.forEach((eb) => {
        eb.energyComponent.bar.progress = event.data.newEnergy;
      });
    });
  },
}) {}

const openDoorQuery = queryRequired({
  openController: OpenDoorController,
});

const openYOffset = 23;
const openYSkew = -0.1;
export class OpenDoor extends SystemFactory<{}>("OpenDoorSystem", {
  execute: ({ world }) => {
    const { openController } = openDoorQuery(world)[0];

    const door = doorQuery(world)[0];
    const decorItems = decorQuery(world);

    if (openController.isOpen) {
      door.position.yOffset = openYOffset;
      door.position.skew = openYSkew;
      decorItems.forEach((decor) => {
        decor.position.yOffset = openYOffset * 0.25;
        decor.position.skew = openYSkew;
      });
    }

    if (
      openController.isOpen === openController.previousState &&
      !openController.tween.isPlaying()
    ) {
      return;
    }

    openController.tween.onUpdate((values) => {
      door.position.yOffset = values.yOffset;
      door.position.skew = values.skew;
      decorItems.forEach((decor) => {
        decor.position.yOffset = values.yOffset * 0.25;
        decor.position.skew = values.skew;
      });
    });

    if (openController.isOpen && !openController.previousState) {
      openController.tween.to({ yOffset: openYOffset, skew: openYSkew });
      openController.tween.startFromCurrentValues();
    } else if (!openController.isOpen && openController.previousState) {
      openController.tween.to({ yOffset: 0, skew: 0 });
      openController.tween.startFromCurrentValues();
    }

    if (!openController.tween.isPlaying()) {
      openController.tween.start();
    }
    openController.tween.update();

    openController.previousState = openController.isOpen;
  },
}) {}
