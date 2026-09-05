import SwiftUI
import UIKit

@main
final class TeslaCompanionAppDelegate: NSObject, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let rootView = ContentView(
            apiClient: APIClient(baseURLs: apiBaseURLs, apiToken: TeslaBuddySecrets.apiToken)
        )
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = UIHostingController(rootView: rootView)
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    private var apiBaseURLs: [URL] {
        #if targetEnvironment(simulator)
        [URL(string: "http://127.0.0.1:8787")!]
        #else
        [
            URL(string: "http://m4.local:8787")!,
            URL(string: "https://m4.taila2745f.ts.net")!
        ]
        #endif
    }
}
