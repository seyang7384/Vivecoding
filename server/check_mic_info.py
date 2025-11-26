"""
Simple script to check microphone channel count using wave module
"""
import wave
import sys

# This is a workaround - we'll create a simple test to capture audio
print("=" * 80)
print("브라우저 개발자 도구에서 확인하는 방법:")
print("=" * 80)
print("""
1. 브라우저에서 http://localhost:5173 열기
2. F12 눌러 개발자 도구 열기
3. Console 탭에서 다음 명령 실행:

navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();
    console.log('🎤 마이크 설정:', settings);
    console.log('채널 수:', settings.channelCount);
    console.log('샘플레이트:', settings.sampleRate);
    console.log('스테레오 지원:', settings.channelCount >= 2 ? '✅ 예' : '❌ 아니오');
    stream.getTracks().forEach(track => track.stop());
  });

""")
print("=" * 80)
print("\n또는 Windows 설정에서 확인:")
print("  설정 > 시스템 > 소리 > 입력 > 디바이스 속성")
print("  채널 수가 2이면 스테레오 지원")
print("=" * 80)
