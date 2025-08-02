import React, { useRef, useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, TextField, Stack, Divider
} from '@mui/material';
import {
  BrowserMultiFormatReader
} from '@zxing/browser';
import {
  BarcodeFormat,
  DecodeHintType,
  MultiFormatReader
} from '@zxing/library';

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
  const inputBuffer = useRef<string>('');
  const pendingFilenameRef = useRef<string>('');

  const playBeep = () => {
    const audio = new Audio('/beep.mp3');
    audio.play().catch(err => console.warn('Beep failed:', err));
  };

  const getFormattedTimestamp = () => new Date().toLocaleString();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      console.error('Error accessing webcam:', err);
    }
  };

  const stopCamera = () => {
    stopRecording();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    barcodeReaderRef.current = null;
    setCameraOn(false);
  };

  const startRecording = (code: string) => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    pendingFilenameRef.current = code;
    recordedChunks.current = [];
    const stream = videoRef.current.srcObject as MediaStream;
    mediaRecorder.current = new MediaRecorder(stream);
    mediaRecorder.current.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.current.push(e.data);
    };
    mediaRecorder.current.onstop = saveRecording;
    mediaRecorder.current.start();
    setRecordingStatus('recording');
    setTimer(0);
    intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    playBeep();
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      playBeep();
    }
    setRecordingStatus('idle');
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimer(0);
  };

  const saveRecording = () => {
    const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pendingFilenameRef.current || 'packet'}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '24px sans-serif';
    ctx.fillText(getFormattedTimestamp(), 10, canvas.height - 20);
    canvas.toBlob(blob => {
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

  const handleCodeInput = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScannedCode(trimmed);
    if (recordingStatus === 'recording') {
      stopRecording();
      setTimeout(() => startRecording(trimmed), 600);
    } else {
      startRecording(trimmed);
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleCodeInput(manualCode.trim());
      setManualCode('');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Enter') {
        const value = inputBuffer.current.trim();
        inputBuffer.current = '';
        if (value) handleCodeInput(value);
      } else {
        inputBuffer.current += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingStatus]);

  useEffect(() => {
    if (cameraOn && videoRef.current) {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE
      ]);

      const reader = new MultiFormatReader();
      reader.setHints(hints);
      barcodeReaderRef.current = new BrowserMultiFormatReader(hints);

      barcodeReaderRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            handleCodeInput(result.getText());
          }
        }
      );
    }
    return () => {
      barcodeReaderRef.current = null;
    };
  }, [cameraOn]);

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start"
      sx={{ backgroundImage: 'linear-gradient(to right, #0f2027, #203a43, #2c5364)' }}>
      <Box mt={4} mb={2} textAlign="center">
        <img src="/vivati-logo.gif" alt="VIVATI ONLINE Logo" style={{ height: 100, marginBottom: 12 }} />
        <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#00bcd4' }}>VIVATI ONLINE</Typography>
        <Typography variant="subtitle1" color="gray">Packet Recorder Dashboard</Typography>
      </Box>

      <Paper sx={{ p: 4, width: '90%', maxWidth: '1200px' }} elevation={4}>
        <Stack direction="row" spacing={2} justifyContent="center" mb={3}>
          <Button variant="contained" onClick={startCamera} disabled={cameraOn}>Start Camera</Button>
          <Button variant="outlined" onClick={stopCamera} disabled={!cameraOn}>Stop Camera</Button>
          <Button variant="outlined" onClick={() => {
            stopCamera();
            setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
            setTimeout(() => startCamera(), 500);
          }} disabled={!cameraOn}>🔄 Flip Camera</Button>
          <Button variant="contained" color="secondary" onClick={capturePhoto} disabled={!cameraOn}>📸 Capture Photo</Button>
          <Button variant="text" color="error" onClick={onLogout}>Logout</Button>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>Live Camera Feed</Typography>
            <Box sx={{ position: 'relative', border: '2px solid #00bcd4', borderRadius: 2, overflow: 'hidden' }}>
              <video ref={videoRef} width="100%" height="auto" muted style={{ borderRadius: 4 }} />
              <Box sx={{ position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 14, padding: '2px 8px', borderRadius: 4 }}>
                {getFormattedTimestamp()}
              </Box>
            </Box>
          </Box>

          <Box flex={1}>
            <Typography variant="h6" gutterBottom>Packet Details</Typography>
            <TextField label="Scanned Code (Scanner or Camera)" fullWidth disabled value={scannedCode} sx={{ mb: 2 }} helperText="Scanned code auto-filled from scanner/camera" />
            <Divider sx={{ my: 2 }} />
            <TextField label="Manually Enter Code" fullWidth value={manualCode} onChange={(e) => setManualCode(e.target.value)} sx={{ mb: 1 }} />
            <Button variant="contained" color="primary" fullWidth onClick={handleManualSubmit} disabled={!manualCode.trim()}>▶️ Submit & Record</Button>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1"><strong>Recording Status:</strong> {recordingStatus}</Typography>
            <Typography variant="subtitle1"><strong>Timer:</strong> {timer}s</Typography>
          </Box>
        </Stack>
      </Paper>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Box>
  );
};

export default PacketRecorderApp;
