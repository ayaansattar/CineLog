import pdfplumber
from collections import defaultdict

for name in ["data/Movies.pdf", "data/TV shows.pdf"]:
    print("====", name, "====")
    with pdfplumber.open(name) as pdf:
        for i, page in enumerate(pdf.pages[:2]):
            print(f"--- page {i+1} ---")
            words = page.extract_words() or []
            # group by rounded top
            lines = defaultdict(list)
            for w in words:
                y = round(w["top"] / 3) * 3
                lines[y].append(w)
            for y in sorted(lines)[:25]:
                ws = sorted(lines[y], key=lambda w: w["x0"])
                texts = [w["text"] for w in ws]
                gaps = []
                for a, b in zip(ws, ws[1:]):
                    gaps.append(round(b["x0"] - a["x1"], 1))
                print(f"y={y}: {' | '.join(texts)}")
                if gaps:
                    print(f"     gaps: {gaps[:20]}")
            print("TEXT extract:")
            print((page.extract_text() or "")[:1200])
            print()
