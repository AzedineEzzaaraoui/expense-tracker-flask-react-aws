locals {
  name_prefix = var.project_name
}

data "aws_availability_zones" "available" {}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags = {
    Name = "${local.name_prefix}-public-subnet-1"
  }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true
  tags = {
    Name = "${local.name_prefix}-public-subnet-2"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "backend" {
  name        = "${local.name_prefix}-backend-sg"
  description = "Allow inbound HTTP/SSH for backend"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Backend HTTP"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Allow MySQL access from backend"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "MySQL access"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = [aws_subnet.public.id, aws_subnet.public_2.id]

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier              = "${local.name_prefix}-db"
  engine                  = "mysql"
  engine_version          = "8.0"
  instance_class          = "db.t3.micro"
  allocated_storage       = 20
  username                = "root"
  password                = "password123!"
  db_name                 = "transactions"
  db_subnet_group_name    = aws_db_subnet_group.main.name
  publicly_accessible     = false
  vpc_security_group_ids  = [aws_security_group.rds.id]
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true
}

resource "aws_instance" "backend" {
  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.backend.id]
  associate_public_ip_address = true
  key_name                    = var.ssh_key_name != "" ? var.ssh_key_name : null

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              amazon-linux-extras install -y python3.11
              yum install -y git
              python3 -m pip install --upgrade pip
              python3 -m pip install flask flask-sqlalchemy flask-cors pymysql
              mkdir -p /opt/app
              cd /opt/app
              cat > /opt/app/run.py <<'PY'
              from app import create_app
              app = create_app()
              if __name__ == '__main__':
                  app.run(host='0.0.0.0', port=8080)
              PY
              mkdir -p /opt/app/app
              cat > /opt/app/app/config.py <<'PY'
              import os
              class Config:
                  DB_HOST = os.getenv('DB_HOST', '${aws_db_instance.main.address}')
                  DB_USER = os.getenv('DB_USER', 'root')
                  DB_PASSWORD = os.getenv('DB_PASSWORD', 'password123!')
                  DB_NAME = os.getenv('DB_NAME', 'transactions')
                  SQLALCHEMY_DATABASE_URI = (
                      f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
                  )
                  SQLALCHEMY_TRACK_MODIFICATIONS = False
                  CORS_ORIGINS = '*'
              PY
              cat > /opt/app/app/models.py <<'PY'
              from app import db
              from datetime import datetime
              class Transaction(db.Model):
                  __tablename__ = 'transactions'
                  id = db.Column(db.Integer, primary_key=True, autoincrement=True)
                  amount = db.Column(db.Float, nullable=False)
                  description = db.Column(db.String(255), nullable=False)
                  category = db.Column(db.String(50), nullable=False, default='Autre')
                  created_at = db.Column(db.DateTime, default=datetime.utcnow)
                  def to_dict(self):
                      return {
                          'id': self.id,
                          'amount': self.amount,
                          'description': self.description,
                          'category': self.category,
                          'created_at': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None
                      }
              PY
              cat > /opt/app/app/routes.py <<'PY'
              from flask import Blueprint, request, jsonify
              from app import db
              from app.models import Transaction
              bp = Blueprint('transactions', __name__)
              VALID_CATEGORIES = ['Alimentation', 'Transport', 'Logement', 'Santé', 'Loisirs', 'Autre']
              @bp.route('/health')
              def health():
                  return jsonify({'status': 'UP', 'message': 'API is running'})
              @bp.route('/transaction', methods=['GET'])
              def get_all():
                  transactions = Transaction.query.order_by(Transaction.created_at.desc()).all()
                  return jsonify({'result': [t.to_dict() for t in transactions], 'count': len(transactions)})
              @bp.route('/transaction', methods=['POST'])
              def add():
                  data = request.get_json()
                  if not data:
                      return jsonify({'message': 'Body JSON requis'}), 400
                  if not data.get('amount'):
                      return jsonify({'message': 'Le champ amount est requis'}), 400
                  if not data.get('desc') and not data.get('description'):
                      return jsonify({'message': 'Le champ desc est requis'}), 400
                  try:
                      amount = float(data['amount'])
                      if amount <= 0:
                          return jsonify({'message': 'Le montant doit être positif'}), 400
                  except (ValueError, TypeError):
                      return jsonify({'message': 'Le montant doit être un nombre'}), 400
                  description = data.get('desc') or data.get('description')
                  category = data.get('category', 'Autre')
                  if category not in VALID_CATEGORIES:
                      category = 'Autre'
                  t = Transaction(amount=amount, description=description, category=category)
                  db.session.add(t)
                  db.session.commit()
                  return jsonify({'message': 'Transaction ajoutée avec succès', 'transaction': t.to_dict()}), 201
              @bp.route('/transaction/<int:id>', methods=['GET'])
              def get_by_id(id):
                  t = Transaction.query.get(id)
                  if not t:
                      return jsonify({'message': f'Transaction {id} non trouvée'}), 404
                  return jsonify(t.to_dict())
              @bp.route('/transaction/<int:id>', methods=['DELETE'])
              def delete_by_id(id):
                  t = Transaction.query.get(id)
                  if not t:
                      return jsonify({'message': f'Transaction {id} non trouvée'}), 404
                  db.session.delete(t)
                  db.session.commit()
                  return jsonify({'message': f'Transaction {id} supprimée avec succès'})
              @bp.route('/transaction', methods=['DELETE'])
              def delete_all():
                  count = Transaction.query.count()
                  Transaction.query.delete()
                  db.session.commit()
                  return jsonify({'message': f'{count} transactions supprimées'})
              @bp.app_errorhandler(404)
              def not_found(e):
                  return jsonify({'message': 'Route non trouvée'}), 404
              @bp.app_errorhandler(500)
              def server_error(e):
                  return jsonify({'message': 'Erreur serveur interne'}), 500
              PY
              cat > /opt/app/app/__init__.py <<'PY'
              from flask import Flask
              from flask_sqlalchemy import SQLAlchemy
              from flask_cors import CORS
              from app.config import Config
              db = SQLAlchemy()
              def create_app():
                  app = Flask(__name__)
                  app.config.from_object(Config)
                  CORS(app, resources={
                      r"/*": {
                          "origins": Config.CORS_ORIGINS,
                          "methods": ["GET", "POST", "DELETE", "OPTIONS"],
                          "allow_headers": ["Content-Type", "Authorization"]
                      }
                  })
                  db.init_app(app)
                  from app.routes import bp
                  app.register_blueprint(bp)
                  with app.app_context():
                      db.create_all()
                  return app
              PY
              nohup python3 /opt/app/run.py &
              EOF
}

resource "aws_s3_bucket" "frontend" {
  bucket = "${local.name_prefix}-frontend-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

output "backend_public_ip" {
  description = "Public IP address of the backend EC2 instance"
  value       = aws_instance.backend.public_ip
}

output "backend_url" {
  description = "Public URL for the backend service"
  value       = "http://${aws_instance.backend.public_ip}:8080"
}

output "frontend_bucket_name" {
  description = "Name of the S3 bucket hosting the frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_website_url" {
  description = "Public website endpoint for the frontend"
  value       = "http://${aws_s3_bucket.frontend.bucket}.s3-website-${var.aws_region}.amazonaws.com"
}

output "rds_endpoint" {
  description = "Endpoint address for the RDS MySQL instance"
  value       = aws_db_instance.main.address
}
