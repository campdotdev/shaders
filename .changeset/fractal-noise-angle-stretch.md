---
'@camp-dev/shaders': minor
---

`FractalNoise` gains `angle` and `stretch`, which draw the field out into streaks. `angle` is the direction the features run, in degrees on screen, the degrees `FlutedGlass` uses: 0 runs them left to right and 90 runs them bottom to top. `stretch`, 1 or more, multiplies how much longer each feature runs along `angle`. At 1, a feature is as much longer than wide as the canvas is wider than tall, so on a 2:1 canvas a stretch of 3 draws features 6 times longer than wide. With `stretch` above 1, `scale` counts features across the streaks. Both take a static value or an animation signal, and change without rebuilding the material. At the defaults, `angle` 0 and `stretch` 1, the field draws as before.
