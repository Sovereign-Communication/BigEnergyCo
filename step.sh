if [ ! -s "$KEYSTORE_PATH" ]; then
  echo "::error title=Release signing::SCMESSENGER_KEYSTORE_BASE64 decoded to an empty or missing file ($KEYSTORE_PATH). The secret is set (HAS_KEYSTORE is true) but did not decode."
  exit 1
fi

if out=$(keytool -list -keystore "$KEYSTORE_PATH" -storepass "$KEYSTORE_PASSWORD" -alias "$KEY_ALIAS" 2>&1); then
  echo "Release signing preflight OK: keystore readable and the configured alias is present."
  exit 0
fi

# Classify keytool's own message instead of asserting a guessed cause.
case "$out" in
  *"does not exist"*)
    echo "::error title=Release signing::SCMESSENGER_KEY_ALIAS does not exist in the decoded keystore. keytool: $(echo "$out" | head -1)"
    echo "::error title=Release signing::Fix: set SCMESSENGER_KEY_ALIAS to an alias that exists. Run locally: keytool -list -v -keystore scmessenger-release.jks | grep -i 'alias name'. PKCS12 alias lookup is case-sensitive; match the case exactly."
    ;;
  *"tampered with, or password was incorrect"*)
    echo "::error title=Release signing::SCMESSENGER_KEYSTORE_PASSWORD is wrong -- keytool could not open the keystore, so the alias was never checked. keytool: $(echo "$out" | head -1)"
    echo "::error title=Release signing::Fix: set SCMESSENGER_KEYSTORE_PASSWORD. Note this is a DIFFERENT fault from a wrong alias; do not re-set SCMESSENGER_KEY_ALIAS in response to this message."
    ;;
  *EOFException*|*"Keystore file exists, but is empty"*)
    echo "::error title=Release signing::The decoded keystore is unreadable or empty -- SCMESSENGER_KEYSTORE_BASE64 does not decode to a valid keystore. keytool: $(echo "$out" | head -1)"
    ;;
  *)
    echo "::error title=Release signing::Release signing preflight failed for an unrecognised reason. keytool: $(echo "$out" | head -1)"
    ;;
esac
echo "--- full keytool output (contains no alias or password) ---"
echo "$out"
exit 1
