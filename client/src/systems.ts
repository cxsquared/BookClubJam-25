import { EntityId, query, queryRequired, System } from "@typeonce/ecs";
import { Container, Sprite as PSprite, Rectangle } from "pixi.js";
import {
  DecorAdded,
  DecorDeleted,
  DecorUpdated,
  DeleteDecorFailed,
  DeleteDecorSucceeded,
  FadeEvent,
  GameEventMap,
  InventoryAdded,
  InventoryDeleted,
  MoveDecorFailed,
  MoveDecorSucceeded,
  OpenDoorEvent,
  PackageAdded,
  PackageDeleted,
  UserEnergyChanged,
} from "./events";
import {
  BackgroundComponent,
  Cursor,
  DecorComponent,
  DoorComponent,
  EnergyComponent,
  FadeComponent,
  GrabbedComponent,
  InventoryComponent,
  MouseEvents,
  OpenDoorController,
  PackageComponent,
  Position,
  PositionLimit,
  Sprite,
  TweenComponent,
} from "./components";
import { DbConnection } from "./module_bindings";
import { InputManager } from "./input_manager";
import { APP_HEIGHT, APP_WIDTH, AssetManager, isTextDecor } from "./Globals";
import { Easing, Tween } from "@tweenjs/tween.js";
import { Input } from "@pixi/ui";
import { profanity } from "@2toad/profanity";
import { SpacetimeDBListener } from "./spacetimedb.listener";
import { PositionTween } from "./main";

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
  | "FadeSystem"
  | "DecorEventSystem"
  | "InventoryEventSystem"
  | "PackageEventSystem"
  | "TweenSystem";

const SystemFactory = System<SystemTags, GameEventMap>();

const pixiRender = query({
  position: Position,
  sprite: Sprite,
});

const fadeQuery = queryRequired({
  fade: FadeComponent,
  tween: TweenComponent,
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

let once = false;

export class RenderSystem extends SystemFactory<{}>("Render", {
  execute: ({ world }) => {
    if (!once) {
      pixiRender(world).forEach(({ sprite, position }) => {
        sprite.sprite.x = position.x + position.xOffset;
        sprite.sprite.y = position.y + position.yOffset;
        sprite.sprite.skew.y = position.skew;
      });
    }
  },
}) {}

export class PositionLimiter extends SystemFactory<{}>("PositionLimit", {
  execute: ({ world }) => {
    positionLimitQuery(world).forEach(({ sprite, position, limit }) => {
      const width = sprite.sprite.width;
      const height = sprite.sprite.height;

      if (position.x < limit.x) position.x = limit.x;

      if (position.x > limit.x + limit.width - width)
        position.x = limit.x + limit.width - width;

      if (position.y < limit.y) position.y = limit.y;

      if (position.y > limit.y + limit.height - height)
        position.y = limit.y + limit.height - height;
    });
  },
}) {}

export class DecorEventSystem extends SystemFactory<{}>("DecorEventSystem", {
  dependencies: ["SpacetimeDBEventSystem"],
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
  public sprite: PSprite;
  public id: EntityId;

  constructor(sprite: PSprite, id: EntityId) {
    this.sprite = sprite;
    this.id = id;
    const downEvent = "pointerdown";
    sprite.on(downEvent, (e) => {
      this.isMouseUp = false;
      this.isMouseJustUp = false;
      this.isMouseDown = true;
      this.isMouseJustDown = true;
      this.mouseX = e.screenX;
      this.mouseY = e.screenY;
    });

    const upEvent = "pointerup";
    sprite.on(upEvent, (e) => {
      this.isMouseDown = false;
      this.isMouseJustDown = false;
      this.isMouseUp = true;
      this.mouseX = e.screenX;
      this.mouseY = e.screenY;
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
          e.mouseEvents.listener.id,
          e.mouseEvents.listener.sprite,
          e.mouseEvents.listener.mouseX,
          e.mouseEvents.listener.mouseY
        );
      }

      e.mouseEvents.listener.tick();
    });
  },
}) {}

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

    let inventoryAdded = listener.inventoryAdded.shift();
    while (inventoryAdded) {
      emit({
        type: InventoryAdded,
        data: { inventory: inventoryAdded },
      });
      inventoryAdded = listener.inventoryAdded.shift();
    }

    let inventoryDeleted = listener.inventoryDeleted.shift();
    while (inventoryDeleted) {
      emit({
        type: InventoryDeleted,
        data: { inventory: inventoryDeleted },
      });
      inventoryDeleted = listener.inventoryDeleted.shift();
    }

    let packageAdded = listener.packageAdded.shift();
    while (packageAdded) {
      emit({
        type: PackageAdded,
        data: { package: packageAdded },
      });
      packageAdded = listener.packageAdded.shift();
    }

    let packageDeleted = listener.packageDeleted.shift();
    while (packageDeleted) {
      emit({
        type: PackageDeleted,
        data: { package: packageDeleted },
      });
      packageDeleted = listener.packageDeleted.shift();
    }
  },
}) {}

