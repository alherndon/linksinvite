// Shared weather logic used by the public /api/weather endpoint AND by email
// senders (invites, digest). Senders call getForecast() directly rather than
// HTTP-fetching /api/weather: a serverless function fetching another function
// on the same Vercel deployment can deadlock, which was silently killing
// invite sends before they could insert a row or send an email.

// Module-level cache survives across warm invocations. Golf course coordinates
// essentially never change, so no TTL is needed. Capped at 200 entries to
// bound memory; oldest entry evicted when full.
const geoCache = new Map();

async function geocode(location) {
  const key = location.toLowerCase().trim();
  if (geoCache.has(key)) return geoCache.get(key);

  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
    {
      headers: {
        'User-Agent': 'LinksInviteGolfApp/1.0 contact@linksinvite.com',
        'Accept-Language': 'en',
      },
    }
  );
  const geoData = await geoRes.json();

  const result = {
    lat: 33.3807,
    lon: -84.7997,
    courseName: location.split(',')[0].trim(),
  };

  if (geoData?.length > 0) {
    result.lat = parseFloat(geoData[0].lat);
    result.lon = parseFloat(geoData[0].lon);
    result.courseName = geoData[0].display_name.split(',')[0].trim();
  }

  if (geoCache.size >= 200) {
    geoCache.delete(geoCache.keys().next().value);
  }
  geoCache.set(key, result);
  return result;
}

const mapWmo = (code) => {
  if (code === 0) return 'Clear Sunny Skies';
  if ([1, 2, 3].includes(code)) return 'Partly Cloudy';
  if ([45, 48].includes(code)) return 'Foggy/Overcast';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Scattered Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snowy Conditions';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Overcast Clouds';
};

// Returns { courseName, location, days[], overallAdvice }. `days` clamps to 1–7.
export async function getForecast(location, days = 3) {
  const numDays = Math.min(Math.max(parseInt(days, 10) || 3, 1), 7);
  const { lat, lon, courseName } = await geocode(location);

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&timezone=auto`;

  const weatherRes = await fetch(weatherUrl);
  const weatherJson = await weatherRes.json();

  const daily = weatherJson?.daily;
  if (!daily) throw new Error('Invalid weather response');

  const days_ = daily.time.slice(0, numDays).map((timeStr, idx) => {
    const dayName = new Date(timeStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const maxTemp = Math.round(daily.temperature_2m_max[idx]);
    const minTemp = Math.round(daily.temperature_2m_min[idx]);
    const rainChance = daily.precipitation_probability_max[idx] || 0;

    let playability = 'Great';
    if (rainChance > 45) playability = 'Poor';
    else if (rainChance > 20 || maxTemp < 50) playability = 'Fair';
    else if (maxTemp > 95) playability = 'Hot';

    return {
      dayName,
      temp: `${maxTemp}°F / ${minTemp}°F`,
      condition: mapWmo(daily.weathercode[idx]),
      rainChance: `${rainChance}%`,
      playability,
    };
  });

  const dayOneRain = daily.precipitation_probability_max[0] || 0;
  const dayOneTemp = daily.temperature_2m_max[0] || 70;
  let overallAdvice = 'Forecast looks great for a round of golf! Green speeds should be standard.';
  if (dayOneRain > 50) {
    overallAdvice = 'High probability of rain. Consider packing umbrellas or scheduling an alternate indoor option.';
  } else if (dayOneTemp < 55) {
    overallAdvice = 'Temperatures will be on the cooler side. Layer up and hit low spin golf balls for extra distance.';
  }

  return { courseName, location, days: days_, overallAdvice };
}
