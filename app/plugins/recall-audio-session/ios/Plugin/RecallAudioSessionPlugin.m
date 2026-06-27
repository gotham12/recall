#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(RecallAudioSessionPlugin, "RecallAudioSession",
           CAP_PLUGIN_METHOD(prepareForSpeechRecognition, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(prepareForPlayback, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(releaseAudioSession, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isScreenCaptured, CAPPluginReturnPromise);
)
