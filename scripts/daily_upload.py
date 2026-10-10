"""Record one Robo Snake game from the published site and upload it to YouTube.

Env: SITE_URL, VIDEO (job name), YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, PRIVACY (optional)
"""
import asyncio, datetime, json, os, random, sys
from pathlib import Path
import requests
from playwright.async_api import async_playwright

VIDEOS = {
    "short-classic-1": dict(w=10, h=10, mode="classic", format="shorts"),
    "short-classic-2": dict(w=10, h=10, mode="classic", format="shorts"),
    "short-double-1": dict(w=10, h=10, mode="double", format="shorts"),
    "short-double-2": dict(w=10, h=10, mode="double", format="shorts"),
    "long-classic-16": dict(w=16, h=16, mode="classic", format="long"),
    "long-double-20": dict(w=20, h=20, mode="double", format="long"),
}


async def record(site: str, cfg: dict, out: Path) -> None:
    q = f"auto=1&w={cfg['w']}&h={cfg['h']}&mode={cfg['mode']}&format={cfg['format']}&speed=15&theme=neon&head=snake"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True)
        page = await ctx.new_page()
        await page.goto(f"{site.rstrip('/')}/?{q}", wait_until="networkidle")
        link = page.get_by_role("link", name="Download video")
        await link.wait_for(timeout=4 * 60 * 60 * 1000)
        async with page.expect_download() as d:
            await link.click()
        await (await d.value).save_as(out)
        await browser.close()


def upload(path: Path, title: str, desc: str, tags: list[str]) -> str:
    tok = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"],
        "refresh_token": os.environ["YT_REFRESH_TOKEN"], "grant_type": "refresh_token"}, timeout=60)
    if not tok.ok:
        sys.exit(f"Token error {tok.status_code}: {tok.text}")
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
    return r.json()["id"]


def main() -> None:
    name = os.environ["VIDEO"]
    cfg = VIDEOS[name]
    out = Path(f"/tmp/{name}.webm")
    asyncio.run(record(os.environ["SITE_URL"], cfg, out))
    mode = "2x Classic" if cfg["mode"] == "double" else "Classic"
    day = datetime.date.today().isoformat()
    size = f"{cfg['w']}x{cfg['h']}"

    SHORT_TITLES = [
        "I NEVER Lose at Snake! 🐍 {mode} {size} #Shorts",
        "I Filled the ENTIRE Snake Board! 😱 {mode} {size} #Shorts",
        "My Perfect Snake Run — Zero Mistakes! 🐍 {mode} {size} #Shorts",
        "I Can't Lose at Snake Anymore! 🔥 {mode} {size} #Shorts",
        "I Solved Snake Like a Boss! 🏆 {mode} {size} #Shorts",
        "The Most Satisfying Snake Run I've Ever Done! ✨ {mode} {size} #Shorts",
        "I Played Snake Until the Board Was FULL 🤯 {mode} {size} #Shorts",
        "Snake on {size} — I Didn't Make One Mistake 🐍 {mode} #Shorts",
    ]
    LONG_TITLES = [
        "I Beat Snake Completely — Full Board {size} {mode} 🐍🏆",
        "My Perfect Snake Run — No Mistakes, Full Board {size} {mode}",
        "I Played Snake FLAWLESSLY Until the Board Was Full! {size} {mode} 🐍",
        "My Longest Snake Run Yet — {size} {mode} Perfect Game 🏆",
        "I Filled Every Single Cell — Satisfying Snake {size} {mode} 🏆",
        "How I Solve Snake Perfectly — {size} {mode} Full Gameplay 🐍",
    ]
    titles = SHORT_TITLES if cfg["format"] == "shorts" else LONG_TITLES
    title = random.choice(titles).format(mode=mode, size=size)

    HOOKS = [
        "I have NEVER lost a single game of Snake.",
        "I filled every single cell without one mistake.",
        "This is the most satisfying Snake run I've ever done.",
        "Zero deaths. Zero errors. Pure perfection.",
        "One snake, one board, zero mistakes.",
    ]
    TAGS = ["#snake", "#snakegame", "#satisfying", "#gaming",
            "#gameplay", "#perfectgame", "#nostalgia", "#arcade", "#viral", "#fyp", "#asmr", "#gamer"]
    desc = (
        f"{random.choice(HOOKS)}\n\n"
        f"I played Snake on a {size} board in {mode} mode and filled every single cell.\n"
        f"Subscribe for daily satisfying Snake gameplay! 🔔\n\n"
        f"{day}\n\n" + " ".join(random.sample(TAGS, 6))
    )
    vid = upload(out, title, desc, ["snake", "snake game", "satisfying", "perfect game",
                                    "arcade", "gameplay", "classic snake", mode])
    print(f"Uploaded {name}: https://youtu.be/{vid}")


if __name__ == "__main__":
    main()
