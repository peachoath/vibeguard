#!/usr/bin/env bash
# VibeGuard 단기 EC2 데모 스택 배포. 무료 크레딧을 사용하므로 명시적 확인이 필요하다.
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ "${CONFIRM_FREE_PLAN_DEPLOY:-}" != "YES" ]; then
  echo "실행 전 CONFIRM_FREE_PLAN_DEPLOY=YES를 지정해야 합니다."
  exit 1
fi

REGION="${AWS_REGION:-ap-northeast-2}"
STACK_NAME="${STACK_NAME:-vibeguard-free-demo}"
KEY_NAME="${KEY_NAME:-vibeguard-demo}"
KEY_PATH="${KEY_PATH:-${HOME}/.ssh/vibeguard-demo.pem}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"
AUTO_STOP_HOURS="${AUTO_STOP_HOURS:-6}"
GIT_BRANCH="${GIT_BRANCH:-docs/deploy-target-ec2}"
SSH_CIDR="${SSH_CIDR:-$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32}"

scripts/aws/free-tier-preflight.sh

if ! aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" >/dev/null 2>&1; then
  mkdir -p "$(dirname "$KEY_PATH")"
  umask 077
  aws ec2 create-key-pair --region "$REGION" --key-name "$KEY_NAME" \
    --key-type ed25519 --query KeyMaterial --output text >"$KEY_PATH"
  chmod 600 "$KEY_PATH"
  echo "SSH 키 생성: ${KEY_PATH} (재발급 불가, 안전하게 보관)"
elif [ ! -f "$KEY_PATH" ]; then
  echo "AWS key pair '${KEY_NAME}'은 있지만 로컬 개인키 ${KEY_PATH}가 없습니다."
  echo "다른 KEY_NAME/KEY_PATH를 지정하거나 기존 개인키를 복구하세요."
  exit 1
fi

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file infra/aws/ec2-free-tier.yml \
  --parameter-overrides \
    KeyName="$KEY_NAME" SSHCidr="$SSH_CIDR" InstanceType="$INSTANCE_TYPE" \
    AutoStopHours="$AUTO_STOP_HOURS" GitBranch="$GIT_BRANCH" \
  --tags Project=VibeGuard CostGuard=ShortLivedDemo

PUBLIC_IP="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicIp`].OutputValue' --output text)"

echo "배포 완료"
echo "  publicIp=${PUBLIC_IP}"
echo "  autoStop=${AUTO_STOP_HOURS}h"
echo "  ssh=ssh -i ${KEY_PATH} ubuntu@${PUBLIC_IP}"
echo "작업 종료 후 반드시: scripts/aws/destroy-free-tier.sh"
