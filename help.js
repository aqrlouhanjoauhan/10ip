document.addEventListener("DOMContentLoaded", () => {
  const proxyInput = document.getElementById("proxyInput");
  const tokenInput = document.getElementById("tokenInput");
  const saveBtn = document.getElementById("saveBtn");
  const saveTip = document.getElementById("saveTip");

  // 回填已有数据
  chrome.storage.local.get(["rawCurl", "apiToken"], (res) => {
    if (res.rawCurl) proxyInput.value = res.rawCurl;
    if (res.apiToken) tokenInput.value = res.apiToken;
  });

  saveBtn.addEventListener("click", async () => {
    const rawCurl = proxyInput.value.trim();
    const token = tokenInput.value.trim();

    if (!rawCurl && !token) {
      showTip("❌ 请至少填写代理地址命令或 API Token 之一", "#ef4444");
      return;
    }

    saveBtn.innerText = "正在保存并同步...";
    saveBtn.disabled = true;

    try {
      let singleConfig = null;
      if (rawCurl) {
        singleConfig = parseProxyInput(rawCurl);
        if (!singleConfig && !token) {
          throw new Error("代理地址格式不正确，请确保包含 http://用户名:密码@IP:端口");
        }
      }

      // 如果提供了 Token，自动请求 Webshare API 拉取全部节点
      let proxies = [];
      if (token) {
        const res = await fetch("https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=100", {
          headers: { "Authorization": `Token ${token}` }
        });
        if (!res.ok) throw new Error("API Token 无效或网络请求失败，请检查 Token");
        const data = await res.json();
        proxies = data.results || [];
      }

      // 保存至缓存
      const saveData = {
        rawCurl: rawCurl,
        apiToken: token,
        proxies: proxies
      };

      // 默认选中第一个可用节点
      let targetNode = null;
      if (singleConfig) {
        saveData.proxyConfig = singleConfig;
        targetNode = singleConfig;
      } else if (proxies.length > 0) {
        targetNode = {
          host: proxies[0].proxy_address,
          port: proxies[0].port,
          username: proxies[0].username,
          password: proxies[0].password
        };
        saveData.proxyConfig = targetNode;
      }

      chrome.storage.local.set(saveData, () => {
        if (targetNode) {
          chrome.runtime.sendMessage({ action: "enable_proxy", data: targetNode }, () => {
            const extraMsg = proxies.length > 0 ? `，已同步 ${proxies.length} 个节点` : "";
            showTip(`✅ 保存成功！已连接至 ${targetNode.host}:${targetNode.port}${extraMsg}`, "#15803d");
          });
        } else {
          showTip("✅ 保存成功！请在插件面板选择节点开启", "#15803d");
        }
      });
    } catch (err) {
      showTip(`❌ ${err.message}`, "#ef4444");
    } finally {
      saveBtn.innerText = "保存并同步节点至插件";
      saveBtn.disabled = false;
    }
  });

  function showTip(msg, color) {
    saveTip.style.display = "block";
    saveTip.style.color = color;
    saveTip.innerText = msg;
  }
});

// 正则解析 curl 格式中的代理凭证
function parseProxyInput(text) {
  const regex = /https?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/;
  const match = text.match(regex);
  if (match) {
    return {
      username: match[1],
      password: match[2],
      host: match[3],
      port: match[4]
    };
  }
  return null;
}
