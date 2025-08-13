const { withAndroidManifest } = require('@expo/config-plugins');

function withFCMHeadless(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) {
      throw new Error('Could not find <application> in AndroidManifest.xml');
    }

    application.service ||= [];
    application.receiver ||= [];

    const svcName = (s) => s.$?.['android:name'];

    const hasService = (name) =>
      application.service.some((s) => svcName(s) === name);

    const getService = (name) =>
      application.service.find((s) => svcName(s) === name);

    // 1) Ensure the MessagingService is present WITH the MESSAGING_EVENT intent-filter
    const MESSAGING_SERVICE =
      'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService';

    if (!hasService(MESSAGING_SERVICE)) {
      application.service.push({
        $: {
          'android:name': MESSAGING_SERVICE,
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } },
            ],
          },
        ],
      });
      console.log('✅ Added ReactNativeFirebaseMessagingService with intent-filter');
    } else {
      // Ensure it has the intent-filter and exported=false
      const svc = getService(MESSAGING_SERVICE);
      svc.$['android:exported'] = 'false';
      const hasIntent =
        Array.isArray(svc['intent-filter']) &&
        svc['intent-filter'].some((f) =>
          (f.action || []).some(
            (a) => a.$?.['android:name'] === 'com.google.firebase.MESSAGING_EVENT'
          )
        );
      if (!hasIntent) {
        svc['intent-filter'] = [
          {
            action: [
              { $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } },
            ],
          },
        ];
        console.log('ℹ️  Ensured MessagingService has MESSAGING_EVENT intent-filter');
      }
    }

    // 2) Ensure the HeadlessService exists, but with NO intent-filter
    const HEADLESS_SERVICE =
      'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingHeadlessService';

    if (!hasService(HEADLESS_SERVICE)) {
      application.service.push({
        $: {
          'android:name': HEADLESS_SERVICE,
          'android:exported': 'false',
        },
      });
      console.log('✅ Added ReactNativeFirebaseMessagingHeadlessService (no intent-filter)');
    } else {
      // Strip any accidental intent-filters
      const headless = getService(HEADLESS_SERVICE);
      headless.$['android:exported'] = 'false';
      if (headless['intent-filter']) {
        delete headless['intent-filter'];
        console.log('🔧 Removed intent-filter from HeadlessService');
      }
    }

    // 3) Remove legacy receivers/services that can conflict
    const legacyReceiverNames = [
      'io.invertase.firebase.messaging.RNFirebaseMessagingReceiver',
      'io.invertase.firebase.messaging.RNFirebaseMsgReceiver',
    ];

    if (Array.isArray(application.receiver)) {
      const before = application.receiver.length;
      application.receiver = application.receiver.filter(
        (r) => !legacyReceiverNames.includes(r.$?.['android:name'])
      );
      const after = application.receiver.length;
      if (after !== before) {
        console.log('🧹 Removed legacy RNFirebase receivers');
      }
    }

    // Also remove any *service* accidentally holding MESSAGING_EVENT that isn't the official one
    application.service = application.service.map((s) => {
      const name = svcName(s) || '';
      if (
        name !== MESSAGING_SERVICE &&
        s['intent-filter'] &&
        s['intent-filter'].some((f) =>
          (f.action || []).some(
            (a) => a.$?.['android:name'] === 'com.google.firebase.MESSAGING_EVENT'
          )
        )
      ) {
        // strip the filter from non-official services (e.g., HeadlessService)
        delete s['intent-filter'];
        console.log(`🧹 Removed MESSAGING_EVENT intent-filter from ${name}`);
      }
      return s;
    });

    return cfg;
  });
}

module.exports = withFCMHeadless;
