import sounddevice as sd
import numpy as np

print("=" * 80)
print("시스템 오디오 디바이스 상세 정보")
print("=" * 80)

# Get all devices
devices = sd.query_devices()

# Find default input device
default_input = sd.query_devices(kind='input')
default_index = sd.default.device[0]

print(f"\n기본 입력 디바이스 (Index: {default_index}):")
print(f"  이름: {default_input['name']}")
print(f"  최대 입력 채널: {default_input['max_input_channels']}")
print(f"  기본 샘플레이트: {default_input['default_samplerate']} Hz")
print(f"  ⭐ 스테레오 지원: {'예 (2채널 이상)' if default_input['max_input_channels'] >= 2 else '아니오 (모노만)'}")

print("\n" + "=" * 80)
print("모든 입력 디바이스:")
print("=" * 80)

for i, device in enumerate(devices):
    if device['max_input_channels'] > 0:
        print(f"\n[Index {i}]")
        print(f"  이름: {device['name']}")
        print(f"  최대 입력 채널: {device['max_input_channels']}")
        print(f"  샘플레이트: {device['default_samplerate']} Hz")
        print(f"  스테레오: {'✅ 지원' if device['max_input_channels'] >= 2 else '❌ 모노만'}")
        print(f"  기본 디바이스: {'✅' if i == default_index else ''}")

print("\n" + "=" * 80)
