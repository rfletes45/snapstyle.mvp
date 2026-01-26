/**
 * Metro Bundle Analyzer Configuration
 * Phase 8: Testing & Launch
 *
 * Configures bundle analysis for tracking and optimizing app size.
 *
 * Usage:
 *   npx react-native-bundle-visualizer
 *   OR
 *   npm run analyze:bundle
 */

const { getDefaultConfig } = require("expo/metro-config");

/**
 * Metro configuration with bundle analysis support
 */
const config = getDefaultConfig(__dirname);

// Add source maps for detailed analysis
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

// Track bundle statistics
config.serializer = {
  ...config.serializer,
  // Enable stats output for analysis tools
  experimentalSerializerHook: (graph, delta) => {
    if (process.env.ANALYZE_BUNDLE) {
      const stats = {
        totalModules: graph.dependencies.size,
        entryPoints: graph.entryPoints,
        timestamp: new Date().toISOString(),
      };

      console.log("\n📦 Bundle Statistics:");
      console.log(`   Total Modules: ${stats.totalModules}`);
      console.log(`   Entry Points: ${stats.entryPoints.size}`);
    }
    return delta;
  },
};

module.exports = config;
