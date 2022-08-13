import json
import os
import datetime

TIME_FORMAT = "%d/%m/%Y-%H:%M"

def migrate_times(old_data: dict):
    for entries in old_data.values():
        for entry in entries:
            entry["time"] = int(datetime.datetime.strptime(entry["time"], TIME_FORMAT).timestamp())


def convert_all():
    FORMAT = "oldest_data_{0}.json"

    with open("json/campaign_levels.json", encoding="utf8") as f:
        level_lookup = json.load(f)

    for level in level_lookup:
        t_code: str = level["code"]
        id: str = level["id"]

        world, level = t_code.split("-")
        challenge = level.endswith("c")
        if challenge:
            level = level[:-1]
        code = f"{int(world)}-{int(level)}{'c' if challenge else ''}" # remove leading zero stuff

        file = os.path.join("data", FORMAT.format(code))

        if os.path.exists(file):
            print(f"[Merge] {code}")

            with open(file) as f:
                new_history = json.load(f)

            with open(f"data/{id}.json", encoding="utf8") as f:
                cur_data = json.load(f)
            
            migrate_times(new_history)
            
            cur_data["any"]["top_history"] = new_history["any"]
            cur_data["unbroken"]["top_history"] = new_history["unbroken"]

            with open(f"data/{id}.json", "w", encoding="utf8") as f:
                json.dump(cur_data, f)



convert_all()