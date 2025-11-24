#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Naver Clova Speech Recognition Bridge (Simplified)
WebSocket server that sends test messages to browser
"""

import os
import asyncio
import json
from dotenv import load_dotenv
import websockets
from websockets.server import serve

# Load environment variables
load_dotenv()

CLOVA_API_URL = os.getenv('CLOVA_SPEECH_INVOKE_URL', 'clovaspeech-gw.ncloud.com:50051')
CLOVA_SECRET = os.getenv('CLOVA_SPEECH_SECRET')


class VoiceRecognitionBridge:
    def __init__(self):
        self.websocket_clients = set()
        self.is_recording = False
        
    async def broadcast_to_clients(self, message):
        """Send message to all connected WebSocket clients"""
        if self.websocket_clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.websocket_clients],
                return_exceptions=True
            )
    
    async def start_recording(self):
        """Start recording simulation"""
        if self.is_recording:
            return
        
        print("Starting recording...")
        self.is_recording = True
        
        # Simulate audio and transcription
        asyncio.create_task(self.simulate_recognition())
    
    async def simulate_recognition(self):
        """Simulate voice recognition with test data"""
        test_phrases = [
            ("Doctor", "환자분의 상태를 확인하겠습니다."),
            ("Nurse", "네, 알겠습니다."),
            ("Doctor", "혈압은 정상이네요."),
            ("Nurse", "체온도 측정하겠습니다."),
        ]
        
        for speaker, text in test_phrases:
            if not self.is_recording:
                break
            
            # Send audio level
            await self.broadcast_to_clients({
                'type': 'meter',
                'level': 0.5
            })
            
            await asyncio.sleep(2)
            
            # Send transcript
            await self.broadcast_to_clients({
                'type': 'transcript',
                'speaker': speaker,
                'text': text
            })
            
            print(f"[{speaker}] {text}")
            
            await asyncio.sleep(1)
    
    async def stop_recording(self):
        """Stop recording"""
        if not self.is_recording:
            return
        
        print("Stopping recording...")
        self.is_recording = False
    
    async def handle_websocket(self, websocket):
        """Handle WebSocket client connection"""
        self.websocket_clients.add(websocket)
        print(f"✅ Client connected. Total clients: {len(self.websocket_clients)}")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    command = data.get('command')
                    
                    print(f"Received command: {command}")
                    
                    if command == 'start':
                        await self.start_recording()
                    elif command == 'stop':
                        await self.stop_recording()
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
        
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed normally")
        except Exception as e:
            print(f"WebSocket error: {e}")
        finally:
            self.websocket_clients.discard(websocket)
            print(f"❌ Client disconnected. Total clients: {len(self.websocket_clients)}")
    
    async def run_server(self):
        """Run WebSocket server"""
        try:
            async with serve(self.handle_websocket, "localhost", 3001):
                print("🎙️ Voice Recognition Bridge running on ws://localhost:3001")
                print(f"🔗 Clova API: {CLOVA_API_URL}")
                print(f"🔑 Secret Key: {'✓' if CLOVA_SECRET else '✗'}")
                print("📡 Waiting for connections...")
                await asyncio.Future()  # Run forever
        except Exception as e:
            print(f"Server error: {e}")


async def main():
    bridge = VoiceRecognitionBridge()
    try:
        await bridge.run_server()
    except KeyboardInterrupt:
        print("\nShutting down...")
        await bridge.stop_recording()


if __name__ == "__main__":
    asyncio.run(main())
