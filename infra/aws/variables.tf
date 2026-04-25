variable "region" {
  description = "AWS region. ap-southeast-1 (Singapore) is where Bedrock is enabled for your hackathon account."
  type        = string
  default     = "ap-southeast-1"
}

variable "ec2_instance_type" {
  description = "EC2 size for the orchestrator. t3.small is plenty for one Node process."
  type        = string
  default     = "t3.small"
}

variable "admin_ip_cidr" {
  description = "Your laptop public IP in CIDR /32 form."
  type        = string
}

variable "ssh_public_key" {
  description = "Contents of your SSH public key. cat ~/.ssh/id_ed25519.pub"
  type        = string
}

variable "git_repo" {
  description = "Repo cloned by user-data."
  type        = string
  default     = "https://github.com/adamwan-z/rize-tng.git"
}

variable "git_ref" {
  description = "Git ref to check out."
  type        = string
  default     = "main"
}

variable "browser_agent_url" {
  description = "Public URL of the Alibaba-hosted browser-agent. From: terraform -chdir=../alibaba output browser_agent_url"
  type        = string
  default     = "http://47.250.172.167:5001"
}

variable "aws_access_key_id" {
  description = "AWS access key. Hackathon STS works (starts with ASIA); long-lived IAM key works too (AKIA)."
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "Matching secret access key."
  type        = string
  sensitive   = true
}

variable "aws_session_token" {
  description = "STS session token. Required when access key is STS (ASIA...). Leave empty for long-lived IAM keys."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bedrock_model_id" {
  description = "Bedrock model identifier. Anthropic models on Bedrock require an inference profile, not the bare model ID."
  type        = string
  default     = "global.anthropic.claude-sonnet-4-6"
}
