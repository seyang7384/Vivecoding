import os
import json
from collections import Counter
from kiwipiepy import Kiwi

# Configuration
TRANSCRIPTS_DIR = os.path.join(os.path.dirname(__file__), 'transcripts')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'keywords.json')
BOOSTING_FILE = os.path.join(os.path.dirname(__file__), 'boostings.txt')

def extract_keywords():
    if not os.path.exists(TRANSCRIPTS_DIR):
        print("❌ Transcripts directory not found. Run process_recordings.py first.")
        return

    try:
        kiwi = Kiwi()
        use_kiwi = True
        print("✅ Kiwi initialized successfully.")
    except Exception as e:
        use_kiwi = False
        print(f"⚠️ Kiwi initialization failed: {e}")
        print("⚠️ Switching to simple regex-based extraction.")
        import re

    # Custom dictionary for medical terms (optional initial seed)
    # if use_kiwi: kiwi.add_user_word('추나', 'NNG')
    
    all_text = ""
    files = [f for f in os.listdir(TRANSCRIPTS_DIR) if f.endswith('.txt')]
    
    if not files:
        print("⚠️ No transcript files found.")
        return

    print(f"📚 Analyzing {len(files)} transcripts...")

    for filename in files:
        with open(os.path.join(TRANSCRIPTS_DIR, filename), 'r', encoding='utf-8') as f:
            all_text += f.read() + "\n"

    # Analyze
    keywords = []
    if use_kiwi:
        try:
            tokens = kiwi.tokenize(all_text)
            # Filter for Nouns (NNG, NNP) and maybe Verbs (VV) if needed
            # We focus on Nouns for boosting
            for token in tokens:
                if token.tag in ['NNG', 'NNP']: # Common Noun, Proper Noun
                    if len(token.form) > 1: # Ignore single char words
                        keywords.append(token.form)
        except Exception as e:
            print(f"❌ Kiwi tokenization failed: {e}")
            use_kiwi = False # Fallback if tokenization crashes

    if not use_kiwi:
        # Fallback: Regex for Hangul words
        import re
        # Match Hangul words with 2 or more characters
        words = re.findall(r'[가-힣]{2,}', all_text)
        keywords = words

    # Count frequency
    counter = Counter(keywords)
    
    # Filter by frequency (at least 2 occurrences to avoid noise)
    # User requested not to set a hard limit like 200 or 1000, but to judge based on extraction.
    # We will keep all nouns that appear at least twice.
    new_keywords = [word for word, count in counter.items() if count >= 2]
    
    print(f"🔍 Extracted {len(new_keywords)} significant keywords (freq >= 2) from new transcripts.")

    # Load EXISTING boostings
    existing_keywords = set()
    if os.path.exists(BOOSTING_FILE):
        try:
            with open(BOOSTING_FILE, 'r', encoding='utf-8') as f:
                existing_keywords = set(line.strip() for line in f if line.strip())
        except UnicodeDecodeError:
             with open(BOOSTING_FILE, 'r', encoding='cp949', errors='ignore') as f:
                existing_keywords = set(line.strip() for line in f if line.strip())
    
    print(f"📂 Loaded {len(existing_keywords)} existing keywords.")

    # Merge (Append-only)
    merged_keywords = existing_keywords.union(set(new_keywords))
    
    print(f"✨ Total keywords after merge: {len(merged_keywords)}")

    # Save detailed JSON (only for new analysis this time, or we could merge this too if needed)
    # For now, let's save the new analysis stats to keywords.json
    keyword_data = [{"word": word, "count": count} for word, count in counter.most_common()]
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(keyword_data, f, ensure_ascii=False, indent=2)
    print(f"💾 Saved analysis stats to {OUTPUT_FILE}")

    # Save merged list for boosting
    with open(BOOSTING_FILE, 'w', encoding='utf-8') as f:
        for word in sorted(list(merged_keywords)):
            f.write(f"{word}\n")
    print(f"💾 Saved merged boosting list to {BOOSTING_FILE}")

if __name__ == "__main__":
    extract_keywords()
