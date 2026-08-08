
# 💸 Expense Tracker

Application de suivi de dépenses full-stack, déployée sur AWS avec une infrastructure gérée en Terraform.

## Stack technique
- **Frontend** : React + Vite
- **Backend** : Flask (Python) + SQLAlchemy
- **Base de données** : MySQL sur Amazon RDS
- **Infra** : Terraform (VPC, EC2, RDS, security groups)
- **Déploiement** : Docker + Amazon ECR
- **Accès sécurisé** : AWS Systems Manager (SSM Session Manager) — pas de SSH exposé

## Fonctionnalités
- Ajout, listing, suppression de transactions
- Statistiques (total, moyenne, maximum, nombre)
- Catégorisation des dépenses (Alimentation, Transport, Logement, Santé, Loisirs, Autre)

## Architecture
Frontend React → Backend Flask (conteneurisé sur EC2) → RDS MySQL

## ⚠️ Note
Projet de démonstration/apprentissage — les identifiants de démo ne doivent pas être utilisés en production. Voir les issues pour la roadmap (Secrets Manager, multi-tenancy, CI/CD).
