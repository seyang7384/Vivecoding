import os, asyncio, json, queue, threading, time, struct, requests, numpy as np
from dotenv import load_dotenv
from websockets.server import serve

load_dotenv()

# Clova Speech API Info
INVOKE_URL = "https://clovaspeech-gw.ncloud.com/external/v1/13590/4a8afe9a7aa788833f0e7ffeca45f57e94e549ac92209e374650cbe2119c885a"
SECRET_KEY = "65132a9940b14133989e7e325e8c2518"

# [Settings]
DIGITAL_GAIN = 30.0     # High gain to pick up whispers
VAD_THRESHOLD = 500     # Low threshold (since we rely on Ratio)
DOMINANCE_RATIO = 1.05  # Extreme Winner-Takes-All (1.05x louder wins)
SILENCE_TIMEOUT = 1.0   # Send after 1s silence
MAX_DURATION = 10.0     # Force send every 10s

def create_wav_header(data_length, sample_rate=16000, channels=1, bits_per_sample=16):
    file_length = data_length + 36
    return struct.pack(
        '\u003c4sI4s4sIHHIIHH4sI',
        b'RIFF', file_length, b'WAVE',
        b'fmt ', 16, 1, 1, 16000, 32000, 2, 16, b'data', data_length
    )

def calculate_rms(audio_data):
    if not audio_data: return 0
    try:
        arr = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        return np.sqrt(np.mean(arr**2))
    except: return 0

class ChannelProcessor:
    """Manages buffer and sending for a single channel"""
    def __init__(self, name, server):
        self.name = name # 'Left' or 'Right' (Mapped to '치료실', '원장님' in frontend)
        self.server = server
        self.buffer = bytearray()
        self.last_input_time = time.time()
        self.last_send_time = time.time()

    def add_data(self, data, loop):
        if not data: return
        
        self.buffer.extend(data)
        self.last_input_time = time.time()
        
        # Check force send conditions
        time_since_send = time.time() - self.last_send_time
        if len(self.buffer) > 320000 or time_since_send > MAX_DURATION: # 20s or max duration
            print(f"⚡ [{self.name}] Force Send")
            self.send(loop)

    def check_silence(self, loop):
        # Send if we have data and it's been silent for a while
        if len(self.buffer) > 0 and (time.time() - self.last_input_time > SILENCE_TIMEOUT):
            # print(f"✨ [{self.name}] Silence Send")
            self.send(loop)

    def send(self, loop):
        if len(self.buffer) < 4000: # Ignore very short chunks (< 0.25s)
            self.buffer = bytearray()
            return

        current_buffer = self.buffer[:]
        self.buffer = bytearray()
        self.last_send_time = time.time()

        # Send in a separate thread to avoid blocking the audio loop
        threading.Thread(target=self._send_request, args=(current_buffer, loop)).start()

    def _send_request(self, audio_data, loop):
        try:
            url = f"{INVOKE_URL}/recognizer/upload"
            headers = {'X-CLOVASPEECH-API-KEY': SECRET_KEY}
            params = {
                'language': 'ko-KR',
                'completion': 'sync',
                'boostings': self.server.boostings
            }
            wav = create_wav_header(len(audio_data)) + audio_data
            files = {
                'media': ('speech.wav', wav, 'audio/wav'),
                'params': (None, json.dumps(params), 'application/json')
            }
            
            # print(f"📤 [{self.name}] Sending {len(audio_data)} bytes...")
            res = requests.post(url, headers=headers, files=files, timeout=10)
            
            if res.status_code == 200:
                text = res.json().get('text', '')
                if text:
                    print(f"📝 [{self.name}]: {text}")
                    # Broadcast to frontend
                    # Note: Frontend expects 'Left' or 'Right' as speaker to map to roles
                    asyncio.run_coroutine_threadsafe(
                        self.server.broadcast('transcript', {'text': text, 'speaker': self.name}), loop
                    )
        except Exception as e:
            print(f"❌ [{self.name}] Error: {e}")

