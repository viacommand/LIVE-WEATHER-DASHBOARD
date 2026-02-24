/* 
  =============================================
  DYNAMIC 3D NATURE BACKGROUNDS CONFIGURATION
  Supports Video (MP4) with Image Fallback
  =============================================
*/

const WEATHER_BACKGROUNDS = {
    // defaults
    defaultDay: {
        img: 'weather bgdimg/sunny weather.jpeg',
        video: null
    },
    defaultNight: {
        img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.33 AM.jpeg', // Night fallback
        video: null
    },

    // Condition Groups
    Clear: {
        day: {
            img: 'weather bgdimg/sunny weather.jpeg',
            video: null
        },
        night: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.33 AM.jpeg',
            video: null
        }
    },
    Clouds: {
        day: {
            img: 'weather bgdimg/few clouds.jpg',
            video: null
        },
        night: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.33 AM (2).jpeg',
            video: null
        }
    },
    Rain: {
        day: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.32 AM.jpeg',
            video: null
        },
        night: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.33 AM (1).jpeg',
            video: null
        }
    },
    Thunderstorm: {
        day: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.27 AM.jpeg',
            video: null
        },
        night: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.27 AM (1).jpeg',
            video: null
        }
    },
    Snow: {
        day: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.31 AM.jpeg',
            video: null
        },
        night: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.31 AM (1).jpeg',
            video: null
        }
    },
    Mist: {
        day: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.30 AM.jpeg',
            video: null
        },
        night: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.30 AM.jpeg',
            video: null
        }
    },
    Atmosphere: {
        day: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.30 AM.jpeg',
            video: null
        },
        night: {
            img: 'weather bgdimg/WhatsApp Image 2026-02-20 at 10.29.30 AM.jpeg',
            video: null
        }
    }
};

/**
 * Gets the best background assets for a given weather condition
 */
function getBackgroundAssets(weatherMain, weatherId, isDay) {
    const timeKey = isDay ? 'day' : 'night';

    // 1. Direct match on Main group
    if (WEATHER_BACKGROUNDS[weatherMain]) {
        return WEATHER_BACKGROUNDS[weatherMain][timeKey];
    }

    // 2. Map generic 'Drizzle' -> Rain
    if (weatherMain === 'Drizzle') return WEATHER_BACKGROUNDS.Rain[timeKey];

    // 3. Map various generic Atmosphere codes
    const atmosphereCodes = ['Mist', 'Smoke', 'Haze', 'Dust', 'Fog', 'Sand', 'Ash', 'Squall', 'Tornado'];
    if (atmosphereCodes.includes(weatherMain)) {
        return WEATHER_BACKGROUNDS.Mist[timeKey];
    }

    // 4. Fallback
    return isDay ? WEATHER_BACKGROUNDS.defaultDay : WEATHER_BACKGROUNDS.defaultNight;
}
