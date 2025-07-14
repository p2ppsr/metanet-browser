import { BarcodeScanningResult, Camera, CameraView, PermissionStatus } from 'expo-camera';
import React, { useEffect, useState, useCallback } from 'react';
import { Alert, StyleSheet, Text, View, Button, ActivityIndicator, Linking, Platform } from 'react-native';

interface ScannerProps {
  setScannedData: (data: string | null) => void;
}

const Scanner: React.FC<ScannerProps> = ({ setScannedData }) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [checking, setChecking] = useState<boolean>(true);
    const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);

    const checkPermission = useCallback(async () => {
        setChecking(true);
        const { status } = await Camera.getCameraPermissionsAsync();
        setPermissionStatus(status);
        setHasPermission(status === PermissionStatus.GRANTED);
        setChecking(false);
    }, []);

    const requestPermission = useCallback(async () => {
        setChecking(true);
        const { status } = await Camera.requestCameraPermissionsAsync();
        setPermissionStatus(status);
        setHasPermission(status === PermissionStatus.GRANTED);
        setChecking(false);
        if (status !== PermissionStatus.GRANTED) {
            Alert.alert(
                'Camera Permission Denied',
                Platform.OS === 'ios'
                    ? 'Please enable camera access in Settings > Privacy > Camera.'
                    : 'Please enable camera access in App Settings.'
            );
        }
    }, []);

    useEffect(() => {
        checkPermission();
    }, [checkPermission]);

    const handleBarCodeScanned = (data: string) => {
        setScannedData(data);
        console.log(`Scanned: ${data}`);
    };

    if (checking || hasPermission === null) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={{marginTop: 12}}>Checking camera permissions...</Text>
            </View>
        );
    }

    if (!hasPermission) {
        return (
            <View style={styles.centered}>
                <Text style={{marginBottom: 12}}>
                    {permissionStatus === PermissionStatus.DENIED
                        ? 'Camera permission denied. Please allow camera access to use the scanner.'
                        : 'No camera access granted.'}
                </Text>
                <Button title="Try Again" onPress={requestPermission} />
                <Button
                    title="Open Settings"
                    onPress={() => Linking.openSettings()}
                    color="#007AFF"
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                onBarcodeScanned={({ data } : BarcodeScanningResult) => handleBarCodeScanned(data)}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        height: 300
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    camera: {
        flex: 1,
    },
    preview: {
        flex: 1,
    },
    overlay: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    text: {
        color: '#fff',
        fontSize: 16,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
});

export default Scanner;
