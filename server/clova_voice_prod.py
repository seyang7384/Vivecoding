#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Naver Clova Speech Recognition Bridge (Production)
Real microphone capture + gRPC streaming with threading
"""

import os
import asyncio
import json
import math
import threading
import queue
import numpy as np
import pyaudio
import grpc
from dotenv import load_dotenv
import websockets
from websockets.server import serve

# Import generated gRPC code
import nest_pb2
import nest_pb2_grpc

# Load environment variables
load_dotenv()

CLOVA_API_URL = os.getenv('CLOVA_SPEECH_INVOKE_URL', 'clovaspeech-gw.ncloud.com:50051')
CLOVA_SECRET = os.getenv('CLOVA_SPEECH_SECRET')

# Audio settings
SAMPLE_RATE = 16000
CHANNELS = 1  # Mono for Lark M2S (치료실은 2로 변경 필요)
CHUNK_SIZE = 1024
FORMAT = pyaudio.paInt16

# Medical keywords
MEDICAL_KEYWORDS = [
    {"words": "추나", "boost": 2},
    {"words": "약침", "boost": 2},
    {"words": "봉침", "boost": 2},
    {"words": "공진단", "boost": 2},
    {"words": "경옥고", "boost": 2},
]


class VoiceRecognitionBridge:
    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.is_recording = False
        self.websocket_clients = set()
        
        # Audio queues for left/right channels
        self.left_queue = queue.Queue()
        self.right_queue = queue.Queue()
        
        # gRPC threads
        self.grpc_threads = []
        
    def calculate_rms(self, audio_data):
        """Calculate RMS (Root Mean Square) volume"""
        if not audio_data or len(audio_data) == 0:
            return 0.0
        
        arr = np.frombuffer(audio_data, dtype=np.int16)
        if len(arr) == 0:
            return 0.0
        
        rms = np.sqrt(np.mean(arr**2))
        
        # Safety check for NaN/Inf
        if math.isnan(rms) or math.isinf(rms):
            return 0.0
        
        return rms
    
    def separate_stereo(self, audio_data):
        """Separate stereo into L/R channels, or duplicate mono to both"""
        arr = np.frombuffer(audio_data, dtype=np.int16)
        
        if CHANNELS == 1:
            # Mono: send same data to both Doctor and Nurse
            # (Station config will determine who this belongs to)
            return audio_data, audio_data
        else:
            # Stereo: separate L/R
            stereo = arr.reshape(-1, 2)
            left = stereo[:, 0].tobytes()
            right = stereo[:, 1].tobytes()
            return left, right
    
    async def broadcast_to_clients(self, message):
        """Send message to all WebSocket clients"""
        if self.websocket_clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.websocket_clients],
                return_exceptions=True
            )
    
    def grpc_stream_worker(self, speaker, audio_queue, loop):
        """gRPC worker thread (runs in separate thread)"""
        try:
            # Create gRPC channel
            credentials = grpc.ssl_channel_credentials()
            channel = grpc.secure_channel(CLOVA_API_URL, credentials)
            stub = nest_pb2_grpc.NestServiceStub(channel)
            
            # Create metadata
            metadata = [('authorization', f'Bearer {CLOVA_SECRET}')]
            
            # Request generator
            def request_generator():
                # Send config first
                config = {
                    'language': 'ko-KR',
                    'completion': 'sync',
                    'boostings': MEDICAL_KEYWORDS
                }
                config_msg = nest_pb2.NestRequest(
                    config=nest_pb2.NestConfig(config=json.dumps(config))
                )
                yield config_msg
                
                # Then send audio chunks
                while self.is_recording:
                    try:
                        audio_chunk = audio_queue.get(timeout=0.1)
                        chunk_msg = nest_pb2.NestRequest(chunk=audio_chunk)
                        yield chunk_msg
                    except queue.Empty:
                        continue
            
            # Start bi-directional stream with generator
            responses = stub.recognize(request_generator(), metadata=metadata)
            
            print(f"[{speaker}] gRPC stream started")
            
            # Read responses
            try:
                for response in responses:
                    if response.contents:
                        try:
                            result = json.loads(response.contents)
                            text = result.get('text', '')
                            
                            if text:
                                # Schedule broadcast in event loop
                                asyncio.run_coroutine_threadsafe(
                                    self.broadcast_to_clients({
                                        'type': 'transcript',
                                        'speaker': speaker,
                                        'text': text
                                    }),
                                    loop
                                )
                                print(f"[{speaker}] {text}")
                        except json.JSONDecodeError:
                            pass
            except Exception as e:
                print(f"[{speaker}] Response error: {e}")
            
            channel.close()
            print(f"[{speaker}] gRPC stream ended")
            
        except Exception as e:
            print(f"[{speaker}] gRPC Error: {e}")
            import traceback
            traceback.print_exc()
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_clients({
                    'type': 'error',
                    'speaker': speaker,
                    'message': str(e)
                }),
                loop
            )
    
    def audio_callback(self, in_data, frame_count, time_info, status):
        """PyAudio callback (runs in audio thread)"""
        if self.is_recording and in_data:
            # Calculate RMS
            rms = self.calculate_rms(in_data)
            normalized_level = min(rms / 32768.0, 1.0)
            
            # Safety check before sending
            if math.isnan(normalized_level) or math.isinf(normalized_level):
                normalized_level = 0.0
            
            # Send to main thread for WebSocket broadcast
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_clients({
                    'type': 'meter',
                    'level': float(normalized_level)  # Ensure it's a valid float
                }),
                self.event_loop
            )
            
            # Separate channels and queue
            left, right = self.separate_stereo(in_data)
            self.left_queue.put(left)
            self.right_queue.put(right)
        
        return (in_data, pyaudio.paContinue)
    
    async def start_recording(self):
        """Start recording"""
        if self.is_recording:
            return
        
        print("Starting recording...")
        self.is_recording = True
        
        # Clear queues
        while not self.left_queue.empty():
            self.left_queue.get()
        while not self.right_queue.empty():
            self.right_queue.get()
        
        # Start gRPC workers
        loop = asyncio.get_event_loop()
        self.event_loop = loop
        
        doctor_thread = threading.Thread(
            target=self.grpc_stream_worker,
            args=('Doctor', self.left_queue, loop),
            daemon=True
        )
        nurse_thread = threading.Thread(
            target=self.grpc_stream_worker,
            args=('Nurse', self.right_queue, loop),
            daemon=True
        )
        
        doctor_thread.start()
        nurse_thread.start()
        self.grpc_threads = [doctor_thread, nurse_thread]
        
        # Start PyAudio stream
        try:
            # Try to use device index 1 (Wireless microphone)
            self.stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=SAMPLE_RATE,
                input=True,
                input_device_index=1,  # Wireless microphone
                frames_per_buffer=CHUNK_SIZE,
                stream_callback=self.audio_callback
            )
            print(f"✅ Opened audio device index 1 (Wireless microphone)")
        except Exception as e:
            print(f"❌ Failed to open device 1, trying default: {e}")
            # Fallback to default device
            self.stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=SAMPLE_RATE,
                input=True,
                frames_per_buffer=CHUNK_SIZE,
                stream_callback=self.audio_callback
            )
            print("✅ Opened default audio device")
        
        self.stream.start_stream()
        print("Microphone stream started")
    
    async def stop_recording(self):
        """Stop recording"""
        if not self.is_recording:
            return
        
        print("Stopping recording...")
        self.is_recording = False
        
        # Stop PyAudio
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        
        # Wait for gRPC threads
        for thread in self.grpc_threads:
            thread.join(timeout=2)
        self.grpc_threads = []
        
        print("Recording stopped")
    
    async def handle_websocket(self, websocket):
        """Handle WebSocket client"""
        self.websocket_clients.add(websocket)
        print(f"✅ Client connected. Total: {len(self.websocket_clients)}")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    command = data.get('command')
                    
                    print(f"Command: {command}")
                    
                    if command == 'start':
                        await self.start_recording()
                    elif command == 'stop':
                        await self.stop_recording()
                except json.JSONDecodeError as e:
                    print(f"JSON error: {e}")
        
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.websocket_clients.discard(websocket)
            print(f"❌ Client disconnected. Total: {len(self.websocket_clients)}")
    
    async def run_server(self):
        """Run WebSocket server"""
        async with serve(self.handle_websocket, "localhost", 3001):
            print("🎙️ Voice Recognition Bridge (PRODUCTION)")
            print(f"🔗 Clova API: {CLOVA_API_URL}")
            print(f"🔑 Secret: {'✓' if CLOVA_SECRET else '✗'}")
            print("📡 Waiting for connections...")
            await asyncio.Future()
    
    def close(self):
        """Cleanup"""
        self.audio.terminate()


async def main():
    bridge = VoiceRecognitionBridge()
    try:
        await bridge.run_server()
    except KeyboardInterrupt:
        print("\nShutting down...")
        await bridge.stop_recording()
        bridge.close()


if __name__ == "__main__":
    asyncio.run(main())
