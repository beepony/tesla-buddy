import SwiftUI
import UIKit

/// Tesla service center Wi-Fi helper.
/// Joining networks programmatically requires the Hotspot Configuration entitlement,
/// which personal development teams cannot use, so this copies the password and
/// opens the system Wi-Fi settings for a one-tap paste.
enum ServiceCenterWiFi {
    static let ssid = "Tesla Service"
    static let passphrase = "*U17r4H4rd*(Or3"

    @MainActor
    static func copyPasswordAndOpenSettings() {
        // Expire the clipboard entry so the password does not linger.
        UIPasteboard.general.setItems(
            [[UIPasteboard.typeAutomatic: passphrase]],
            options: [.expirationDate: Date().addingTimeInterval(300)]
        )

        // Try the Wi-Fi pane first; fall back to the app's settings page if iOS rejects it.
        guard let wifiURL = URL(string: "App-Prefs:WIFI") else { return }
        UIApplication.shared.open(wifiURL) { opened in
            guard !opened, let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return }
            Task { @MainActor in UIApplication.shared.open(settingsURL) }
        }
    }
}

struct ServiceCenterWiFiSection: View {
    @State private var copied = false

    var body: some View {
        Section {
            Button {
                ServiceCenterWiFi.copyPasswordAndOpenSettings()
                copied = true
            } label: {
                HStack {
                    Label("连接服务中心 Wi-Fi", systemImage: "wifi")
                    Spacer()
                    Text(ServiceCenterWiFi.ssid)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            if copied {
                Label("密码已复制，在 Wi-Fi 列表中选择「\(ServiceCenterWiFi.ssid)」并粘贴即可。", systemImage: "doc.on.clipboard")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text("服务中心")
        } footer: {
            Text("点击后会复制「\(ServiceCenterWiFi.ssid)」的密码（5 分钟后从剪贴板清除）并打开系统 Wi-Fi 设置。个人开发者签名无法使用 iOS 的自动加入网络能力，需在设置中粘贴密码完成连接，之后 iPhone 会自动记住该网络。")
        }
    }
}
