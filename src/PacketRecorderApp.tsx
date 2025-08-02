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
import { BrowserMultiFormatReader } from '@zxing/browser';

const PacketRecorderApp: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [cameraOn, setCameraOn] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [scannedCode, setScannedCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [timer, setTimer] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const inputBuffer = useRef<string>(''); // for scanner input

  const playBeep = () => {
    const audio = new Audio('/beep.mp3');
    audio.play().catch((err) => console.warn('Beep failed:', err));
  };

  const getFormattedTimestamp = (): string => {
    const now = new Date();
    return now.toLocaleString(); // e.g., "8/1/2025, 6:33:10 PM"
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setTimeout(() => {
          videoRef.current?.play().catch((err) =>
            console.warn('Autoplay error:', err)
          );
        }, 100);
      }
      setCameraOn(true);
    } catch (err) {
      console.error('Error accessing webcam:', err);
    }
  };

  const stopCamera = () => {
    stopRecording();

    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    barcodeReaderRef.current = null;
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
    playBeep();

    intervalRef.current = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      playBeep();
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
    a.download = `${scannedCode || 'packet'}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // ✅ Draw timestamp on photo
    ctx.fillStyle = 'white';
    ctx.font = '24px sans-serif';
    ctx.fillText(getFormattedTimestamp(), 10, canvas.height - 20);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scannedCode || 'packet'}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/jpeg');
  };

  const handleManualSubmit = () => {
    const value = manualCode.trim();
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

    setManualCode('');
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === 'Enter') {
        const value = inputBuffer.current.trim();
        inputBuffer.current = '';

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
      } else {
        inputBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [recordingStatus]);

  useEffect(() => {
    if (cameraOn && videoRef.current) {
      barcodeReaderRef.current = new BrowserMultiFormatReader();

      barcodeReaderRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result, err) => {
          if (result) {
            const value = result.getText();

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
          }
        }
      );
    }

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      barcodeReaderRef.current = null;
    };
  }, [cameraOn]);

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
        <img
          src="/vivati-logo.gif"
          alt="VIVATI ONLINE Animated Logo"
          style={{ height: 100, marginBottom: 12 }}
        />
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
          <Button
            variant="outlined"
            onClick={() => {
              stopCamera();
              setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
              setTimeout(() => startCamera(), 500);
            }}
            disabled={!cameraOn}
          >
            🔄 Flip Camera
          </Button>
          <Button variant="contained" color="secondary" onClick={capturePhoto} disabled={!cameraOn}>
            📸 Capture Photo
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
                position: 'relative',
                border: '2px solid #00bcd4',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <video ref={videoRef} width="100%" height="auto" muted style={{ borderRadius: 4 }} />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  fontSize: 14,
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                {getFormattedTimestamp()}
              </Box>
            </Box>
          </Box>

          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              Packet Details
            </Typography>
            <TextField
              label="Scanned Code (Scanner or Camera)"
              fullWidth
              disabled
              value={scannedCode}
              sx={{ mb: 2 }}
              helperText="Scanned code auto-filled from scanner/camera"
            />
            <Divider sx={{ my: 2 }} />
            <TextField
              label="Manually Enter Code"
              fullWidth
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              sx={{ mb: 1 }}
            />
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
            >
              ▶️ Submit & Record
            </Button>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1">
              <strong>Recording Status:</strong> {recordingStatus}
            </Typography>
            <Typography variant="subtitle1">
              <strong>Timer:</strong> {timer}s
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Box>
  );
};

export default PacketRecorderApp;
