import React, { useContext } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native'
import { WalletContext } from '../context/WalletContext'
import { UserContext } from '../context/UserContext'
import { useThemeStyles } from '../context/theme/useThemeStyles'
import AppChip from './AppChip'
import { deterministicColor } from '../utils/deterministicColor'

const ProtocolAccessModal = () => {
    const { protocolRequests, advanceProtocolQueue, managers } = useContext(WalletContext)
    const { protocolAccessModalOpen, setProtocolAccessModalOpen } = useContext(UserContext)
    const themeStyles = useThemeStyles()

    // Handle denying the top request in the queue
    const handleDeny = async () => {
        if (protocolRequests.length > 0) {
            managers.permissionsManager?.denyPermission(protocolRequests[0].requestID)
        }
        advanceProtocolQueue()
        setProtocolAccessModalOpen(false)
    }

    // Handle granting the top request in the queue
    const handleGrant = async () => {
        if (protocolRequests.length > 0) {
            managers.permissionsManager?.grantPermission({
                requestID: protocolRequests[0].requestID
            })
        }
        advanceProtocolQueue()
        setProtocolAccessModalOpen(false)
    }

    if (!protocolAccessModalOpen || !protocolRequests.length) return null

    const { protocolID, originator, description, renewal, protocolSecurityLevel } = protocolRequests[0]

    return (
        <Modal
            visible={protocolAccessModalOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={handleDeny}
        >
            <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
                <View style={[styles.modalContent, themeStyles.card]}>
                    {/* Title */}
                    <Text style={[styles.title, themeStyles.text]}>
                        {renewal ? 'Protocol Access Renewal' : 'Protocol Access Request'}
                    </Text>

                    {/* App section */}
                    <AppChip
                        size={1.5}
                        showDomain
                        label={originator || 'unknown'}
                        clickable={false}
                    />

                    <View style={styles.divider} />

                    {/* Protocol section */}
                    <View style={styles.infoRow}>
                        <Text style={[styles.label, themeStyles.text]}>Protocol ID:</Text>
                        <Text style={[styles.value, themeStyles.text]} numberOfLines={1}>
                            {protocolID}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={[styles.label, themeStyles.text]}>Security Level:</Text>
                        <Text style={[styles.value, themeStyles.text]}>
                            {protocolSecurityLevel}
                        </Text>
                    </View>

                    {/* Description section */}
                    {description && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <Text style={[styles.label, themeStyles.text]}>Description:</Text>
                                <Text style={[styles.value, themeStyles.text]}>
                                    {description}
                                </Text>
                            </View>
                        </>
                    )}

                    {/* Visual signature */}
                    <View
                        style={[
                            styles.visualSignature,
                            { backgroundColor: deterministicColor(JSON.stringify(protocolRequests[0])) }
                        ]}
                    />

                    {/* Action buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.denyButton, themeStyles.button]}
                            onPress={handleDeny}
                        >
                            <Text style={[styles.buttonText, themeStyles.buttonText]}>Deny</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.grantButton, themeStyles.button]}
                            onPress={handleGrant}
                        >
                            <Text style={[styles.buttonText, themeStyles.buttonText]}>Grant Access</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    modalContent: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 12,
        padding: 20,
        elevation: 5
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center'
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 15
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 5
    },
    label: {
        fontWeight: 'bold',
        flex: 1
    },
    value: {
        flex: 2,
        textAlign: 'right'
    },
    visualSignature: {
        height: 4,
        width: '100%',
        marginVertical: 20,
        borderRadius: 2
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        marginHorizontal: 5
    },
    denyButton: {
        borderWidth: 1
    },
    grantButton: {},
    buttonText: {
        textAlign: 'center',
        fontWeight: '600'
    }
})

export default ProtocolAccessModal