export class DecorSpawnSystem extends SystemFactory<{
  readonly ctx: Container;
  readonly conn: DbConnection;
}>("DecorSpawn", {
  dependencies: ["SpacetimeDBEventSystem"],
  execute: ({
    world,
    poll,
    createEntity,
    addComponent,
    getComponent,
    input: { ctx, conn },
  }) => {
    const { position: doorPosition, sprite: doorSprite } = doorQuery(world)[0];

    poll(DecorAdded).forEach((event) => {
      const decor = event.data.decor;
      let spriteContainer = new Container();
      spriteContainer.label = `decor:${decor.id}:${decor.key}`;
      spriteContainer.interactiveChildren = true;
      spriteContainer.eventMode = "static";

      const id = createEntity();
      let grabOffsetY = 0;
      let deleteOffsetX = 6;
      let delteOffsetY = 6;

      ctx.addChild(spriteContainer);

      let listener;

      if (isTextDecor(event.data.decor.key)) {
        const bg = new PSprite(AssetManager.Assets[event.data.decor.key]);
        const input = new Input({
          bg,
          padding: [0, 0, 0, 0],
          textStyle: {
            align: "center",
            fontFamily: '"Comic Sans MS", cursive, sans-serif',
            fontSize: 12,
            fontVariant: "small-caps",
            lineHeight: 12,
            wordWrap: true,
            wordWrapWidth: bg.width - 8,
            breakWords: true,
          },
          maxLength: 58,
          value: event.data.decor.text,
          align: "center",
          addMask: true,
        });
        input.interactive = conn.identity && decor.owner.isEqual(conn.identity);
        input.onChange.connect(() => {
          globalThis.editingText = true;
        });
        input.onEnter.connect((newText) => {
          input.value = profanity.censor(newText);
          globalThis.editingText = false;
          conn.reducers.updateDecorText(decor.id, input.value);
        });

        const hanger = new PSprite(AssetManager.Assets.hanger_01);
        hanger.label = "hanger";
        hanger.eventMode = "dynamic";
        hanger.cursor = "grab";
        listener = new MouseListener(hanger, id);

        input.y += hanger.height;

        hanger.on("pointerenter", () => {
          const grabbed = getComponent({ grabbed: GrabbedComponent })(id);

          if (!grabbed?.grabbed) {
            deleteSprite.visible = true;
          }
        });

        spriteContainer.addChild(hanger);
        spriteContainer.addChild(input);

        spriteContainer.width = bg.width;
        spriteContainer.height = bg.height + hanger.height;
        spriteContainer.scale = 1;

        deleteOffsetX = hanger.width / 2 - 22;
        grabOffsetY = -input.height / 2 - hanger.height / 2;
      } else {
        const sprite = new PSprite(AssetManager.Assets[event.data.decor.key]);
        sprite.cursor = "grab";
        sprite.anchor.set(0, 0);
        sprite.eventMode = "dynamic";

        listener = new MouseListener(sprite, id);
        spriteContainer.addChild(sprite);

        sprite.on("pointerenter", () => {
          const grabbed = getComponent({ grabbed: GrabbedComponent })(id);

          if (!grabbed?.grabbed) {
            deleteSprite.visible = true;
          }
        });

        spriteContainer.width = sprite.width;
        spriteContainer.height = sprite.height;
      }

      const deleteSprite = new PSprite(AssetManager.Assets.delete);
      deleteSprite.visible = false;
      deleteSprite.x = spriteContainer.width - deleteOffsetX;
      deleteSprite.y = -delteOffsetY;
      deleteSprite.hitArea = new Rectangle(
        0,
        0,
        deleteSprite.width,
        deleteSprite.height
      );
      deleteSprite.eventMode = "dynamic";
      deleteSprite.on("pointerdown", (e) => {
        conn.reducers.deleteDecor(decor.id);
        e.stopPropagation();
      });

      spriteContainer.addChild(deleteSprite);

      spriteContainer.x = decor.x - spriteContainer.width / 2;
      spriteContainer.y = decor.y - spriteContainer.height / 2;

      spriteContainer.eventMode = "static";
      spriteContainer.interactiveChildren = true;
      spriteContainer.on("pointerleave", (e) => {
        deleteSprite.visible = false;
      });

      const position = new Position({
        x: spriteContainer.x,
        y: spriteContainer.y,
        xOffset: 0,
        yOffset: 0,
        skew: 0,
      });

      const cursor = cursorQuery(world)[0];
      const onClick = (id: EntityId, sprite: PSprite, x: number, y: number) => {
        sprite.cursor = "grabbing";
        cursor.cursor.grabbedEvents.push({
          id,
          component: new GrabbedComponent({
            xOffset: position.x - x,
            yOffset: grabOffsetY,
            sprite,
          }),
        });

        deleteSprite.visible = false;
      };

      const decorComp = new DecorComponent({
        decor,
        inputListener: listener,
        originalPosition: new Position({
          x: decor.x,
          y: decor.y,
          xOffset: 0,
          yOffset: 0,
          skew: 0,
        }),
        deleteSprite,
      });
      addComponent(
        id,
        position,
        new Sprite({ sprite: spriteContainer }),
        decorComp,
        new PositionLimit({
          x: doorPosition.x,
          y: doorPosition.y,
          width: doorSprite.sprite.width,
          height: doorSprite.sprite.height,
        }),
        new MouseEvents({
          listener,
          onClick,
        })
      );
    });
  },
}) {}

