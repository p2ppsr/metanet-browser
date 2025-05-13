import React, { useContext, useState, useEffect } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native'
import { WalletContext } from '../context/WalletContext'
import { UserContext } from '../context/UserContext'
import { useThemeStyles } from '../context/theme/useThemeStyles'
import AppChip from './AppChip'
import { deterministicColor } from '../utils/deterministicColor'
import { Services } from '@bsv/wallet-toolbox-mobile'

const services = new Services('main')

const SpendingAuthorizationModal = () => {
    const { spendingRequests, advanceSpendingQueue, managers } = useContext(WalletContext)
    const { spendingAuthorizationModalOpen, setSpendingAuthorizationModalOpen } = useContext(UserContext)
    const themeStyles = useThemeStyles()
    const [usdPerBsv, setUsdPerBSV] = useState(35)

    // Handle denying the request
    const handleDeny = async () => {
        if (spendingRequests.length > 0) {
            managers.permissionsManager?.denyPermission(spendingRequests[0].requestID)
        }
        advanceSpendingQueue()
        setSpendingAuthorizationModalOpen(false)
    }

    // Handle granting the request
    const handleGrant = async ({ singular = true, amount }: { singular?: boolean, amount?: number }) => {
        if (spendingRequests.length > 0) {
            managers.permissionsManager?.grantPermission({
                requestID: spendingRequests[0].requestID,
                ephemeral: singular,
                amount
            })
        }
        advanceSpendingQueue()
        setSpendingAuthorizationModalOpen(false)
    }

    // Format satoshis to BSV
    const formatBSV = (sats: number) => {
        return (sats / 100000000).toFixed(8)
    }

    // Format USD amount
    const formatUSD = (sats: number) => {
        const bsv = sats / 100000000
        return (bsv * usdPerBsv).toFixed(2)
    }

    if (!spendingAuthorizationModalOpen || !spendingRequests.length) return null

    const {
        originator,
        description,
        transactionAmount,
        totalPastSpending,
        amountPreviouslyAuthorized,
        authorizationAmount,
        renewal,
        lineItems
    } = spendingRequests[0]

    return (
        <Modal
            visible={spendingAuthorizationModalOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={handleDeny}
        >
            <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
                <View style={[styles.modalContent, themeStyles.card]}>
                    <ScrollView>
                        {/* Title */}
                        <Text style={[styles.title, themeStyles.text]}>
                            {renewal ? 'Spending Authorization Renewal' : 'Spending Authorization Request'}
                        </Text>

                        {/* App section */}
                        <AppChip
                            size={1.5}
                            showDomain
                            label={originator || 'unknown'}
                            clickable={false}
                        />

                        <View style={styles.divider} />

                        {/* Transaction Amount */}
                        <View style={styles.infoRow}>
                            <Text style={[styles.label, themeStyles.text]}>Transaction Amount:</Text>
                            <View style={styles.amountContainer}>
                                <Text style={[styles.value, themeStyles.text]}>
                                    {formatBSV(transactionAmount)} BSV
                                </Text>
                                <Text style={[styles.subValue, themeStyles.textSecondary]}>
                                    (${formatUSD(transactionAmount)})
                                </Text>
                            </View>
                        </View>

                        {/* Past Spending */}
                        {totalPastSpending > 0 && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.label, themeStyles.text]}>Total Past Spending:</Text>
                                <View style={styles.amountContainer}>
                                    <Text style={[styles.value, themeStyles.text]}>
                                        {formatBSV(totalPastSpending)} BSV
                                    </Text>
                                    <Text style={[styles.subValue, themeStyles.textSecondary]}>
                                        (${formatUSD(totalPastSpending)})
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Previously Authorized */}
                        {amountPreviouslyAuthorized > 0 && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.label, themeStyles.text]}>Previously Authorized:</Text>
                                <View style={styles.amountContainer}>
                                    <Text style={[styles.value, themeStyles.text]}>
                                        {formatBSV(amountPreviouslyAuthorized)} BSV
                                    </Text>
                                    <Text style={[styles.subValue, themeStyles.textSecondary]}>
                                        (${formatUSD(amountPreviouslyAuthorized)})
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Line Items */}
                        {lineItems && lineItems.length > 0 && (
                            <>
                                <View style={styles.divider} />
                                <Text style={[styles.sectionTitle, themeStyles.text]}>Line Items:</Text>
                                {lineItems.map((item: any, index: number) => (
                                    <View key={index} style={styles.lineItem}>
                                        <Text style={[styles.lineItemText, themeStyles.text]}>
                                            {item.description}
                                        </Text>
                                        <View style={styles.amountContainer}>
                                            <Text style={[styles.value, themeStyles.text]}>
                                                {formatBSV(item.amount)} BSV
                                            </Text>
                                            <Text style={[styles.subValue, themeStyles.textSecondary]}>
                                                (${formatUSD(item.amount)})
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </>
                        )}

                        {/* Description */}
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
                                { backgroundColor: deterministicColor(JSON.stringify(spendingRequests[0])) }
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
                                onPress={() => handleGrant({ singular: true })}
                            >
                                <Text style={[styles.buttonText, themeStyles.buttonText]}>Grant Once</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.grantButton, themeStyles.button]}
                                onPress={() => handleGrant({ singular: false, amount: authorizationAmount })}
                            >
                                <Text style={[styles.buttonText, themeStyles.buttonText]}>Grant Always</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
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
        maxHeight: '80%',
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
        textAlign: 'right'
    },
    amountContainer: {
        flex: 2,
        alignItems: 'flex-end'
    },
    subValue: {
        fontSize: 12,
        marginTop: 2
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 10
    },
    lineItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 5,
        paddingHorizontal: 10
    },
    lineItemText: {
        flex: 1,
        marginRight: 10
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
        fontWeight: '600',
        fontSize: 12
    }
})

export default SpendingAuthorizationModal
