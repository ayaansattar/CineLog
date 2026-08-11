"""Parse Movies.pdf and TV shows.pdf into structured JSON for import."""
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

MOVIE_SECTIONS = {
    "watching",
    "animated",
    "james bond",
    "superhero",
    "christopher nolan",
    "quentin tarantino",
    "martin scorsese",
    "guy ritchie",
    "howard hughes",
    "wes anderson",
    "adam mckay",
    "biography/documentary",
    "comedy",
    "dc animated",
    "action/drama/thriller/crime",
    "horror",
    "sci-fi",
    "romance",
    "war",
    "sports",
    "musicals",
    "classic",
    "foreign",
    "bollywood",
    "unreleased",
    "to watch",
    "watchlist",
}

TV_SECTIONS = {
    "tv shows",
    "watching",
    "must-watch",
    "must watch",
    "netflix:-",
    "netflix:",
    "sitcom:-",
    "sitcom:",
    "prime video:-",
    "prime video:",
    "cw:-",
    "cw:",
    "mcu",
    "hbo",
    "hulu",
    "disney+",
    "disney",
    "apple tv",
    "other",
}


def clean_line(line: str) -> str:
    line = line.replace("\u0000", "")
    line = line.replace("\ufb01", "fi").replace("\ufb02", "fl")
    line = line.replace("�", "'")
    line = re.sub(r"\s+", " ", line).strip()
    return line


def is_section(line: str, sections: set[str]) -> bool:
    low = line.lower().rstrip(":-").strip()
    keyed = line.lower().strip()
    if keyed in sections or low in sections:
        return True
    if keyed.endswith(":-") or keyed.endswith(":"):
        return True
    return False


def expand_movie_title(raw: str) -> list[str]:
    """Expand simple 'Title 1 2 3' / 'Title 1 & 2' patterns into separate titles."""
    text = raw.strip()
    # Shangai Noon and Knights → two titles (typo Shanghai)
    if re.search(r"\band\b", text, re.I) and not re.search(
        r"\b(and the|& the)\b", text, re.I
    ):
        # only split clear "A and B" film pairs that aren't normal titles
        if re.match(r"^Shangai Noon and Knights$", text, re.I):
            return ["Shanghai Noon", "Shanghai Knights"]

    m = re.match(r"^(.+?)\s+(\d(?:\s*[&and]*\s*\d)+)\s*$", text, re.I)
    if m:
        base = m.group(1).strip()
        nums = [int(n) for n in re.findall(r"\d+", m.group(2))]
        if 1 < len(nums) <= 4 and nums == list(range(nums[0], nums[0] + len(nums))):
            # Blade 1 2 3 → Blade, Blade 2, Blade 3
            out = []
            for n in nums:
                out.append(base if n == 1 else f"{base} {n}")
            return out

    m = re.match(r"^(.+?)\s+(\d)\s*&\s*(\d)\s*$", text)
    if m:
        base, a, b = m.group(1).strip(), int(m.group(2)), int(m.group(3))
        return [base if a == 1 else f"{base} {a}", f"{base} {b}"]

    # series shorthand
    if re.search(r"\bseries\b", text, re.I):
        return [re.sub(r"\s*series\s*$", "", text, flags=re.I).strip()]

    return [text]


def parse_tv_line(line: str) -> tuple[str, int | None]:
    """Return (title, season) from lines like 'Cobra Kai 6' or 'Suits 9 (Ended)'."""
    text = re.sub(r"\s*\((ended|ongoing)\)\s*$", "", line, flags=re.I).strip()
    m = re.match(r"^(.+?)\s+(\d{1,2})$", text)
    if m:
        title = m.group(1).strip()
        season = int(m.group(2))
        # avoid treating years as seasons (rare in this list)
        if season <= 30:
            return title, season
    return text, None


def extract_lines(pdf_path: Path) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw in text.splitlines():
                line = clean_line(raw)
                if line:
                    lines.append(line)
    return lines


def parse_movies(pdf_path: Path) -> list[dict]:
    items = []
    status = "watchlist"
    for line in extract_lines(pdf_path):
        if is_section(line, MOVIE_SECTIONS):
            if line.lower() == "watching":
                status = "watching"
            else:
                # leaving Watching section resets to watchlist
                if status == "watching" and line.lower() != "watching":
                    status = "watchlist"
            continue

        for title in expand_movie_title(line):
            title = clean_line(title)
            if len(title) < 2:
                continue
            # year trailing like "The batman 1989"
            year = None
            ym = re.match(r"^(.+?)\s+(19\d{2}|20\d{2})$", title)
            if ym:
                title, year = ym.group(1).strip(), int(ym.group(2))
            items.append(
                {
                    "title": title,
                    "year": year,
                    "mediaType": "movie",
                    "status": status,
                }
            )
    return items


def parse_tv(pdf_path: Path) -> list[dict]:
    items = []
    status = "watchlist"
    for line in extract_lines(pdf_path):
        if is_section(line, TV_SECTIONS):
            if line.lower() == "watching":
                status = "watching"
            else:
                if status == "watching" and line.lower() != "watching":
                    status = "watchlist"
            continue

        title, season = parse_tv_line(line)
        title = clean_line(title)
        if len(title) < 2:
            continue
        item = {
            "title": title,
            "year": None,
            "mediaType": "tv",
            "status": status,
        }
        if status == "watching" and season is not None:
            item["currentSeason"] = season
            item["currentEpisode"] = 1
        items.append(item)
    return items


def dedupe_parsed(items: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for item in items:
        key = (item["mediaType"], item["title"].lower(), item.get("year"))
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def main():
    movies = dedupe_parsed(parse_movies(DATA / "Movies.pdf"))
    tv = dedupe_parsed(parse_tv(DATA / "TV shows.pdf"))

    watching_m = sum(1 for i in movies if i["status"] == "watching")
    watching_t = sum(1 for i in tv if i["status"] == "watching")

    out = {
        "movies": movies,
        "tv": tv,
        "counts": {
            "movies": len(movies),
            "moviesWatching": watching_m,
            "tv": len(tv),
            "tvWatching": watching_t,
        },
    }
    out_path = DATA / "parsed-pdf-lists.json"
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out["counts"], indent=2))
    print(f"Wrote {out_path}")
    print("Sample movies:", movies[:8])
    print("Sample tv:", tv[:8])


if __name__ == "__main__":
    main()
