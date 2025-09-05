import React, { useState, useEffect, useRef } from 'react';
import './App.css';

type Tab = 'lobby' | 'rooms' | 'config';

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
  const [tab, setTab] = useState<Tab>('lobby');
  const [user, setUser] = useState<User | null>(null);

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

  if (!user) {
    return <GoogleAuth onCredential={handleCredential} />;
  }

  return (
    <div className="admin">
      <header>
        <span>{user.name}</span>
        <button onClick={logout}>Logout</button>
      </header>
      <nav>
        <button onClick={() => setTab('lobby')}>Lobby</button>
        <button onClick={() => setTab('rooms')}>Rooms</button>
        <button onClick={() => setTab('config')}>Config</button>
      </nav>
      {tab === 'lobby' && <LobbyView />}
      {tab === 'rooms' && <RoomsView />}
      {tab === 'config' && <ConfigView />}
    </div>
  );
}

function LobbyView() {
  const [users, setUsers] = useState<User[]>([]);

  const load = async () => {
    const res = await fetch('/admin/lobby');
    const data = await res.json();
    setUsers(data.snapshot.users);
  };

  useEffect(() => {
    load();
  }, []);

  const createRoom = async () => {
    await fetch('/admin/room.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    await load();
  };

  return (
    <section className="lobby">
      <button onClick={load}>Refresh</button>
      <button onClick={createRoom}>Create room</button>
      <ul>
        {users.map((u) => (
          <li key={u.uid}>{u.name}</li>
        ))}
      </ul>
    </section>
  );
}

function RoomsView() {
  const [rooms, setRooms] = useState<Room[]>([]);

  const load = async () => {
    const res = await fetch('/admin/rooms');
    const data = await res.json();
    setRooms(data.rooms);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="rooms">
      <button onClick={load}>Refresh</button>
      <ul>
        {rooms.map((r) => (
          <li key={r.meta.id}>
            {r.meta.id}: {r.users.map((u) => u.name).join(', ')}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfigView() {
  const [roomSize, setRoomSize] = useState(0);
  const [autoMatch, setAutoMatch] = useState(false);

  const load = async () => {
    const res = await fetch('/admin/lobby');
    const data = await res.json();
    setRoomSize(data.snapshot.config.roomSize);
    setAutoMatch(data.snapshot.config.autoMatch);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    await fetch('/admin/config.set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomSize, autoMatch }),
    });
  };

  return (
    <section className="config">
      <div>
        <label>
          Room size:
          <input
            type="number"
            value={roomSize}
            onChange={(e) => setRoomSize(Number(e.target.value))}
          />
        </label>
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={autoMatch}
            onChange={(e) => setAutoMatch(e.target.checked)}
          />
          Auto match
        </label>
      </div>
      <button onClick={save}>Save</button>
    </section>
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
