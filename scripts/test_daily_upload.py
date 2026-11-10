import datetime
import unittest
from urllib.parse import parse_qs

from daily_upload import VIDEOS, UPLOAD_GAP_MIN, video_config, recording_query, validate_frame_times


class DailyVideoRules(unittest.TestCase):
    day = datetime.date(2026, 10, 13)

    shorts = [n for n in VIDEOS if VIDEOS[n]["format"] == "shorts"]
    longs = [n for n in VIDEOS if VIDEOS[n]["format"] == "long"]

    def test_four_shorts_two_long_snake_only(self):
        self.assertEqual((len(self.shorts), len(self.longs)), (4, 2))
        self.assertTrue(all(v["game"] == "snake" for v in VIDEOS.values()))

    def test_memes_half_of_each_format(self):
        self.assertEqual(sum(video_config(n, self.day)["mems"] for n in self.shorts), 2)
        self.assertEqual(sum(video_config(n, self.day)["mems"] for n in self.longs), 1)

    def test_shorts_keep_10_by_10_speed_15(self):
        for n in self.shorts:
            cfg = video_config(n, self.day)
            self.assertEqual((cfg["w"], cfg["h"], cfg["speed"], cfg["head"]), (10, 10, 15, "snake"))

    def test_uploads_30_minutes_apart(self):
        self.assertEqual(UPLOAD_GAP_MIN, 30)

    def test_smooth_capture_accepted(self):
        validate_frame_times([i / 30 for i in range(300)])

    def test_frozen_capture_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "too choppy"):
            validate_frame_times([i / 30 for i in range(60)] + [3 + i / 30 for i in range(240)])

    def test_low_frame_rate_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "too choppy"):
            validate_frame_times([i / 12 for i in range(120)])

    def test_empty_recording_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "no usable"):
            validate_frame_times([])


if __name__ == "__main__":
    unittest.main()
