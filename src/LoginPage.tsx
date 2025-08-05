import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    if (username === 'admin' && password === '1234') {
      onLogin();
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <Box
      height="100vh"
      display="flex"
      justifyContent="center"
      alignItems="center"
      sx={{
        backgroundImage: 'url("/login-bg.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
        px: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 5,
          maxWidth: 500,
          width: '100%',
          textAlign: 'center',
          backdropFilter: 'blur(15px)',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: 4,
        }}
      >
        <img
          src="/vivati-logo.gif"
          alt="Logo"
          style={{ height: 80, marginBottom: 20 }}
        />
        <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#1a1a1a' }}>
          Login to VIVATI ONLINE
        </Typography>

        <TextField
          label="Username"
          fullWidth
          size="medium"
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          sx={{ mb: 3 }}
        />
        <TextField
          label="Password"
          fullWidth
          size="medium"
          variant="outlined"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLogin();
          }}
          sx={{ mb: 4 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((prev) => !prev)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {error && (
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Button
          variant="contained"
          fullWidth
          color="primary"
          sx={{ py: 1.2, fontSize: '1rem' }}
          onClick={handleLogin}
        >
          Login
        </Button>
      </Paper>
    </Box>
  );
};

export default LoginPage;
