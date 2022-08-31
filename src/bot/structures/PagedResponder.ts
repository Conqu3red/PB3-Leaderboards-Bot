import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CommandInteraction,
    ComponentType,
    InteractionCollector,
    Message,
    MessagePayload,
    WebhookEditMessageOptions,
} from "discord.js";
import { ExtendedClient } from "./Client";

export const arrowComponents = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId("back_all").setLabel("⏮"),
    new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId("back_one").setLabel("◀️"),
    new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId("forward_one").setLabel("▶️"),
    new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId("forward_all").setLabel("⏭")
);

/* export const arrowComponents: ActionRow<MessageActionRowComponent>[] = [
    {
        type: Eris.Constants.ComponentTypes.ACTION_ROW, // You can have up to 5 action rows, and 1 select menu per action row
        components: [
            {
                type: Eris.Constants.ComponentTypes.BUTTON,
                style: Eris.Constants.ButtonStyles.SECONDARY,
                custom_id: "back_all",
                label: "⏮",
                disabled: false,
            },
            {
                type: Eris.Constants.ComponentTypes.BUTTON,
                style: Eris.Constants.ButtonStyles.SECONDARY,
                custom_id: "back_one",
                label: "◀️",
                disabled: false,
            },
            {
                type: Eris.Constants.ComponentTypes.BUTTON,
                style: Eris.Constants.ButtonStyles.SECONDARY,
                custom_id: "forward_one",
                label: "▶️",
                disabled: false,
            },
            {
                type: Eris.Constants.ComponentTypes.BUTTON,
                style: Eris.Constants.ButtonStyles.SECONDARY,
                custom_id: "forward_all",
                label: "⏭",
                disabled: false,
            },
        ],
    },
]; */

export type EditMessageType = string | MessagePayload | WebhookEditMessageOptions;

export abstract class PagedResponder {
    client: ExtendedClient;
    interaction: CommandInteraction;
    collector?: InteractionCollector<ButtonInteraction>;
    message?: Message = undefined;
    page: number = 0;
    pageCount: number;

    constructor(client: ExtendedClient, interaction: CommandInteraction, pageCount: number) {
        this.client = client;
        this.interaction = interaction;
        this.pageCount = pageCount;
    }

    async start() {
        //this.message = await this.interaction.getOriginalMessage();
        await this.updateMessage();
    }

    async beginCollector() {
        if (this.message) {
            this.collector = this.message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 2 * 60 * 1000,
                filter: (i) => {
                    i.deferUpdate();
                    return (
                        i.message.id === this.message?.id &&
                        i.message.author.id === this.message?.author?.id
                    );
                },
            });

            this.collector.on("collect", async (i) => {
                let newPage = this.page;
                switch (i.customId) {
                    case "back_all":
                        newPage = 0;
                        break;

                    case "back_one":
                        if (newPage > 0) newPage -= 1;
                        break;

                    case "forward_one":
                        if (newPage < this.pageCount - 1) newPage += 1;
                        break;

                    case "forward_all":
                        newPage = this.pageCount - 1;
                        break;
                }

                if (newPage !== this.page) {
                    this.page = newPage;
                    await this.updateMessage();
                }
            });

            this.collector.on("end", async (collected, reason) => {
                if (this.message) {
                    this.message = await this.message.edit({ components: [] });
                }
            });
        }
    }

    async updateMessage() {
        const message = await this.generateMessage();
        this.message = await this.interaction.editReply(message);
        if (!this.collector) await this.beginCollector();
    }
    abstract generateMessage(): Promise<EditMessageType>;
}