const inventoryQuery = queryRequired({
  inventory: InventoryComponent,
});

export class InventoryEventSystem extends SystemFactory<{}>(
  "InventoryEventSystem",
  {
    dependencies: ["SpacetimeDBEventSystem"],
    execute: ({ world, poll }) => {
      const { inventory } = inventoryQuery(world)[0];

      poll(InventoryAdded).forEach(({ data }) => {
        inventory.inventory.push(data.inventory);
      });

      poll(InventoryDeleted).forEach(({ data }) => {
        const index = inventory.inventory.indexOf(data.inventory);
        inventory.inventory.splice(index);
      });
    },
  }
) {}

const packageQuery = query({
  package: PackageComponent,
  sprite: Sprite,
});

export class PackageEventSystem extends SystemFactory<{
  container: Container;
  conn: DbConnection;
}>("PackageEventSystem", {
  dependencies: ["SpacetimeDBEventSystem"],
  execute: ({
    world,
    poll,
    createEntity,
    addComponent,
    getComponent,
    destroyEntity,
    input: { container, conn },
  }) => {
    const existingPackages = packageQuery(world);

    poll(PackageDeleted).forEach(({ data }) => {
      const packageToDelete = existingPackages.find(
        (ep) => ep.package.package.id === data.package.id
      );

      if (packageToDelete) {
        destroyEntity(packageToDelete.entityId);

        packageToDelete.sprite.sprite.destroy();
      }
    });

    poll(PackageAdded).forEach(({ data }) => {
      const entityId = createEntity();

      const sprite = new PSprite(AssetManager.Assets.package);
      sprite.label = `package:${data.package.id}`;
      sprite.interactive = true;

      const x =
        APP_WIDTH / 2 + Math.random() * (APP_WIDTH / 2) - sprite.width - 5;
      const y = APP_HEIGHT - sprite.height + 5;

      sprite.x = x;
      sprite.y = y;

      sprite.zIndex = 50;
      container.addChild(sprite);

      const listener = new MouseListener(sprite, entityId);

      addComponent(
        entityId,
        new PackageComponent({
          package: data.package,
        }),
        new Position({
          x: x,
          y: y,
          xOffset: 0,
          yOffset: 0,
          skew: 0,
        }),
        new Sprite({
          sprite: sprite,
        }),
        new MouseEvents({
          listener: listener,
          onClick: (id, _sprite, _x, _y) => {
            const packageItem = getComponent({
              package: PackageComponent,
            })(id);

            if (packageItem) {
              conn.reducers.openPackage(packageItem.package.package.id);
            }
          },
        })
      );
    });
  },
}) {}

const backgroundQuery = queryRequired({
  background: BackgroundComponent,
  sprite: Sprite,
  position: Position,
});

export class KeyInputSystem extends SystemFactory<{
  inputManager: InputManager;
}>("KeyInput", {
  execute: ({ world, emit, input: { inputManager } }) => {
    if (!globalThis.editingText && inputManager.isKeyPressed("Space")) {
      const openDoor = openDoorQuery(world)[0];
      if (!openDoor.openController.isRunning) {
        emit({
          type: OpenDoorEvent,
          data: {},
        });
      }
    }

    inputManager.tick();
  },
}) {}

const grabbedQuery = query({
  grabbed: GrabbedComponent,
  sprite: Sprite,
  position: Position,
  decor: DecorComponent,
});

