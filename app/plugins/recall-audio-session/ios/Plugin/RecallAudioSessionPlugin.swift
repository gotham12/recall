import Foundation
import Capacitor
import AVFoundation

@objc(RecallAudioSessionPlugin)
public class RecallAudioSessionPlugin: CAPPlugin {
    private func session() -> AVAudioSession {
        AVAudioSession.sharedInstance()
    }

    @objc func prepareForSpeechRecognition(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let s = self.session()
                try s.setCategory(
                    .playAndRecord,
                    mode: .voiceChat,
                    options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP]
                )
                try s.setActive(true, options: [])
                call.resolve()
            } catch {
                call.reject("Could not prepare audio session for speech: \(error.localizedDescription)")
            }
        }
    }

    @objc func prepareForPlayback(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let s = self.session()
                try s.setCategory(
                    .playback,
                    mode: .default,
                    options: [.mixWithOthers, .defaultToSpeaker]
                )
                try s.setActive(true, options: [])
                call.resolve()
            } catch {
                call.reject("Could not prepare audio session for playback: \(error.localizedDescription)")
            }
        }
    }

    @objc func releaseAudioSession(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let s = self.session()
                try s.setActive(false, options: .notifyOthersOnDeactivation)
                call.resolve()
            } catch {
                // Non-fatal — screen recording may still resume after deactivate attempt
                call.resolve()
            }
        }
    }

    @objc func isScreenCaptured(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let captured = UIScreen.main.isCaptured
            call.resolve(["captured": captured])
        }
    }
}
