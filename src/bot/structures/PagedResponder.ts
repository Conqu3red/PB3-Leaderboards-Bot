import Eris from "eris";
import { ComponentCollector } from "../collectors/ComponentCollector";
import { BetterClient } from "./Client";

interface SupportedInteraction {
    member?: Eris.Member;
    user?: Eris.User;
}

function interactionUser<T extends SupportedInteraction>(
    interaction: T
): Eris.Member | Eris.User | undefined {
    return interaction.member ?? interaction.user;
}

export const arrowComponents: Eris.ActionRow[] = [
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
];

export interface GeneratedMessage {
    content: string | Eris.InteractionContent;
    file?: Eris.FileContent | Eris.FileContent[] | undefined;
}

export abstract class PagedResponder {
    client: BetterClient;
    interaction: Eris.CommandInteraction;
    collector: ComponentCollector;
    message?: Eris.Message = undefined;
    page: number = 0;
    pageCount: number;

    constructor(client: BetterClient, interaction: Eris.CommandInteraction, pageCount: number) {
        this.client = client;
        this.interaction = interaction;
        this.pageCount = pageCount;
        this.collector = new ComponentCollector({
            client,
            filter: (i) =>
                i.message?.id === this.message?.id &&
                interactionUser(i)?.id === interactionUser(interaction)?.id,
            time: 2 * 60 * 1000,
        });
    }

    async start() {
        //this.message = await this.interaction.getOriginalMessage();
        await this.updateMessage();

        this.collector.on("collect", async (i: Eris.ComponentInteraction) => {
            this.collector.resetTimer();
            let newPage = this.page;

            switch (i.data.custom_id) {
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

        this.collector.on(
            "end",
            async (interactions: Eris.ComponentInteraction[], reason: string) => {
                if (this.message) {
                    this.message.edit({ components: [] });
                }
            }
        );
    }

    async updateMessage() {
        const message = await this.generateMessage();
        this.message = await this.interaction.editOriginalMessage(message.content, message.file);
    }

    abstract generateMessage(): Promise<GeneratedMessage>;
}
