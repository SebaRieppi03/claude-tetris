---
name: clima
description: Consulta el clima actual y el pronóstico de una ciudad usando servicios gratuitos sin API key (wttr.in y Open-Meteo). Úsalo cuando el usuario pregunte por el clima, temperatura, pronóstico o condiciones meteorológicas de un lugar.
---

# Clima

Esta skill obtiene información del clima real ejecutando comandos en la terminal (Bash), sin necesidad de API keys.

## Cómo obtener el clima

### Opción 1 (por defecto): wttr.in — rápido, texto legible

```bash
curl -s "wttr.in/CIUDAD?format=3"
```

Para un reporte más completo (3 días, sin emojis raros de terminal, en español):

```bash
curl -s "wttr.in/CIUDAD?lang=es&m"
```

- Reemplazá `CIUDAD` por el nombre de la ciudad (ej: `Montevideo`, `Buenos+Aires`). Si el usuario no especifica ciudad, dejá `CIUDAD` vacío (`wttr.in?lang=es&m`) para que detecte la ubicación por IP.
- `m` fuerza unidades métricas (°C, km/h).
- Si `curl` no está disponible o falla (sin conexión, DNS bloqueado), avisá al usuario en vez de inventar datos.

### Opción 2: Open-Meteo — cuando se necesitan datos estructurados (JSON)

Útil si el usuario pide un dato puntual (ej: "¿cuál es la humedad?", "dame el pronóstico por hora") o si `wttr.in` no responde.

1. Geocodificar la ciudad:
```bash
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=CIUDAD&count=1&language=es"
```
2. Con la `latitude`/`longitude` obtenida, pedir el clima:
```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto"
```

## Presentación de la respuesta

- Respondé de forma breve y directa: ciudad, condición, temperatura actual y (si aplica) mín/máx del día.
- No repitas el JSON crudo al usuario; interpretalo y resumilo en 1-3 líneas, salvo que pida el detalle completo.
- Si el usuario pide pronóstico de varios días, listalo día por día en una tabla o lista corta.
