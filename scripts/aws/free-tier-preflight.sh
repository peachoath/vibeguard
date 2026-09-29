#!/usr/bin/env bash
# AWS 리소스를 만들지 않는 읽기 전용 비용·환경 사전 점검.
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-2}"
MIN_CREDITS="${MIN_FREE_CREDITS_USD:-10}"

command -v aws >/dev/null || { echo "AWS CLI가 필요합니다."; exit 1; }
aws sts get-caller-identity >/dev/null

PLAN="$(aws freetier get-account-plan-state --region us-east-1 --query accountPlanType --output text)"
STATUS="$(aws freetier get-account-plan-state --region us-east-1 --query accountPlanStatus --output text)"
CREDITS="$(aws freetier get-account-plan-state --region us-east-1 --query accountPlanRemainingCredits.amount --output text)"
EXPIRES="$(aws freetier get-account-plan-state --region us-east-1 --query accountPlanExpirationDate --output text)"

if [ "$PLAN" != "FREE" ] || [ "$STATUS" != "ACTIVE" ]; then
  echo "중단: AWS Free Plan ACTIVE 계정이 아닙니다. plan=${PLAN}, status=${STATUS}"
  exit 1
fi
if ! awk -v credits="$CREDITS" -v minimum="$MIN_CREDITS" 'BEGIN { exit !(credits >= minimum) }'; then
  echo "중단: 남은 무료 크레딧이 USD ${MIN_CREDITS} 미만입니다."
  exit 1
fi

DEFAULT_VPC="$(aws ec2 describe-vpcs --region "$REGION" \
  --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)"
if [ -z "$DEFAULT_VPC" ] || [ "$DEFAULT_VPC" = "None" ]; then
  echo "중단: ${REGION} 리전에 기본 VPC가 없습니다. 새 VPC/NAT 구성은 이 무료 경로에서 만들지 않습니다."
  exit 1
fi

RUNNING="$(aws ec2 describe-instances --region "$REGION" \
  --filters Name=tag:Project,Values=VibeGuard Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'length(Reservations[].Instances[])' --output text)"

echo "AWS 무료 사전 점검 통과"
echo "  plan=${PLAN}/${STATUS}"
echo "  remainingCredits=USD ${CREDITS}"
echo "  expires=${EXPIRES}"
echo "  region=${REGION}"
echo "  defaultVpc=ready"
echo "  existingVibeGuardInstances=${RUNNING}"
