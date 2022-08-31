import { Sequelize } from "sequelize-typescript";

export const sequelize = new Sequelize({
    database: "db",
    dialect: "sqlite",
    username: "root",
    password: "",
    storage: "db.sqlite",
    models: [__dirname + "/models"],
});
