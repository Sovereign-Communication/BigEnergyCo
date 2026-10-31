#!/bin/bash
# SCMessenger Android-iOS Network Diagnostic

echo "=== SCMESSENGER NETWORK DIAGNOSTIC ==="
echo "Timestamp: $(date)"
echo ""

echo "[1] Emulator Network Info"
adb shell ifconfig | grep -E "inet|hwaddr|UP" | head -10
echo ""

echo "[2] Mesh Service Status"
adb shell dumpsys | grep -i "meshservice\|transport\|peer" | head -20
echo ""

echo "[3] BLE Status"
adb shell settings get secure ble_enabled 2>/dev/null || echo "N/A"
adb shell dumpsys bluetooth_manager | grep -i "enabled\|ble" | head -10
echo ""

echo "[4] WiFi Status"
adb shell dumpsys wifi | grep -i "state\|ssid\|connected" | head -10
echo ""

echo "[5] Recent Network Errors (last 100 lines)"
adb logcat -d | grep -iE "bootstrap.*fail|dial.*fail|error.*network|no.*address" | tail -20
echo ""

echo "[6] Peer Discovery Status"
adb logcat -d | grep "peersDiscovered" | tail -5
echo ""

echo "[7] Transport Status"
adb logcat -d | grep -iE "transport.*start|transport.*init|all.*transport" | tail -10
