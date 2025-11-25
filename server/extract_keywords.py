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

    kiwi = Kiwi()
    
    # Custom dictionary for medical terms (optional initial seed)
    # kiwi.add_user_word('추나', 'NNG')
    
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
    tokens = kiwi.tokenize(all_text)
    
    # Filter for Nouns (NNG, NNP) and maybe Verbs (VV) if needed
    # We focus on Nouns for boosting
    keywords = []
    for token in tokens:
        if token.tag in ['NNG', 'NNP']: # Common Noun, Proper Noun
            if len(token.form) > 1: # Ignore single char words
                keywords.append(token.form)

    # Count frequency
    counter = Counter(keywords)
    
    # Get top 100 keywords
    top_keywords = counter.most_common(100)
    
    # Format for Clova Boosting
    boosting_list = []
    keyword_data = []

    print("\n🔍 Top 20 Keywords found:")
    for word, count in top_keywords[:20]:
        print(f"- {word}: {count}")
        boosting_list.append({"words": word})
        keyword_data.append({"word": word, "count": count})

    # Save detailed JSON
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(keyword_data, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Saved keywords to {OUTPUT_FILE}")

    # Save simple list for boosting copy-paste
    with open(BOOSTING_FILE, 'w', encoding='utf-8') as f:
        for item in boosting_list:
            f.write(f"{item['words']}\n")
    print(f"💾 Saved boosting list to {BOOSTING_FILE}")

if __name__ == "__main__":
    extract_keywords()
