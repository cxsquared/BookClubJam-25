import { query, queryRequired, System } from "@typeonce/ecs";
import { Container, Sprite as PSprite } from "pixi.js";
import {
  DecorAdded,
  DecorDeleted,
  DecorUpdated,
  GameEventMap,
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
import { DbConnection, Decor, User } from "./module_bindings";
import { Identity } from "spacetimedb";
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
  | "OpenDoorSystem";

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

export class MouseListener {
  public isMouseJustDown: boolean = false;
  public isMouseDown: boolean = false;
  public isMouseUp: boolean = false;
  public isMouseJustUp: boolean = false;
  public justEntered: boolean = false;
  public mouseX: number = 0;
  public mouseY: number = 0;
  public sprite: Container;

  constructor(sprite: Container, global: boolean = false) {
    this.sprite = sprite;
    const downEvent = global ? "globalpointerdown" : "pointerdown";
    sprite.on(downEvent, (e) => {
      this.isMouseUp = false;
      this.isMouseJustUp = false;
      this.isMouseDown = true;
      this.isMouseJustDown = true;
      this.mouseX = e.x;
      this.mouseY = e.y;
    });

    const upEvent = global ? "globalpointerup" : "pointerup";
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
}>("DecorSpawn", {
  execute: ({ world, poll, createEntity, addComponent, input: { ctx } }) => {
    const { position: doorPosition, sprite: doorSprite } = doorQuery(world)[0];

    poll(DecorAdded).forEach((event) => {
      const decor = event.data.decor;
      const sprite = new PSprite(AssetManager.Assets[event.data.decor.key]);
      sprite.label = `decor:${decor.id}:${decor.key}`;
      sprite.x = decor.x;
      sprite.y = decor.y;
      sprite.anchor.set(0.5, 0.5);
      ctx.addChild(sprite);
      sprite.eventMode = "dynamic";

      const listener = new MouseListener(sprite);
      const position = new Position({
        x: decor.x,
        y: decor.y,
        yOffset: 0,
        skew: 0,
      });

      const id = createEntity();
      addComponent(
        id,
        position,
        new Sprite({ sprite }),
        new DecorComponent({ decor, inputListener: listener }),
        new PositionLimit({
          x: doorPosition.x,
          y: doorPosition.y,
          width: doorSprite.sprite.width,
          height: doorSprite.sprite.height,
        }),
        new MouseEvents({
          listener,
          onClick: (x, y) => {
            const cursor = cursorQuery(world)[0].cursor;
            cursor.dragging = id;
            position.x = x;
            position.y = y;
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
