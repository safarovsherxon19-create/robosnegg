import datetime
import unittest
from urllib.parse import parse_qs

from daily_upload import VIDEOS, SHORT_PALETTES, UPLOAD_GAP_MIN, video_config, recording_query


class DailyVideoRules(unittest.TestCase):
    day = datetime.date(2026, 10, 13)

    snakes = [n for n in VIDEOS if VIDEOS[n]["game"] == "snake"]
    cubes = [n for n in VIDEOS if VIDEOS[n]["game"] == "cubes"]

    def test_three_snake_one_with_memes(self):
        self.assertEqual(len(VIDEOS), 6)
        self.assertEqual(len(self.snakes), 3)
        self.assertEqual(sum(video_config(n, self.day)["mems"] for n in self.snakes), 1)

    def test_three_cube_races(self):
        self.assertEqual(sorted(VIDEOS[n]["level"] for n in self.cubes), ["laser", "maze", "plinko"])
        for n in self.cubes:
            self.assertEqual(parse_qs(recording_query(video_config(n, self.day)))["level"], [VIDEOS[n]["level"]])

    def test_snake_shorts_keep_10_by_10_speed_15(self):
        for n in self.snakes:
            cfg = video_config(n, self.day)
            self.assertEqual((cfg["w"], cfg["h"], cfg["speed"], cfg["head"], cfg["format"]), (10, 10, 15, "snake", "shorts"))

    def test_snake_colors_distinct_each_day(self):
        for d in range(15):
            cfgs = [video_config(n, self.day + datetime.timedelta(days=d)) for n in self.snakes]
            self.assertEqual(len({c["theme"] for c in cfgs}), 3)

    def test_uploads_30_minutes_apart(self):
        self.assertEqual(UPLOAD_GAP_MIN, 30)


if __name__ == "__main__":
    unittest.main()
