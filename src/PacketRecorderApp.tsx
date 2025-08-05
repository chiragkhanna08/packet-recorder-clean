import React, { useRef, useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, TextField, Divider, useMediaQuery
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { useTheme } from '@mui/material/styles';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

const saveVideoToStorage = async (blob: Blob, filename: string) => {
  try {
    const base64Data = await convertBlobToBase64(blob) as string;
    await Filesystem.writeFile({
      path: filename,
      data: base64Data.split(',')[1],
      directory: Directory.Documents,
    });
    console.log('✅ Video saved to device:', filename);
  } catch (error) {
    console.error('❌ Failed to save video:', error);
  }
};



const PacketRecorderApp: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [cameraOn, setCameraOn] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [scannedCode, setScannedCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [timer, setTimer] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [logs, setLogs] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const inputBuffer = useRef<string>('');
  const pendingFilenameRef = useRef<string>('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
  const requestPermissions = async () => {
    try {
      const status = await Camera.requestPermissions();
      if (status.camera !== 'granted') {
        alert('Camera permission is required to use this app.');
      } else {
        console.log('✅ Camera permission granted');
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  };
  requestPermissions();
}, []);



  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const playBeep = () => {
    const beep = document.getElementById('beep-sound') as HTMLAudioElement;
    if (beep) {
      beep.currentTime = 0;
      beep.play().catch(() => {});
    }
  };

  const getFormattedTimestamp = () => new Date().toLocaleString();

const downloadLogs = () => {
  const fullLog = logs.slice().reverse().join('\n');
  const blob = new Blob([fullLog], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0]; // yyyy-MM-dd_HH-mm-ss
  a.download = `vivati-logs-${timestamp}.txt`;

  a.click();
  URL.revokeObjectURL(url);
};


const downloadScannedLogs = () => {
  const filteredLogs = logs
    .slice()
    .reverse()
    .filter(log => log.includes('Code scanned/submitted'))
    .join('\n');

  const blob = new Blob([filteredLogs], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
  a.download = `vivati-scan-logs-${timestamp}.txt`;

  a.click();
  URL.revokeObjectURL(url);
};


  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      addLog("Camera started");
    } catch (err) {
      console.error('Camera access error:', err);
    }
  };

  const stopCamera = () => {
    stopRecording();
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    barcodeReaderRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimer(0);
    setCameraOn(false);
    addLog("Camera stopped");
  };

 const handleLogout = () => {
  addLog("User logged out");

  // Auto download both logs
  downloadLogs();            // ⬇️ Full log
  downloadScannedLogs();     // 🔍 Packet scan log

  stopCamera();
  onLogout();
};


  const startRecording = (code: string) => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    pendingFilenameRef.current = code;
    recordedChunks.current = [];

    const stream = videoRef.current.srcObject as MediaStream;
    mediaRecorder.current = new MediaRecorder(stream);
    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.current.push(e.data);
    };
    mediaRecorder.current.onstop = (_e: Event) => {
  saveRecording(pendingFilenameRef.current);
};

    mediaRecorder.current.start();
    

    setRecordingStatus('recording');
    setTimer(0);
    intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    addLog(`Recording started for packet: ${code}`);
    playBeep();
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    setRecordingStatus('idle');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimer(0);
    addLog("Recording stopped");
    playBeep();
  };

const saveRecording = async (filename: string) => {
  const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
  const safeFilename = `${filename}.webm`; // exact scanned code as filename

  if (Capacitor.getPlatform() === 'web') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await saveVideoToStorage(blob, safeFilename);
  }

  addLog(`Video saved: ${safeFilename}`);
};


  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
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
        addLog(`Photo captured for packet: ${scannedCode}`);
        playBeep();
      }
    }, 'image/jpeg');
  };

  const handleCodeInput = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    playBeep();
    setScannedCode(trimmed);
    addLog(`Code scanned/submitted: ${trimmed}`);
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
      } else if (e.key.length === 1) {
        inputBuffer.current += e.key;
      } else if (e.key === 'Backspace') {
        inputBuffer.current = inputBuffer.current.slice(0, -1);
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
      barcodeReaderRef.current = new BrowserMultiFormatReader(hints);
      barcodeReaderRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) handleCodeInput(result.getText());
        }
      );
    }
    return () => {
      barcodeReaderRef.current = null;
    };
  }, [cameraOn]);

  return (
    <Box sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f3f3f3' }}>
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <img src="/vivati-logo.gif" alt="Logo" style={{ maxHeight: 60, objectFit: 'contain' }} />
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1976d2' }}>VIVATI ONLINE</Typography>
        <Typography variant="subtitle2">Packet Recorder Dashboard</Typography>
      </Box>

      <Box flex="1" overflow="auto">
        <Paper elevation={3} sx={{ width: '95%', maxWidth: 1300, mx: 'auto', p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button variant="contained" fullWidth onClick={startCamera} disabled={cameraOn}>Start Camera</Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button variant="outlined" fullWidth onClick={stopCamera} disabled={!cameraOn}>Stop Camera</Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button variant="outlined" fullWidth onClick={() => {
                stopCamera();
                setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
                setTimeout(() => startCamera(), 500);
              }} disabled={!cameraOn}>Flip Camera</Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button variant="contained" color="secondary" fullWidth onClick={capturePhoto} disabled={!cameraOn}>📸 Photo</Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button variant="text" color="error" fullWidth onClick={handleLogout}>Logout</Button>
            </Grid>
          </Grid>

          <Grid container spacing={3} mt={1}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6">Live Camera</Typography>
              <Box sx={{
                position: 'relative',
                border: '2px solid #1976d2',
                borderRadius: 2,
                overflow: 'hidden',
                width: '100%',
                height: isMobile ? 260 : 390
              }}>
                <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                <Box sx={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  padding: '2px 8px',
                  fontSize: 12,
                  borderRadius: 4
                }}>{getFormattedTimestamp()}</Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6">Packet Details</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Scanned Code" fullWidth disabled value={scannedCode} />
                <TextField label="Manual Code" fullWidth value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                <Button variant="contained" onClick={handleManualSubmit} disabled={!manualCode.trim()}>Submit & Record</Button>
                <Divider />
                <Typography><strong>Status:</strong> {recordingStatus}</Typography>
                <Typography><strong>Timer:</strong> {timer}s</Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6">Activity Logs</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 200, overflowY: 'auto', p: 1, backgroundColor: '#f9f9f9' }}>
                {logs.length === 0
                  ? <Typography variant="body2" color="textSecondary">No activity yet</Typography>
                  : logs.map((log, index) => <Typography key={index} variant="body2">{log}</Typography>)
                }
              </Paper>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', mt: 2, gap: 2 }}>
                <Button variant="outlined" color="primary" onClick={downloadLogs}>
                  ⬇️ Download Full Log
                </Button>
                <Button variant="outlined" color="secondary" onClick={downloadScannedLogs}>
                  🔍 Download Packet Scan Logs
                </Button>
              </Box>
            </Grid>
          </Grid>

          <audio id="beep-sound" src="/beep.mp3" preload="auto" />
        </Paper>
      </Box>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Box>
  );
};

export default PacketRecorderApp;
