import Constants from 'expo-constants';

const useFirebase: boolean = Constants.expoConfig?.extra?.useFirebase ?? false;

export default { useFirebase };
