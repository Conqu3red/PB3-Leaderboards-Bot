import { CommandInteraction } from "discord.js";
import { UserFilter, userMatchesID, userMatchesUsername } from "../../utils/userFilter";
import User from "../models/User";
import { EditMessageType } from "../structures/PagedResponder";
import { error } from "./embeds";

export const DISCORD_USER_PATTERN = /<@!?(\d{17,19})>/;
export const USER_ID_PATTERN = /@([a-zA-Z0-9]+)/;

export async function userMatchesDiscordID(discordID: string): Promise<UserFilter | null> {
    const dbUser = await User.findOne({ where: { discordID } });
    if (dbUser) {
        return userMatchesID(dbUser.polyBridgeID);
    }
    return null;
}

export async function pickUserFilter(user: string): Promise<UserFilter | null> {
    // discord linked account
    let discord = user.match(DISCORD_USER_PATTERN);
    if (discord) {
        return userMatchesDiscordID(discord[1]);
    }

    // user ID
    let user_id = user.match(USER_ID_PATTERN);
    if (user_id) {
        return userMatchesID(user_id[1]);
    }

    // normal username;
    return userMatchesUsername(user);
}

export async function pickUserFilterError(interaction: CommandInteraction) {
    await error(
        interaction,
        "The specified discord user does not have a Poly Bridge account associated with them."
    );
}
