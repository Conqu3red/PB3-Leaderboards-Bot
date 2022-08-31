import { Table, Column, Model, DataType, PrimaryKey } from "sequelize-typescript";
import { InferAttributes, InferCreationAttributes } from "sequelize/types";

@Table
export default class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    @PrimaryKey
    @Column(DataType.TEXT)
    declare discordID: string;

    @Column(DataType.TEXT)
    declare polyBridgeID: string;
}
