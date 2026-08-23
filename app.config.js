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

module.exports = ({ config }) =>
  withProjectBuildGradle(config, (gradleConfig) => {
    if (!gradleConfig.modResults.contents.includes(marker)) {
      gradleConfig.modResults.contents += compatibilityBlock;
    }

    return gradleConfig;
  });
