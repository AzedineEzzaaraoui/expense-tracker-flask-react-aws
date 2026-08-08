from app import db
from datetime import datetime

class Transaction(db.Model):
    __tablename__ = 'transactions'

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    amount      = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    category    = db.Column(db.String(50), nullable=False, default='Autre')
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'amount':      self.amount,
            'description': self.description,
            'category':    self.category,
            'created_at':  self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None
        }
