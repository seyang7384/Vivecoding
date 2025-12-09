import os
import json
import time
import shutil
import requests
import subprocess
import imageio_ffmpeg
from dotenv import load_dotenv

load_dotenv()

# Configuration
RECORDINGS_DIR = os.path.join(os.path.dirname(__file__), 'recordings')
TRANSCRIPTS_DIR = os.path.join(os.path.dirname(__file__), 'transcripts')
SECRET_KEY = os.getenv('CLOVA_SPEECH_SECRET')
INVOKE_URL = os.getenv('CLOVA_SPEECH_INVOKE_URL')

if not SECRET_KEY:
    print("❌ Error: CLOVA_SPEECH_SECRET not found in .env")
    exit(1)

def get_ffmpeg_exe():
    return imageio_ffmpeg.get_ffmpeg_exe()

def convert_to_wav(input_path):
    """Convert audio file to WAV format (16kHz, mono) using ffmpeg directly"""
    try:
        print(f"🔄 Converting {os.path.basename(input_path)} to WAV...")
        wav_path = os.path.splitext(input_path)[0] + ".wav"
        
        cmd = [
            get_ffmpeg_exe(),
            '-i', input_path,
            '-ar', '16000',
            '-ac', '1',
            '-y',
            wav_path
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return wav_path
    except Exception as e:
        print(f"❌ Conversion failed: {e}")
        return None

def split_audio(wav_path, segment_time=60):
    """Split WAV file into chunks using ffmpeg segment"""
    try:
        print(f"✂️ Splitting {os.path.basename(wav_path)} into {segment_time}s chunks...")
        
        # Create a temp directory for chunks
        chunk_dir = os.path.join(os.path.dirname(wav_path), "chunks_" + os.path.basename(wav_path).replace('.', '_'))
        if os.path.exists(chunk_dir):
            shutil.rmtree(chunk_dir)
        os.makedirs(chunk_dir)
        
        output_pattern = os.path.join(chunk_dir, "chunk_%03d.wav")
        
        cmd = [
            get_ffmpeg_exe(),
            '-i', wav_path,
            '-f', 'segment',
            '-segment_time', str(segment_time),
            '-c', 'copy',
            output_pattern
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        chunks = sorted([os.path.join(chunk_dir, f) for f in os.listdir(chunk_dir) if f.endswith('.wav')])
        return chunks, chunk_dir
    except Exception as e:
        print(f"❌ Splitting failed: {e}")
        return [], None

def load_boostings():
    boostings = []
    try:
        boosting_file = os.path.join(os.path.dirname(__file__), 'boostings.txt')
        if os.path.exists(boosting_file):
            try:
                with open(boosting_file, 'r', encoding='utf-8') as f:
                    words = [line.strip() for line in f if line.strip()]
            except UnicodeDecodeError:
                with open(boosting_file, 'r', encoding='cp949', errors='ignore') as f:
                    words = [line.strip() for line in f if line.strip()]
            
            if words:
                # Limit to 300 words to avoid API limits (max 50000 chars usually, but safer to limit count)
                words = words[:300]
                boostings.append({"words": ",".join(words)})
            print(f"📚 Loaded {len(words)} boosting keywords")
    except Exception as e:
        print(f"⚠️ Failed to load boostings: {e}")
    return boostings

BOOSTINGS = load_boostings()

def transcribe_chunk(file_path):
    """Transcribe a single chunk"""
    headers = {'X-CLOVASPEECH-API-KEY': SECRET_KEY}
    
    try:
        with open(file_path, 'rb') as f:
            files = {
                'media': f,
                'params': (None, json.dumps({
                    'language': 'ko-KR',
                    'completion': 'sync',
                    'wordAlignment': False,
                    'fullText': True,
                    'boostings': BOOSTINGS
                }), 'application/json')
            }
            
            response = requests.post(f"{INVOKE_URL}/recognizer/upload", headers=headers, files=files, timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ API Error ({os.path.basename(file_path)}): {response.text[:100]}...")
                return None
    except Exception as e:
        print(f"❌ Request failed ({os.path.basename(file_path)}): {e}")
        return None

def process_file(file_path):
    print(f"\n🎬 Processing {os.path.basename(file_path)}...")
    
    # 1. Convert to WAV
    wav_path = convert_to_wav(file_path)
    if not wav_path: return None
    
    # 2. Split into chunks
    segment_time = 60
    chunks, chunk_dir = split_audio(wav_path, segment_time=segment_time)
    if not chunks: return None
    
    full_text = ""
    all_segments = []
    print(f"🚀 Transcribing {len(chunks)} chunks...")
    
    for i, chunk_path in enumerate(chunks):
        print(f"  - Chunk {i+1}/{len(chunks)}...", end='\r')
        result = transcribe_chunk(chunk_path)
        if result:
            # Append text
            if result.get('text'):
                full_text += result.get('text') + " "
            
            # Append segments with offset
            if result.get('segments'):
                time_offset = i * segment_time * 1000 # Convert to ms
                for seg in result.get('segments'):
                    new_seg = seg.copy()
                    new_seg['start'] += time_offset
                    new_seg['end'] += time_offset
                    all_segments.append(new_seg)
                    
        time.sleep(0.5) # Rate limit prevention
    
    print(f"\n✅ Transcription complete for {os.path.basename(file_path)}")
    
    # Cleanup
    if chunk_dir and os.path.exists(chunk_dir):
        shutil.rmtree(chunk_dir)
    if wav_path != file_path and os.path.exists(wav_path): # Don't delete original if it was wav
        os.remove(wav_path)
        
    return {"text": full_text.strip(), "segments": all_segments}

def main():
    if not os.path.exists(TRANSCRIPTS_DIR):
        os.makedirs(TRANSCRIPTS_DIR)

    files = [f for f in os.listdir(RECORDINGS_DIR) if f.lower().endswith(('.mp4', '.m4a', '.wav', '.mp3'))]
    
    if not files:
        print(f"⚠️ No audio files found in {RECORDINGS_DIR}")
        return

    print(f"Found {len(files)} files to process.")

    for filename in files:
        file_path = os.path.join(RECORDINGS_DIR, filename)
        output_json_path = os.path.join(TRANSCRIPTS_DIR, f"{os.path.splitext(filename)[0]}.json")
        output_txt_path = os.path.join(TRANSCRIPTS_DIR, f"{os.path.splitext(filename)[0]}.txt")

        if os.path.exists(output_json_path):
            print(f"⏭️ Skipping {filename} (already processed)")
            continue

        result = process_file(file_path)
        
        if result and result.get('text'):
            # Save JSON
            with open(output_json_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            
            # Save TXT
            with open(output_txt_path, 'w', encoding='utf-8') as f:
                f.write(result.get('text', ''))
            
            print(f"💾 Saved transcript to {output_txt_path}")
        else:
            print(f"⚠️ Failed to transcribe {filename}")

if __name__ == "__main__":
    main()
