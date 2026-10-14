import datetime
import unittest
from urllib.parse import parse_qs

from daily_upload import VIDEOS, SHORT_PALETTES, video_config, recording_query, video_metadata


class DailyVideoRules(unittest.TestCase):
    day = datetime.date(2026, 10, 13)

    def test_four_videos_one_of_each_format_and_mode(self):
        self.assertEqual(len(VIDEOS), 4)
        self.assertEqual({(v["format"], v["mode"]) for v in VIDEOS.values()},
                         {("shorts", "classic"), ("shorts", "double"), ("long", "classic"), ("long", "double")})

    def test_shorts_keep_10_by_10_speed_15_snake(self):
        for name in ("short-classic-1", "short-double-1"):
            cfg = video_config(name, self.day)
            self.assertEqual((cfg["w"], cfg["h"], cfg["speed"], cfg["head"]), (10, 10, 15, "snake"))

    def test_shorts_have_distinct_ready_made_colors_and_change_daily(self):
        seen = set()
        for offset in range(len(SHORT_PALETTES)):
            day = self.day + datetime.timedelta(days=offset)
            classic = video_config("short-classic-1", day)["theme"]
            double = video_config("short-double-1", day)["theme"]
            self.assertNotEqual(classic, double)
            self.assertIn(classic, SHORT_PALETTES)
            self.assertIn(double, SHORT_PALETTES)
            self.assertNotEqual(classic, video_config("short-classic-1", day + datetime.timedelta(days=1))["theme"])
            seen.add(classic)
        self.assertEqual(seen, set(SHORT_PALETTES))

    def test_longs_are_32_by_18_neon_speed_15_snake(self):
        for name in ("long-classic-32", "long-double-32"):
            cfg = video_config(name, self.day)
            self.assertEqual((cfg["w"], cfg["h"], cfg["format"], cfg["speed"], cfg["theme"], cfg["head"]),
                             (32, 18, "long", 15, "neon", "snake"))

    def test_all_four_pass_distinct_banner_variants_to_recording(self):
        variants = set()
        for name in VIDEOS:
            cfg = video_config(name, self.day)
            query = parse_qs(recording_query(cfg))
            self.assertEqual(query["banner"], [str(cfg["banner"])])
            variants.add(cfg["banner"])
        self.assertEqual(len(variants), 4)

    def test_only_shorts_describe_a_half_full_start(self):
        for name in VIDEOS:
            cfg = video_config(name, self.day)
            title, desc, _ = video_metadata(name, cfg, self.day)
            self.assertEqual("half-full" in desc, cfg["format"] == "shorts")
            if cfg["format"] == "long":
                self.assertNotIn("50%", title)
                self.assertIn("small snake", desc)

    def test_first_short_and_long_use_uploaded_memes_second_videos_do_not(self):
        for name, enabled in (("short-classic-1", 1), ("long-classic-32", 1),
                              ("short-double-1", 0), ("long-double-32", 0)):
            cfg = video_config(name, self.day)
            self.assertEqual(cfg["mems"], enabled)
            self.assertEqual(parse_qs(recording_query(cfg))["mems"], [str(enabled)])


if __name__ == "__main__":
    unittest.main()