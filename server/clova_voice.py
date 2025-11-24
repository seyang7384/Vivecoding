#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Naver Clova Speech Recognition Bridge
Captures stereo microphone input, separates channels, and streams to Naver Clova gRPC API
"""

import os
import asyncio
import json
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
CHANNELS = 2
CHUNK_SIZE = 1024  # Samples per channel
FORMAT = pyaudio.paInt16

# VAD settings (simple volume-based)
VAD_THRESHOLD = 500  # RMS threshold for speech detection
SILENCE_DURATION = 1.5  # seconds of silence before stopping

# Medical keywords for boosting
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
        
        # gRPC streams for left (Doctor) and right (Nurse)
        self.grpc_streams = {'Doctor': None, 'Nurse': None}
        
    def calculate_rms(self, audio_data):
        """Calculate RMS (Root Mean Square) volume"""
        arr = np.frombuffer(audio_data, dtype=np.int16)
        return np.sqrt(np.mean(arr**2))
    
    def simple_vad(self, audio_data):
        """Simple volume-based VAD"""
        rms = self.calculate_rms(audio_data)
        return rms > VAD_THRESHOLD
    
    def separate_stereo(self, stereo_data):
        """Separate stereo audio into left and right channels"""
        arr = np.frombuffer(stereo_data, dtype=np.int16)
        stereo = arr.reshape(-1, 2)
        left = stereo[:, 0].tobytes()
        right = stereo[:, 1].tobytes()
        return left, right
    
    async def broadcast_to_clients(self, message):
        """Send message to all connected WebSocket clients"""
        if self.websocket_clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.websocket_clients],
                return_exceptions=True
            )
    
    def create_grpc_channel(self):
        """Create authenticated gRPC channel"""
        credentials = grpc.ssl_channel_credentials()
        channel = grpc.secure_channel(CLOVA_API_URL, credentials)
        
        # Create metadata with authorization
        metadata = [('authorization', f'Bearer {CLOVA_SECRET}')]
        
        return channel, metadata
    
    async def grpc_stream_handler(self, speaker):
        """Handle gRPC streaming for one speaker (Doctor or Nurse)"""
        try:
            channel, metadata = self.create_grpc_channel()
            stub = nest_pb2_grpc.NestServiceStub(channel)
            
            # Create config
            config = {
                'language': 'ko-KR',
                'completion': 'sync',
                'boostings': MEDICAL_KEYWORDS
            }
            
            config_msg = nest_pb2.NestRequest(
                config=nest_pb2.NestConfig(config=json.dumps(config))
            )
            
            # Start bi-directional stream
            call = stub.recognize(metadata=metadata)
            
            # Send config first
            await asyncio.to_thread(call.write, config_msg)
            
            print(f"[{speaker}] gRPC stream started")
            
            # Listen for responses
            async for response in asyncio.to_thread(call):
                if response.contents:
                    try:
                        result = json.loads(response.contents)
                        text = result.get('text', '')
                        
                        if text:
                            await self.broadcast_to_clients({
                                'type': 'transcript',
                                'speaker': speaker,
                                'text': text
                            })
                            print(f"[{speaker}] {text}")
                    except json.JSONDecodeError:
                        pass
            
        except Exception as e:
            print(f"[{speaker}] gRPC Error: {e}")
            await self.broadcast_to_clients({
                'type': 'error',
                'speaker': speaker,
                'message': str(e)
            })
    
    async def audio_callback(self, audio_data):
        """Process captured audio data"""
        if not self.is_recording:
            return
        
        # Calculate and send audio level
        rms = self.calculate_rms(audio_data)
        normalized_level = min(rms / 32768.0, 1.0)
        
        await self.broadcast_to_clients({
            'type': 'meter',
            'level': normalized_level
        })
        
        # VAD check
        is_speech = self.simple_vad(audio_data)
        
        # Separate stereo channels
        left, right = self.separate_stereo(audio_data)
        
        # Send to gRPC streams
        if is_speech and self.grpc_streams['Doctor']:
            chunk_msg = nest_pb2.NestRequest(chunk=left)
            await asyncio.to_thread(self.grpc_streams['Doctor'].write, chunk_msg)
        
        if is_speech and self.grpc_streams['Nurse']:
            chunk_msg = nest_pb2.NestRequest(chunk=right)
            await asyncio.to_thread(self.grpc_streams['Nurse'].write, chunk_msg)
    
    async def start_recording(self):
        """Start audio capture and gRPC streaming"""
        if self.is_recording:
            return
        
        print("Starting recording...")
        self.is_recording = True
        
        # Start gRPC streams
        asyncio.create_task(self.grpc_stream_handler('Doctor'))
        asyncio.create_task(self.grpc_stream_handler('Nurse'))
        
        # Start audio capture
        self.stream = self.audio.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_SIZE,
            stream_callback=lambda in_data, frame_count, time_info, status: (in_data, pyaudio.paContinue)
        )
        
        self.stream.start_stream()
        
        # Audio processing loop
        while self.is_recording:
            if self.stream.is_active():
                audio_data = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)
                await self.audio_callback(audio_data)
            await asyncio.sleep(0.01)
    
    async def stop_recording(self):
        """Stop audio capture and gRPC streaming"""
        if not self.is_recording:
            return
        
        print("Stopping recording...")
        self.is_recording = False
        
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        
        # Close gRPC streams
        for speaker, stream in self.grpc_streams.items():
            if stream:
                await asyncio.to_thread(stream.done)
                self.grpc_streams[speaker] = None
    
    async def handle_websocket(self, websocket):
        """Handle WebSocket client connection"""
        self.websocket_clients.add(websocket)
        print(f"Client connected. Total clients: {len(self.websocket_clients)}")
        
        try:
            async for message in websocket:
                data = json.loads(message)
                command = data.get('command')
                
                if command == 'start':
                    await self.start_recording()
                elif command == 'stop':
                    await self.stop_recording()
        
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.websocket_clients.remove(websocket)
            print(f"Client disconnected. Total clients: {len(self.websocket_clients)}")
    
    async def run_server(self):
        """Run WebSocket server"""
        async with serve(self.handle_websocket, "localhost", 3001):
            print("🎙️ Voice Recognition Bridge running on ws://localhost:3001")
            print(f"🔗 Clova API: {CLOVA_API_URL}")
            print(f"🔑 Secret Key: {'✓' if CLOVA_SECRET else '✗'}")
            await asyncio.Future()  # Run forever
    
    def close(self):
        """Cleanup resources"""
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
