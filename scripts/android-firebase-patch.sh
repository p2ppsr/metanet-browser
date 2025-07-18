# Patch AndroidManifest.xml files if Firebase is used
if [[ "$USE_FIREBASE" == "true" ]]; then
    printf "\nPatching AndroidManifest.xml files for Firebase manifest merger conflicts...\n"

    for MANIFEST_PATH in \
        "android/app/src/debug/AndroidManifest.xml" \
        "android/app/src/main/AndroidManifest.xml"; do
        if [[ -f "$MANIFEST_PATH" ]]; then
            # Add xmlns:tools if not already present
            if ! grep -q 'xmlns:tools=' "$MANIFEST_PATH"; then
                sed -i '' 's/xmlns:android="http:\/\/schemas.android.com\/apk\/res\/android"/xmlns:android="http:\/\/schemas.android.com\/apk\/res\/android" xmlns:tools="http:\/\/schemas.android.com\/tools"/' "$MANIFEST_PATH"
                echo "Added tools namespace to <manifest> in $MANIFEST_PATH"
            fi

            # First remove any existing tools:replace attributes to prevent duplicates
            sed -i '' 's| tools:replace="android:value"||g' "$MANIFEST_PATH"
            sed -i '' 's| tools:replace="android:resource"||g' "$MANIFEST_PATH"
            
            # Now add the tools:replace attributes properly
            sed -i '' 's|\(<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id"[^>]*\) */\>|\1 tools:replace="android:value" />|' "$MANIFEST_PATH"
            sed -i '' 's|\(<meta-data android:name="com.google.firebase.messaging.default_notification_color"[^>]*\) */\>|\1 tools:replace="android:resource" />|' "$MANIFEST_PATH"

            echo "Patched <meta-data> tags in $MANIFEST_PATH"

            # In the section where the Firebase Messaging service is injected:
            if [[ "$MANIFEST_PATH" == *"/main/"* ]] && ! grep -q "ReactNativeFirebaseMessagingService" "$MANIFEST_PATH"; then
                awk '
                    /<\/application>/ {
                        print "    <service android:name=\"io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService\" android:exported=\"true\" tools:replace=\"android:exported\">";
                        print "        <intent-filter>";
                        print "            <action android:name=\"com.google.firebase.MESSAGING_EVENT\" />";
                        print "        </intent-filter>";
                        print "    </service>";
                        print "";
                        print "    <receiver android:name=\"io.invertase.firebase.messaging.ReactNativeFirebaseMessagingReceiver\" android:enabled=\"true\" android:exported=\"true\">";
                        print "        <intent-filter>";
                        print "            <action android:name=\"com.google.firebase.INSTANCE_ID_EVENT\" />";
                        print "        </intent-filter>";
                        print "    </receiver>";
                    }
                    { print }
                    ' "$MANIFEST_PATH" >"$MANIFEST_PATH.tmp" && mv "$MANIFEST_PATH.tmp" "$MANIFEST_PATH"

                echo "Injected Firebase Messaging <service> and <receiver> into $MANIFEST_PATH"
            fi

        else
            echo "⚠️  $MANIFEST_PATH not found."
        fi
    done
fi
