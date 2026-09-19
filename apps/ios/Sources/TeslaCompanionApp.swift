import SwiftUI

@main
struct TeslaCompanionApp: App {
    private let apiClient: APIClient

    init() {
        apiClient = APIClient(
            baseURLs: Self.apiBaseURLs,
            apiToken: TeslaBuddySecrets.apiToken
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView(apiClient: apiClient)
        }
    }

    private static var apiBaseURLs: [URL] {
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
