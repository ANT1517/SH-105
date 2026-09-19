# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Backend wiring

Every screen talks to real services; nothing in the UI is a canned reply.

| Screen | Data source |
| --- | --- |
| Home / Money Pot Map | Person B `GET /api/financial-state` |
| Ledger | Person B `GET /api/ledger` |
| Goals (Lakshya) | Person B `GET /api/goals` |
| Chat | safety check first (Person C `POST /api/v1/safety/check`), then saathi-nlp understanding; transactions go to Person B `POST /api/transactions`, questions to Person C `POST /api/v1/integration/person_a/guidance` |
| Safety Shield | Person C `POST /api/v1/safety/check` on a message the user pastes in |

- Service URLs are environment variables, one per service (see `.env.example`, read in `src/services/apiConfig.js`).
- Home and Ledger fall back to the bundled sample data (`src/api/fixture.js`) **only** if the live call fails, and then show an
  "offline sample data" banner. Goals shows an error with a retry instead. Chat never falls back to canned text: a failure says nothing was recorded.
- Only Person C may use an LLM for financial content (masterplan section 8). The NLP service only classifies intent and extracts entities.
- Message routing lives in `src/services/messageRouter.js`.

### Tests

```bash
npm test                      # logic layer: config, clients, router, view models, safety trigger, screen guards
cd nlp-service && npm test    # NLP service, including the LLM-boundary tests
```
