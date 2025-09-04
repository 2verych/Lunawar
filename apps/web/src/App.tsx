import React, { useEffect, useRef, useState } from 'react';
import {
  CHANNEL_LOBBY,
  CHANNEL_ROOM,
  CHANNEL_USER,
  LOBBY_JOINED,
  ROOM_CREATED,
  ROOM_USER_JOINED,
  ROOM_USER_LEFT
} from '@lunawar/shared/src/events';
import type { LobbySnapshot, RoomInfo, User } from '@lunawar/shared/src/types';
import { l } from '@lunawar/shared/src/i18n';
import { CONFIG_ROOM_SIZE, CONFIG_AUTO_MATCH } from '@lunawar/shared/src/redisKeys';

interface CredentialResponse { credential: string }

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch('/me').then(async (r) => {
      if (r.status === 200) {
        const d = await r.json();
        setUser(d.user);
      } else if (r.status === 401) {
        // user remains null
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/lobby').then(r => r.json()).then((d) => setLobby(d.snapshot));
    fetch('/rooms').then(r => r.json()).then((d) => setRooms(d.rooms));

    const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws`);
    wsRef.current = ws;
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ channels: [CHANNEL_USER, CHANNEL_ROOM, CHANNEL_LOBBY] }));
    });
    ws.addEventListener('message', ev => {
      const { type, payload } = JSON.parse(ev.data);
      switch (type) {
        case ROOM_CREATED:
        case ROOM_USER_JOINED:
        case ROOM_USER_LEFT:
          fetch('/rooms').then(r => r.json()).then((d) => setRooms(d.rooms));
          break;
        case LOBBY_JOINED:
          setLobby(payload.snapshot);
          break;
      }
    });
    return () => ws.close();
  }, [user]);

  async function handleCredential(cred: string) {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: cred })
    });
    if (res.ok) {
      const d = await res.json();
      setUser(d.user);
    }
  }

  if (!user) {
    return <GoogleAuth onCredential={handleCredential} />;
  }

  async function joinLobby() {
    await fetch('/lobby/join', { method: 'POST' });
    const d = await fetch('/lobby').then(r => r.json());
    setLobby(d.snapshot);
  }
  async function leaveLobby() {
    await fetch('/lobby/leave', { method: 'POST' });
    const d = await fetch('/lobby').then(r => r.json());
    setLobby(d.snapshot);
  }

  async function leaveRoom(roomId: string) {
    await fetch(`/rooms/${roomId}/leave`, { method: 'POST' });
    const d = await fetch('/rooms').then(r => r.json());
    setRooms(d.rooms);
  }

  async function logout() {
    await fetch('/auth/logout', { method: 'POST' });
    setUser(null);
    setLobby(null);
    setRooms([]);
  }

  return (
    <div>
      <h1>{l('ui.lobby', 'Lobby')}</h1>
      <p>
        {l('ui.loggedInAs', 'Logged in as')}: {user.name}
        <button onClick={logout}>{l('ui.logout', 'Logout')}</button>
      </p>
      <button onClick={joinLobby}>{l('ui.joinLobby', 'Join Lobby')}</button>
      <button onClick={leaveLobby}>{l('ui.leaveLobby', 'Leave Lobby')}</button>
      {lobby && (
        <div>
          <h2>{l('ui.lobbyUsers', 'Lobby Users')}</h2>
          <ul>
            {lobby.users.map(u => (
              <li key={u.uid}>{u.name}</li>
            ))}
          </ul>
          <p>
            {CONFIG_ROOM_SIZE}: {lobby.config.roomSize} / {CONFIG_AUTO_MATCH}: {String(lobby.config.autoMatch)}
          </p>
        </div>
      )}
      <h2>{l('ui.rooms', 'Rooms')}</h2>
      <ul>
        {rooms.map(r => (
          <li key={r.meta.id}>
            {r.meta.id} ({r.users.length}/{r.meta.size})
            {r.users.some(u => u.uid === user.uid) && (
              <button onClick={() => leaveRoom(r.meta.id)}>{l('ui.leaveRoom', 'Leave Room')}</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoogleAuth({ onCredential }: { onCredential: (cred: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      // @ts-ignore google is provided by the script above
      const clientId = import.meta.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.error('Missing GOOGLE_CLIENT_ID env var');
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: CredentialResponse) => onCredential(resp.credential)
      });
      // @ts-ignore
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large' });
    };
    document.body.appendChild(script);
  }, [onCredential]);
  return <div ref={ref}></div>;
}