export class CursorSystem extends SystemFactory<{
  conn: DbConnection;
}>("CursorSystem", {
  execute: ({ world, addComponent, removeComponent, input: { conn } }) => {
    const cursorEntity = cursorQuery(world)[0];

    cursorEntity.position.x = cursorEntity.cursor.listener.mouseX;
    cursorEntity.position.y = cursorEntity.cursor.listener.mouseY;

    cursorEntity.cursor.grabbedEvents.forEach(({ id, component }) => {
      addComponent(id, component);
    });
    cursorEntity.cursor.grabbedEvents = [];

    grabbedQuery(world).forEach(
      ({ entityId, grabbed, sprite, position, decor }) => {
        position.x =
          cursorEntity.cursor.listener.mouseX - sprite.sprite.width / 2;
        position.y =
          cursorEntity.cursor.listener.mouseY -
          sprite.sprite.height / 2 -
          grabbed.yOffset;

        if (
          decor.inputListener.isMouseJustUp ||
          decor.inputListener.isMouseUp
        ) {
          grabbed.sprite.cursor = "grab";
          removeComponent(entityId, GrabbedComponent);
          conn.reducers.moveDecor(
            decor.decor.id,
            cursorEntity.cursor.listener.mouseX,
            cursorEntity.cursor.listener.mouseY,
            0
          );
        }
      }
    );
  },
}) {}

const energyBarQuery = query({
  energyComponent: EnergyComponent,
});

export class EnergySystem extends SystemFactory<{}>("EnergySystem", {
  dependencies: ["SpacetimeDBEventSystem"],
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
  tween: TweenComponent<PositionTween>,
});

const openYOffset = -350;
const openXOffset = 400;
const openYSkew = -1.4;
export class OpenDoorSystem extends SystemFactory<{
  conn: DbConnection;
}>("OpenDoorSystem", {
  dependencies: ["TweenSystem"],
  execute: ({ world, emit, poll, input: { conn } }) => {
    poll(OpenDoorEvent).forEach(() => {
      const { openController, tween } = openDoorQuery(world)[0];
      const door = doorQuery(world)[0];
      const decorItems = decorQuery(world);
      const background = backgroundQuery(world)[0];

      openController.isRunning = true;

      tween.tween.onUpdate((values) => {
        door.position.yOffset = values.yOffset;
        door.position.xOffset = values.xOffset;
        door.position.skew = values.skew;
        door.sprite.sprite.scale = values.bgScale;
        background.sprite.sprite.scale = values.bgScale;
        decorItems.forEach((decor) => {
          decor.position.yOffset = values.yOffset * 0.25;
          decor.position.xOffset = values.xOffset;
          decor.position.skew = values.skew;
          decor.sprite.sprite.scale = values.bgScale;
        });
      });

      tween.onComplete = ({ emit, destroyEntity }) => {
        tween.tween = new Tween({
          xOffset: 0,
          yOffset: 0,
          skew: 0,
          bgScale: 1,
        });
        tween.tween.easing(Easing.Exponential.InOut);
        openController.isRunning = false;
        door.sprite.sprite.scale = 1;
        door.position.skew = 0;
        door.position.yOffset = 0;
        door.position.xOffset = 0;
        conn.reducers.enterDoor();

        emit({
          type: FadeEvent,
          data: {
            isFadeOut: false,
          },
        });

        background.sprite.sprite.scale = 1;

        for (const decor of decorQuery(world)) {
          decor.sprite.sprite.removeFromParent();
          destroyEntity(decor.entityId);
        }
      };

      tween.tween
        .to(
          {
            yOffset: openYOffset,
            xOffset: openXOffset,
            skew: openYSkew,
            bgScale: 5,
          },
          1000
        )
        .onComplete(() => {
          tween.justCompleted = true;
        })
        .start();

      emit({
        type: FadeEvent,
        data: {
          isFadeOut: true,
        },
      });
    });
  },
}) {}

export class FadeSystem extends SystemFactory<{}>("FadeSystem", {
  dependencies: ["OpenDoorSystem", "KeyInput", "TweenSystem"],
  execute: ({ world, poll }) => {
    const { tween } = fadeQuery(world)[0];

    poll(FadeEvent).forEach(({ data }) => {
      if (data.isFadeOut) {
        tween.tween.stop();
        tween.tween.to(
          {
            alpha: 1,
          },
          1000
        );
      } else {
        tween.tween.stop();
        tween.tween.to(
          {
            alpha: 0,
          },
          250
        );
      }

      tween.tween.startFromCurrentValues();
    });
  },
}) {}

const tweenQuery = query({
  tween: TweenComponent,
});

export class TweenSystem extends SystemFactory<{}>("TweenSystem", {
  execute: (exe) => {
    const { world } = exe;
    tweenQuery(world).forEach(({ tween }) => {
      tween.tween.update();

      if (tween.justCompleted) {
        if (tween.onComplete) tween.onComplete(exe);

        tween.justCompleted = false;
      }
    });
  },
}) {}
