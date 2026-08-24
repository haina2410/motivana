/**
 * Runs the Kotlin rotation tests, which are the only check that the native module
 * still agrees with assets/data/quotes.json. A change to that file passed a green
 * gate once, because the gate had no native stage.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const gradle = `${root}android/gradlew`;
const task = ':motivana-wallpaper:testDebugUnitTest';

// A build server must not inherit the skip below, or the gate goes quiet again.
const required = process.env.MOTIVANA_REQUIRE_NATIVE === '1';

function stopIfRequired(reason) {
  if (required) {
    console.error(
      `verify-native: FAILED, ${reason}, and MOTIVANA_REQUIRE_NATIVE=1.`,
    );
    process.exit(1);
  }
}

if (!existsSync(gradle)) {
  // android/ is generated and git-ignored, so a fresh checkout has no Gradle yet.
  stopIfRequired('android/ is absent');
  console.error(
    'verify-native: SKIPPED, android/ is absent.\n' +
      '  The Kotlin rotation tests guard the shape of assets/data/quotes.json.\n' +
      '  Run them before you change that file or the native module:\n' +
      '    npx expo prebuild --platform android --no-install\n' +
      `    cd android && ./gradlew ${task}`,
  );
  process.exit(0);
}

if (
  process.env.ANDROID_HOME === undefined &&
  process.env.ANDROID_SDK_ROOT === undefined
) {
  stopIfRequired('no Android SDK is configured');
  console.error(
    'verify-native: SKIPPED, no ANDROID_HOME or ANDROID_SDK_ROOT.\n' +
      `  Run "cd android && ./gradlew ${task}" once the Android SDK is set up.`,
  );
  process.exit(0);
}

execFileSync(gradle, [task, '--console=plain'], {
  cwd: `${root}android`,
  stdio: 'inherit',
});
console.log('verify-native: Kotlin rotation tests passed.');
