"""struggle-vision: camera-based detection of a child struggling while writing."""

from .config import Config
from .detector import Status, StruggleDetector

__all__ = ["Config", "Status", "StruggleDetector"]
__version__ = "0.1.0"
