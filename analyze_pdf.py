import fitz
import json

doc = fitz.open('/home/nithu/Music/lead/Tribeca_Dental_Care_-_AI_Growth_Readiness_Report-FIXED.pdf')
page = doc[0]

blocks = page.get_text("dict")["blocks"]

for b in blocks:
    if "lines" in b:
        for l in b["lines"]:
            for s in l["spans"]:
                print(f"Text: {s['text'][:30]}... Font: {s['font']} Size: {round(s['size'], 1)} Color: {hex(s['color'])} BBox: {[round(c, 1) for c in s['bbox']]}")
    elif b["type"] == 1: # Image
        print(f"Image BBox: {[round(c, 1) for c in b['bbox']]}")

print("Drawings:")
for p in page.get_drawings():
    print(f"Rect: {[round(c, 1) for c in p['rect']]} Fill: {p['fill']} Stroke: {p['color']}")
