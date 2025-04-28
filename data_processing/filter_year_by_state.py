import pandas as pd

# Step 1: Setup
wanted_elements = {'TMAX', 'TMIN', 'TAVG'}  # Only these three for averaging

# Load US station list with states
stations_df = pd.read_csv("filtered_us_stations.csv")[["ID", "STATE"]]
station_state_map = dict(zip(stations_df["ID"], stations_df["STATE"]))

# Load daily data from 2000

daily_df = pd.read_csv("2000.csv", header=None, names=[
    "ID", "DATE", "ELEMENT", "VALUE", "MFLAG", "QFLAG", "SFLAG", "OBSTIME"
], dtype=str)

# Step 2: Filter to wanted stations and elements
daily_df = daily_df[
    daily_df["ID"].isin(station_state_map) &
    daily_df["ELEMENT"].isin(wanted_elements)
]

# Add STATE column
daily_df["STATE"] = daily_df["ID"].map(station_state_map)

# Only keep necessary columns
daily_df = daily_df[["STATE", "ID", "DATE", "ELEMENT", "VALUE"]]

# Convert VALUE to numeric
daily_df["VALUE"] = pd.to_numeric(daily_df["VALUE"], errors='coerce')

# Step 3: Pivot to have TMIN, TMAX, TAVG in columns
daily_pivot = daily_df.pivot_table(
    index=["STATE", "DATE"],
    columns="ELEMENT",
    values="VALUE",
    aggfunc='first'  # In case of multiple, take the first
).reset_index()

# Step 4: Calculate monthly averages
# Extract month from DATE
daily_pivot["MONTH"] = daily_pivot["DATE"].str[4:6]

# Group by STATE and MONTH
monthly_avg_state = (
    daily_pivot.groupby(["STATE", "MONTH"])[["TMIN", "TMAX", "TAVG"]]
    .mean()
    .reset_index()
)

# Step 5: Adjust values: divide by 10 and round to 1 decimal place
for col in ["TMIN", "TMAX", "TAVG"]:
    monthly_avg_state[col] = (monthly_avg_state[col] / 10).round(1)

# Save to file
monthly_avg_state.to_csv("state_monthly_avg_temps.csv", index=False)

print("Monthly state averages saved.")
