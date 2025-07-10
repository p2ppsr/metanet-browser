#!/bin/bash

# This script configures the project for different environments.

echo "Select the build environment:"
select build_type in "Development Build" "Expo Go"; do
    case $build_type in
    "Development Build")
        read -p $'\nDo you want to include Firebase/Google Analytics?\nThis requires google-services.json and GoogleService-Info.plist\n(y/n): ' include_firebase
        if [[ "$include_firebase" == "y" || "$include_firebase" == "Y" ]]; then
            USE_FIREBASE="true"
            cp app.json.dev-template app.json
            echo "Using Development Build configuration with Firebase ENABLED."
        else
            USE_FIREBASE="false"
            cp app.json.expo-template app.json
            echo "Using Development Build configuration with Firebase DISABLED."
        fi
        
        break
        ;;
    "Expo Go")
        cp app.json.expo-template app.json
        USE_FIREBASE="false"
        echo "Using Expo Go configuration. Firebase is DISABLED."
        break
        ;;
    *)
        echo "Invalid option. Please try again."
        ;;
    esac
done

# Set useFirebase flag in app.json
echo "Setting useFirebase flag in app.json..."
export USE_FIREBASE_BOOL=$USE_FIREBASE
node -e "
    const fs = require('fs');
    const appConfigPath = 'app.json';
    try {
        let appConfig = JSON.parse(fs.readFileSync(appConfigPath));
        if (!appConfig.expo) appConfig.expo = {};
        if (!appConfig.expo.extra) appConfig.expo.extra = {};
        appConfig.expo.extra.useFirebase = process.env.USE_FIREBASE_BOOL === 'true';
        fs.writeFileSync(appConfigPath, JSON.stringify(appConfig, null, 2) + '\n');
        console.log('app.json updated: useFirebase is set to ' + appConfig.expo.extra.useFirebase);
    } catch (e) {
        console.error('Could not modify app.json:', e.message);
    }
"

echo -e "\nConfiguration complete. Your project is ready."
