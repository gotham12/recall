#!/usr/bin/env bash
set -e

echo "==> Installing dependencies..."
npm install

echo "==> Building React app..."
npm run build

echo "==> Adding Capacitor iOS platform..."
npx cap add ios

echo "==> Syncing web assets to iOS..."
npx cap sync ios

echo "==> Patching Info.plist for camera + microphone permissions..."
PLIST="ios/App/App/Info.plist"

if [ -f "$PLIST" ]; then
  # Add NSMicrophoneUsageDescription
  if ! grep -q "NSMicrophoneUsageDescription" "$PLIST"; then
    sed -i '' 's|</dict>|  <key>NSMicrophoneUsageDescription</key>\
  <string>Recall uses your microphone to let you speak with Clara, your voice companion.</string>\
</dict>|' "$PLIST"
  fi

  # Add NSCameraUsageDescription
  if ! grep -q "NSCameraUsageDescription" "$PLIST"; then
    sed -i '' 's|</dict>|  <key>NSCameraUsageDescription</key>\
  <string>Recall uses your camera to verify that you have your medication ready.</string>\
</dict>|' "$PLIST"
  fi

  echo "==> Info.plist patched."
else
  echo "WARNING: Could not find $PLIST — add permissions manually in Xcode."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Open ios/App/App.xcworkspace in Xcode"
echo "  2. Select your device or simulator"
echo "  3. Press ▶ Run"
echo ""
echo "To re-sync after code changes: npm run ios:sync"
