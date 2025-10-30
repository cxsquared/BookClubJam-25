use spacetimedb::{
    rand::{
        seq::{IteratorRandom, SliceRandom},
        Rng,
    },
    reducer, table, Identity, ReducerContext, Table, Timestamp,
};
use std::collections::HashSet;

#[derive(strum_macros::Display)]
enum InteractionType {
    LikeDoor,
}

const DECOR_KEYS: [&str; 18] = [
    "heart_01",
    "eye_01",
    "cac_01",
    "star_01",
    "paw_01",
    "board_01",
    "board_02",
    "rainbow_01",
    "cat_01",
    "face_01",
    "leaf_01",
    "shroom_01",
    "star_02",
    "lights_01",
    "cac_02",
    "weird_01",
    "char_01",
    "board_03",
];

#[table(name = user, public)]
pub struct User {
    #[primary_key]
    identity: Identity,
    original_door: Option<u64>,
    current_door_number: u8,
    owned_items_deleted: u8,
}

#[table(name = door_visit)]
pub struct DoorVisit {
    #[index(btree)]
    visitor: Identity,
    door_id: u64,
}

#[table(name = door, public)]
pub struct Door {
    #[primary_key]
    #[auto_inc]
    id: u64,
    owner: Identity,
    #[index(btree)]
    current_visitor: Identity,
    number: u8,
}

#[table(name = decor, public)]
pub struct Decor {
    #[primary_key]
    #[auto_inc]
    id: u64,
    door_id: u64,
    owner: Identity,
    text: Option<String>,
    x: u32,
    y: u32,
    rot: u32,
    key: String,
    last_modifier: Identity,
    deleted_at: Option<Timestamp>,
}

#[table(name = interaction)]
pub struct Interaction {
    #[primary_key]
    #[auto_inc]
    id: u64,
    actor: Identity,
    target_user: Identity,
    interaction_type: String,
}

#[table(name=inventory, public)]
pub struct Inventory {
    #[primary_key]
    #[auto_inc]
    id: u64,
    #[index(btree)]
    owner: Identity,
    decor_key: String,
}

#[table(name=package, public)]
pub struct Package {
    #[primary_key]
    #[auto_inc]
    id: u64,
    #[index(btree)]
    door_id: u64,
}

#[table(name=package_item)]
pub struct PackageItem {
    #[primary_key]
    #[auto_inc]
    id: u64,
    #[index(btree)]
    package_id: u64,
    decor_key: String,
}

#[reducer(client_connected)]
/// Called when a client connects to a SpacetimeDB database server
pub fn identity_connected(ctx: &ReducerContext) {
    if ctx.db.user().identity().find(ctx.sender).is_none() {
        // If this is a new user, create a `User` row for the `Identity`,
        // which is online, but hasn't set a name.
        let user = ctx.db.user().insert(User {
            identity: ctx.sender,
            original_door: None,
            current_door_number: 1,
            owned_items_deleted: 0,
        });

        let door = create_door_for_user(ctx, 1, &user);

        ctx.db.user().identity().update(User {
            original_door: Some(door.id),
            current_door_number: 1,
            ..user
        });

        ctx.db.door_visit().insert(DoorVisit {
            visitor: user.identity,
            door_id: door.id,
        });
    }
}

