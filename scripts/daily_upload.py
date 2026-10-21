"""Record one Snake game from the published site and upload it to YouTube.

Env: SITE_URL, VIDEO (job name), YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, PRIVACY (optional)
"""
import asyncio, time, datetime, json, os, random, sys
from urllib.parse import urlencode
from pathlib import Path
import requests
from playwright.async_api import async_playwright

# Six Shorts a day, alternating: 3 Snake (1 with memes) and 3 Cube Battle races.
VIDEOS = {
    "short-1": dict(game="snake", w=10, h=10, mode="classic", format="shorts", mems=1),
    "cube-plinko": dict(game="cubes", level="plinko", format="shorts"),
    "short-2": dict(game="snake", w=10, h=10, mode="double", format="shorts", mems=0),
    "cube-laser": dict(game="cubes", level="laser", format="shorts"),
    "short-3": dict(game="snake", w=10, h=10, mode="classic", format="shorts", mems=0),
    "cube-maze": dict(game="cubes", level="maze", format="shorts"),
}
CUBE_TITLES = {"plinko": "Plinko Race", "laser": "Laser Spinner", "maze": "Maze Race"}
CUBE_HOOKS = ["Which Color Wins?", "I Bet on One Color — Did I Win?", "Pick Your Color Before It Starts!",
              "My Hardest Color Race Yet", "Guess the Winner in 3 Seconds", "I Can't Believe This Color Won"]
CUBE_TAGS = ["#WhichColorWins", "#Satisfying", "#Simulation", "#Marble", "#ColorRace", "#Physics", "#Gaming", "#OddlySatisfying"]
UPLOAD_GAP_MIN = 30  # each next Short goes live 30 minutes after the previous one
# Only existing app palettes. Consecutive days change both Shorts colors.
SHORT_PALETTES = ["candy", "ice", "lime", "rainbow", "ocean", "fire", "gold", "sunset", "neon", "google", "classic"]
STICKERS = ["🐍✨", "🍎🔥", "🎯🐍", "🏆✨", "🍒🎮", "💯🐍", "🍉✨", "🎧🍎"]
TITLE_HOOKS = [
    "Can I Fill the Last Cell?", "I Started at 50% — Can I Reach 100%?",
    "My Final Bite Is So Satisfying", "I Have Almost No Space Left",
    "I Turned Half a Board Into a Perfect Finish", "My Snake Run Gets Tighter Every Bite",
    "I Saved the Most Satisfying Bite for Last", "My 50% to 100% Snake Challenge",
    "I Filled Every Gap — Listen to Those Bites", "My Perfect Finish: Every Cell Filled",
    "I Can't Stop Watching This Final Bite", "My Snake Board Has Nowhere Left to Go",
]
HASHTAGS = ["#Snake", "#SnakeGame", "#Satisfying", "#ASMR", "#Gaming", "#Gameplay",
            "#PerfectGame", "#Arcade", "#OddlySatisfying", "#Relaxing", "#SnakeChallenge", "#NoCommentary"]


def video_config(name: str, day: datetime.date) -> dict:
    if VIDEOS[name]["game"] == "cubes":
        return {**VIDEOS[name]}
    cfg = {"speed": 15, "head": "snake", "theme": "neon", **VIDEOS[name]}
    index = list(VIDEOS).index(name)
    if cfg["format"] == "shorts":
        cfg["theme"] = SHORT_PALETTES[(day.toordinal() + index * 2) % len(SHORT_PALETTES)]
    cfg["banner"] = (day.toordinal() + index) % 8
    return cfg


def recording_query(cfg: dict) -> str:
    if cfg.get("game") == "cubes":
        return urlencode({"auto": 1, "level": cfg["level"]})
    return urlencode({"auto": 1, **{k: cfg[k] for k in
        ("w", "h", "mode", "format", "speed", "theme", "head", "banner", "mems")}})


def video_metadata(name: str, cfg: dict, day: datetime.date) -> tuple[str, str, list[str]]:
    index = list(VIDEOS).index(name)
    rng = random.Random(f"{day.isoformat()}:{name}")
    if cfg.get("game") == "cubes":
        lvl = CUBE_TITLES[cfg["level"]]
        hook = CUBE_HOOKS[(day.toordinal() + index) % len(CUBE_HOOKS)]
        tags = rng.sample(CUBE_TAGS, 5) + ["#Shorts"]
        desc = (f"{hook} 🎨 | {lvl}\n\nI made every color race to the finish. Pick yours before it starts!\n"
                "Comment your color 👇 Subscribe for a new race every day!\n\n" f"{day.isoformat()}\n" + " ".join(tags))
        return f"{hook} 🎨 | {lvl} #Shorts", desc, ["which color wins", "color race", "satisfying", "simulation", lvl.lower(), "gaming"]
    mode = "2x Classic" if cfg["mode"] == "double" else "Classic"
    hooks = TITLE_HOOKS if cfg["format"] == "shorts" else [h for h in TITLE_HOOKS if "50%" not in h and "Half" not in h]
    hook = hooks[(day.toordinal() * 4 + index) % len(hooks)]
    sticker = STICKERS[(day.toordinal() + index) % len(STICKERS)]
    suffix = " #Shorts" if cfg["format"] == "shorts" else ""
    title = f"{hook} {sticker} | {mode}{suffix}"
    tags = rng.sample(HASHTAGS, 5)
    if suffix:
        tags.append("#Shorts")
    beginning = "a half-full" if cfg["format"] == "shorts" else "a small snake on a"
    desc = (f"{hook} {sticker}\n\n"
            f"I started with {beginning} {cfg['w']}x{cfg['h']} board in {mode} and filled every last cell.\n"
            "Crisp fruit bites, soft turns, and a perfect finish. 🎧\n\n"
            f"{rng.choice(['Which bite was the most satisfying?', 'Can you spot the last empty cell?', 'Which color should I try next?'])}\n"
            "Subscribe for daily satisfying Snake runs! 🐍\n\n"
            f"{day.isoformat()}\n" + " ".join(tags))
    return title, desc, ["snake", "snake game", "satisfying", "asmr", "fruit crunch",
                         "perfect finish", "gaming", "no commentary", "snake challenge", mode]



