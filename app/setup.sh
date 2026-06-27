#!/usr/bin/env bash
set -e

echo "==> Installing dependencies..."
npm install

echo "==> Building React app for Capacitor..."
npm run build:capacitor

if [ ! -d "ios" ]; then
  echo "==> Adding Capacitor iOS platform..."
  npx cap add ios
else
  echo "==> iOS platform already present."
fi

echo "==> Syncing web assets + native plugins to iOS..."
npx cap sync ios

PLIST="ios/App/App/Info.plist"
ENTITLEMENTS="ios/App/App/App.entitlements"

patch_plist_key() {
  local key="$1"
  local value="$2"
  if [ -f "$PLIST" ] && ! grep -q "$key" "$PLIST"; then
    sed -i '' "s|</dict>|  <key>${key}</key>\\
  <string>${value}</string>\\
</dict>|" "$PLIST"
  fi
}

if [ -f "$PLIST" ]; then
  echo "==> Patching Info.plist for camera, microphone, and HealthKit..."
  patch_plist_key "NSMicrophoneUsageDescription" "Recall uses your microphone to let you speak with Clara, your voice companion."
  patch_plist_key "NSCameraUsageDescription" "Recall uses your camera to verify that you have your medication ready."
  patch_plist_key "NSHealthShareUsageDescription" "Recall reads Margaret's heart rate, blood pressure, breathing rate, temperature, and walking speed from Apple Health to help caregivers monitor her wellbeing."
  patch_plist_key "NSHealthUpdateUsageDescription" "Recall does not write health data to Apple Health."
  echo "==> Info.plist patched."
else
  echo "WARNING: Could not find $PLIST — add permissions manually in Xcode."
fi

if [ ! -f "$ENTITLEMENTS" ]; then
  echo "==> Creating HealthKit entitlements file..."
  cat > "$ENTITLEMENTS" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.healthkit</key>
  <true/>
  <key>com.apple.developer.healthkit.access</key>
  <array/>
</dict>
</plist>
EOF
  echo "==> Created $ENTITLEMENTS"
  echo "    In Xcode: Target → Signing & Capabilities → + Capability → HealthKit"
  echo "    Ensure CODE_SIGN_ENTITLEMENTS points to App/App.entitlements"
else
  echo "==> Entitlements file already exists."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Open ios/App/App.xcworkspace in Xcode"
echo "  2. Target → Signing & Capabilities → add HealthKit if not present"
echo "  3. Select Margaret's iPhone (HealthKit needs a real device)"
echo "  4. Press ▶ Run"
echo "  5. Supervisor → Overview → Vitals → Connect Apple Health"
echo ""
echo "To re-sync after code changes: npm run ios:sync"
