import Network
import SwiftUI
import UIKit

/// Tesla service center Wi-Fi helper.
/// Joining networks from the app needs the Hotspot Configuration entitlement, which
/// personal development teams cannot use. Instead the app hands iOS a Wi-Fi
/// configuration profile; once installed, the iPhone joins the network automatically.
enum ServiceCenterWiFi {
    static let ssid = "Tesla Service"
    static let passphrase = "*U17r4H4rd*(Or3"
    static let profileIdentifier = "com.personal.teslacompanion.wifi.service-center"

    static func profileData() -> Data {
        let wifiPayload: [String: Any] = [
            "PayloadType": "com.apple.wifi.managed",
            "PayloadVersion": 1,
            "PayloadIdentifier": "\(profileIdentifier).payload",
            "PayloadUUID": "6F0C7B4E-2E1A-4C59-9C6B-5A0F3D7E9A11",
            "PayloadDisplayName": "Wi-Fi（\(ssid)）",
            "SSID_STR": ssid,
            "HIDDEN_NETWORK": false,
            "AutoJoin": true,
            "EncryptionType": "Any",
            "Password": passphrase
        ]
        let profile: [String: Any] = [
            "PayloadType": "Configuration",
            "PayloadVersion": 1,
            "PayloadIdentifier": profileIdentifier,
            "PayloadUUID": "0B8D2F61-8C34-4E7A-B1D2-7E5C9A3F4B20",
            "PayloadDisplayName": "Tesla 服务中心 Wi-Fi",
            "PayloadDescription": "自动加入 Tesla 服务中心的「\(ssid)」网络。",
            "PayloadOrganization": "Tesla Buddy",
            "PayloadRemovalDisallowed": false,
            "PayloadContent": [wifiPayload]
        ]
        // A fixed dictionary of plist types always serializes.
        return try! PropertyListSerialization.data(fromPropertyList: profile, format: .xml, options: 0)
    }

    @MainActor
    static func copyPassword() {
        // Expire the clipboard entry so the password does not linger.
        UIPasteboard.general.setItems(
            [[UIPasteboard.typeAutomatic: passphrase]],
            options: [.expirationDate: Date().addingTimeInterval(300)]
        )
    }
}

/// Serves the profile once over loopback so Safari can hand it to iOS's profile installer.
/// Apps cannot open a local .mobileconfig directly; Safari only installs profiles it downloads.
@MainActor
final class WiFiProfileInstaller: ObservableObject {
    enum State: Equatable {
        case idle
        case opening
        case opened
        case failed(String)
    }

    @Published private(set) var state: State = .idle
    private var listener: NWListener?
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    private var stopTask: Task<Void, Never>?

    func install() {
        stop()
        state = .opening
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: .any)
            let listener = try NWListener(using: parameters)
            let body = ServiceCenterWiFi.profileData()
            listener.newConnectionHandler = { connection in
                Self.serve(body, on: connection)
            }
            listener.stateUpdateHandler = { [weak self] newState in
                Task { @MainActor in self?.handle(newState) }
            }
            self.listener = listener
            // Keep the server alive briefly while the app is backgrounded by Safari.
            backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
                Task { @MainActor in self?.stop() }
            }
            listener.start(queue: .global(qos: .userInitiated))
        } catch {
            state = .failed("无法准备描述文件：\(error.localizedDescription)")
        }
    }

    private func handle(_ newState: NWListener.State) {
        switch newState {
        case .ready:
            guard let port = listener?.port?.rawValue,
                  let url = URL(string: "http://127.0.0.1:\(port)/TeslaServiceWiFi.mobileconfig") else {
                state = .failed("无法准备描述文件。")
                stop()
                return
            }
            UIApplication.shared.open(url) { [weak self] opened in
                Task { @MainActor in
                    guard let self else { return }
                    self.state = opened ? .opened : .failed("无法打开 Safari。")
                }
            }
            stopTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(25))
                self?.stop()
            }
        case .failed(let error):
            state = .failed("无法准备描述文件：\(error.localizedDescription)")
            stop()
        default:
            break
        }
    }

    private func stop() {
        stopTask?.cancel()
        stopTask = nil
        listener?.cancel()
        listener = nil
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }

    nonisolated private static func serve(_ body: Data, on connection: NWConnection) {
        connection.start(queue: .global(qos: .userInitiated))
        // Read the request head, then reply with the profile regardless of path.
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { _, _, _, _ in
            let header = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: application/x-apple-aspen-config\r\n"
                + "Content-Disposition: attachment; filename=\"TeslaServiceWiFi.mobileconfig\"\r\n"
                + "Content-Length: \(body.count)\r\n"
                + "Cache-Control: no-store\r\n"
                + "Connection: close\r\n\r\n"
            connection.send(content: Data(header.utf8) + body, completion: .contentProcessed { _ in
                connection.cancel()
            })
        }
    }
}

struct ServiceCenterWiFiSection: View {
    @StateObject private var installer = WiFiProfileInstaller()
    @State private var copied = false

    var body: some View {
        Section {
            Button {
                installer.install()
            } label: {
                HStack {
                    Label("安装服务中心 Wi-Fi", systemImage: "wifi")
                    Spacer()
                    if installer.state == .opening {
                        ProgressView()
                    } else {
                        Text(ServiceCenterWiFi.ssid)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .disabled(installer.state == .opening)

            switch installer.state {
            case .opened:
                Label("在 Safari 中点「允许」，再到「设置 > 通用 > VPN与设备管理」安装描述文件。", systemImage: "arrow.down.doc")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            case .failed(let message):
                Label(message, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            default:
                EmptyView()
            }

            Button {
                ServiceCenterWiFi.copyPassword()
                copied = true
            } label: {
                Label(copied ? "密码已复制（5 分钟后清除）" : "复制 Wi-Fi 密码", systemImage: "doc.on.clipboard")
            }
        } header: {
            Text("服务中心")
        } footer: {
            Text("安装一次 Wi-Fi 描述文件后，iPhone 到达 Tesla 服务中心时会自动加入「\(ServiceCenterWiFi.ssid)」，无需打开 App 或输入密码。描述文件可在「设置 > 通用 > VPN与设备管理」中删除。")
        }
    }
}
