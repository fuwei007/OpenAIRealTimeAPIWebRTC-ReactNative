package com.openaidemo1

import android.app.Application
import com.dooboolab.audiorecorderplayer.RNAudioRecorderPlayerPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.shell.MainReactPackage
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.zoontek.rnpermissions.RNPermissionsPackage
import java.util.Arrays
import com.oney.WebRTCModule.WebRTCModulePackage
import com.rnfs.RNFSPackage;
import com.zmxv.RNSound.RNSoundPackage;
import com.zxcpoiu.incallmanager.InCallManagerPackage


class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
              return Arrays.asList<ReactPackage>(
                  MainReactPackage(),
                  RNPermissionsPackage(),
                  RNAudioRecorderPlayerPackage(),
                  WebRTCModulePackage(),
                  RNFSPackage(),
                  RNSoundPackage(),
                  InCallManagerPackage(),
              )
          }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }
}
