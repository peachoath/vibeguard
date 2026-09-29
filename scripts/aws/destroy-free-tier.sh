#!/usr/bin/env bash
# CloudFormation 스택과 EC2/EBS/보안그룹을 함께 제거한다. SSH key pair는 보존한다.
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-2}"
STACK_NAME="${STACK_NAME:-vibeguard-free-demo}"

if [ "${CONFIRM_DESTROY:-}" != "YES" ]; then
  echo "삭제 전 CONFIRM_DESTROY=YES를 지정해야 합니다."
  exit 1
fi

aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK_NAME"
aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$STACK_NAME"
echo "삭제 완료: ${STACK_NAME} (EC2, 루트 EBS, 보안그룹 제거; key pair는 보존)"