async def record(site: str, cfg: dict, out: Path) -> None:
    q = recording_query(cfg)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True)
        page = await ctx.new_page()
        path = "/cubes" if cfg.get("game") == "cubes" else "/"
        await page.goto(f"{site.rstrip('/')}{path}?{q}", wait_until="networkidle")
        if cfg.get("mems"):
            # An empty library must not silently produce a supposedly meme-enabled video.
            await page.get_by_role("button", name="Choose memes").wait_for(timeout=60000)
            count = await page.get_by_role("button", name="Choose memes").inner_text()
            if count.strip().startswith("0 clips"):
                raise RuntimeError("Meme-enabled video needs uploaded clips. Add clips on the site before running this job.")
        link = page.get_by_role("link", name="Download video")
        await link.wait_for(timeout=4 * 60 * 60 * 1000)
        async with page.expect_download() as d:
            await link.click()
        await (await d.value).save_as(out)
        if cfg.get("game") == "cubes":
            await browser.close()
            return
        cover = page.get_by_role("link", name="Download cover", exact=True)
        await cover.wait_for(timeout=60000)
        async with page.expect_download() as d:
            await cover.click()
        await (await d.value).save_as(out.with_suffix(".jpg"))
        await browser.close()


def upload(path: Path, title: str, desc: str, tags: list[str], *, set_cover: bool = False) -> str:
    tok = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"],
        "refresh_token": os.environ["YT_REFRESH_TOKEN"], "grant_type": "refresh_token"}, timeout=60)
    if not tok.ok:
        sys.exit(f"Token error {tok.status_code}")
    auth = {"Authorization": f"Bearer {tok.json()['access_token']}"}
    meta = {"snippet": {"title": title[:100], "description": desc, "tags": tags, "categoryId": "20"},
            "status": {"privacyStatus": os.environ.get("PRIVACY", "public"), "selfDeclaredMadeForKids": False}}
    init = requests.post("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
                         headers={**auth, "Content-Type": "application/json; charset=UTF-8",
                                  "X-Upload-Content-Type": "video/*"}, data=json.dumps(meta), timeout=60)
    if not init.ok:
        sys.exit(f"Upload init error {init.status_code}: {init.text}")
    with open(path, "rb") as f:
        r = requests.put(init.headers["Location"], headers={**auth, "Content-Type": "video/*"}, data=f, timeout=3600)
    if not r.ok:
        sys.exit(f"Upload error {r.status_code}: {r.text}")
    video_id = r.json()["id"]
    if set_cover and path.with_suffix(".jpg").exists():
        with open(path.with_suffix(".jpg"), "rb") as cover:
            thumbnail = requests.post("https://www.googleapis.com/upload/youtube/v3/thumbnails/set",
                params={"videoId": video_id}, headers={**auth, "Content-Type": "image/jpeg"}, data=cover, timeout=60)
        if not thumbnail.ok:
            print(f"Video uploaded, but cover was not accepted ({thumbnail.status_code}). Check channel custom-thumbnail eligibility.", file=sys.stderr)
    return video_id


def main() -> None:
    name = os.environ["VIDEO"]
    day = datetime.datetime.now(datetime.timezone.utc).date()
    cfg = video_config(name, day)
    out = Path(f"/tmp/{name}.webm")
    asyncio.run(record(os.environ["SITE_URL"], cfg, out))
    title, desc, tags = video_metadata(name, cfg, day)
    start = datetime.datetime.combine(day, datetime.time(0, 0), datetime.timezone.utc)
    target = start + datetime.timedelta(minutes=UPLOAD_GAP_MIN * list(VIDEOS).index(name))
    wait = (target - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
    if wait > 0:
        time.sleep(wait)
    vid = upload(out, title, desc, tags, set_cover=cfg.get("format") == "long")
    print(f"Uploaded {name}: https://youtu.be/{vid}")


if __name__ == "__main__":
    main()
