import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("CV_DATA_DIR", ROOT / "data"))
DATABASE_URL = os.environ.get(
    "CV_DATABASE_URL", "postgresql+psycopg://courtvision:courtvision@localhost:5434/lakers"
)
LAKERS_ID = "13"
METHOD_VERSION = "espn-events-v1"
SOURCE_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
