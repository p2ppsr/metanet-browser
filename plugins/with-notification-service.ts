import {
  ConfigPlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
  withPodfile
} from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';

const APP_GROUP = 'group.org.bsvblockchain.metanet';
const EXTENSION_NAME = 'MetanetNotificationService';
const MAIN_BUNDLE_ID = 'org.bsvblockchain.metanet';

const withNotificationService: ConfigPlugin = (config) => {
  // 1) Ensure App Group on app target
  let cfg = withEntitlementsPlist(config, (c) => {
    const appGroupKey = 'com.apple.security.application-groups';
    const existing = c.modResults[appGroupKey];
    const current = Array.isArray(existing) ? existing : [];
    c.modResults[appGroupKey] = Array.from(new Set([...current, APP_GROUP]));
    return c;
  });

  // 2) Copy wallet-bundle.js into MetanetNotificationService on prebuild
  cfg = withDangerousMod(cfg, ['ios', async (c) => {
    const iosDir = c.modRequest.platformProjectRoot;
    const extensionDir = path.join(iosDir, EXTENSION_NAME);
    const bundlePath = path.join(c.modRequest.projectRoot, 'js-notification-processor/dist/wallet-bundle.js');
    const destPath = path.join(extensionDir, 'wallet-bundle.js');
    
    if (fs.existsSync(bundlePath)) {
      fs.copyFileSync(bundlePath, destPath);
      console.log('✅ Copied wallet-bundle.js to MetanetNotificationService');
    } else {
      console.warn('⚠️ wallet-bundle.js not found - run npm run build in js-notification-processor first');
    }
    return c;
  }]);

  // 3) Create/attach the extension target
  cfg = withXcodeProject(cfg, (c) => {
    const project = c.modResults;
    const extensionName = EXTENSION_NAME;
    const bundleId = MAIN_BUNDLE_ID;
    const extensionBundleId = `${bundleId}.${extensionName}`;
    
    // Check if extension target already exists
    const existingTarget = project.getTarget(extensionName);
    if (existingTarget) {
      console.log('NotificationService extension target already exists, skipping creation');
      return c;
    }

    // Add the extension target
    const target = project.addTarget(extensionName, 'app_extension', extensionName, `${bundleId}.${extensionName}`);
    
    // Add source files to the target
    const sourcesBuildPhase = project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    const resourcesBuildPhase = project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    const group = project.addPbxGroup(['NotificationService.swift', 'wallet-bundle.js'], extensionName, extensionName);
    project.addToPbxGroup('NotificationService.swift', group.uuid);
    project.addToPbxGroup('wallet-bundle.js', group.uuid);
    project.addToPbxSourcesBuildPhase('NotificationService.swift', sourcesBuildPhase.uuid);
    project.addToPbxResourcesBuildPhase('wallet-bundle.js', resourcesBuildPhase.uuid);
    
    // Configure build settings
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      if (configurations[key].buildSettings && key.includes(target.uuid)) {
        const buildSettings = configurations[key].buildSettings;
        buildSettings.PRODUCT_BUNDLE_IDENTIFIER = extensionBundleId;
        buildSettings.SWIFT_VERSION = '5.0';
        buildSettings.TARGETED_DEVICE_FAMILY = '1,2';
        buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '11.0';
        buildSettings.CODE_SIGN_ENTITLEMENTS = `${extensionName}/${extensionName}.entitlements`;
        buildSettings.INFOPLIST_FILE = `${extensionName}/Info.plist`;
      }
    }
    
    // Add extension to main app's embed app extensions phase
    const mainTarget = project.getFirstTarget();
    if (mainTarget && mainTarget.uuid) {
      const embedPhase = project.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Embed App Extensions', mainTarget.uuid, 'app_extension');
      if (embedPhase) {
        project.addToPbxCopyfilesBuildPhase(target.uuid, embedPhase.uuid, extensionName, 'app_extension');
      }
    }
    
    console.log('✅ Created NotificationService extension target');
    return c;
  });

  // 4) Create extension files (Info.plist and entitlements)
  cfg = withDangerousMod(cfg, ['ios', async (c) => {
    const iosDir = c.modRequest.platformProjectRoot;
    const extensionDir = path.join(iosDir, EXTENSION_NAME);
    
    // Create Info.plist for extension
    
    fs.writeFileSync(
      path.join(extensionDir, 'Info.plist'),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleName</key>
\t<string>$(PRODUCT_NAME)</string>
\t<key>CFBundleDisplayName</key>
\t<string>NotificationService</string>
\t<key>CFBundleIdentifier</key>
\t<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
\t<key>CFBundleVersion</key>
\t<string>$(CURRENT_PROJECT_VERSION)</string>
\t<key>CFBundleShortVersionString</key>
\t<string>$(MARKETING_VERSION)</string>
\t<key>CFBundlePackageType</key>
\t<string>XPC!</string>
\t<key>NSExtension</key>
\t<dict>
\t\t<key>NSExtensionPointIdentifier</key>
\t\t<string>com.apple.usernotifications.service</string>
\t\t<key>NSExtensionPrincipalClass</key>
\t\t<string>$(PRODUCT_MODULE_NAME).NotificationService</string>
\t</dict>
</dict>
</plist>`
    );
    
    // Create entitlements file for extension
    
    fs.writeFileSync(
      path.join(extensionDir, `${EXTENSION_NAME}.entitlements`),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>${APP_GROUP}</string>
\t</array>
</dict>
</plist>`
    );
    
    console.log('✅ Created NotificationService Info.plist and entitlements');
    return c;
  }]);
  
  // 5) Inject Podfile changes if the extension needs pods
  cfg = withPodfile(cfg, (c) => {
    // Append a NotificationService target block if missing.
    // Make sure to idempotently patch (search+insert) rather than overwrite.
    return c;
  });

  return cfg;
};

export default withNotificationService;
