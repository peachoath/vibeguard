#!/usr/bin/env bash
# 보존된 단기 데모 EC2를 다시 시작한다. 시작할 때 공인 IPv4가 새로 배정된다.
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ "${CONFIRM_START:-}" != "YES" ]; then
  echo "시작 전 CONFIRM_START=YES를 지정해야 합니다."
  exit 1
fi

REGION="${AWS_REGION:-ap-northeast-2}"
STACK_NAME="${STACK_NAME:-vibeguard-free-demo}"
KEY_PATH="${KEY_PATH:-${HOME}/.ssh/vibeguard-demo.pem}"

scripts/aws/free-tier-preflight.sh
INSTANCE_ID="$(aws cloudformation describe-stack-resources --region "$REGION" \
  --stack-name "$STACK_NAME" --logical-resource-id VibeGuardInstance \
  --query 'StackResources[0].PhysicalResourceId' --output text)"

aws ec2 start-instances --region "$REGION" --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-status-ok --region "$REGION" --instance-ids "$INSTANCE_ID"
PUBLIC_IP="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"

# 선택 사항: 저장소 루트의 권한 제한 파일로 DuckDNS를 새 공인 IP에 자동 연결한다.
# 토큰은 명령행·로그에 출력하지 않으며 .duckdns.local은 *.local 규칙으로 Git에서 제외된다.
DUCKDNS_ENV="${DUCKDNS_ENV:-.duckdns.local}"
DUCKDNS_HOST=""
if [ -f "$DUCKDNS_ENV" ]; then
  DUCKDNS_DOMAIN="$(awk -F= '$1 == "DUCKDNS_DOMAIN" { sub(/^[^=]*=/, ""); print; exit }' "$DUCKDNS_ENV")"
  DUCKDNS_TOKEN="$(awk -F= '$1 == "DUCKDNS_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' "$DUCKDNS_ENV")"

  if [[ ! "$DUCKDNS_DOMAIN" =~ ^[A-Za-z0-9-]+$ ]] || [ -z "$DUCKDNS_TOKEN" ]; then
    echo "DuckDNS 설정 오류: ${DUCKDNS_ENV}의 DUCKDNS_DOMAIN/DUCKDNS_TOKEN을 확인하세요."
    exit 1
  fi

  DUCKDNS_RESPONSE="$(curl -fsS --get \
    --data-urlencode "domains=${DUCKDNS_DOMAIN}" \
    --data-urlencode "token=${DUCKDNS_TOKEN}" \
    --data-urlencode "ip=${PUBLIC_IP}" \
    https://www.duckdns.org/update)"
  if [ "$DUCKDNS_RESPONSE" != "OK" ]; then
    echo "DuckDNS 갱신 실패(토큰은 출력하지 않음)."
    exit 1
  fi
  DUCKDNS_HOST="${DUCKDNS_DOMAIN}.duckdns.org"
fi

echo "시작 완료: ${INSTANCE_ID}"
echo "  publicIp=${PUBLIC_IP}"
[ -z "$DUCKDNS_HOST" ] || echo "  duckDns=https://${DUCKDNS_HOST}"
echo "  ssh=ssh -i ${KEY_PATH} ubuntu@${PUBLIC_IP}"
echo "  자동 정지 타이머는 부팅 시점부터 다시 계산됩니다."
