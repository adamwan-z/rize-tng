output "orchestrator_url" {
  description = "Public URL of the orchestrator. Set as VITE_ORCHESTRATOR_URL in apps/web/.env then rebuild + redeploy frontend."
  value       = "http://${aws_eip.orchestrator.public_ip}:4000"
}

output "orchestrator_ssh" {
  description = "SSH into the box. Default user is 'ubuntu' on AWS Ubuntu AMIs."
  value       = "ssh ubuntu@${aws_eip.orchestrator.public_ip}"
}

output "orchestrator_public_ip" {
  description = "Bare IP. Use this to update the Alibaba browser-agent SG to lock down :5001."
  value       = aws_eip.orchestrator.public_ip
}

output "web_url" {
  description = "Frontend HTTPS URL. CloudFront-distributed, free TLS, cached at APAC+US+EU edges."
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "web_bucket" {
  description = "S3 bucket for the Vite static build. Use with infra/aws/upload-web.py."
  value       = aws_s3_bucket.web.bucket
}

output "web_distribution_id" {
  description = "CloudFront distribution id. Used to invalidate cache on redeploy."
  value       = aws_cloudfront_distribution.web.id
}
