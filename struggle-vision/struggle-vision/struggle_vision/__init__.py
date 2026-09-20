"""struggle-vision: camera-based detection of a child struggling while writing."""

from .config import Config
from .detector import (PostureReference, Status, StruggleDetector, load_calibration,
                       save_calibration)
from .scoring import score_parts, struggle_score

__all__ = ["Config", "PostureReference", "Status", "StruggleDetector",
           "load_calibration", "save_calibration", "score_parts", "struggle_score"]
__version__ = "0.1.0"
