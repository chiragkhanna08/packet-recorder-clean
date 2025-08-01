import React, { useRef, useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper, Stack } from '@mui/material';

interface Props {
  onLogout: () => void;
}

const PacketRecorderApp: React.FC<Props> = ({ onLogout }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [scannedCode, setScannedCode] = useState('');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedCodeRef = useRef<string>('');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      mediaRecorderRef.current = new MediaRecorder(stream);
      setCameraOn(true);
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  };

  const stopCamera = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    }
    setCameraOn(false);
    setRecordingStatus('idle');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startRecording = () => {
    if (!mediaRecorderRef.current) return;

    chunks.current = [];
    mediaRecorderRef.current.ondataavailable = (e) => chunks.current.push(e.data);
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${lastScannedCodeRef.current || 'packet'}.webm`;
      a.click();
    };
    mediaRecorderRef.current.start();
    setRecordingStatus('recording');
    timerRef.current = setInterval(() => setTimer((prev) => prev + 1), 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setTimer(0);
      setRecordingStatus('idle');
    }
  };

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const code = (e.target as HTMLInputElement).value.trim();
      if (!code) return;

      if (recordingStatus === 'recording') {
        stopRecording();
      }

      setScannedCode(code);
      lastScannedCodeRef.current = code;
      startRecording();

      (e.target as HTMLInputElement).value = '';
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(to right, #141e30, #243b55)',
        padding: 3,
      }}
    >
      <Paper
        sx={{
          p: 4,
          background: 'linear-gradient(to bottom right, #0f2027, #203a43, #2c5364)',
          color: 'white',
          maxWidth: 1000,
          mx: 'auto',
          borderRadius: 3,
        }}
      >
        <Typography
          variant="h4"
          gutterBottom
          sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: 1 }}
        >
          VIVATI ONLINE - Packet Recorder Dashboard
        </Typography>

        <Stack direction="row" spacing={2} mb={3}>
          <Button variant="contained" onClick={startCamera} disabled={cameraOn}>
            Start Camera
          </Button>
          <Button variant="outlined" onClick={stopCamera} disabled={!cameraOn}>
            Stop Camera
          </Button>
          <Button variant="text" color="inherit" onClick={onLogout}>
            Logout
          </Button>
        </Stack>

        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3}>
          <Box flex={1}>
            <video ref={videoRef} width="100%" height="auto" muted />
          </Box>
          <Box flex={1}>
            <TextField
              label="Scan Packet Barcode"
              fullWidth
              onKeyDown={handleScan}
              disabled={!cameraOn}
              sx={{ background: 'white', borderRadius: 1 }}
            />
            <Typography mt={2}>Scanned Code: {scannedCode || 'None'}</Typography>
            <Typography>Recording Status: {recordingStatus}</Typography>
            <Typography>Timer: {timer}s</Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default PacketRecorderApp;
