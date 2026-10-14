import datetime
import unittest
from urllib.parse import parse_qs

from daily_upload import VIDEOS, SHORT_PALETTES, UPLOAD_GAP_MIN, video_config, recording_query


class DailyVideoRules(unittest.TestCase):
    day = datetime.date(2026, 10, 13)

    def test_six_shorts_three_with_memes_three_without(self):
        self.assertEqual(len(VIDEOS), 6)
        mems = [video_config(n, self.day)["mems"] for n in VIDEOS]
        self.assertEqual(sum(mems), 3)
        for n in VIDEOS:
            self.assertEqual(parse_qs(recording_query(video_config(n, self.day)))["mems"], [str(video_config(n, self.day)["mems"])])

    def test_shorts_keep_10_by_10_speed_15_snake(self):
        for n in VIDEOS:
            cfg = video_config(n, self.day)
            self.assertEqual((cfg["w"], cfg["h"], cfg["speed"], cfg["head"], cfg["format"]), (10, 10, 15, "snake", "shorts"))

    def test_distinct_colors_and_banners_each_day(self):
        for d in range(15):
            day = self.day + datetime.timedelta(days=d)
            cfgs = [video_config(n, day) for n in VIDEOS]
            self.assertEqual(len({c["theme"] for c in cfgs}), 6)
            self.assertEqual(len({c["banner"] for c in cfgs}), 6)
            for c in cfgs:
                self.assertIn(c["theme"], SHORT_PALETTES)

    def test_uploads_30_minutes_apart(self):
        self.assertEqual(UPLOAD_GAP_MIN, 30)


if __name__ == "__main__":
    unittest.main()
