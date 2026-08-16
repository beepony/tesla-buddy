# TeslaMate 本地部署

此 Compose 项目仅将 TeslaMate（4000）和 Grafana（3000）绑定到 Mac mini 本机回环地址，不向局域网或公网公开 PostgreSQL、MQTT 或 TeslaMate。

启动：

```sh
/Users/bw/Applications/Docker.app/Contents/Resources/bin/docker compose --env-file .env up -d
```

首次启动后，在 Mac mini 浏览器打开 <http://localhost:4000>，按 TeslaMate 页面完成 Tesla 账户授权。Tesla 密码不会存入本项目；TeslaMate 只保存经 `TESLAMATE_ENCRYPTION_KEY` 加密的令牌。

Grafana 位于 <http://localhost:3000>。首次登录为 `admin` / `admin`，随后必须立刻改为强密码。

维护命令：

```sh
/Users/bw/Applications/Docker.app/Contents/Resources/bin/docker compose ps
/Users/bw/Applications/Docker.app/Contents/Resources/bin/docker compose logs -f teslamate
```
