import { useContext, useEffect } from "react"
import { useWallet } from "@/context/WalletContext"
import { router } from "expo-router"

// -----
// AuthRedirector: Handles auto-login redirect when snapshot has loaded
// -----
export default function AuthRedirector() {
    const { managers, snapshotLoaded } = useWallet()

    useEffect(() => {
        console.log('auth redirector', managers?.walletManager?.authenticated, snapshotLoaded)
        if (
            managers?.walletManager?.authenticated && snapshotLoaded
        ) {
            router.replace('/(tabs)/apps')
        }
    }, [managers?.walletManager?.authenticated, snapshotLoaded])

    return null
}