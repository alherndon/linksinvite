export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { location } = req.query;
  if (!location) {
    return res.status(400).json({ error: 'Missing location parameter' });
  }

  try {
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const geoRes = await fetch(geoUrl, {
      headers: {
        'User-Agent': 'LinksInviteGolfApp/1.0 contact@linksinvite.com',
        'Accept-Language': 'en',
      },
    });
    const geoData = await geoRes.json();

    let lat = 33.3807;
    let lon = -84.7997;
    let courseName = location.split(',')[0].trim();

    if (geoData?.length > 0) {
      lat = parseFloat(geoData[0].lat);
      lon = parseFloat(geoData[0].lon);
      courseName = geoData[0].display_name.split(',')[0].trim();
    }

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&timezone=auto`;

    const weatherRes = await fetch(weatherUrl);
    const weatherJson = await weatherRes.json();

    const daily = weatherJson?.daily;
    if (!daily) throw new Error('Invalid weather response');

    const mapWmo = (code) => {
      if (code === 0) return 'Clear Sunny Skies';
      if ([1, 2, 3].includes(code)) return 'Partly Cloudy';
      if ([45, 48].includes(code)) return 'Foggy/Overcast';
      if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Scattered Rain';
      if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snowy Conditions';
      if ([95, 96, 99].includes(code)) return 'Thunderstorms';
      return 'Overcast Clouds';
    };

    const days = daily.time.slice(0, 3).map((timeStr, idx) => {
      const dayName = new Date(timeStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      const maxTemp = Math.round(daily.temperature_2m_max[idx]);
      const minTemp = Math.round(daily.temperature_2m_min[idx]);
      const rainChance = daily.precipitation_probability_max[idx] || 0;

      let playability = 'Excellent';
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

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
    return res.status(200).json({ courseName, location, days, overallAdvice });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
