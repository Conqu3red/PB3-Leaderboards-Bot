import lmdb from "lmdb";

export const database = lmdb.open("score-db", { cache: true });
export default database;
