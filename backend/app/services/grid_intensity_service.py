import os
import urllib.request
import json
from datetime import datetime

# Mapping of cities to Electricity Maps zones
ZONE_MAPPINGS = {
    "bengaluru": "IN-KA",
    "bangalore": "IN-KA",
    "mumbai": "IN-MH",
    "pune": "IN-MH",
    "delhi": "IN-DL",
    "noida": "IN-DL",
    "gurgaon": "IN-DL",
    "chennai": "IN-TN",
    "kolkata": "IN-WB",
}

# Standard grid emissions averages (kg CO2e / kWh)
DEFAULT_FACTORS = {
    "IN-KA": 0.78,
    "IN-MH": 0.86,
    "IN-DL": 0.90,
    "IN-TN": 0.72,
    "IN-WB": 0.88,
    "GLOBAL": 0.49,
}

class GridIntensityService:
    def get_realtime_intensity(self, city: str) -> float:
        """Fetch real-time grid intensity for a city, else use regional factors."""
        if not city:
            return DEFAULT_FACTORS["GLOBAL"]

        city_lower = city.strip().lower()
        zone = "GLOBAL"
        for key, z_code in ZONE_MAPPINGS.items():
            if key in city_lower:
                zone = z_code
                break

        # 1. Check if Electricity Maps API key is configured
        api_key = os.getenv("ELECTRICITY_MAPS_API_KEY")
        if api_key:
            try:
                zone_param = zone if zone != "GLOBAL" else "IN"
                url = f"https://api.electricitymaps.com/v3/carbon-intensity/latest?zone={zone_param}"
                req = urllib.request.Request(
                    url,
                    headers={"auth-token": api_key}
                )
                with urllib.request.urlopen(req, timeout=3) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    # Electricity Maps returns gCO2e/kWh, convert to kgCO2e/kWh
                    g_co2 = data.get("carbonIntensity")
                    if g_co2 is not None:
                        return round(g_co2 / 1000.0, 3)
            except Exception:
                # Silently fail and use dynamic fallback
                pass

        # 2. Regional time-adjusted factor used when the live provider is not configured.
        base_factor = DEFAULT_FACTORS.get(zone, 0.82)
        current_hour = datetime.now().hour

        if 10 <= current_hour <= 15:
            # Solar peak (clean grid): 15% drop in carbon intensity
            multiplier = 0.85
        elif 18 <= current_hour <= 22:
            # Evening peak (heavy coal/gas load): 10% increase in carbon intensity
            multiplier = 1.10
        else:
            # Baseline off-peak
            multiplier = 1.00

        return round(base_factor * multiplier, 3)

_service = GridIntensityService()

def get_grid_intensity_service() -> GridIntensityService:
    return _service
