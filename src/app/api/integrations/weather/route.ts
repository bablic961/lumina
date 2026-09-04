import { jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** WMO weather codes as used by Open-Meteo, condensed to what a chat line needs. */
const WMO: Record<number, string> = {
  0: '☀️ ясно',
  1: '🌤 преимущественно ясно',
  2: '⛅️ переменная облачность',
  3: '☁️ облачно',
  45: '🌫 туман',
  48: '🌫 туман с изморозью',
  51: '🌦 слабая морось',
  53: '🌦 морось',
  55: '🌧 сильная морось',
  61: '🌦 слабый дождь',
  63: '🌧 дождь',
  65: '🌧 сильный дождь',
  71: '🌨 слабый снег',
  73: '🌨 снег',
  75: '❄️ сильный снег',
  77: '🌨 снежные зёрна',
  80: '🌦 ливни',
  81: '🌧 сильные ливни',
  82: '⛈ очень сильные ливни',
  85: '🌨 снежные ливни',
  86: '🌨 сильные снежные ливни',
  95: '⛈ гроза',
  96: '⛈ гроза с градом',
  99: '⛈ сильная гроза с градом',
};

async function viaOpenWeather(city: string, key: string) {
  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.searchParams.set('q', city);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('lang', 'ru');
  url.searchParams.set('appid', key);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    name?: string;
    main?: { temp?: number; feels_like?: number; humidity?: number };
    weather?: { description?: string }[];
    wind?: { speed?: number };
  };
  if (typeof data.main?.temp !== 'number') return null;
  const description = data.weather?.[0]?.description ?? 'без осадков';
  return [
    `🌡 ${data.name ?? city}: ${Math.round(data.main.temp)}°C, ${description}`,
    `ощущается как ${Math.round(data.main.feels_like ?? data.main.temp)}°C`,
    `влажность ${data.main.humidity ?? '—'}%`,
    `ветер ${Math.round(data.wind?.speed ?? 0)} м/с`,
  ].join(' · ');
}

/** Keyless fallback so `/weather` works out of the box. */
async function viaOpenMeteo(city: string) {
  const geo = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geo.searchParams.set('name', city);
  geo.searchParams.set('count', '1');
  geo.searchParams.set('language', 'ru');
  const found = await fetch(geo, { cache: 'no-store' });
  if (!found.ok) return null;
  const places = (await found.json()) as { results?: { name: string; country?: string; latitude: number; longitude: number }[] };
  const place = places.results?.[0];
  if (!place) return null;

  const forecast = new URL('https://api.open-meteo.com/v1/forecast');
  forecast.searchParams.set('latitude', String(place.latitude));
  forecast.searchParams.set('longitude', String(place.longitude));
  forecast.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code');
  const res = await fetch(forecast, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
      weather_code?: number;
    };
  };
  const now = data.current;
  if (typeof now?.temperature_2m !== 'number') return null;
  const where = [place.name, place.country].filter(Boolean).join(', ');
  return [
    `🌡 ${where}: ${Math.round(now.temperature_2m)}°C, ${WMO[now.weather_code ?? -1] ?? 'без осадков'}`,
    `ощущается как ${Math.round(now.apparent_temperature ?? now.temperature_2m)}°C`,
    `влажность ${now.relative_humidity_2m ?? '—'}%`,
    `ветер ${Math.round((now.wind_speed_10m ?? 0) / 3.6)} м/с`,
  ].join(' · ');
}

/** `/weather <город>` — OpenWeatherMap when a key is set, Open-Meteo otherwise. */
export async function GET(req: Request) {
  try {
    await requireUser();
    const city = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80);
    if (!city) return Response.json({ error: 'Укажите город: /weather Москва' }, { status: 400 });

    const key = process.env.OPENWEATHER_API_KEY;
    const text = (key ? await viaOpenWeather(city, key).catch(() => null) : null) ?? (await viaOpenMeteo(city).catch(() => null));
    if (!text) return Response.json({ error: 'Город не найден' }, { status: 404 });
    return Response.json({ text });
  } catch (err) {
    return jsonError(err);
  }
}
