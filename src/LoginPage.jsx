import React, { useState } from 'react';
import { TextField, Button, Container, Typography, Paper } from '@mui/material';

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (username === 'admin' && password === '1234') {
      onLogin();
    } else {
      alert('Invalid credentials');
    }
  };

  return (
    <Container maxWidth="xs">
      <Paper elevation={3} style={{ padding: '2rem', marginTop: '6rem' }}>
        <Typography variant="h5" gutterBottom align="center">Login</Typography>
        <TextField
          label="Username"
          fullWidth
          margin="normal"
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button variant="contained" color="primary" fullWidth onClick={handleSubmit}>
          Login
        </Button>
      </Paper>
    </Container>
  );
};

export default LoginPage;
