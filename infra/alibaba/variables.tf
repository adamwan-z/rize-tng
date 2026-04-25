variable "region" {
  description = "Alibaba Cloud region. ap-southeast-3 = Kuala Lumpur."
  type        = string
  default     = "ap-southeast-3"
}

variable "ecs_instance_type" {
  description = <<-EOT
    Browser-agent ECS size. Default ecs.g6.xlarge (4 vCPU, 16 GB) is generously sized for headless Chromium.
    g7 is newer but not available in ap-southeast-3 (KL) as of 2026-04. g6 is identical performance for this workload.
  EOT
  type        = string
  default     = "ecs.g6.xlarge"
}

variable "screenshots_bucket" {
  description = "OSS bucket for browser-agent screenshots. Must be globally unique."
  type        = string
  default     = "tng-rise-screenshots"
}

variable "web_bucket" {
  description = "OSS bucket hosting the Vite static build. Must be globally unique."
  type        = string
  default     = "tng-rise-web"
}

variable "admin_ip_cidr" {
  description = "Your laptop public IP in CIDR /32 form. Find with: curl https://api.ipify.org"
  type        = string
}

variable "orchestrator_ip_cidr" {
  description = "CIDR allowed to call the browser-agent on :5001. Use the AWS orchestrator's EIP. 0.0.0.0/0 is fine for the demo."
  type        = string
  default     = "0.0.0.0/0"
}

variable "ssh_public_key" {
  description = "Contents of your SSH public key. cat ~/.ssh/id_ed25519.pub"
  type        = string
}

variable "git_repo" {
  description = "Repo cloned by the ECS user-data script."
  type        = string
  default     = "https://github.com/adamwan-z/rize-tng.git"
}

variable "git_ref" {
  description = "Git ref to check out on first boot."
  type        = string
  default     = "main"
}

variable "dashscope_api_key" {
  description = "DashScope API key (Qwen). Used by browser-agent in mode=agent."
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key. Browser-agent fallback when DashScope is absent."
  type        = string
  sensitive   = true
  default     = ""
}
