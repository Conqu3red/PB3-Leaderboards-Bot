import lmdb from "lmdb";

export const database = lmdb.open("score-db", {
    cache: true,
    sharedStructuresKey: Symbol.for("structures"),
});
export const userDB = lmdb.open("user-db", {
    cache: true,
    sharedStructuresKey: Symbol.for("structures"),
});
export default database;
