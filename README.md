# PB3 Leaderboards Bot

A Discord Bot for viewing the leaderboard of Poly Bridge 3, with extra features:

-   Global leaderboard
-   Top score history
-   User profiles
-   Histograms of score distribution

Uses Discord.js and TypeScript.

## Environment Variables

To run this project, you will need to add the following environment variables to your `.env` file:

`botToken` - Discord Bot token.

`STEAM_WEBAPI_KEY` - Key for valve's [Steam Web API](https://steamcommunity.com/dev).

`STEAM_USERNAME` - Steam account username.

`STEAM_PASSWORD` - Steam account password.

The steam account must own a copy of Poly Bridge 3 in order to access the leaderboards. It should also have 2FA disabled so the bot can login to it easily. It is advised you create a steam account solely for running the bot!

## Run Locally

Clone the project

```bash
git clone https://github.com/Conqu3red/PB3-Leaderboards-Bot
```

Go to the project directory

```bash
cd PB3-Leaderboards-Bot
```

Install node dependencies

```bash
npm install
```

On Linux, install extra fonts so chinese characters can be rendered:

```bash
sudo apt-get install language-pack-gnome-zh-hans
sudo apt-get install fonts-wqy-microhei
```

Configure environment variables, then start the bot

```bash
npm run bot:dev
```

## Compiling

To build this project, run

```bash
npm run build
```

The compiled javascript code is located in the `dist/` folder in the root of the project.

To run the built version:

```bash
node dist/src/bot/Index.js
```

## Authors

-   [@Conqu3red](https://www.github.com/Conqu3red)
