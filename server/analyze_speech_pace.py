import os
import json
import statistics

TRANSCRIPTS_DIR = os.path.join(os.path.dirname(__file__), 'transcripts')

def analyze_speech():
    if not os.path.exists(TRANSCRIPTS_DIR):
        print("❌ Transcripts directory not found.")
        return

    files = [f for f in os.listdir(TRANSCRIPTS_DIR) if f.endswith('.json')]
    if not files:
        print("⚠️ No transcript files found yet.")
        return

    print(f"📚 Analyzing {len(files)} transcripts for speech pace...")

    all_durations = []
    all_pauses = []

    for filename in files:
        try:
            with open(os.path.join(TRANSCRIPTS_DIR, filename), 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            segments = data.get('segments', [])
            if not segments:
                continue

            # Sort by start time just in case
            segments.sort(key=lambda x: x['start'])

            for i, seg in enumerate(segments):
                # Duration of the segment (sentence/phrase)
                duration = seg['end'] - seg['start']
                all_durations.append(duration)

                # Pause before next segment
                if i < len(segments) - 1:
                    next_seg = segments[i+1]
                    pause = next_seg['start'] - seg['end']
                    # Filter out negative pauses (overlaps) or huge pauses (different sessions)
                    if 0 < pause < 10000: # Ignore pauses > 10s as they might be silence breaks
                        all_pauses.append(pause)
                        
        except Exception as e:
            print(f"⚠️ Error reading {filename}: {e}")

    if not all_durations:
        print("⚠️ No valid segments found.")
        return

    avg_duration = statistics.mean(all_durations)
    avg_pause = statistics.mean(all_pauses) if all_pauses else 0
    
    # Convert to seconds
    avg_duration_sec = avg_duration / 1000
    avg_pause_sec = avg_pause / 1000

    print(f"\n📊 Analysis Results:")
    print(f"  - Total Segments: {len(all_durations)}")
    print(f"  - Avg Sentence Duration: {avg_duration_sec:.2f}s")
    print(f"  - Avg Pause Between Sentences: {avg_pause_sec:.2f}s")
    
    # Recommendation
    # If avg sentence is 3s, we should wait at least that long before forcing? 
    # Actually, MAX_DURATION should be longer than the longest typical sentence.
    # SILENCE_TIMEOUT should be slightly longer than the average pause within a thought, 
    # but short enough to detect end of turn.
    
    recommended_silence = max(1.0, avg_pause_sec * 1.5) # 1.5x margin
    recommended_max = max(10.0, avg_duration_sec * 3)   # 3x margin
    
    print(f"\n💡 Recommendations:")
    print(f"  - SILENCE_TIMEOUT: {recommended_silence:.1f}s (Current: 1.0s)")
    print(f"  - MAX_DURATION: {recommended_max:.1f}s (Current: 10.0s)")

if __name__ == "__main__":
    analyze_speech()
