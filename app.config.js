const { withProjectBuildGradle } = require('expo/config-plugins');

const marker = '// Motivana Gradle 9 test-discovery compatibility';
const compatibilityBlock = `
${marker}
gradle.beforeProject { project ->
  if (project.name == 'expo-modules-core') {
    project.tasks.withType(org.gradle.api.tasks.testing.Test).configureEach {
      failOnNoDiscoveredTests = false
    }
  }
}
`;
const lintMarker = '// Motivana external dependency lint isolation';
const lintBlock = `
${lintMarker}
gradle.afterProject { project, _ ->
  if (!(project.path in [':app', ':motivana-wallpaper'])) {
    project.tasks.matching { it.name.startsWith('lintAnalyze') }.configureEach {
      enabled = false
    }
  }
}
`;

module.exports = ({ config }) =>
  withProjectBuildGradle(config, (gradleConfig) => {
    if (!gradleConfig.modResults.contents.includes(marker)) {
      gradleConfig.modResults.contents += compatibilityBlock;
    }
    if (!gradleConfig.modResults.contents.includes(lintMarker)) {
      gradleConfig.modResults.contents += lintBlock;
    }

    return gradleConfig;
  });
