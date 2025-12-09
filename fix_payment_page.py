
lines = []
with open('d:/Vivecoding/src/pages/PaymentPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep lines 1-701 (indices 0-700)
# Skip lines 702-904 (indices 701-903)
# Keep lines 905-end (indices 904-end)

# Adjusting for 0-based indexing:
# Line 701 is index 700.
# Line 905 is index 904.

new_lines = lines[:701] + lines[904:]

with open('d:/Vivecoding/src/pages/PaymentPage.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully removed duplicate lines.")
