terraform {
  required_version = ">= 1.5"
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.220"
    }
  }
}

provider "alicloud" {
  region = var.region
}

# ─── Networking ────────────────────────────────────────────────
# Find any zone that supports VSwitch creation. Then below we discover
# what instance types are actually orderable in that zone.
data "alicloud_zones" "available" {
  available_resource_creation = "VSwitch"
}

# Discover which 4-vCPU/16-GB instance types this account can order.
# The Developers role on Finhack accounts often lacks DescribeAvailableResource,
# so we filter by spec instead and use the first match.
data "alicloud_instance_types" "browser_agent" {
  availability_zone = data.alicloud_zones.available.zones[0].id
  cpu_core_count    = 4
  memory_size       = 16
}

resource "alicloud_vpc" "main" {
  vpc_name   = "tng-rise-vpc"
  cidr_block = "10.10.0.0/16"
}

resource "alicloud_vswitch" "main" {
  vswitch_name = "tng-rise-vswitch"
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = "10.10.1.0/24"
  zone_id      = data.alicloud_zones.available.zones[0].id
}

# ─── Security group ────────────────────────────────────────────
resource "alicloud_security_group" "browser_agent" {
  name        = "tng-rise-browser-agent-sg"
  vpc_id      = alicloud_vpc.main.id
  description = "Browser agent: SSH and FastAPI :5001"
}

resource "alicloud_security_group_rule" "ssh" {
  security_group_id = alicloud_security_group.browser_agent.id
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "22/22"
  cidr_ip           = var.admin_ip_cidr
  policy            = "accept"
}

resource "alicloud_security_group_rule" "browser_agent_api" {
  security_group_id = alicloud_security_group.browser_agent.id
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "5001/5001"
  cidr_ip           = var.orchestrator_ip_cidr
  policy            = "accept"
}

# Public HTTP for nginx serving the Vite static build (Finhack OSS force-download
# workaround). Open to anywhere since this is a public site.
resource "alicloud_security_group_rule" "web_http" {
  security_group_id = alicloud_security_group.browser_agent.id
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "80/80"
  cidr_ip           = "0.0.0.0/0"
  policy            = "accept"
}

# ─── ECS key pair ──────────────────────────────────────────────
resource "alicloud_ecs_key_pair" "main" {
  key_pair_name = "tng-rise"
  public_key    = var.ssh_public_key
}

# ─── ECS instance for browser-agent ────────────────────────────
data "alicloud_images" "ubuntu" {
  owners      = "system"
  name_regex  = "^ubuntu_22_04_x64"
  most_recent = true
}

resource "alicloud_instance" "browser_agent" {
  instance_name        = "tng-rise-browser-agent"
  instance_type        = data.alicloud_instance_types.browser_agent.instance_types[0].id
  image_id             = data.alicloud_images.ubuntu.images[0].id
  vswitch_id           = alicloud_vswitch.main.id
  security_groups      = [alicloud_security_group.browser_agent.id]
  key_name             = alicloud_ecs_key_pair.main.key_pair_name
  instance_charge_type = "PostPaid"

  # t5 burstable doesn't support cloud_essd. cloud_efficiency is SSD-backed
  # and adequate for Docker + Chromium workloads (no IOPS-bound operations).
  system_disk_category = "cloud_efficiency"
  system_disk_size     = 60

  # Public IP comes from the EIP below, not from the instance directly
  internet_max_bandwidth_out = 0

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    git_repo              = var.git_repo
    git_ref               = var.git_ref
    dashscope_api_key     = var.dashscope_api_key
    anthropic_api_key     = var.anthropic_api_key
    oss_region            = "oss-${var.region}"
    oss_bucket            = alicloud_oss_bucket.screenshots.bucket
    oss_endpoint          = "https://oss-${var.region}.aliyuncs.com"
    oss_access_key_id     = alicloud_ram_access_key.uploader.id
    oss_access_key_secret = alicloud_ram_access_key.uploader.secret
  }))
}

resource "alicloud_eip_address" "browser_agent" {
  address_name         = "tng-rise-browser-agent-eip"
  bandwidth            = 10
  internet_charge_type = "PayByTraffic"
}

resource "alicloud_eip_association" "browser_agent" {
  allocation_id = alicloud_eip_address.browser_agent.id
  instance_id   = alicloud_instance.browser_agent.id
}

# ─── OSS: screenshots (browser-agent uploads) ──────────────────
resource "alicloud_oss_bucket" "screenshots" {
  bucket = var.screenshots_bucket
  acl    = "public-read"
}

# ─── OSS: web frontend (Vite static build) ─────────────────────
resource "alicloud_oss_bucket" "web" {
  bucket = var.web_bucket
  acl    = "public-read"

  website {
    index_document = "index.html"
    error_document = "index.html"
  }
}

# ─── RAM user for OSS uploads ──────────────────────────────────
resource "alicloud_ram_user" "uploader" {
  name         = "tng-rise-uploader"
  display_name = "tng-rise-uploader"
}

resource "alicloud_ram_policy" "uploader" {
  policy_name = "tng-rise-oss-uploader"
  policy_document = jsonencode({
    Version = "1"
    Statement = [{
      Effect = "Allow"
      Action = ["oss:PutObject", "oss:GetObject", "oss:ListObjects"]
      Resource = [
        "acs:oss:*:*:${var.screenshots_bucket}",
        "acs:oss:*:*:${var.screenshots_bucket}/*",
      ]
    }]
  })
}

resource "alicloud_ram_user_policy_attachment" "uploader" {
  policy_name = alicloud_ram_policy.uploader.policy_name
  policy_type = "Custom"
  user_name   = alicloud_ram_user.uploader.name
}

resource "alicloud_ram_access_key" "uploader" {
  user_name = alicloud_ram_user.uploader.name
}
