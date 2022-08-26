import json
import datetime
from time import time
plots = {}
level_id = "mAp2V"

with open(f"data/{level_id}.json") as f:
    data = json.load(f)

oldest = data["any"]["top_history"]

for entry in oldest:
    name: str = entry["owner"]["display_name"]
    if name not in plots:
        plots[name] = ([], [])
    
    if plots[name][0]:
        plots[name][0].append(entry["time"])
        plots[name][1].append(plots[name][1][-1])

    plots[name][0].append(entry["time"])
    plots[name][1].append(entry["value"])

# scuffed way
# TODO: do this bit properly
newPlots = {}
for entry in oldest:
    name: str = entry["owner"]["display_name"]
    if entry["rank"] == 1:
        newPlots[name] = plots[name]

plots = newPlots

print("plotting...")

min_time = min(min(plot[0]) for plot in plots.values())
max_time = max(max(plot[0]) for plot in plots.values())

N_STEPS = 5

step_amount = (max_time - min_time) / N_STEPS
steps = [min_time + i * step_amount for i in range(N_STEPS + 1)]


import matplotlib.pyplot as plt

fig = plt.figure(1)

for label, (x, y) in plots.items():
    plt.plot(x, y, label=label)

plt.ylabel("Budget")
plt.xlabel("Days ago")

seconds_in_day = 60 * 60 * 24

today = int(time() // seconds_in_day)

plt.xticks(steps, [int(today - (step // seconds_in_day)) for step in steps])

plt.legend(loc='center left', bbox_to_anchor=(1, 0))

fig.savefig('1-1', bbox_inches='tight')