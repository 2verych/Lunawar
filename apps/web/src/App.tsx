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
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  List,
  ListItem,
  TextField,
  Paper,
} from '@mui/material';

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
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography sx={{ flexGrow: 1 }}>{l('ui.lobby', 'Lobby')}</Typography>
          <Typography sx={{ mr: 2 }}>{l('ui.loggedInAs', 'Logged in as')}: {user.name}</Typography>
          <Button color="inherit" onClick={logout}>{l('ui.logout', 'Logout')}</Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button variant="contained" onClick={joinLobby}>{l('ui.joinLobby', 'Join Lobby')}</Button>
          <Button variant="contained" onClick={leaveLobby}>{l('ui.leaveLobby', 'Leave Lobby')}</Button>
        </Box>
        {lobby && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6">{l('ui.lobbyUsers', 'Lobby Users')}</Typography>
            <List>
              {lobby.users.map(u => (
                <ListItem key={u.uid}>{u.name}</ListItem>
              ))}
            </List>
            <Typography>
              {CONFIG_ROOM_SIZE}: {lobby.config.roomSize} / {CONFIG_AUTO_MATCH}: {String(lobby.config.autoMatch)}
            </Typography>
          </Box>
        )}
        <Box>
          <Typography variant="h6">{l('ui.rooms', 'Rooms')}</Typography>
          <List>
            {rooms.map(r => (
              <ListItem key={r.meta.id}>{r.meta.id} ({r.users.length}/{r.meta.size})</ListItem>
            ))}
          </List>
        </Box>
      </Container>
    </Box>
  );
}

function RoomView({
  room: _room,
  messages,
  onLeave,
  onSend,
}: {
  room: RoomInfo;
  messages: Message[];
  onLeave: () => void;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  return (
    <Box sx={{ position: 'relative', height: '100vh', bgcolor: 'background.default' }}>
      <Button sx={{ position: 'absolute', top: 16, left: 16 }} variant="contained" onClick={onLeave}>{l('ui.leaveRoom', 'Leave Room')}</Button>
      <Paper sx={{ position: 'absolute', top: 0, right: 0, width: 300, height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
        <List sx={{ flex: 1, overflowY: 'auto' }}>
          {messages.length === 0 ? (
            <ListItem><Typography color="text.secondary">{l('ui.noMessages', 'No messages yet')}</Typography></ListItem>
          ) : (
            messages.map(m => (
              <ListItem key={m.eventId}><Typography component="span" fontWeight="bold">{m.from.name}: </Typography>{m.text}</ListItem>
            ))
          )}
        </List>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onSend(input); setInput(''); } }}
            size="small"
            fullWidth
          />
          <Button variant="contained" onClick={() => { onSend(input); setInput(''); }}>{l('ui.send', 'Send')}</Button>
        </Box>
      </Paper>
    </Box>
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