#[reducer]
pub fn enter_door(ctx: &ReducerContext) -> Result<(), String> {
    let user = get_user(ctx)?;
    let user_id = user.identity.to_abbreviated_hex();

    log::info!("Moving user to new door {user_id}");

    // Remove user from their current door (or any door they are attached to)
    for door in ctx.db.door().current_visitor().filter(user.identity) {
        let id = door.id;
        log::debug!("Remove user from door {id}");
        ctx.db.door().id().update(Door {
            current_visitor: Identity::ZERO,
            ..door
        });
    }

    let visited: HashSet<u64> = HashSet::from_iter(
        ctx.db
            .door_visit()
            .visitor()
            .filter(user.identity)
            .map(|v| return v.door_id),
    );
    let visited_count = visited.iter().count();
    let new_visited_count = <usize as TryInto<u8>>::try_into(visited_count).unwrap() + 1;
    let found_door: Door;

    // find a new door that isn't theirs and doesn't have a visitor
    // otherwise create a new door
    if let Some(new_door) = ctx
        .db
        .door()
        .current_visitor()
        .filter(Identity::ZERO)
        .filter(|d| d.owner != user.identity && !visited.contains(&d.id))
        .choose(&mut ctx.rng())
    {
        let id = new_door.id;
        log::debug!("Visiting new door {id}");
        found_door = ctx.db.door().id().update(Door {
            current_visitor: user.identity,
            ..new_door
        });

        let package_count = ctx.db.package().door_id().filter(found_door.id).count();

        if package_count <= 0 {
            add_initial_packages(&ctx, found_door.id);
        }
    } else {
        found_door = create_door_for_user(ctx, new_visited_count, &user);
    }

    ctx.db.user().identity().update(User {
        current_door_number: new_visited_count,
        ..user
    });

    ctx.db.door_visit().insert(DoorVisit {
        visitor: user.identity,
        door_id: found_door.id,
    });

    Ok(())
}

#[reducer]
pub fn create_decor(ctx: &ReducerContext, inventory_id: u64, x: u32, y: u32) -> Result<(), String> {
    let user = get_user(ctx)?;

    let inventory_item = ctx
        .db
        .inventory()
        .id()
        .find(inventory_id)
        .ok_or("Didn't find inventory item {inventory_id}".to_string())?;

    let door = ctx
        .db
        .door()
        .current_visitor()
        .filter(user.identity)
        .next()
        .ok_or("Cannot add a decor if you aren't at a door".to_string())?;

    ctx.db.decor().insert(Decor {
        id: 0,
        door_id: door.id,
        owner: user.identity,
        text: None,
        x,
        y,
        rot: 0,
        key: inventory_item.decor_key,
        last_modifier: user.identity,
        deleted_at: None,
    });

    ctx.db.inventory().id().delete(inventory_item.id);

    Ok(())
}

#[reducer]
pub fn move_decor(
    ctx: &ReducerContext,
    decor_id: u64,
    x: u32,
    y: u32,
    rot: u32,
) -> Result<(), String> {
    let user = get_user(ctx)?;
    let decor = ctx
        .db
        .decor()
        .id()
        .find(decor_id)
        .ok_or("Decor does not exist".to_string())?;

    ctx.db.decor().id().update(Decor {
        last_modifier: user.identity,
        x,
        y,
        rot,
        ..decor
    });

    Ok(())
}

#[reducer]
pub fn delete_decor(ctx: &ReducerContext, decor_id: u64) -> Result<(), String> {
    let user = get_user(ctx)?;
    let decor = ctx
        .db
        .decor()
        .id()
        .find(decor_id)
        .ok_or("Decor does not exist".to_string())?;

    if let Some(owner) = ctx.db.user().identity().find(decor.owner) {
        if owner.identity != user.identity {
            let updated_user = ctx.db.user().identity().update(User {
                owned_items_deleted: owner.owned_items_deleted + 1,
                ..owner
            });

            if updated_user.owned_items_deleted >= 3 {
                ctx.db.user().identity().update(User {
                    owned_items_deleted: 0,
                    ..owner
                });

                if let Some(current_door) = ctx
                    .db
                    .door()
                    .current_visitor()
                    .filter(owner.identity)
                    .next()
                {
                    add_package(ctx, current_door.id);
                } else {
                    log::warn!("User not at door");
                }
            }
        } else {
            ctx.db.inventory().insert(Inventory {
                id: 0,
                owner: owner.identity,
                decor_key: decor.key,
            });
        }
    }

    ctx.db.decor().id().delete(decor.id);

    Ok(())
}

