import React, { useRef, useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, TextField, Divider, useMediaQuery, Stack
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
      path: `Download/${filename}`,
      data: base64Data.split(',')[1],
      directory: Directory.External,
      recursive: true
    });
    alert(`✅ Video saved to Downloads as ${filename}`);
    console.log('✅ Saved to: Download/', filename);
  } catch (error) {
    console.error('❌ Failed to save video:', error);
    alert('❌ Failed to save video');
  }
};

const PacketRecorderApp: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [cameraOn, setCameraOn] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [scannedCode, setScannedCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [timer, setTimer] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [logs, setLogs] = useState<string[]>(() => {
    const saved = localStorage.getItem('vivatiLogs');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const inputBuffer = useRef<string>('');
  const pendingFilenameRef = useRef<string>('');
  // canvas drawing control refs
  const canvasDrawFrameId = useRef<number | null>(null);
  const canvasDrawingActive = useRef<boolean>(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Permissions
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

  // Persist logs
  useEffect(() => {
    localStorage.setItem('vivatiLogs', JSON.stringify(logs));
  }, [logs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => {
      const next = [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]; // limit 100
      return next;
    });
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
    const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
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

  // Start camera (keeps high resolution as before)
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },   // keep high resolution
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (err) {
          // autoplay might be blocked; still camera stream attached
          console.warn('video.play() error:', err);
        }
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
    downloadLogs();
    downloadScannedLogs();
    stopCamera();
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('vivatiLogs'); // Clear logs on logout
    onLogout();
  };

  // Recording: draw to canvas overlay + captureStream -> MediaRecorder
  const startRecording = (code: string) => {
    if (!videoRef.current || !videoRef.current.srcObject) return;

    pendingFilenameRef.current = code;
    recordedChunks.current = [];

    // create canvas (we previously used a created element; reuse hidden canvasRef if present)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const video = videoRef.current;

    // set canvas to video natural size if available; fallbacks kept
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    canvasDrawingActive.current = true;

    // draw loop with overlays (timestamp, packet code)
    const drawFrame = () => {
      if (!canvasDrawingActive.current) return;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Timestamp overlay (bottom-left)
        ctx.fillStyle = 'white';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(new Date().toLocaleString(), 10, canvas.height - 40);

        // Scanned code overlay (bottom-center)
        if (pendingFilenameRef.current) {
          ctx.fillStyle = 'yellow';
          ctx.font = '22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(pendingFilenameRef.current, canvas.width / 2, canvas.height - 10);
        }
      } catch (e) {
        // drawing can fail if video not ready; ignore
      }
      canvasDrawFrameId.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    // capture stream from canvas (30 fps)
    const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(30) : null;
    if (!canvasStream) {
      console.error('captureStream not supported by this browser');
      return;
    }

    try {
      mediaRecorder.current = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
    } catch (err) {
      console.error('MediaRecorder creation failed:', err);
      return;
    }

    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.current.push(e.data);
    };

    mediaRecorder.current.onstop = () => {
      saveRecording(pendingFilenameRef.current);
    };

    mediaRecorder.current.onerror = (e: any) => {
      console.error("❌ MediaRecorder error:", e);
      stopRecording();
    };

    mediaRecorder.current.start();

    setRecordingStatus('recording');
    setTimer(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // set timer using window.setInterval to get a number returned (for clearing)
    intervalRef.current = window.setInterval(() => setTimer((t) => t + 1), 1000);

    addLog(`Recording started for packet: ${code}`);
    playBeep();
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      try {
        mediaRecorder.current.stop();
      } catch (e) {
        console.warn('Error stopping mediaRecorder', e);
      }
    }
    setRecordingStatus('idle');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimer(0);

    // stop canvas draw loop
    canvasDrawingActive.current = false;
    if (canvasDrawFrameId.current) {
      cancelAnimationFrame(canvasDrawFrameId.current);
      canvasDrawFrameId.current = null;
    }

    addLog("Recording stopped");
    playBeep();
  };

  const saveRecording = async (filename: string) => {
    try {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      // free memory before maybe large operations
      recordedChunks.current = []; // clear recorded chunks to free memory
      const safeFilename = `${filename}.webm`;
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
    } catch (e) {
      console.error('saveRecording error', e);
      addLog('Failed to save video');
    }
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
      setTimeout(() => startRecording(trimmed), 800); // small delay to stabilize
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

  // keyboard scanner input buffer
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

  // Throttled Barcode Scanner: decodeOnce loop (1s)
  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;

    const reader = new BrowserMultiFormatReader();
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
    // assign hints (BrowserMultiFormatReader doesn't accept direct prop in some versions)
    (reader as any).hints = hints;

    let lastScan = 0;
    let active = true;

    const loop = async () => {
      if (!active || !cameraOn) return;
      const now = Date.now();
      if (now - lastScan > 1000) { // 1-second throttle
        try {
          // decodeOnceFromVideoDevice tries to decode a single frame from device
          const result = await reader.decodeOnceFromVideoDevice(undefined, videoRef.current ?? undefined);

          if (result && result.getText()) {
            handleCodeInput(result.getText());
          }
          lastScan = now;
        } catch (err) {
          // ignore decoding errors; continue
        }
      }
      requestAnimationFrame(loop);
    };
    loop();

    return () => {
  active = false;
  try {
    // @ts-ignore
    reader.reset();
  } catch (e) { /* ignore */ }
};

  }, [cameraOn]);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto pause/resume camera on tab visibility
  useEffect(() => {
    const handleVis = () => {
      if (document.hidden) {
        stopCamera();
      } else {
        startCamera();
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  return (
    <Box sx={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
      {/* Fullscreen video - only when camera is ON */}
      {cameraOn && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            backgroundColor: 'black',
          }}
        >
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
            autoPlay
            playsInline
          />
        </Box>
      )}

      {/* Controls Navbar (always at top, one row) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          backgroundColor: 'rgba(30,30,30,0.9)',
          p: 1,
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Button
          variant="contained"
          onClick={startCamera}
          disabled={cameraOn}
          sx={{
            flex: 1,
            '&.Mui-disabled': {
              backgroundColor: 'rgba(70,70,70,0.8)',
              color: 'lightgray',
            },
          }}
        >
          🎥 Start Camera
        </Button>

        <Button
          variant="outlined"
          onClick={stopCamera}
          disabled={!cameraOn}
          sx={{
            flex: 1,
            '&.Mui-disabled': {
              borderColor: 'gray',
              color: 'lightgray',
            },
          }}
        >
          ⏹ Stop Camera
        </Button>

        <Button
          variant="outlined"
          onClick={() => {
            stopCamera();
            setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
            setTimeout(() => startCamera(), 500);
          }}
          disabled={!cameraOn}
          sx={{
            flex: 1,
            '&.Mui-disabled': {
              borderColor: 'gray',
              color: 'lightgray',
            },
          }}
        >
          🔄 Flip Camera
        </Button>

        <Button
          variant="contained"
          color="secondary"
          onClick={capturePhoto}
          disabled={!cameraOn}
          sx={{
            flex: 1,
            '&.Mui-disabled': {
              backgroundColor: 'rgba(70,70,70,0.8)',
              color: 'lightgray',
            },
          }}
        >
          📸 Photo
        </Button>

        <Button variant="text" color="error" onClick={handleLogout} sx={{ flex: 1 }}>
          🚪 Logout
        </Button>
      </Box>

      {/* Packet Details (center before start, right after start, bigger before start) */}
      <Box
        sx={{
          position: 'absolute',
          top: cameraOn ? 100 : '50%',
          right: cameraOn ? 60 : '50%',
          transform: cameraOn ? 'none' : 'translate(50%, -50%)',
          width: '90%',
          maxWidth: cameraOn ? 350 : 500,   // wider before camera starts
          zIndex: 2,
        }}
      >
        <Paper
          sx={{
            p: cameraOn ? 2 : 3,            // more padding before camera starts
            borderRadius: 3,
            backgroundColor: 'rgba(30,30,30,0.85)',
          }}
        >
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', color: '#90caf9' }}>
            Packet Details
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Scanned Code"
              fullWidth
              disabled
              value={scannedCode}
              InputProps={{ style: { color: '#fff' } }}
              InputLabelProps={{ style: { color: '#fff' } }}
              sx={{
                input: { color: '#fff', '::placeholder': { color: '#fff', opacity: 1 } },
                label: { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'lightgray' },
                  '&:hover fieldset': { borderColor: '#90caf9' },
                  '&.Mui-focused fieldset': { borderColor: '#90caf9' },
                },
              }}
            />
            <TextField
              label="Manual Code"
              fullWidth
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
              InputProps={{ style: { color: '#fff' } }}
              InputLabelProps={{ style: { color: '#fff' } }}
              sx={{
                input: { color: '#fff', '::placeholder': { color: '#fff', opacity: 1 } },
                label: { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'lightgray' },
                  '&:hover fieldset': { borderColor: '#90caf9' },
                  '&.Mui-focused fieldset': { borderColor: '#90caf9' },
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              sx={{
                border: '1px solid lightgray',
                '&.Mui-disabled': {
                  border: '1px solid gray',
                  color: 'lightgray',
                },
              }}
            >
              📦 Submit & Record
            </Button>
            <Divider />
            <Typography sx={{ color: '#fff' }}>
              <strong>Status:</strong> {recordingStatus}
            </Typography>
            <Typography sx={{ color: '#fff' }}>
              <strong>Timer:</strong> {timer}s
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Activity logs panel (floating left) */}
      <Box
        sx={{
          position: 'absolute',
          top: 100,
          left: 24,
          width: 320,
          maxHeight: '60vh',
          zIndex: 2,
        }}
      >
        <Paper sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(30,30,30,0.85)' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ color: '#fff' }}>
            Activity Logs
          </Typography>
          <Paper variant="outlined" sx={{
            maxHeight: 240, overflowY: 'auto', p: 1,
            backgroundColor: '#151515', borderColor: '#2c2c2c'
          }}>
            {logs.length === 0
              ? <Typography variant="body2" sx={{ color: '#aaa' }}>No activity yet</Typography>
              : logs.map((log, index) => <Typography key={index} variant="body2" sx={{ color: '#fff' }}>{log}</Typography>)
            }
          </Paper>
          <Stack direction="row" spacing={1} mt={2}>
            <Button variant="outlined" sx={{ borderColor: '#00C2A8', color: '#00C2A8' }} onClick={downloadLogs}>
              ⬇️ Download Logs
            </Button>
            <Button variant="outlined" sx={{ borderColor: '#00C2A8', color: '#00C2A8' }} onClick={downloadScannedLogs}>
              🔍 Download Scans
            </Button>
          </Stack>
        </Paper>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'gray',
          fontSize: '0.85rem',
          backgroundColor: 'rgba(0,0,0,0.6)',
          px: 2,
          py: 1,
          borderRadius: 2,
          zIndex: 2,
        }}
      >
        © 2025 Vivati Online Pvt Ltd | All rights reserved
      </Box>

      <audio id="beep-sound" src="/beep.mp3" preload="auto" />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Box>
  );
};

export default PacketRecorderApp;
