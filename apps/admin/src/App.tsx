import React, { useState, useEffect, useRef } from 'react';
import {
  CHANNEL_LOBBY,
  CHANNEL_ROOM,
  LOBBY_JOINED,
  ROOM_CREATED,
  ROOM_USER_JOINED,
  ROOM_USER_LEFT,
} from '@lunawar/shared/src/events';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Tabs,
  Tab,
  Container,
  Box,
  List,
  ListItem,
  TextField,
  Checkbox,
  FormControlLabel,
} from '@mui/material';

type AdminTab = 'lobby' | 'rooms' | 'config';

interface User {
  uid: string;
  name: string;
}

interface CredentialResponse { credential: string }

interface Room {
  meta: { id: string };
  users: User[];
}

export default function App() {
  const [tab, setTab] = useState<AdminTab>('lobby');
  const [user, setUser] = useState<User | null>(null);
  const [lobbyUsers, setLobbyUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomSize, setRoomSize] = useState(0);
  const [autoMatch, setAutoMatch] = useState(false);

  useEffect(() => {
    fetch('/admin/me').then(async (r) => {
      if (r.status === 200) {
        const d = await r.json();
        setUser(d.user);
      }
    });
  }, []);

  async function handleCredential(cred: string) {
    const res = await fetch('/admin/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: cred })
    });
    if (res.ok) {
      const d = await res.json();
      setUser(d.user);
    }
  }

  async function logout() {
    await fetch('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  const loadLobby = async () => {
    const res = await fetch('/admin/lobby');
    const data = await res.json();
    setLobbyUsers(data.snapshot.users);
    setRoomSize(data.snapshot.config.roomSize);
    setAutoMatch(data.snapshot.config.autoMatch);
  };

  const loadRooms = async () => {
    const res = await fetch('/admin/rooms');
    const data = await res.json();
    setRooms(data.rooms);
  };

  useEffect(() => {
    if (!user) return;
    loadLobby();
    loadRooms();
    const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws`);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ channels: [CHANNEL_LOBBY, CHANNEL_ROOM] }));
    });
    ws.addEventListener('message', (ev) => {
      const { type } = JSON.parse(ev.data);
      switch (type) {
        case ROOM_CREATED:
        case ROOM_USER_JOINED:
        case ROOM_USER_LEFT:
          loadRooms();
          break;
        case LOBBY_JOINED:
          loadLobby();
          break;
      }
    });
    return () => ws.close();
  }, [user]);

  if (!user) {
    return <GoogleAuth onCredential={handleCredential} />;
  }

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography sx={{ flexGrow: 1 }}>{user.name}</Typography>
          <Button color="inherit" onClick={logout}>Logout</Button>
        </Toolbar>
      </AppBar>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        centered
      >
        <Tab label="Lobby" value="lobby" />
        <Tab label="Rooms" value="rooms" />
        <Tab label="Config" value="config" />
      </Tabs>
      <Container sx={{ mt: 2 }}>
        {tab === 'lobby' && (
          <LobbyView
            users={lobbyUsers}
            onCreateRoom={async () => {
              await fetch('/admin/room.create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });
              await loadRooms();
              await loadLobby();
            }}
            onRefresh={loadLobby}
          />
        )}
        {tab === 'rooms' && (
          <RoomsView rooms={rooms} onRefresh={loadRooms} />
        )}
        {tab === 'config' && (
          <ConfigView
            roomSize={roomSize}
            autoMatch={autoMatch}
            onRoomSizeChange={setRoomSize}
            onAutoMatchChange={setAutoMatch}
            onSave={async () => {
              await fetch('/admin/config.set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomSize, autoMatch }),
              });
              await loadLobby();
            }}
          />
        )}
      </Container>
    </Box>
  );
}

function LobbyView({
  users,
  onCreateRoom,
  onRefresh,
}: {
  users: User[];
  onCreateRoom: () => void;
  onRefresh: () => void;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button variant="contained" onClick={onRefresh}>Refresh</Button>
        <Button variant="contained" onClick={onCreateRoom}>Create room</Button>
      </Box>
      <List>
        {users.map((u) => (
          <ListItem key={u.uid}>{u.name}</ListItem>
        ))}
      </List>
    </Box>
  );
}

function RoomsView({
  rooms,
  onRefresh,
}: {
  rooms: Room[];
  onRefresh: () => void;
}) {
  return (
    <Box>
      <Button variant="contained" sx={{ mb: 2 }} onClick={onRefresh}>Refresh</Button>
      <List>
        {rooms.map((r) => (
          <ListItem key={r.meta.id}>
            {r.meta.id}: {r.users.map((u) => u.name).join(', ')}
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

function ConfigView({
  roomSize,
  autoMatch,
  onRoomSizeChange,
  onAutoMatchChange,
  onSave,
}: {
  roomSize: number;
  autoMatch: boolean;
  onRoomSizeChange: (n: number) => void;
  onAutoMatchChange: (b: boolean) => void;
  onSave: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 300 }}>
      <TextField
        type="number"
        label="Room size"
        value={roomSize}
        onChange={(e) => onRoomSizeChange(Number(e.target.value))}
      />
      <FormControlLabel
        control={<Checkbox checked={autoMatch} onChange={(e) => onAutoMatchChange(e.target.checked)} />}
        label="Auto match"
      />
      <Button variant="contained" onClick={onSave}>Save</Button>
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
      // @ts-ignore
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