class ClovaRelayServer:
    def __init__(self):
        self.websocket_clients = set()
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.worker_thread = None
        self.boostings = self.load_boostings()
        
        # Processors for Left (Director) and Right (Treatment Room)
        self.proc_left = None
        self.proc_right = None

    def load_boostings(self):
        boostings = []
        try:
            boosting_file = os.path.join(os.path.dirname(__file__), 'boostings.txt')
            if os.path.exists(boosting_file):
                words = [line.strip() for line in open(boosting_file, 'r', encoding='utf-8') if line.strip()]
                if words: boostings.append({"words": ",".join(words)})
                print(f"📚 {len(words)} keywords")
        except Exception as e: print(f"⚠️ {e}")
        return boostings

    async def broadcast(self, msg_type, data):
        if self.websocket_clients:
            msg = json.dumps({"type": msg_type, **data})
            await asyncio.gather(*[c.send(msg) for c in self.websocket_clients], return_exceptions=True)

    def main_worker(self, loop):
        print("🎧 Stereo Separation Started (Winner Takes All)")
        last_log = 0
        
        while self.is_recording:
            try:
                # 1. Get Chunk
                chunk = self.audio_queue.get(timeout=0.1)
                
                # 2. Deinterleave & Gain
                try:
                    arr = np.frombuffer(chunk, dtype=np.int16)
                    # Apply Gain and Clip
                    arr = np.clip(arr * DIGITAL_GAIN, -32768, 32767).astype(np.int16)
                    
                    # Even: Left, Odd: Right
                    left_raw = arr[0::2].tobytes()
                    right_raw = arr[1::2].tobytes()
                    
                    # RMS Calc
                    rms_l = calculate_rms(left_raw)
                    rms_r = calculate_rms(right_raw)
                    
                    if time.time() - last_log > 1.0:
                         print(f"MIC L:{rms_l:.0f} R:{rms_r:.0f}")
                         last_log = time.time()

                    # 3. Winner Takes All Logic
                    # If both are quiet, ignore (Noise Gate)
                    if rms_l < VAD_THRESHOLD and rms_r < VAD_THRESHOLD:
                        pass 
                    
                    # Left is dominant (1.2x louder) -> Left wins
                    elif rms_l > rms_r * DOMINANCE_RATIO:
                        self.proc_left.add_data(left_raw, loop)
                        
                    # Right is dominant (1.2x louder) -> Right wins
                    elif rms_r > rms_l * DOMINANCE_RATIO:
                        self.proc_right.add_data(right_raw, loop)
                        
                    # Similar volume -> Allow both (Independent speech or ambiguous)
                    else:
                        self.proc_left.add_data(left_raw, loop)
                        self.proc_right.add_data(right_raw, loop)
                        
                except Exception as e:
                    print(f"⚠️ Process Error: {e}")

            except queue.Empty:
                # Check silence timeouts when no data
                if self.proc_left: self.proc_left.check_silence(loop)
                if self.proc_right: self.proc_right.check_silence(loop)
                continue

    async def start_recording(self, loop):
        if self.is_recording: return
        self.is_recording = True
        while not self.audio_queue.empty(): self.audio_queue.get()
        
        # Initialize Processors
        # Name them 'Left' and 'Right' to match frontend expectations
        self.proc_left = ChannelProcessor("Left", self)
        self.proc_right = ChannelProcessor("Right", self)
        
        self.worker_thread = threading.Thread(target=self.main_worker, args=(loop,), daemon=True)
        self.worker_thread.start()
        print("✅ Recording Started")

    async def stop_recording(self):
        self.is_recording = False
        if self.worker_thread: self.worker_thread.join(timeout=1)
        print("✅ Recording Stopped")

    async def handle_client(self, websocket):
        self.websocket_clients.add(websocket)
        loop = asyncio.get_event_loop()
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    if self.is_recording: self.audio_queue.put(message)
                else:
                    cmd = json.loads(message).get('command')
                    if cmd == 'start': await self.start_recording(loop)
                    elif cmd == 'stop': await self.stop_recording()
        except: pass
        finally: self.websocket_clients.discard(websocket)

    async def run(self):
        async with serve(self.handle_client, "localhost", 3001):
            print(f"🚀 Clova Relay (Gain:{DIGITAL_GAIN}, Ratio:{DOMINANCE_RATIO})")
            await asyncio.Future()

if __name__ == "__main__":
    server = ClovaRelayServer()
    try: asyncio.run(server.run())
    except KeyboardInterrupt: pass
