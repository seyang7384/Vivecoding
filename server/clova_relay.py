import os
import asyncio
import json
import queue
import threading
import time
import struct
import requests
import numpy as np
from dotenv import load_dotenv
import websockets
from websockets.server import serve

load_dotenv()

# Clova Speech API Info
INVOKE_URL = "https://clovaspeech-gw.ncloud.com/external/v1/13590/4a8afe9a7aa788833f0e7ffeca45f57e94e549ac92209e374650cbe2119c885a"
SECRET_KEY = "65132a9940b14133989e7e325e8c2518"

# [Settings]
# Mono mode settings
VAD_THRESHOLD = 300     # Threshold for voice activity detection
SILENCE_TIMEOUT = 3.0   # Send after 3 seconds of silence
MAX_DURATION = 15.0     # Force send after 15 seconds

def create_wav_header(data_length, sample_rate=16000, channels=1, bits_per_sample=16):
    file_length = data_length + 36
    return struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', file_length, b'WAVE',
        b'fmt ', 16, 1, channels, sample_rate, sample_rate * channels * 2, channels * 2, bits_per_sample, b'data', data_length
    )

class ClovaRelayServer:
    def __init__(self):
        self.websocket_clients = set()
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.worker_thread = None
        self.boostings = self.load_boostings()
        self.corrections = self.load_corrections()
        
        # Buffer for single channel
        self.audio_buffer = bytearray()
        self.last_input_time = time.time()
        self.last_send_time = time.time()

    def load_boostings(self):
        boostings = []
        try:
            boosting_file = os.path.join(os.path.dirname(__file__), 'boostings.txt')
            if os.path.exists(boosting_file):
                content = open(boosting_file, 'r', encoding='utf-8', errors='ignore').read().strip()
                if content:
                    # Split by both newlines and commas
                    import re
                    all_words = [w.strip() for w in re.split(r'[,\n]+', content) if w.strip()]
                    
                    # Limit to 1000 words
                    limited_words = all_words[:1000]
                    if limited_words:
                        boostings.append({"words": ",".join(limited_words)})
                    print(f"📚 Loaded {len(limited_words)} boosting keywords. Examples: {limited_words[:5]}")
        except Exception as e: print(f"⚠️ {e}")
        return boostings

    def load_corrections(self):
        try:
            file_path = os.path.join(os.path.dirname(__file__), 'corrections.json')
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"⚠️ Failed to load corrections: {e}")
        return {}

    def save_corrections(self, new_data):
        try:
            file_path = os.path.join(os.path.dirname(__file__), 'corrections.json')
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(new_data, f, ensure_ascii=False, indent=2)
            self.corrections = new_data
            print(f"✅ Saved {len(new_data)} corrections")
        except Exception as e:
            print(f"⚠️ Failed to save corrections: {e}")

    def apply_corrections(self, text):
        if not text: return text
        for wrong, correct in self.corrections.items():
            if wrong in text:
                text = text.replace(wrong, correct)
        return text

    async def broadcast(self, msg_type, data):
        if self.websocket_clients:
            print(f"📡 Broadcasting to {len(self.websocket_clients)} clients")
            msg = json.dumps({"type": msg_type, **data})
            await asyncio.gather(*[c.send(msg) for c in self.websocket_clients], return_exceptions=True)

    def send_buffer(self, loop):
        if len(self.audio_buffer) < 3200: # Ignore < 0.1s
            self.audio_buffer = bytearray()
            return

        current_buffer = self.audio_buffer[:]
        self.audio_buffer = bytearray()
        self.last_send_time = time.time()

        threading.Thread(target=self._send_request, args=(current_buffer, loop)).start()

    def _send_request(self, audio_data, loop):
        try:
            url = f"{INVOKE_URL}/recognizer/upload"
            headers = {'X-CLOVASPEECH-API-KEY': SECRET_KEY}
            params = {
                'language': 'ko-KR',
                'completion': 'sync',
                'boostings': self.boostings,
                'diarization': {
                    'enable': False
                }
            }
            # Mono WAV
            wav = create_wav_header(len(audio_data), channels=1) + audio_data
            files = {
                'media': ('speech.wav', wav, 'audio/wav'),
                'params': (None, json.dumps(params), 'application/json')
            }
            
            res = requests.post(url, headers=headers, files=files, timeout=10)
            
            if res.status_code == 200:
                data = res.json()
                text = data.get('text', '')
                if text:
                    # Apply corrections
                    original_text = text
                    text = self.apply_corrections(text)
                    if text != original_text:
                        print(f"🔧 Corrected: '{original_text}' -> '{text}'")
                    
                    print(f"📝 Transcript: {text}")
                    asyncio.run_coroutine_threadsafe(
                        self.broadcast('transcript', {'text': text, 'speaker': 'Director'}), loop
                    )
                else:
                    print(f"⚪ Empty response")
            else:
                print(f"❌ API Error {res.status_code}: {res.text}")
        except Exception as e:
            print(f"❌ Request Failed: {e}")

    def main_worker(self, loop):
        print("🎧 Mono Processing Started")
        
        while self.is_recording:
            try:
                chunk = self.audio_queue.get(timeout=0.1)
                
                # Assume input is already mono Int16 PCM from frontend
                self.audio_buffer.extend(chunk)
                self.last_input_time = time.time()

                # Calculate RMS for VAD logging (optional)
                if len(chunk) > 0:
                    arr = np.frombuffer(chunk, dtype=np.int16).astype(np.float32)
                    rms = np.sqrt(np.mean(arr**2))
                    # print(f"RMS: {rms:.0f}") # Too noisy, maybe log occasionally

                # Check force send
                time_since_send = time.time() - self.last_send_time
                if len(self.audio_buffer) > 320000 or time_since_send > MAX_DURATION: # 20s or max duration
                    print("⚡ Force Send (Duration/Size)")
                    self.send_buffer(loop)

            except queue.Empty:
                # Check silence timeout
                if len(self.audio_buffer) > 0 and (time.time() - self.last_input_time > SILENCE_TIMEOUT):
                    print("✨ Silence Send")
                    self.send_buffer(loop)
                continue

    async def start_recording(self, loop):
        if self.is_recording: return
        self.is_recording = True
        while not self.audio_queue.empty(): self.audio_queue.get()
        
        self.worker_thread = threading.Thread(target=self.main_worker, args=(loop,), daemon=True)
        self.worker_thread.start()
        print("✅ Recording Started")

    async def stop_recording(self):
        self.is_recording = False
        if self.worker_thread: self.worker_thread.join(timeout=1)
        print("✅ Recording Stopped")

    async def handle_client(self, websocket):
        # Enforce single client: Clear existing clients to prevent duplicates
        if self.websocket_clients:
            print(f"⚠️ New client connected. Clearing {len(self.websocket_clients)} old clients.")
            self.websocket_clients.clear()
            
        self.websocket_clients.add(websocket)
        loop = asyncio.get_event_loop()
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    if self.is_recording: self.audio_queue.put(message)
                else:
                    try:
                        data = json.loads(message)
                        cmd = data.get('command')
                        
                        if cmd == 'start': 
                            await self.start_recording(loop)
                        elif cmd == 'stop': 
                            await self.stop_recording()
                        elif cmd == 'update_keywords':
                            # Same keyword update logic
                            new_keywords = data.get('keywords', [])
                            if new_keywords:
                                base_keywords = self.load_boostings()
                                combined_words = []
                                if base_keywords:
                                    combined_words.extend(base_keywords[0]['words'].split(','))
                                combined_words.extend(new_keywords)
                                unique_words = list(set([w.strip() for w in combined_words if w.strip()]))
                                self.boostings = [{"words": ",".join(unique_words[:1000])}] # Limit 1000
                                print(f"📚 Updated boostings: {len(unique_words[:1000])}")
                        elif cmd == 'get_corrections':
                            await self.broadcast('corrections', {'data': self.corrections})
                        elif cmd == 'save_corrections':
                            new_corrections = data.get('data', {})
                            self.save_corrections(new_corrections)
                            await self.broadcast('corrections', {'data': self.corrections})
                    except json.JSONDecodeError:
                        pass
        except: pass
        finally: self.websocket_clients.discard(websocket)

    async def run(self):
        async with serve(self.handle_client, "localhost", 3001):
            print(f"🚀 Clova Relay (Mono Mode)")
            await asyncio.Future()

if __name__ == "__main__":
    server = ClovaRelayServer()
    try: asyncio.run(server.run())
    except KeyboardInterrupt: pass