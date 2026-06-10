# Petodo 部署说明

本文说明 Petodo 桌宠番茄钟应用的本地部署和云服务器部署方式。

## 一、本地部署

本地部署时，Electron 前端请求本机 FastAPI 后端：

```js
API_BASE_URL: "http://127.0.0.1:8000"
```

### 1. 启动后端

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

启动后可以测试：

```text
http://127.0.0.1:8000/health
```

### 2. 启动前端

```bash
cd frontend
npm install
npm start
```

本地开发时，`frontend/config.js` 保持默认配置：

```js
window.PETODO_CONFIG = {
  API_BASE_URL: "http://127.0.0.1:8000"
};
```

## 二、云服务器部署

服务器信息（请替换成你自己的）：

- 系统：Ubuntu 22.04
- 公网 IP：你的服务器公网IP
- 登录用户：你的登录用户名

云服务器正式访问时，Electron 前端请求你自己的服务器地址，例如：

```js
API_BASE_URL: "http://你的服务器公网IP"
```

也就是把 `frontend/config.js` 改成：

```js
window.PETODO_CONFIG = {
  API_BASE_URL: "http://你的服务器公网IP"
};
```

### 1. 安装基础环境

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv git nginx
```

### 2. 克隆项目

```bash
cd /home/你的登录用户名
git clone https://github.com/future867/petodo-pet-app.git
```

### 3. 安装后端依赖

```bash
cd /home/你的登录用户名/petodo-pet-app/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. 临时测试启动

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

临时测试地址：

```text
http://你的服务器公网IP:8001/health
```

如果这个地址能打开并看到正常返回，说明后端已经能在服务器上运行。

## 三、systemd 后台运行

创建服务文件：

```bash
sudo nano /etc/systemd/system/petodo-backend.service
```

写入以下内容：

```ini
[Unit]
Description=Petodo FastAPI Backend
After=network.target

[Service]
User=你的登录用户名
WorkingDirectory=/home/你的登录用户名/petodo-pet-app/backend
ExecStart=/home/你的登录用户名/petodo-pet-app/backend/venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl start petodo-backend
sudo systemctl enable petodo-backend
sudo systemctl status petodo-backend
```

## 四、Nginx 反向代理

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/petodo
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/petodo /etc/nginx/sites-enabled/petodo
sudo nginx -t
sudo systemctl restart nginx
```

最终测试地址：

```text
http://你的服务器公网IP/health
```

如果这个地址能打开并看到正常返回，说明 Nginx 已经把外部请求转发到后端。

## 五、阿里云安全组

需要在阿里云安全组中开放：

- 22 端口：SSH 登录服务器
- 80 端口：通过 Nginx 访问后端
- 8001 端口：临时测试 FastAPI，可选

正式部署后，推荐只保留 22 和 80，关闭 8001。

## 六、常用检查命令

查看后端服务状态：

```bash
sudo systemctl status petodo-backend
```

查看后端服务日志：

```bash
journalctl -u petodo-backend -f
```

检查 Nginx 配置：

```bash
sudo nginx -t
```

重启 Nginx：

```bash
sudo systemctl restart nginx
```
