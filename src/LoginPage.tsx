import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
  Grid
} from '@mui/material';
import { Visibility, VisibilityOff, ArrowForward } from '@mui/icons-material';

// Import Google Font (Poppins)
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

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
      flexDirection="column"
      sx={{
        background: "#000000", // black background
      }}
    >
      <Grid container sx={{ flex: 1 }} alignItems="center" justifyContent="center">
        
        {/* Left side: Logo + Branding */}
        <Grid item xs={12} md={6} sx={{ textAlign: "center", px: 4 }}>
          {/* Logo */}
          <img
            src="/vivati-logo.gif"
            alt="Logo"
            style={{ height: 90, marginBottom: 20 }}
          />

          {/* One-line header */}
          <Typography
            variant="h3"
            sx={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              letterSpacing: "1px",
              color: "#2196f3",
              mb: 1,
            }}
          >
            VIVATI <span style={{ color: "#fff", fontWeight: 500 }}>Packet Recorder</span>
          </Typography>

          {/* Tagline */}
          <Typography
            variant="subtitle1"
            sx={{
              fontFamily: "'Poppins', sans-serif",
              color: "lightgray",
              mb: 4,
            }}
          >
            Smart solution to record, capture & track packets with ease.
          </Typography>

          {/* Feature row */}
          <Box display="flex" justifyContent="center" gap={4} sx={{ mt: 2 }}>
            <Box textAlign="center">
              <Typography sx={{ fontSize: "2rem" }}>🎥</Typography>
              <Typography sx={{ fontFamily: "'Poppins', sans-serif", color: "lightgray" }}>
                Record
              </Typography>
            </Box>
            <Box textAlign="center">
              <Typography sx={{ fontSize: "2rem" }}>📸</Typography>
              <Typography sx={{ fontFamily: "'Poppins', sans-serif", color: "lightgray" }}>
                Capture
              </Typography>
            </Box>
            <Box textAlign="center">
              <Typography sx={{ fontSize: "2rem" }}>🔍</Typography>
              <Typography sx={{ fontFamily: "'Poppins', sans-serif", color: "lightgray" }}>
                Track
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Right side: Login form */}
        <Grid item xs={12} md={6} sx={{ display: "flex", justifyContent: "center" }}>
          <Paper
            elevation={6}
            sx={{
              p: 5,
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
              borderRadius: 4,
              backgroundColor: "#2a2a2a", // grey card
              boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
              color: "#fff",
            }}
          >
            {/* Small logo inside card */}
            <img
              src="/vivati-logo.gif"
              alt="Logo"
              style={{ height: 70, marginBottom: 20 }}
            />

            <Typography
              variant="h6"
              sx={{
                mb: 3,
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
                color: "#2196f3"
              }}
            >
              Login to Continue
            </Typography>

            <TextField
              label="Username"
              fullWidth
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{
                mb: 3,
                input: { color: "#fff" },
                label: { color: "gray" },
              }}
            />

            <TextField
              label="Password"
              fullWidth
              variant="outlined"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              sx={{
                mb: 3,
                input: { color: "#fff" },
                label: { color: "gray" },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
                      {showPassword ? <VisibilityOff sx={{ color: "#2196f3" }} /> : <Visibility sx={{ color: "#2196f3" }} />}
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
              endIcon={<ArrowForward />}
              sx={{
                py: 1.3,
                fontSize: "1rem",
                borderRadius: 3,
                background: "linear-gradient(90deg,#1976d2,#42a5f5)",
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
              }}
              onClick={handleLogin}
            >
              Login
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Footer fixed centered */}
      <Box textAlign="center" sx={{ py: 2, color: "gray", fontSize: "0.85rem", fontFamily: "'Poppins', sans-serif" }}>
        © 2025 Vivati Online Pvt Ltd | All rights reserved
      </Box>
    </Box>
  );
};

export default LoginPage;
