export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private onAudioData: (base64Data: string) => void;

  constructor(onAudioData: (base64Data: string) => void) {
    this.onAudioData = onAudioData;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use system sample rate to avoid connection errors
      this.audioContext = new AudioContext();
      const sourceSampleRate = this.audioContext.sampleRate;
      
      this.input = this.audioContext.createMediaStreamSource(this.stream);
      
      // Use ScriptProcessor for raw audio access
      // Buffer size 4096 provides good balance between latency and performance
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const targetSampleRate = 24000;
        
        // Resample if necessary
        let pcmData: Int16Array;
        
        if (sourceSampleRate === targetSampleRate) {
          pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
        } else {
          const ratio = sourceSampleRate / targetSampleRate;
          const newLength = Math.floor(inputData.length / ratio);
          pcmData = new Int16Array(newLength);
          
          for (let i = 0; i < newLength; i++) {
            const offset = i * ratio;
            const index = Math.floor(offset);
            const nextIndex = Math.min(index + 1, inputData.length - 1);
            const fraction = offset - index;
            
            // Linear interpolation
            const sample = inputData[index] * (1 - fraction) + inputData[nextIndex] * fraction;
            const s = Math.max(-1, Math.min(1, sample));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
        }
        
        // Convert to Base64
        const buffer = pcmData.buffer;
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        this.onAudioData(base64);
      };

      this.input.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error starting audio recording:', error);
      throw error;
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.input) {
      this.input.disconnect();
      this.input = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export class VoicePreviewPlayer {
  private audioContext: AudioContext | null = null;
  private ws: WebSocket | null = null;
  private onLoading: (isLoading: boolean) => void;
  private onError: (error: string) => void;
  private nextStartTime: number = 0;

  constructor(
    onLoading: (isLoading: boolean) => void,
    onError: (error: string) => void
  ) {
    this.onLoading = onLoading;
    this.onError = onError;
  }

  async play(voice: string) {
    this.stop();
    this.onLoading(true);

    try {
      // Get ephemeral token
      const tokenResponse = await fetch(`/api/realtime-token?voice=${voice}`, {
        method: 'POST',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get token');
      }

      const data = await tokenResponse.json();
      const clientSecret = data.client_secret.value;

      // Connect to WebSocket
      this.ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        ['realtime', `openai-insecure-api-key.${clientSecret}`, 'openai-beta.realtime-v1']
      );

      this.ws.onopen = () => {
        // Configure session
        this.ws?.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            voice: voice,
          }
        }));

        // Send text to generate audio
        this.ws?.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: "Hello, I'm your AI assistant."
              }
            ]
          }
        }));

        this.ws?.send(JSON.stringify({
          type: 'response.create',
        }));
      };

      this.ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'response.audio.delta') {
          this.onLoading(false);
          await this.queueAudio(message.delta);
        } else if (message.type === 'error') {
           this.onError(message.error?.message || 'Unknown error');
           this.stop();
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        this.onError('Connection error');
        this.stop();
      };

    } catch (err) {
      this.onError(err instanceof Error ? err.message : 'Failed to play preview');
      this.stop();
    }
  }

  private async queueAudio(base64Data: string) {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.nextStartTime = this.audioContext.currentTime;
    }

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
  }

  stop() {
    this.onLoading(false);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.nextStartTime = 0;
  }
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private onStateChange: (isPlaying: boolean) => void;
  private sourceNodes: AudioBufferSourceNode[] = [];
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  constructor(onStateChange: (isPlaying: boolean) => void) {
    this.onStateChange = onStateChange;
  }

  async play(base64Data: string) {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.nextStartTime = this.audioContext.currentTime;
      
      // Create analyser for lip sync
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.connect(this.audioContext.destination);
    }

    // Resume context if suspended (browser policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Connect through analyser for lip sync
    if (this.analyser) {
      source.connect(this.analyser);
    } else {
      source.connect(this.audioContext.destination);
    }

    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
    
    this.sourceNodes.push(source);
    
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.onStateChange(true);
    }

    source.onended = () => {
      this.sourceNodes = this.sourceNodes.filter(s => s !== source);
      if (this.sourceNodes.length === 0 && this.audioContext && this.audioContext.currentTime >= this.nextStartTime - 0.1) {
        this.isPlaying = false;
        this.onStateChange(false);
      }
    };
  }

  /**
   * Get current audio volume for lip sync (0.0 to 1.0)
   */
  getVolume(): number {
    if (!this.analyser || !this.dataArray || !this.isPlaying) {
      return 0;
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate average amplitude
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    
    // Normalize to 0.0-1.0 range (with some amplification for visibility)
    return Math.min(1.0, (average / 255.0) * 2.5);
  }

  async pause() {
    if (this.audioContext && this.audioContext.state === 'running') {
      await this.audioContext.suspend();
      this.isPlaying = false;
      this.onStateChange(false);
    }
  }

  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      this.isPlaying = true;
      this.onStateChange(true);
    }
  }

  interrupt() {
    this.sourceNodes.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
    });
    this.sourceNodes = [];
    this.nextStartTime = 0;
    if (this.audioContext) {
        this.nextStartTime = this.audioContext.currentTime;
    }
    this.isPlaying = false;
    this.onStateChange(false);
  }

  stop() {
    this.interrupt();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }
}

export function parseWAVFile(base64WAV: string): { 
  pcmData: ArrayBuffer, 
  sampleRate: number,
  channels: number 
} {
  const binaryString = atob(base64WAV);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const dataView = new DataView(bytes.buffer);
  
  // Parse RIFF header
  // "RIFF" at bytes 0-3
  // File size at bytes 4-7
  // "WAVE" at bytes 8-11
  
  // Find chunks
  let offset = 12; // Start after "RIFF" + size + "WAVE"
  let sampleRate = 44100;
  let numChannels = 1;
  let pcmData: ArrayBuffer | null = null;

  while (offset < bytes.length - 8) {
    const chunkId = String.fromCharCode(...Array.from(bytes.slice(offset, offset + 4)));
    const chunkSize = dataView.getUint32(offset + 4, true);
    
    if (chunkId === 'fmt ') {
      // Parse fmt chunk
      // audioFormat at offset + 8 (2 bytes)
      numChannels = dataView.getUint16(offset + 10, true);
      sampleRate = dataView.getUint32(offset + 12, true);
      // bitsPerSample at offset + 22 (2 bytes)
    } else if (chunkId === 'data') {
      pcmData = bytes.buffer.slice(offset + 8, offset + 8 + chunkSize);
      // We found the data, we can stop if we already have fmt info, 
      // but usually fmt comes before data.
      if (pcmData) break;
    }
    
    offset += 8 + chunkSize;
  }
  
  if (!pcmData) {
    throw new Error('No data chunk found in WAV file');
  }

  return { pcmData, sampleRate, channels: numChannels };
}

export function chunkPCMData(pcmData: ArrayBuffer, chunkSizeMs: number, sampleRate: number): ArrayBuffer[] {
  const bytesPerSample = 2; // Int16
  const samplesPerMs = sampleRate / 1000;
  const chunkSizeSamples = Math.floor(chunkSizeMs * samplesPerMs);
  const chunkSizeBytes = chunkSizeSamples * bytesPerSample;
  
  const chunks: ArrayBuffer[] = [];
  for (let i = 0; i < pcmData.byteLength; i += chunkSizeBytes) {
    chunks.push(pcmData.slice(i, Math.min(i + chunkSizeBytes, pcmData.byteLength)));
  }
  return chunks;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
