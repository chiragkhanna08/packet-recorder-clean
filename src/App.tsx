import React, { useState } from 'react';
import LoginPage from './LoginPage';
import PacketRecorderApp from './PacketRecorderApp';

const App: React.FC = () => {
  // ✅ Load login state from localStorage on first render
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });

  // ✅ Called only when logout button is clicked
  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
  };

  // ✅ Called only when login is successful
  const handleLogin = () => {
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoggedIn(true);
  };

  return isLoggedIn ? (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(to right, #fdfbfb, #ebedee)',
        padding: '20px',
      }}
    >
      <PacketRecorderApp onLogout={handleLogout} />
    </div>
  ) : (
    <LoginPage onLogin={handleLogin} />
  );
};

export default App;