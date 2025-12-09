from kiwipiepy import Kiwi
try:
    kiwi = Kiwi()
    print("Kiwi initialized successfully")
except Exception as e:
    print(f"Kiwi initialization failed: {e}")
