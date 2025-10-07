use std::{cmp, collections::HashSet};

use spacetimedb::{reducer, table, Identity, ReducerContext, Table, Timestamp};

const ENERGY_MAX: u32 = 100;
const ENERGY_MIN: u32 = 1;

const LIKE_DECOR_ENERGY_GAIN: u32 = 33;
const DELETE_OWN_ENERGY: u32 = 15;
const DELETE_OTHER_ENERGY: u32 = 25;
const CREATE_ENERGY: u32 = 10;
const MODIFY_ENERGY: u32 = 5;

const INTERACTION_LIKE: &str = "LIKE";

#[table(name = user, public)]
pub struct User {
    #[primary_key]
    identity: Identity,
    original_door: Option<u64>,
    energy: u32,
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
    decor_id: u64,
    interaction: String,
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
            energy: 100,
        });

        let door = ctx.db.door().insert(Door {
            owner: user.identity,
            id: 0, // 0 tells db to update it to a unique id
            current_visitor: user.identity,
        });

        ctx.db.user().identity().update(User {
            original_door: Some(door.id),
            ..user
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
    let found_door: Door;

    // find a new door that isn't theirs and doesn't have a visitor
    // otherwise create a new door
    if let Some(new_door) = ctx
        .db
        .door()
        .current_visitor()
        .filter(Identity::ZERO)
        .filter(|d| d.owner != user.identity && !visited.contains(&d.id))
        .next()
    {
        let id = new_door.id;
        log::debug!("Visiting new door {id}");
        found_door = ctx.db.door().id().update(Door {
            current_visitor: user.identity,
            ..new_door
        });
    } else {
        log::debug!("Building new door to visit");
        found_door = ctx.db.door().insert(Door {
            owner: user.identity,
            id: 0,
            current_visitor: user.identity,
        });
    }

    ctx.db.door_visit().insert(DoorVisit {
        visitor: user.identity,
        door_id: found_door.id,
    });

    log::debug!("Giving energy to user");
    ctx.db.user().identity().update(User {
        energy: (user.energy + cmp::min(5, 50 - ((visited_count as u32) * 2)))
            .clamp(ENERGY_MIN, ENERGY_MAX),
        ..user
    });

    Ok(())
}

#[reducer]
pub fn create_decor(ctx: &ReducerContext, key: String, x: u32, y: u32) -> Result<(), String> {
    let user = get_user(ctx)?;
    let energy_needed = CREATE_ENERGY;

    check_has_enough_energy(&user, energy_needed)?;

    let door = ctx
        .db
        .door()
        .current_visitor()
        .filter(user.identity)
        .next()
        .expect("Cannot add a decor if you aren't at a door");

    ctx.db.decor().insert(Decor {
        id: 0,
        door_id: door.id,
        owner: user.identity,
        text: None,
        x,
        y,
        rot: 0,
        key,
        last_modifier: user.identity,
        deleted_at: None,
    });

    ctx.db.user().identity().update(User {
        energy: (user.energy - energy_needed).clamp(ENERGY_MIN, ENERGY_MAX),
        ..user
    });

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
        .expect("Decor does not exist");

    let energy_needed = MODIFY_ENERGY;

    if decor.owner != user.identity {
        check_has_enough_energy(&user, energy_needed)?;

        ctx.db.user().identity().update(User {
            energy: (user.energy - energy_needed).clamp(ENERGY_MIN, ENERGY_MAX),
            ..user
        });

        if let Some(owner) = ctx.db.user().identity().find(decor.owner) {
            ctx.db.user().identity().update(User {
                energy: (owner.energy + energy_needed).clamp(ENERGY_MIN, ENERGY_MAX),
                ..owner
            });
        }
    }

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
        .expect("Decor does not exist");

    let energy_needed = if decor.owner == user.identity {
        DELETE_OWN_ENERGY
    } else {
        DELETE_OTHER_ENERGY
    };

    check_has_enough_energy(&user, energy_needed)?;

    ctx.db.decor().delete(decor);

    ctx.db.user().identity().update(User {
        energy: (user.energy - energy_needed).clamp(ENERGY_MIN, ENERGY_MAX),
        ..user
    });

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
        .expect("Decor does not exist");

    ctx.db.decor().id().update(Decor {
        last_modifier: user.identity,
        text: Some(text),
        ..decor
    });

    Ok(())
}

#[reducer]
pub fn like_decor(ctx: &ReducerContext, decor_id: u64) -> Result<(), String> {
    let acting_user = get_user(ctx)?;
    let decor = ctx
        .db
        .decor()
        .id()
        .find(decor_id)
        .expect("Decor does not exist");

    if let Some(receiving_user) = ctx.db.user().identity().find(decor.owner) {
        ctx.db.interaction().insert(Interaction {
            id: 0,
            actor: acting_user.identity,
            decor_id,
            interaction: INTERACTION_LIKE.to_string(),
        });

        ctx.db.user().identity().update(User {
            energy: (receiving_user.energy + LIKE_DECOR_ENERGY_GAIN).clamp(ENERGY_MIN, ENERGY_MAX),
            ..receiving_user
        });
    } else {
        log::warn!("User no longer exists");
    }

    Ok(())
}

fn get_user(ctx: &ReducerContext) -> Result<User, String> {
    let user = ctx
        .db
        .user()
        .identity()
        .find(ctx.sender)
        .expect("User does not exit");

    Ok(user)
}

fn check_has_enough_energy(user: &User, energy: u32) -> Result<(), String> {
    let user_energy = user.energy;

    if let Some(new_energy) = user_energy.checked_sub(energy) {
        if new_energy < ENERGY_MIN {
            return Err("Not enough energy for action".to_string());
        }
    } else {
        return Err("Not enough energy for action".to_string());
    }

    Ok(())
}
