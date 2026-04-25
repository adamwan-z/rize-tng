terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# ─── Networking ────────────────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "tng-rise-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = { Name = "tng-rise-subnet-public" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "tng-rise-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "tng-rise-rt-public" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ─── Security group ────────────────────────────────────────────
resource "aws_security_group" "orchestrator" {
  name        = "tng-rise-orchestrator-sg"
  description = "Orchestrator: SSH (admin), :4000 (frontend)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH from admin IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_ip_cidr]
  }

  ingress {
    description = "Orchestrator API for the public frontend"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound (Bedrock, GitHub, browser-agent on Alibaba)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "tng-rise-orchestrator-sg" }
}

# ─── SSH key pair ──────────────────────────────────────────────
resource "aws_key_pair" "main" {
  key_name   = "tng-rise"
  public_key = var.ssh_public_key
}

# ─── EC2 instance for orchestrator ─────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_instance" "orchestrator" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.ec2_instance_type
  subnet_id     = aws_subnet.public.id
  key_name      = aws_key_pair.main.key_name

  vpc_security_group_ids = [aws_security_group.orchestrator.id]

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = templatefile("${path.module}/user-data.sh", {
    git_repo              = var.git_repo
    git_ref               = var.git_ref
    aws_region            = var.region
    aws_access_key_id     = var.aws_access_key_id
    aws_secret_access_key = var.aws_secret_access_key
    aws_session_token     = var.aws_session_token
    bedrock_model_id      = var.bedrock_model_id
    browser_agent_url     = var.browser_agent_url
  })

  tags = { Name = "tng-rise-orchestrator" }
}

resource "aws_eip" "orchestrator" {
  domain = "vpc"
  tags   = { Name = "tng-rise-orchestrator-eip" }
}

resource "aws_eip_association" "orchestrator" {
  instance_id   = aws_instance.orchestrator.id
  allocation_id = aws_eip.orchestrator.id
}

# ─── S3 + CloudFront for the frontend ──────────────────────────
# CloudFront fronts a private S3 bucket via Origin Access Control. Bucket
# stays locked down, CloudFront serves over HTTPS with a free *.cloudfront.net
# cert. Same-cloud as the orchestrator so the cross-cloud diagram stays clean.

resource "random_id" "web_bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "web" {
  bucket        = "tng-rise-web-${random_id.web_bucket_suffix.hex}"
  force_destroy = true

  tags = { Name = "tng-rise-web" }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "tng-rise-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"  # APAC + US + EU edges (cheaper than All)
  comment             = "tng-rise frontend"

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-tng-rise-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  # Second origin: the EC2 orchestrator. CloudFront routes /chat and /health
  # to it, leaving everything else going to S3. CloudFront uses the EC2's
  # auto-generated public DNS name (raw IPs aren't allowed as origins).
  origin {
    domain_name = aws_eip.orchestrator.public_dns
    origin_id   = "ec2-orchestrator"

    custom_origin_config {
      http_port              = 4000
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_keepalive_timeout = 60
      origin_read_timeout      = 60
    }
  }

  # SSE-friendly cache behavior for /chat: caching disabled, all viewer
  # headers/cookies forwarded, all HTTP methods allowed.
  ordered_cache_behavior {
    path_pattern             = "/chat"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "ec2-orchestrator"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = false  # SSE streaming + gzip don't mix

    # AWS-managed policies. CachingDisabled = no caching; AllViewer = forward
    # all viewer headers/cookies/query strings to the origin.
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3"
  }

  ordered_cache_behavior {
    path_pattern             = "/health"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "ec2-orchestrator"
    viewer_protocol_policy   = "redirect-to-https"
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-tng-rise-web"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 300
    max_ttl     = 3600
  }

  # SPA fallback: route any 403/404 from S3 (e.g. /some/route) to index.html
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = { Name = "tng-rise-web-cdn" }
}

# Bucket policy allows the specific CloudFront distribution to read objects
resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.web.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.web.arn
        }
      }
    }]
  })
}
