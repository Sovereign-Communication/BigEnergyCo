# Android Emulator <-> iOS Message Delivery Debug

## Critical Findings

### 1. **Bootstrap Connectivity FAILING** (PRIMARY BLOCKER)
- Bootstrap all-failed (consecutive=10+), retrying every 60s
- Emulator cannot reach external bootstrap/relay nodes
- Without bootstrap, messages cannot be relayed if direct connection fails
- **Likely cause**: Emulator network isolation (NAT) prevents inbound connections

### 2. **Peer Discovery = 0**
- `peersDiscovered=0` (Core: 0 peers, Repo: 0 full, 0 headless)
- iOS device not appearing in peer scan
- Local LAN discovery not working

### 3. **Transport Status**
- [OK] BLE: Active (advertising + scanning)
  - Issue: Identity data too large (425 bytes), fallback to GATT
  - BLE scan fallback enabled after 21s (no advertisements found)
- [OK] WiFi: Connected (WIFI status)
- [ERROR] WiFi Aware: DISABLED
- [ERROR] WiFi Direct: DISABLED
- [ERROR] mDNS: Not working in emulator environment

### 4. **Dial Failures**
- Failed to dial `/ip4/10.0.2.15/tcp/9001` (error: No addresses)
- Failed to dial `/ip4/10.0.2.15/tcp/9002/ws` (error: No addresses)
- Emulator detecting itself as peer via SubnetProbe but cannot dial itself

## Message Delivery Paths (All Blocked)

1. **Direct P2P**: [ERROR] No peer connection established
2. **Via Bootstrap/Relay**: [ERROR] Bootstrap failing
3. **Via Local Peer**: [ERROR] 0 peers discovered

## iOS Contact Successfully Created
- QR scan worked
- Contact stored with correct nickname
- But no message delivery path exists

## Next Steps (From Plan Agent)
[Awaiting comprehensive strategy...]

## Immediate Actions to Try
1. Enable WiFi Aware/Direct in settings
2. Test with relay node configuration
3. Check if iOS is actually broadcasting on BLE
4. Compare with physical device test (not emulator)
