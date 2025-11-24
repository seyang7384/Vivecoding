import os
import asyncio
import json
import queue
import threading
import time
import struct # [추가] WAV 헤더 생성을 위해 필요
import requests
from dotenv import load_dotenv
import websockets
from websockets.server import serve

load_dotenv()

# 원장님의 정보
INVOKE_URL = "https://clovaspeech-gw.ncloud.com/external/v1/13590/4a8afe9a7aa788833f0e7ffeca45f57e94e549ac92209e374650cbe2119c885a"
SECRET_KEY = "65132a9940b14133989e7e325e8c2518"

def create_wav_header(data_length, sample_rate=16000, channels=1, bits_per_sample=16):
    """Raw PCM 데이터에 WAV 헤더를 붙여주는 함수"""
    file_length = data_length + 36
    return struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', file_length, b'WAVE',
        b'fmt ', 16, 1, channels, sample_rate,
        sample_rate * channels * (bits_per_sample // 8),
        channels * (bits_per_sample // 8),
        bits_per_sample,
        b'data', data_length
    )

class ClovaRelayServer:
    def __init__(self):
        self.websocket_clients = set()
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.worker_thread = None

    async def broadcast(self, msg_type, data):
        if self.websocket_clients:
            msg = json.dumps({"type": msg_type, **data})
            await asyncio.gather(*[c.send(msg) for c in self.websocket_clients], return_exceptions=True)

    def http_worker(self, loop):
        target_url = f"{INVOKE_URL}/recognizer/upload"
        print(f"🔗 Target: {target_url}")
        
        buffer = bytearray()
        last_send_time = time.time()
        
        while self.is_recording:
            try:
                chunk = self.audio_queue.get(timeout=0.1)
                buffer.extend(chunk)
                
                # 3초 분량 모이면 전송
                if len(buffer) > 96000 or (time.time() - last_send_time > 3 and len(buffer) > 0):
                    
                    headers = {'X-CLOVASPEECH-API-KEY': SECRET_KEY}
                    params = {
                        'language': 'ko-KR',
                        'completion': 'sync',
                    }
                    
                    # [핵심 수정] Raw 데이터 앞에 WAV 헤더를 붙임
                    wav_header = create_wav_header(len(buffer))
                    wav_data = wav_header + buffer
                    
                    # 파일명도 speech.wav로 변경하고 MIME type도 audio/wav로 명시
                    files = {
                        'media': ('speech.wav', wav_data, 'audio/wav'),
                        'params': (None, json.dumps(params), 'application/json')
                    }
                    
                    print(f"📤 Sending {len(wav_data)} bytes (WAV)...")
                    try:
                        response = requests.post(target_url, headers=headers, files=files, timeout=10)
                        
                        if response.status_code == 200:
                            res_json = response.json()
                            # 결과가 FAILED인지 확인
                            if res_json.get("result") == "FAILED":
                                print(f"❌ 서버 거부: {res_json.get('message')}")
                            else:
                                text = res_json.get('text', '')
                                if text:
                                    print(f"✅ 인식됨: {text}")
                                    asyncio.run_coroutine_threadsafe(
                                        self.broadcast('transcript', {'text': text, 'speaker': 'System'}), loop
                                    )
                                else:
                                    print("⚠️ 텍스트 없음 (음성 미감지)")
                        else:
                            print(f"❌ HTTP Error {response.status_code}: {response.text}")

                    except Exception as e:
                        print(f"❌ Request Fail: {e}")

                    buffer = bytearray()
                    last_send_time = time.time()
            except queue.Empty:
                continue

    # ... (서버 구동부 동일) ...
    async def start_recording(self, loop):
        if self.is_recording: return
        self.is_recording = True
        while not self.audio_queue.empty(): self.audio_queue.get()
        self.worker_thread = threading.Thread(target=self.http_worker, args=(loop,), daemon=True)
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
            print("🚀 Clova Relay Server Ready (WAV Mode)")
            await asyncio.Future()

if __name__ == "__main__":
    server = ClovaRelayServer()
    try: asyncio.run(server.run())
    except KeyboardInterrupt: pass