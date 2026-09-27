const vscode = require("vscode");
const { CodexUsageClient } = require("./codex-client");

let client;
let refreshTimer;
let statusItem;

function windowLabel(minutes) {
  if (!minutes) return "사용량";
  if (minutes < 60) return `${minutes}분`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}시간`;
  return `${Math.round(minutes / 1440)}일`;
}

function resetLabel(timestamp) {
  if (!timestamp) return "초기화 시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function bucketsFrom(result) {
  const byId = result?.rateLimitsByLimitId;
  if (byId && Object.keys(byId).length) return Object.values(byId);
  return result?.rateLimits ? [result.rateLimits] : [];
}

function partsFromBucket(bucket) {
  return [bucket?.primary, bucket?.secondary].filter(Boolean).map((limit) => ({
    name: windowLabel(limit.windowDurationMins),
    remaining: Math.max(0, Math.round(100 - Number(limit.usedPercent || 0))),
    used: Math.max(0, Math.round(Number(limit.usedPercent || 0))),
    resetsAt: limit.resetsAt,
  }));
}

function render(result) {
  const buckets = bucketsFrom(result);
  const parts = buckets.flatMap(partsFromBucket);

  if (!parts.length) {
    statusItem.text = "$(pulse) Codex 사용량 없음";
    statusItem.tooltip = "ChatGPT 로그인 사용량을 가져오지 못했습니다. 클릭해서 다시 시도하세요.";
    statusItem.backgroundColor = undefined;
    return;
  }

  const visible = parts.slice(0, 2);
  statusItem.text = `$(pulse) Codex ${visible.map((part) => `${part.name} ${part.remaining}%`).join(" · ")}`;
  statusItem.tooltip = [
    "Codex 남은 사용량",
    ...parts.map((part) => `${part.name}: ${part.remaining}% 남음 (${part.used}% 사용) · ${resetLabel(part.resetsAt)} 초기화`),
    "클릭해서 새로고침",
  ].join("\n");
  statusItem.backgroundColor = parts.some((part) => part.remaining <= 10)
    ? new vscode.ThemeColor("statusBarItem.errorBackground")
    : parts.some((part) => part.remaining <= 25)
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
}

function renderError(error) {
  statusItem.text = "$(warning) Codex 사용량";
  statusItem.tooltip = `사용량을 불러오지 못했습니다: ${error.message}\n클릭해서 다시 시도하세요.`;
  statusItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
}

async function refresh() {
  statusItem.text = "$(sync~spin) Codex 사용량";
  try {
    render(await client.readRateLimits());
  } catch (error) {
    renderError(error);
  }
}

function activate(context) {
  const config = vscode.workspace.getConfiguration("codexUsage");
  client = new CodexUsageClient({ codexPath: config.get("codexPath", "") });
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.name = "Codex Usage";
  statusItem.command = "codexUsage.refresh";
  statusItem.show();

  const refreshCommand = vscode.commands.registerCommand("codexUsage.refresh", refresh);
  const intervalSeconds = Math.max(15, config.get("refreshIntervalSeconds", 60));
  refreshTimer = setInterval(refresh, intervalSeconds * 1000);
  client.on("rateLimits", render);

  context.subscriptions.push(statusItem, refreshCommand, { dispose: () => clearInterval(refreshTimer) }, client);
  refresh();
}

function deactivate() {
  clearInterval(refreshTimer);
  client?.dispose();
}

module.exports = { activate, deactivate };
