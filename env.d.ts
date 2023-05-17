declare global {
    namespace NodeJS {
        interface ProcessEnv {
            botToken: string;
            STEAM_WEBAPI_KEY: string;
            STEAM_USERNAME: string;
            STEAM_PASSWORD: string;
        }
    }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
