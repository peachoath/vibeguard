#!/usr/bin/env bash
# EC2 컴퓨팅·공인 IPv4 사용을 즉시 멈춘다. EBS와 CloudFormation 스택은 유지한다.
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-2}"
STACK_NAME="${STACK_NAME:-vibeguard-free-demo}"

INSTANCE_ID="$(aws cloudformation describe-stack-resources --region "$REGION" \
  --stack-name "$STACK_NAME" --logical-resource-id VibeGuardInstance \
  --query 'StackResources[0].PhysicalResourceId' --output text)"

aws ec2 stop-instances --region "$REGION" --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-stopped --region "$REGION" --instance-ids "$INSTANCE_ID"
echo "정지 완료: ${INSTANCE_ID} (EBS는 유지, 공인 IPv4는 해제됨)"
