const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const withFcmManifestFixes = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const androidManifest = cfg.modResults;
    const { manifest } = androidManifest;

    // Ensure tools namespace on <manifest>
    manifest.$ = manifest.$ || {};
    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    // Get <application>
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
    if (!app) { throw new Error('Main application not found in AndroidManifest'); }

    // Helper to upsert <meta-data> by android:name
    const upsertMetaData = (name, attrs) => {
      app["meta-data"] = app["meta-data"] || [];
      const idx = app["meta-data"].findIndex(
        (x) => x.$?.["android:name"] === name
      );
      const node = { $: { "android:name": name, ...attrs } };
      if (idx === -1) app["meta-data"].push(node);
      else app["meta-data"][idx] = node;
    };

    // Replace conflicts with tools:replace as Gradle requested
    upsertMetaData("com.google.firebase.messaging.default_notification_channel_id", {
      "android:value": "default",
      "tools:replace": "android:value",
    });

    upsertMetaData("com.google.firebase.messaging.default_notification_color", {
      "android:resource": "@color/notification_icon_color",
      "tools:replace": "android:resource",
    });

    return cfg;
  });
};

module.exports = withFcmManifestFixes;