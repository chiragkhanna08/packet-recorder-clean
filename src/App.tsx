import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, TextField, Button, Typography, Paper, Box } from '@mui/material';
import PacketRecorderApp from './PacketRecorderApp';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const App: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    if (userId.trim() === 'admin' && password.trim() === '1234') {
      setIsLoggedIn(true);
    } else {
      alert('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserId('');
    setPassword('');
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box p={3}>
        {!isLoggedIn ? (
          <Paper sx={{ p: 4, maxWidth: 400, margin: 'auto' }}>
            <Typography variant="h5" gutterBottom>
              Admin Login
            </Typography>
            <TextField
              fullWidth
              label="User ID"
              variant="outlined"
              margin="normal"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <TextField
              fullWidth
              label="Password"
              variant="outlined"
              type="password"
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button variant="contained" color="primary" fullWidth onClick={handleLogin}>
              Login
            </Button>
          </Paper>
        ) : (
          <PacketRecorderApp onLogout={handleLogout} />
        )}
      </Box>
    </ThemeProvider>
  );
};

export default App;
