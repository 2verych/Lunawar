import React, { useEffect, useRef, useState } from 'react';
import {
  CHANNEL_LOBBY,
  CHANNEL_ROOM,
  CHANNEL_USER,
  LOBBY_JOINED,
  ROOM_CREATED,
  ROOM_USER_JOINED,
  ROOM_USER_LEFT,
  CHAT_MESSAGE,
} from '@lunawar/shared/src/events';
import type { LobbySnapshot, RoomInfo, User, Message } from '@lunawar/shared/src/types';
import { l } from '@lunawar/shared/src/i18n';
import { CONFIG_ROOM_SIZE, CONFIG_AUTO_MATCH } from '@lunawar/shared/src/redisKeys';
import './App.css';

interface CredentialResponse { credential: string }

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
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
    fetch('/rooms').then(r => r.json()).then(async (d) => {
      setRooms(d.rooms);
      const msgs: Record<string, Message[]> = {};
      for (const r of d.rooms) {
        if (r.users.some((u: User) => u.uid === user.uid)) {
          const roomData = await fetch(`/rooms/${r.meta.id}`).then(res => res.json());
          msgs[r.meta.id] = roomData.lastMessages || [];
        }
      }
      setMessages(msgs);
    });

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
        case CHAT_MESSAGE:
          setMessages(prev => {
            const msg: Message = payload.message;
            return {
              ...prev,
              [msg.roomId]: [...(prev[msg.roomId] || []), msg],
            };
          });
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

  async function sendChat(roomId: string, text: string) {
    if (!text) return;
    await fetch(`/rooms/${roomId}/chat.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: crypto.randomUUID(), text }),
    });
  }

  async function logout() {
    await fetch('/auth/logout', { method: 'POST' });
    setUser(null);
    setLobby(null);
    setRooms([]);
  }

  const currentRoom = rooms.find(r => r.users.some(u => u.uid === user.uid));
  if (currentRoom) {
    return (
      <RoomView
        room={currentRoom}
        messages={messages[currentRoom.meta.id] || []}
        onLeave={() => leaveRoom(currentRoom.meta.id)}
        onSend={text => sendChat(currentRoom.meta.id, text)}
      />
    );
  }

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>{l('ui.lobby', 'Lobby')}</h1>
        <div className="user-info">
          {l('ui.loggedInAs', 'Logged in as')}: {user.name}
          <button onClick={logout}>{l('ui.logout', 'Logout')}</button>
        </div>
      </header>
      <div className="lobby-actions">
        <button onClick={joinLobby}>{l('ui.joinLobby', 'Join Lobby')}</button>
        <button onClick={leaveLobby}>{l('ui.leaveLobby', 'Leave Lobby')}</button>
      </div>
      {lobby && (
        <section className="lobby-users">
          <h2>{l('ui.lobbyUsers', 'Lobby Users')}</h2>
          <ul>
            {lobby.users.map(u => (
              <li key={u.uid}>{u.name}</li>
            ))}
          </ul>
          <p>
            {CONFIG_ROOM_SIZE}: {lobby.config.roomSize} / {CONFIG_AUTO_MATCH}: {String(lobby.config.autoMatch)}
          </p>
        </section>
      )}
      <section className="rooms">
        <h2>{l('ui.rooms', 'Rooms')}</h2>
        <ul>
          {rooms.map(r => (
            <li key={r.meta.id}>
              {r.meta.id} ({r.users.length}/{r.meta.size})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RoomView({
  room,
  messages,
  onLeave,
  onSend,
}: {
  room: RoomInfo;
  messages: Message[];
  onLeave: () => void;
  onSend: (text: string) => void;
}) {
  const [showFull, setShowFull] = useState(true);
  const [input, setInput] = useState('');
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '`') {
        setShowFull(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const msgs = showFull ? messages : messages.slice(-3);
  return (
    <div className="room">
      <button className="exit" onClick={onLeave}>{l('ui.leaveRoom', 'Leave Room')}</button>
      <div className={`chat ${showFull ? 'full' : 'mini'}`}>
        <ul className="messages">
          {msgs.length === 0 ? (
            <li className="placeholder">{l('ui.noMessages', 'No messages yet')}</li>
          ) : (
            msgs.map(m => (
              <li key={m.eventId}><b>{m.from.name}:</b> {m.text}</li>
            ))
          )}
        </ul>
        {showFull && (
          <div className="input">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onSend(input); setInput(''); }
              }}
            />
            <button onClick={() => { onSend(input); setInput(''); }}>{l('ui.send', 'Send')}</button>
            <button className="toggle" onClick={() => setShowFull(false)}>{l('ui.closeChat', 'Hide')}</button>
          </div>
        )}
        {!showFull && (
          <button className="toggle" onClick={() => setShowFull(true)}>{l('ui.openChat', 'Chat')}</button>
        )}
      </div>
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
