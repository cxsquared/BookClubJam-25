import { Identity, ReducerEvent } from "spacetimedb";
import {
  DbConnection,
  Decor,
  DeleteDecor,
  Inventory,
  MoveDecor,
  Package,
  User,
} from "./module_bindings";

export class SpacetimeDBListener {
  public readonly decorAdded: Decor[] = [];
  public readonly decorDeleted: Decor[] = [];
  public readonly decorUpdated: Decor[] = [];
  public readonly userUpdated: User[] = [];
  public readonly inventoryAdded: Inventory[] = [];
  public readonly inventoryDeleted: Inventory[] = [];
  public readonly packageAdded: Package[] = [];
  public readonly packageDeleted: Package[] = [];

  public readonly moveDecorEvent: ReducerEvent<{
    name: "MoveDecor";
    args: MoveDecor;
  }>[] = [];

  public readonly deleteDecorEvent: ReducerEvent<{
    name: "DeleteDecor";
    args: DeleteDecor;
  }>[] = [];

  public currentDoorId: BigInt = BigInt(0);
  public userSub;
  public doorSub;
  public decorSub;
  public inventorySub;
  public packageSub;

  constructor(conn: DbConnection, identity: Identity) {
    console.log("building listeners");

    // Door
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

    conn.db.door.onInsert((_ctx, row) => {
      console.log("new door " + row.id);
      this.currentDoorId = row.id;

      const newDecorSubscription = conn
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

      this.decorSub = newDecorSubscription;

      const newPackageSubscription = conn
        .subscriptionBuilder()
        .onError((ctx) => {
          console.log(ctx.event);
        })
        .onApplied(() => {
          console.log("new package sub");
        })
        .subscribe(
          `SELECT * FROM package WHERE door_id = ${this.currentDoorId}`
        );

      if (this.packageSub.isActive()) {
        this.packageSub.unsubscribe();
      }

      this.packageSub = newPackageSubscription;
    });

    // User
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

    conn.db.user.onInsert((_ctx, row) => {
      this.userUpdated.push(row);
    });

    conn.db.user.onUpdate((_ctx, _oldRow, newRow) => {
      console.log(
        "user updated " + newRow.identity.toHexString().substring(0, 8)
      );
      this.userUpdated.push(newRow);
    });

    // package
    this.packageSub = conn
      .subscriptionBuilder()
      .onError((ctx) => {
        console.log(ctx.event);
      })
      .onApplied(() => {
        console.log("package Sub");
      })
      .subscribe(`SELECT * FROM package WHERE door_id = ${this.currentDoorId}`);

    conn.db.package.onInsert((_, row) => {
      console.log("package added " + row.id);

      if (this.currentDoorId && row.doorId == this.currentDoorId)
        this.packageAdded.push(row);
    });

    conn.db.package.onDelete((_, row) => {
      console.log("package deleted " + row.id);

      this.packageDeleted.push(row);
    });

    // inventory
    this.inventorySub = conn
      .subscriptionBuilder()
      .onError((ctx) => {
        console.log(ctx.event);
      })
      .onApplied(() => {
        console.log("inventory Sub");
      })
      .subscribe(
        `SELECT * FROM inventory WHERE owner = 0x${identity.toHexString()}`
      );

    conn.db.inventory.onInsert((_, row) => {
      console.log("inventory added " + row.id);

      this.inventoryAdded.push(row);
    });

    conn.db.inventory.onDelete((_, row) => {
      console.log("inventory deleted" + row.id);

      this.inventoryDeleted.push(row);
    });

    // Decor
    this.decorSub = conn
      .subscriptionBuilder()
      .onError((ctx) => {
        console.log(ctx.event);
      })
      .onApplied(() => {
        console.log("decor Sub");
      })
      .subscribe(`SELECT * FROM decor WHERE door_id = ${this.currentDoorId}`);

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
  }
}
