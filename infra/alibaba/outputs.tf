output "browser_agent_instance_type" {
  description = "The ECS instance type Terraform discovered and used."
  value       = data.alicloud_instance_types.browser_agent.instance_types[0].id
}

output "browser_agent_url" {
  description = "Set as BROWSER_AGENT_URL on the AWS-side orchestrator."
  value       = "http://${alicloud_eip_address.browser_agent.ip_address}:5001"
}

output "browser_agent_ssh" {
  description = "SSH into the box. Runs as root on Alibaba's Ubuntu image."
  value       = "ssh root@${alicloud_eip_address.browser_agent.ip_address}"
}

output "screenshots_bucket_endpoint" {
  description = "OSS endpoint host for the screenshots bucket."
  value       = alicloud_oss_bucket.screenshots.extranet_endpoint
}

output "web_url" {
  description = "Static frontend URL. Sync the Vite build with: ossutil cp -r apps/web/dist oss://<web_bucket>/"
  value       = "http://${var.web_bucket}.oss-website-${var.region}.aliyuncs.com"
}

output "uploader_access_key_id" {
  description = "RAM access key id. Already injected into the ECS user-data, surfaced here for local CLI use."
  value       = alicloud_ram_access_key.uploader.id
  sensitive   = true
}

output "uploader_access_key_secret" {
  value     = alicloud_ram_access_key.uploader.secret
  sensitive = true
}
