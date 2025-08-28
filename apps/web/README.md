# Web Application

React client for players. Supports Google OAuth based sign-in, lobby interaction and room listing. After successful authentication it connects to the backend via WebSocket to receive real time updates.

## Configuration

This app uses Google Identity Services. Provide your OAuth client ID via the `GOOGLE_CLIENT_ID` environment variable when running or building the app. You can define it in the repository’s `.env` file or pass it inline:

```
GOOGLE_CLIENT_ID=your-client-id npm run dev
```
