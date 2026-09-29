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

echo "시작 완료: ${INSTANCE_ID}"
echo "  publicIp=${PUBLIC_IP}"
echo "  ssh=ssh -i ${KEY_PATH} ubuntu@${PUBLIC_IP}"
echo "  자동 정지 타이머는 부팅 시점부터 다시 계산됩니다."
