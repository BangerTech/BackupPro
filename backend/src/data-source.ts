import { DataSource } from "typeorm";
import { Schedule } from "./entities/Schedule";
import { Target } from "./entities/Target";
import { Backup } from "./entities/Backup";
import { User } from "./entities/User";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    username: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "backup_schedule",
    synchronize: true,
    logging: false,
    entities: [Schedule, Target, Backup, User],
    migrations: [],
    subscribers: [],
}); 