# PhysLive Android

A native Flutter app for students and teachers. Accounts that run a school or the platform (school, manager, reviewer, admin) are told to use the web.

| Student | Teacher |
| --- | --- |
| Assignments to do and handed in, deadlines, scores and comments | Assignments given, open/closed, hand-in and grading counts |
| Predict → observe the simulation → write the conclusion and hand in (all activity types) | A student's work, score and comment, confirming AI scores, sending work back |
| The school's and the community's simulation library | Own, school and community library; changing a simulation's parameters (the backend recomputes) |
| Account, password change, sign-out | Same |

Not in the app (use the web): creating simulations with AI, giving assignments, managing classes, reports, billing.

## The simulation stage

Every control, reading and slider is native. Only the authored scene is drawn by the web player's own PixiJS runtime. It runs offline from `assets/player/player.html`, in a sandboxed frame with no network access, and the drawing happens in a worker on OffscreenCanvas. The physics comes from the backend as a timeline, so the phone only replays it.

`player.html` is generated from the web sources. Rebuild it whenever `react-client/src/features/simulation/engine/pixiRuntime.ts` or PixiJS changes:

```sh
cd ../react-client && node scripts/build-mobile-player.mjs
```

## Run

Use Flutter 3.41.9 and Android SDK 36 or newer.

```sh
flutter pub get
flutter run
```

A debug build talks to the backend on the developer's machine through the emulator (`http://10.0.2.2:8080/api`). The address can be changed from the sign-in screen. A release build gets its address at build time:

```sh
flutter build apk --release --dart-define=PHYSLIVE_API_URL=https://your-physlive-deployment.example/api
```

Production addresses must use HTTPS. Plain HTTP is accepted only for localhost and 10.0.2.2, and cleartext traffic is enabled only in debug builds.

Release signing reads android/key.properties with storeFile, storePassword, keyAlias and keyPassword. storeFile is relative to the android directory. The keystore and properties are ignored by git.
