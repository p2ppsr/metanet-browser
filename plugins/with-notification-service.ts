import {
  ConfigPlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  withPodfile
} from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';

const APP_GROUP = 'group.org.bsvblockchain.metanet';

const withNotificationService: ConfigPlugin = (config) => {
  // 1) Ensure App Group on app target
  let cfg = withEntitlementsPlist(config, (c) => {
    const appGroupKey = 'com.apple.security.application-groups';
    const existing = c.modResults[appGroupKey];
    const current = Array.isArray(existing) ? existing : [];
    c.modResults[appGroupKey] = Array.from(new Set([...current, APP_GROUP]));
    return c;
  });

  // 2) Copy Swift files into ios on prebuild
  cfg = withDangerousMod(cfg, ['ios', async (c) => {
    const iosDir = c.modRequest.platformProjectRoot;
    const dest = path.join(iosDir, 'NotificationService');
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(
      path.join(c.modRequest.projectRoot, 'native/ios/NotificationService/NotificationService.swift'),
      path.join(dest, 'NotificationService.swift')
    );
    // copy any other files you need (Info.plist templates, etc.)
    return c;
  }]);

  // 3) Create/attach the extension target
  cfg = withXcodeProject(cfg, (c) => {
    // Add PBXNativeTarget, build phases, build settings, and Embed App Extensions step.
    // (There are small helper libs/gists for this; keep it deterministic.)
    return c;
  });

  // 4) Add the same App Group to the extension’s entitlements (create an entitlements file for it if needed)
  cfg = withInfoPlist(cfg, (c) => {
    // If you generate a separate plist for the extension, write it in withDangerousMod instead.
    return c;
  });

  // 5) Inject Podfile changes if the extension needs pods
  cfg = withPodfile(cfg, (c) => {
    // Append a NotificationService target block if missing.
    // Make sure to idempotently patch (search+insert) rather than overwrite.
    return c;
  });

  return cfg;
};

export default withNotificationService;
