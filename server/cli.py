import argparse
import json

from server.provider import import_season, rebuild_saved_games
from server.storage import all_games, initialize_database


def main():
    parser = argparse.ArgumentParser(description="Import and verify real Lakers game data.")
    parser.add_argument("command", choices=["import", "rebuild", "validate", "init"])
    parser.add_argument(
        "--season", type=int, default=2026, help="Season end year: 2026 means 2025-26."
    )
    parser.add_argument("--season-type", type=int, choices=[1, 2, 3], default=2)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    initialize_database()
    if args.command == "import":
        print(
            json.dumps(
                import_season(args.season, args.season_type, args.limit, args.refresh), indent=2
            )
        )
    elif args.command == "rebuild":
        print(f"Rebuilt {rebuild_saved_games()} games from saved source responses.")
    elif args.command == "validate":
        games = all_games()
        report = {
            "games": len(games),
            "validated": sum(g["validation"]["status"] == "validated" for g in games),
            "stats_valid": sum(g["validation"]["stats_valid"] for g in games),
            "lineups_valid": sum(g["validation"]["lineups_valid"] for g in games),
            "issues": [
                {
                    "id": g["id"],
                    "date": g["local_date"],
                    "issues": g["validation"]["issues"],
                    "failed_checks": [c for c in g["validation"]["checks"] if not c["passed"]],
                }
                for g in games
                if g["validation"]["status"] != "validated"
            ],
        }
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
