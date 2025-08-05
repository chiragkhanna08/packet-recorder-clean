import React, { useState } from 'react';
import LoginPage from './LoginPage';
import PacketRecorderApp from './PacketRecorderApp'; // your main dashboard component

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return isLoggedIn ? (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(to right, #fdfbfb, #ebedee)',
        padding: '20px',
      }}
    >
      <PacketRecorderApp onLogout={() => setIsLoggedIn(false)} />
    </div>
  ) : (
    <LoginPage onLogin={() => setIsLoggedIn(true)} />
  );
};

export default App;