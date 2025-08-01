import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Stack,
  Divider
} from '@mui/material';

const PacketRecorderApp: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [cameraOn, setCameraOn] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [scannedCode, setScannedCode] = useState('');
  const [timer, setTimer] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      console.error('Error accessing webcam:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    stopRecording();
    setCameraOn(false);
  };

  const startRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    recordedChunks.current = [];
    mediaRecorder.current = new MediaRecorder(stream);

    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.current.push(event.data);
    };

    mediaRecorder.current.onstop = saveRecording;
    mediaRecorder.current.start();
    setRecordingStatus('recording');

    intervalRef.current = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    setRecordingStatus('idle');
    setTimer(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const saveRecording = () => {
    const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scannedCode || 'packet'}_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim();
      if (!value) return;

      if (recordingStatus === 'recording') {
        stopRecording();
        setTimeout(() => {
          setScannedCode(value);
          startRecording();
        }, 500);
      } else {
        setScannedCode(value);
        startRecording();
      }
      (e.target as HTMLInputElement).value = '';
    }
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="flex-start"
      sx={{ backgroundImage: 'linear-gradient(to right, #0f2027, #203a43, #2c5364)' }}
    >
      <Box mt={4} mb={2} textAlign="center">
        <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#00bcd4' }}>
          VIVATI ONLINE
        </Typography>
        <Typography variant="subtitle1" color="gray">
          Packet Recorder Dashboard
        </Typography>
      </Box>

      <Paper sx={{ p: 4, width: '90%', maxWidth: '1200px' }} elevation={4}>
        <Stack direction="row" spacing={2} justifyContent="center" mb={3}>
          <Button variant="contained" onClick={startCamera} disabled={cameraOn}>
            Start Camera
          </Button>
          <Button variant="outlined" onClick={stopCamera} disabled={!cameraOn}>
            Stop Camera
          </Button>
          <Button variant="text" color="error" onClick={onLogout}>
            Logout
          </Button>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              Live Camera Feed
            </Typography>
            <Box
              sx={{
                border: '2px solid #00bcd4',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <video ref={videoRef} width="100%" height="auto" muted style={{ borderRadius: 4 }} />
            </Box>
          </Box>

          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              Packet Details
            </Typography>
            <TextField
              label="Scan Packet Barcode"
              fullWidth
              onKeyDown={handleScan}
              disabled={!cameraOn}
              sx={{ mb: 2 }}
            />
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1">
              <strong>Scanned Code:</strong> {scannedCode || 'None'}
            </Typography>
            <Typography variant="subtitle1">
              <strong>Recording Status:</strong> {recordingStatus}
            </Typography>
            <Typography variant="subtitle1">
              <strong>Timer:</strong> {timer}s
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

export default PacketRecorderApp;
