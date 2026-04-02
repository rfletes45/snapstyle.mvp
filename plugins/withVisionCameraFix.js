/**
 * Expo config plugin that adds CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES
 * to the Xcode project's build settings. This fixes the build error caused by
 * react-native-vision-camera v4 importing non-modular headers in framework modules
 * on newer Xcode toolchains.
 */
const { withXcodeProject, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withVisionCameraFix = (config) => {
  // Modify the Podfile to add the compiler flag via post_install
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      let podfileContents = fs.readFileSync(podfilePath, "utf8");

      // Check if already patched
      if (podfileContents.includes("CLANG_ALLOW_NON_MODULAR_INCLUDES")) {
        return config;
      }

      // Inject the build setting into the post_install hook
      const postInstallSnippet = `
  # --- VisionCamera non-modular header fix ---
  post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end
`;

      // If there's an existing post_install, merge into it; otherwise append
      if (podfileContents.includes("post_install do |installer|")) {
        podfileContents = podfileContents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|
    # VisionCamera non-modular header fix
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`,
        );
      } else {
        // Append before the final "end" of the target block
        podfileContents += postInstallSnippet;
      }

      fs.writeFileSync(podfilePath, podfileContents);
      return config;
    },
  ]);
};

module.exports = withVisionCameraFix;
