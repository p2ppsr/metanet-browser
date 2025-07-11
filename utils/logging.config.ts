// Default logging state for all files
const defaultLogging = false;

// Specific file logging overrides
const loggingConfig: { [file: string]: boolean } = {
  default: defaultLogging,
  'app/browser': true,
  'components/UniversalScanner': true
  //'context/WalletContext': true
};

export default loggingConfig;
