import pandas as pd

# Load the file and limit to the first 9 columns
df = pd.read_csv("ghcnd-stations.csv", header=None, usecols=range(9), names=[
    "ID", "LATITUDE", "LONGITUDE", "ELEVATION", "STATE",
    "NAME", "GSN_FLAG", "HCN_CRN_FLAG", "WMO_ID"
], skipinitialspace=True)

# Valid 2-letter US state codes
us_state_codes = {
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
}

# Filter only rows with valid state codes
us_df = df[df["STATE"].isin(us_state_codes)]

# Keep the first station found per state
one_per_state_df = us_df.drop_duplicates(subset="STATE", keep="first")

# Save to new CSV
one_per_state_df.to_csv("one_station_per_state.csv", index=False)