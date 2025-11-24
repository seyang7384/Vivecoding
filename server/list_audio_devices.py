#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
List all available audio input devices
"""

import pyaudio

p = pyaudio.PyAudio()

print("=" * 60)
print("Available Audio Input Devices:")
print("=" * 60)

for i in range(p.get_device_count()):
    info = p.get_device_info_by_index(i)
    
    # Only show input devices
    if info['maxInputChannels'] > 0:
        print(f"\n[Index {i}]")
        print(f"  Name: {info['name']}")
        print(f"  Channels: {info['maxInputChannels']}")
        print(f"  Sample Rate: {int(info['defaultSampleRate'])} Hz")
        print(f"  Default: {'YES' if i == p.get_default_input_device_info()['index'] else 'NO'}")

print("\n" + "=" * 60)
print("✅ Check complete!")
print("=" * 60)

p.terminate()
