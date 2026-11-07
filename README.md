# Golgotha and the Empty Tomb: interactive 3D scenes

Two scenes modelled and animated in Blender, exported to glTF and shown in the browser with three.js.

- **Golgotha**: the three crosses (Jesus between the two thieves), soldiers, the road and the city wall.
- **The Empty Tomb**: the stone rolled away at dawn, the soldiers falling back and running.

## Controls (HUD)

- **Weather**: as filmed, clear, cloudy, rain, storm (lightning and thunder), fog, dust wind, snow
- **Season**: spring (Passover), summer, autumn, winter. Re-tints ground, foliage and sunlight
- **Time of day**: slider from 00:00 to 24:00 moves the sun and sky, with stars at night
- **Camera**: the film camera, free orbit and per-scene presets, optional auto-orbit
- Clouds and god-ray toggles, generated ambient sound (no audio files), quality presets
- Screenshot, fullscreen, and a shareable link that stores scene, weather, season and time

Responsive from small phones to ultrawide screens. On narrow screens the HUD is a bottom sheet, and portrait
screens widen the field of view so nothing is cropped.

## Stack

Static site, no build step: three.js 0.160 (ES modules from a CDN), GLB assets exported from Blender.
Everything is open source and self-hostable. Copy the folder to any static host.

```
python3 -m http.server 8765   # then open http://localhost:8765
```