#[reducer]
pub fn update_decor_text(ctx: &ReducerContext, decor_id: u64, text: String) -> Result<(), String> {
    let user = get_user(ctx)?;
    let decor = ctx
        .db
        .decor()
        .id()
        .find(decor_id)
        .ok_or("Decor does not exist".to_string())?;

    ctx.db.decor().id().update(Decor {
        last_modifier: user.identity,
        text: Some(text),
        ..decor
    });

    Ok(())
}

#[reducer]
pub fn like_door(ctx: &ReducerContext, door_id: u64) -> Result<(), String> {
    let acting_user = get_user(ctx)?;
    let door = ctx
        .db
        .decor()
        .id()
        .find(door_id)
        .ok_or("Door does not exist".to_string())?;

    // Checking if door owner exists and giving it a like
    if let Some(receiving_user) = ctx.db.user().identity().find(door.owner) {
        ctx.db.interaction().insert(Interaction {
            id: 0,
            actor: acting_user.identity,
            target_user: receiving_user.identity,
            interaction_type: InteractionType::LikeDoor.to_string(),
        });
    } else {
        log::warn!("User no longer exists");
    }

    // Giving like to the last user that modified the door if they weren't the owner
    if door.owner != door.last_modifier {
        if let Some(receiving_user) = ctx.db.user().identity().find(door.last_modifier) {
            ctx.db.interaction().insert(Interaction {
                id: 0,
                actor: acting_user.identity,
                target_user: receiving_user.identity,
                interaction_type: InteractionType::LikeDoor.to_string(),
            });
        } else {
            log::warn!("User no longer exists");
        }
    }

    Ok(())
}

#[reducer]
pub fn open_package(ctx: &ReducerContext, package_id: u64) -> Result<(), String> {
    let package = ctx
        .db
        .package()
        .id()
        .find(package_id)
        .ok_or("Could not find package {package_id}".to_string())?;

    let package_items = ctx.db.package_item().package_id().filter(package.id);

    for item in package_items {
        ctx.db.inventory().insert(Inventory {
            id: 0,
            owner: ctx.sender,
            decor_key: item.decor_key,
        });

        ctx.db.package_item().id().delete(item.id);
    }

    ctx.db.package().id().delete(package.id);

    Ok(())
}

fn get_user(ctx: &ReducerContext) -> Result<User, String> {
    let user = ctx
        .db
        .user()
        .identity()
        .find(ctx.sender)
        .ok_or("User does not exit".to_string())?;

    Ok(user)
}

fn create_door_for_user(ctx: &ReducerContext, door_number: u8, owner: &User) -> Door {
    log::debug!("Building new door to visit");
    let new_door = ctx.db.door().insert(Door {
        owner: owner.identity,
        id: 0,
        current_visitor: owner.identity,
        number: door_number,
    });

    // build packages
    add_initial_packages(&ctx, new_door.id);

    return new_door;
}

fn add_initial_packages(ctx: &ReducerContext, door_id: u64) {
    let number_of_packages = ctx.rng().gen_range(1..3);

    log::info!("building {number_of_packages} packages for door");

    for _pn in 0..number_of_packages {
        add_package(ctx, door_id);
    }
}

fn add_package(ctx: &ReducerContext, door_id: u64) {
    let new_package = ctx.db.package().insert(Package {
        id: 0,
        door_id: door_id,
    });

    let number_of_decor = ctx.rng().gen_range(3..6);

    log::info!("building {number_of_decor} package items");
    for _pd in 0..number_of_decor {
        let decor_key = random_decor_key(ctx);
        match decor_key {
            Ok(key) => {
                ctx.db.package_item().insert(PackageItem {
                    id: 0,
                    package_id: new_package.id,
                    decor_key: key,
                });
            }
            Err(e) => {
                log::error!("{e}");
            }
        }
    }
}

fn random_decor_key(ctx: &ReducerContext) -> Result<String, String> {
    match DECOR_KEYS.choose(&mut ctx.rng()) {
        Some(key) => Ok(key.to_string()),
        None => return Err("Could not find string key".to_string()),
    }
}
