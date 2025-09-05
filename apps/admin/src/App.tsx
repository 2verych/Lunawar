import React, { useState } from 'react';
import './App.css';

type Tab = 'lobby' | 'rooms' | 'config';

export default function App() {
  const [tab, setTab] = useState<Tab>('lobby');

  return (
    <div className="admin">
      <nav>
        <button onClick={() => setTab('lobby')}>Lobby</button>
        <button onClick={() => setTab('rooms')}>Rooms</button>
        <button onClick={() => setTab('config')}>Config</button>
      </nav>
      {tab === 'lobby' && <section className="lobby">Lobby view</section>}
      {tab === 'rooms' && <section className="rooms">Rooms view</section>}
      {tab === 'config' && <section className="config">Config view</section>}
    </div>
  );
}
