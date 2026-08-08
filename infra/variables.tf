variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "expense-tracker"
}

variable "ssh_key_name" {
  description = "SSH key pair name for backend EC2 access (optional)"
  type        = string
  default     = ""
}
