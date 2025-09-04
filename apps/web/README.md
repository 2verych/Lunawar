# Web Application

React client for players. Supports Google OAuth based sign-in, lobby interaction and room listing. After successful authentication it connects to the backend via WebSocket to receive real time updates.

Inside a game room the client displays an empty playfield with a mini chat pinned to the side showing the last three messages. Pressing the <code>`</code> key toggles the full chat view with the entire history and input. A leave button is available in the top-left corner of the screen.

## Configuration

This app uses Google Identity Services. Provide your OAuth client ID via the `GOOGLE_CLIENT_ID` environment variable when running or building the app. You can define it in the repository’s `.env` file or pass it inline:

```
GOOGLE_CLIENT_ID=your-client-id npm run dev
```
