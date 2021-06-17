variable "application" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type    = string
  default = "us-east-2"
}

variable "cloudfront_aliases" {
  type    = list(string)
  default = []
}

variable "acm_certificate_arn" {
  type = string
}

variable "regional_acm_certificate_arn" {
  type = string
}

variable "apig_domain_name" {
  type = string
}

variable "aws_account" {
  type = string
}

variable "cors_origins" {
  type    = list(string)
  default = []
}

variable "username" {
  type      = string
  sensitive = true
}

variable "password" {
  type      = string
  sensitive = true
}
